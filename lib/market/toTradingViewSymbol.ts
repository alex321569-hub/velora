import { stockUniverse } from "./stockUniverse";
import type { StockUniverseItem } from "./types";
import { stripKoreaSuffix, toTradingViewSymbolForStock } from "./toTradingViewSymbolCore";

function getUniverseItem(symbol: string) {
  const normalizedSymbol = stripKoreaSuffix(symbol);
  return stockUniverse.find((item) => stripKoreaSuffix(item.symbol) === normalizedSymbol) ?? null;
}

export function toTradingViewSymbol(symbol: string, stock?: StockUniverseItem | null): string | null {
  const universeItem = stock ?? getUniverseItem(symbol);
  return toTradingViewSymbolForStock(symbol, universeItem);
}
