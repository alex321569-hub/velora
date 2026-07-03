import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type AssetType = "stock" | "etf";

type GeneratedStock = {
  symbol: string;
  name: string;
  exchange: string;
  country: "US";
  assetType: AssetType;
  sector: string;
  industry: string;
  aliases: string[];
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = join(__dirname, "..", "lib", "market", "generated", "stockUniverse.json");

const sources = [
  {
    url: "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt",
    kind: "nasdaq" as const,
  },
  {
    url: "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt",
    kind: "other" as const,
  },
];

const exchangeNames: Record<string, string> = {
  Q: "NASDAQ",
  N: "NYSE",
  A: "AMEX",
  P: "NYSEARCA",
  Z: "BATS",
  V: "IEX",
};

function cleanName(value: string): string {
  return value
    .replace(/\s+-\s+.*$/g, "")
    .replace(/\s+(Common Stock|Ordinary Shares|Class [A-Z]+|American Depositary Shares|Depositary Shares).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferAssetType(name: string, etfFlag: string): AssetType {
  if (etfFlag.toUpperCase() === "Y") return "etf";
  if (/\b(ETF|ETN)\b/i.test(name)) return "etf";
  if (/\bExchange Traded Fund\b/i.test(name)) return "etf";
  return "stock";
}

function inferSectorIndustry(name: string, assetType: AssetType): { sector: string; industry: string } {
  if (assetType === "etf") return { sector: "ETF", industry: "Exchange Traded Fund" };

  const lowerName = name.toLowerCase();
  if (/(bank|financial|capital|credit|insurance|bancorp)/.test(lowerName)) return { sector: "Financials", industry: "Financial Services" };
  if (/(bio|pharma|therapeutics|health|medical|surgical|genomics)/.test(lowerName)) return { sector: "Healthcare", industry: "Healthcare" };
  if (/(ase technology|semiconductor|chip|silicon)/.test(lowerName)) return { sector: "Semiconductor", industry: "Semiconductor" };
  if (/(technology|software|systems|data|cloud|cyber)/.test(lowerName)) return { sector: "Technology", industry: "Technology" };
  if (/(energy|oil|gas|petroleum|solar|power)/.test(lowerName)) return { sector: "Energy", industry: "Energy" };
  if (/(reit|realty|properties|property|real estate)/.test(lowerName)) return { sector: "Real Estate", industry: "Real Estate" };
  if (/(airline|aerospace|defense|industrial|machinery|rail|logistics|shipping)/.test(lowerName)) return { sector: "Industrials", industry: "Industrials" };
  if (/(materials|steel|chemical|mining|gold|copper)/.test(lowerName)) return { sector: "Materials", industry: "Materials" };
  if (/(utility|utilities|water|electric)/.test(lowerName)) return { sector: "Utilities", industry: "Utilities" };
  if (/(retail|consumer|restaurant|food|auto|motor|entertainment|media)/.test(lowerName)) return { sector: "Consumer", industry: "Consumer" };

  return { sector: "Other", industry: "Other" };
}

function parsePipeTable(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("File Creation Time") && !line.startsWith("Symbol|") && !line.startsWith("ACT Symbol|"))
    .map((line) => line.split("|"));
}

function toGeneratedStock(symbol: string, rawName: string, exchange: string, etfFlag: string, testIssueFlag: string): GeneratedStock | null {
  const normalizedSymbol = symbol.trim();
  const name = cleanName(rawName);

  if (!normalizedSymbol || !name || normalizedSymbol.includes("$")) return null;
  if (testIssueFlag.toUpperCase() === "Y") return null;
  if (/test issue/i.test(name)) return null;

  const assetType = inferAssetType(rawName, etfFlag);
  const { sector, industry } = inferSectorIndustry(rawName, assetType);

  return {
    symbol: normalizedSymbol,
    name,
    exchange,
    country: "US",
    assetType,
    sector,
    industry,
    aliases: Array.from(new Set([normalizedSymbol, name, rawName.trim()].filter(Boolean))),
  };
}

async function fetchSource(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "text/plain,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

async function main() {
  const stocks = new Map<string, GeneratedStock>();

  for (const source of sources) {
    const text = await fetchSource(source.url);
    const rows = parsePipeTable(text);

    for (const row of rows) {
      const item =
        source.kind === "nasdaq"
          ? toGeneratedStock(row[0] ?? "", row[1] ?? "", "NASDAQ", row[6] ?? "N", row[3] ?? "N")
          : toGeneratedStock(row[0] ?? "", row[1] ?? "", exchangeNames[row[2] ?? ""] ?? "OTHER", row[4] ?? "N", row[6] ?? "N");

      if (item) stocks.set(item.symbol, item);
    }
  }

  const payload = Array.from(stocks.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
  const etfCount = payload.filter((item) => item.assetType === "etf").length;
  const suspiciousEtfCount = payload.filter(
    (item) =>
      item.assetType === "etf" &&
      /(American Depositary Shares?|Depositary Shares|Common Shares?|Ordinary Shares?|Class A Ordinary Shares)/i.test(
        [item.name, item.sector, item.industry, ...item.aliases].join(" "),
      ),
  ).length;
  const depositaryOrOrdinaryEtfCount = payload.filter(
    (item) =>
      item.assetType === "etf" &&
      /(American Depositary Shares?|Depositary Shares|Ordinary Shares?|Class A Ordinary Shares)/i.test(
        [item.name, item.sector, item.industry, ...item.aliases].join(" "),
      ),
  ).length;

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Wrote ${payload.length.toLocaleString()} symbols to ${outputPath}`);
  console.log(`ETF count: ${etfCount.toLocaleString()}`);
  console.log(`Suspicious ADR/common/ordinary share ETFs: ${suspiciousEtfCount.toLocaleString()}`);
  console.log(`Depositary/ordinary share ETFs: ${depositaryOrOrdinaryEtfCount.toLocaleString()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
