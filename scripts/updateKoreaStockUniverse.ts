import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type Exchange = "KOSPI" | "KOSDAQ";

interface KoreaStockUniverseItem {
  symbol: string;
  name: string;
  koreanName: string;
  exchange: Exchange;
  country: "KR";
  assetType: "stock";
  sector: string;
  industry: string;
  aliases: string[];
}

const outputPath = path.join(process.cwd(), "lib", "market", "generated", "koreaStockUniverse.json");
const kindUrl = "https://kind.krx.co.kr/corpgeneral/corpList.do?method=download";

const marketDownloads: Array<{ marketType: string; exchange: Exchange }> = [
  { marketType: "stockMkt", exchange: "KOSPI" },
  { marketType: "kosdaqMkt", exchange: "KOSDAQ" },
];

function stripTags(value: string) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .trim();
}

function parseHtmlTable(html: string): string[][] {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((row) => [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => stripTags(cell[1])))
    .filter((cells) => cells.length > 0);
}

function normalizeSymbol(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.padStart(6, "0").slice(-6);
}

function createAliases(symbol: string, koreanName: string, exchange: Exchange) {
  const suffix = exchange === "KOSDAQ" ? "KQ" : "KS";
  const aliases = [symbol, `${symbol}.${suffix}`, koreanName, koreanName.replace(/\s+/g, "")];
  return Array.from(new Set(aliases.filter(Boolean)));
}

function rowsToItems(rows: string[][], exchange: Exchange): KoreaStockUniverseItem[] {
  const [headers, ...body] = rows;
  const nameIndex = headers.indexOf("회사명");
  const symbolIndex = headers.indexOf("종목코드");
  const industryIndex = headers.indexOf("업종");

  if (nameIndex < 0 || symbolIndex < 0) {
    throw new Error(`Unexpected KRX table format for ${exchange}`);
  }

  return body
    .map((cells): KoreaStockUniverseItem | null => {
      const koreanName = cells[nameIndex]?.trim();
      const symbol = normalizeSymbol(cells[symbolIndex] ?? "");
      const industry = cells[industryIndex]?.trim() || "Other";

      if (!koreanName || !/^[0-9]{6}$/.test(symbol)) {
        return null;
      }

      return {
        symbol,
        name: koreanName,
        koreanName,
        exchange,
        country: "KR",
        assetType: "stock",
        sector: industry,
        industry,
        aliases: createAliases(symbol, koreanName, exchange),
      };
    })
    .filter((item): item is KoreaStockUniverseItem => item !== null);
}

async function fetchKrxItems(marketType: string, exchange: Exchange) {
  const url = `${kindUrl}&marketType=${marketType}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/vnd.ms-excel,text/html,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`KRX KIND download failed for ${exchange}: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const html = new TextDecoder("euc-kr").decode(buffer);
  return rowsToItems(parseHtmlTable(html), exchange);
}

function readLocalJson(inputPath: string): KoreaStockUniverseItem[] {
  const items = JSON.parse(readFileSync(inputPath, "utf8")) as KoreaStockUniverseItem[];
  return items.map((item) => ({
    ...item,
    symbol: normalizeSymbol(item.symbol),
    aliases: createAliases(normalizeSymbol(item.symbol), item.koreanName, item.exchange),
  }));
}

async function main() {
  const inputPath = process.argv[2] ?? process.env.KRX_LISTING_JSON;
  const rawItems = inputPath
    ? readLocalJson(inputPath)
    : (await Promise.all(marketDownloads.map((market) => fetchKrxItems(market.marketType, market.exchange)))).flat();

  const dedupedItems = Array.from(new Map(rawItems.map((item) => [`${item.symbol}:${item.exchange}`, item])).values()).sort((a, b) =>
    a.symbol.localeCompare(b.symbol),
  );

  writeFileSync(outputPath, `${JSON.stringify(dedupedItems, null, 2)}\n`, "utf8");

  const kospiCount = dedupedItems.filter((item) => item.exchange === "KOSPI").length;
  const kosdaqCount = dedupedItems.filter((item) => item.exchange === "KOSDAQ").length;
  console.log(`Wrote ${dedupedItems.length} Korean listings to ${outputPath}`);
  console.log(`KOSPI: ${kospiCount}`);
  console.log(`KOSDAQ: ${kosdaqCount}`);
}

void main();
