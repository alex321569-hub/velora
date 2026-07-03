import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type Row = Record<string, string>;

interface KoreaStockUniverseItem {
  symbol: string;
  name: string;
  koreanName: string;
  exchange: "KOSPI" | "KOSDAQ";
  country: "KR";
  assetType: "stock" | "etf";
  sector: string;
  industry: string;
  aliases: string[];
}

const inputPath = process.argv[2] ?? process.env.KRX_LISTING_CSV;
const outputPath = path.join(process.cwd(), "lib", "market", "generated", "koreaStockUniverse.json");

if (!inputPath) {
  throw new Error("Usage: pnpm update:korea-stock-universe <krx-listing.csv>");
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function parseCsv(content: string): Row[] {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function pick(row: Row, keys: string[]) {
  return keys.map((key) => row[key]).find((value) => value && value.trim())?.trim() ?? "";
}

function normalizeExchange(value: string): "KOSPI" | "KOSDAQ" | null {
  const upper = value.toUpperCase();
  if (upper.includes("KOSDAQ") || upper.includes("코스닥")) return "KOSDAQ";
  if (upper.includes("KOSPI") || upper.includes("유가") || upper.includes("코스피")) return "KOSPI";
  return null;
}

function normalizeSymbol(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.padStart(6, "0").slice(-6);
}

const rows = parseCsv(readFileSync(inputPath, "utf8"));
const items = rows
  .map((row): KoreaStockUniverseItem | null => {
    const rawSymbol = pick(row, ["symbol", "Symbol", "종목코드", "단축코드", "Code", "code"]);
    const koreanName = pick(row, ["koreanName", "Korean Name", "한글 종목명", "종목명", "Name", "name"]);
    const exchange = normalizeExchange(pick(row, ["exchange", "Exchange", "시장구분", "시장", "Market", "market"]));
    const sector = pick(row, ["sector", "Sector", "업종", "industry", "Industry"]) || "Other";
    const industry = pick(row, ["industry", "Industry", "업종명", "업종"]) || sector;

    if (!rawSymbol || !koreanName || !exchange) return null;

    const symbol = normalizeSymbol(rawSymbol);
    const suffix = exchange === "KOSDAQ" ? "KQ" : "KS";

    return {
      symbol,
      name: koreanName,
      koreanName,
      exchange,
      country: "KR",
      assetType: "stock",
      sector,
      industry,
      aliases: [symbol, `${symbol}.${suffix}`, koreanName],
    };
  })
  .filter((item): item is KoreaStockUniverseItem => item !== null)
  .sort((a, b) => a.symbol.localeCompare(b.symbol));

writeFileSync(outputPath, `${JSON.stringify(items, null, 2)}\n`, "utf8");
console.log(`Wrote ${items.length} Korean listings to ${outputPath}`);
