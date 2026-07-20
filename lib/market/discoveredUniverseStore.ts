import { promises as fs } from "fs";
import path from "path";
import type { StockUniverseItem } from "./types";

const cacheFilePath = process.env.DISCOVERED_STOCK_UNIVERSE_PATH
  ? path.resolve(process.env.DISCOVERED_STOCK_UNIVERSE_PATH)
  : path.join(process.cwd(), ".data", "discovered-stock-universe.json");

let memoryCache: StockUniverseItem[] | null = null;

function normalizeCacheSymbol(symbol: string) {
  return symbol.trim().toUpperCase().replace(/\.(KS|KQ)$/i, "");
}

function sanitizeStock(item: StockUniverseItem): StockUniverseItem {
  const symbol = normalizeCacheSymbol(item.symbol);
  const aliases = Array.from(
    new Set([symbol, item.symbol, item.name, item.koreanName, ...item.aliases].filter((value): value is string => Boolean(value?.trim()))),
  );

  return {
    ...item,
    symbol,
    aliases,
  };
}

async function readCacheFile(): Promise<StockUniverseItem[]> {
  try {
    const raw = await fs.readFile(cacheFilePath, "utf8");
    const parsed = JSON.parse(raw) as StockUniverseItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeStock);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("[market:discovered-cache] read failed", error);
    }
    return [];
  }
}

async function writeCacheFile(items: StockUniverseItem[]) {
  await fs.mkdir(path.dirname(cacheFilePath), { recursive: true });
  await fs.writeFile(cacheFilePath, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

export async function getDiscoveredStocks(): Promise<StockUniverseItem[]> {
  if (memoryCache) return memoryCache;
  memoryCache = await readCacheFile();
  return memoryCache;
}

export async function upsertDiscoveredStock(item: StockUniverseItem): Promise<void> {
  const sanitized = sanitizeStock(item);
  const current = await getDiscoveredStocks();
  const nextBySymbol = new Map(current.map((stock) => [normalizeCacheSymbol(stock.symbol), stock]));
  const existing = nextBySymbol.get(sanitized.symbol);

  nextBySymbol.set(sanitized.symbol, {
    ...existing,
    ...sanitized,
    aliases: Array.from(new Set([...(existing?.aliases ?? []), ...sanitized.aliases])),
  });

  memoryCache = Array.from(nextBySymbol.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));

  try {
    await writeCacheFile(memoryCache);
  } catch (error) {
    console.warn("[market:discovered-cache] write failed; keeping in memory only", error);
  }
}

export function getDiscoveredStockCachePath() {
  return cacheFilePath;
}
