import { normalizeKoreanCode } from "./symbolUtils";
import { stockUniverse } from "./stockUniverse";
import type { SearchFilter, StockUniverseItem } from "./types";

interface SearchIndexItem {
  stock: StockUniverseItem;
  symbol: string;
  name: string;
  koreanName: string;
  aliases: string[];
  haystack: string;
  filterTokens: string[];
}

interface RankedStock {
  stock: StockUniverseItem;
  score: number;
}

export const baseSearchFilters: Array<{ id: SearchFilter; label: string }> = [
  { id: "all", label: "전체" },
  { id: "us", label: "미국" },
  { id: "kr", label: "한국" },
  { id: "etf", label: "ETF" },
];

export const sectorSearchFilters: Array<{ id: SearchFilter; label: string }> = [
  { id: "Technology", label: "Technology" },
  { id: "Semiconductor", label: "Semiconductor" },
  { id: "Healthcare", label: "Healthcare" },
  { id: "Financials", label: "Financials" },
  { id: "Energy", label: "Energy" },
  { id: "Consumer", label: "Consumer" },
  { id: "Industrials", label: "Industrials" },
  { id: "Materials", label: "Materials" },
  { id: "Utilities", label: "Utilities" },
  { id: "Real Estate", label: "Real Estate" },
  { id: "Defense", label: "Defense" },
  { id: "Aerospace", label: "Aerospace" },
  { id: "AI", label: "AI" },
  { id: "Bio", label: "Bio" },
  { id: "EV", label: "EV" },
  { id: "Software", label: "Software" },
  { id: "Cloud", label: "Cloud" },
  { id: "Cybersecurity", label: "Cybersecurity" },
];

export function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
}

export function normalizeSymbolInput(value: string): string {
  return value.trim().toUpperCase().replace(/\.(KS|KQ)$/i, "");
}

export function isTickerLikeInput(value: string): boolean {
  const trimmed = value.trim();
  return /^[A-Za-z][A-Za-z0-9.-]{0,11}$/.test(trimmed) || /^A?[0-9]{1,6}(\.(KS|KQ))?$/i.test(trimmed);
}

function createSearchIndex(universe: StockUniverseItem[] = stockUniverse): SearchIndexItem[] {
  return universe.map((stock) => {
    const aliases = stock.aliases.map(normalizeText);
    const filterTokens = [stock.sector, stock.industry, stock.assetType, stock.country].map(normalizeText);

    return {
      stock,
      symbol: normalizeText(stock.symbol),
      name: normalizeText(stock.name),
      koreanName: normalizeText(stock.koreanName),
      aliases,
      haystack: [stock.symbol, stock.name, stock.koreanName, stock.exchange, stock.country, stock.sector, stock.industry, stock.assetType, ...stock.aliases]
        .map(normalizeText)
        .join("|"),
      filterTokens,
    };
  });
}

const searchIndex = createSearchIndex();

function levenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));

  for (let index = 0; index <= a.length; index += 1) matrix[index][0] = index;
  for (let index = 0; index <= b.length; index += 1) matrix[0][index] = index;

  for (let row = 1; row <= a.length; row += 1) {
    for (let column = 1; column <= b.length; column += 1) {
      const substitutionCost = a[row - 1] === b[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + substitutionCost,
      );
    }
  }

  return matrix[a.length][b.length];
}

function normalizeRecommendationSymbol(symbol: string): string {
  return normalizeText(symbol).replace(/\.(ks|kq)$/i, "");
}

function matchesFilter(item: SearchIndexItem, filter: SearchFilter): boolean {
  if (filter === "all") return true;
  if (filter === "us") return item.stock.country === "US";
  if (filter === "kr") return item.stock.country === "KR";
  if (filter === "etf") return item.stock.assetType === "etf";

  const normalizedFilter = normalizeText(filter);
  return item.filterTokens.some((token) => token.includes(normalizedFilter) || normalizedFilter.includes(token));
}

export function stockMatchesFilter(stock: StockUniverseItem, filter: SearchFilter): boolean {
  const item = searchIndex.find((indexItem) => normalizeSymbolInput(indexItem.stock.symbol) === normalizeSymbolInput(stock.symbol));
  return item ? matchesFilter(item, filter) : false;
}

export function getStockByRecommendationSymbol(symbol: string): StockUniverseItem | null {
  const normalizedSymbol = normalizeRecommendationSymbol(symbol);
  const exactMatch = searchIndex.find((item) => normalizeRecommendationSymbol(item.stock.symbol) === normalizedSymbol);
  if (exactMatch) return exactMatch.stock;

  return getBestMatch(symbol) ?? getBestMatch(normalizedSymbol);
}

function getSearchScore(item: SearchIndexItem, query: string): number {
  const normalizedQuery = normalizeText(query);
  const boost = item.stock.searchBoost ?? 0;

  if (item.symbol === normalizedQuery) return 10000 + boost;
  if (item.koreanName === normalizedQuery) return 9500 + boost;
  if (item.name === normalizedQuery) return 9000 + boost;
  if (item.aliases.some((alias) => alias === normalizedQuery)) return 8800 + boost;
  if (item.symbol.startsWith(normalizedQuery)) return 8500 + boost - (item.symbol.length - normalizedQuery.length);

  const nameTargets = [item.koreanName, item.name, ...item.aliases];
  const partialScore = nameTargets.reduce((best, target) => {
    const index = target.indexOf(normalizedQuery);
    if (index < 0) return best;

    const score = 5000 - index * 8 - Math.max(0, target.length - normalizedQuery.length);
    return Math.max(best, score);
  }, 0);

  if (partialScore > 0) return partialScore + boost;

  if (normalizedQuery.length >= 2) {
    const fuzzyTargets = [item.symbol, item.koreanName, item.name, ...item.aliases].slice(0, 8);
    const bestDistance = Math.min(
      ...fuzzyTargets.map((target) => levenshteinDistance(normalizedQuery, target.slice(0, normalizedQuery.length + 2))),
    );
    const fuzzyThreshold = normalizedQuery.length <= 4 ? 1 : 2;

    if (bestDistance <= fuzzyThreshold) return 3000 - bestDistance * 140 + boost;
  }

  return 0;
}

function rankStocksInIndex(searchItems: SearchIndexItem[], query: string, filter: SearchFilter = "all"): RankedStock[] {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return [];

  return searchItems
    .filter((item) => matchesFilter(item, filter))
    .map((item) => ({ stock: item.stock, score: getSearchScore(item, query) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.stock.symbol.localeCompare(b.stock.symbol));
}

function rankStocks(query: string, filter: SearchFilter = "all"): RankedStock[] {
  return rankStocksInIndex(searchIndex, query, filter);
}

function createKoreanDirectTicker(query: string): StockUniverseItem | null {
  const normalizedSymbol = normalizeKoreanCode(query);
  if (!normalizedSymbol) return null;

  return {
    symbol: normalizedSymbol,
    name: normalizedSymbol,
    koreanName: normalizedSymbol,
    exchange: "KOSPI/KOSDAQ",
    country: "KR",
    assetType: "stock",
    sector: "Other",
    industry: "KOSPI/KOSDAQ",
    aliases: [normalizedSymbol, `${normalizedSymbol}.KS`, `${normalizedSymbol}.KQ`],
  };
}

export function searchStocksByAlias(query: string, filter: SearchFilter = "all"): StockUniverseItem[] {
  const results = rankStocks(query, filter).map((result) => result.stock);
  const directTicker = createKoreanDirectTicker(query);
  if (results.length === 0 && directTicker && (filter === "all" || filter === "kr")) {
    return [directTicker];
  }

  return results;
}

export function searchStocksByAliasInUniverse(query: string, universe: StockUniverseItem[], filter: SearchFilter = "all"): StockUniverseItem[] {
  const results = rankStocksInIndex(createSearchIndex(universe), query, filter).map((result) => result.stock);
  const directTicker = createKoreanDirectTicker(query);
  if (results.length === 0 && directTicker && (filter === "all" || filter === "kr")) {
    return [directTicker];
  }

  return results;
}

export function getBestMatch(query: string, filter: SearchFilter = "all"): StockUniverseItem | null {
  const results = rankStocks(query, filter);
  const directTicker = createKoreanDirectTicker(query);
  if (results.length === 0 && directTicker && (filter === "all" || filter === "kr")) {
    return directTicker;
  }

  if (results.length === 0) return null;
  return results[0].score >= 6500 || results.length === 1 ? results[0].stock : null;
}

export function getBestMatchInUniverse(query: string, universe: StockUniverseItem[], filter: SearchFilter = "all"): StockUniverseItem | null {
  const results = rankStocksInIndex(createSearchIndex(universe), query, filter);
  const directTicker = createKoreanDirectTicker(query);
  if (results.length === 0 && directTicker && (filter === "all" || filter === "kr")) {
    return directTicker;
  }

  if (results.length === 0) return null;
  return results[0].score >= 6500 || results.length === 1 ? results[0].stock : null;
}

export function getAutocompleteResults(query: string, limit = 8, filter: SearchFilter = "all"): StockUniverseItem[] {
  const results = rankStocks(query, filter)
    .slice(0, limit)
    .map((result) => result.stock);
  const directTicker = createKoreanDirectTicker(query);
  if (results.length === 0 && directTicker && (filter === "all" || filter === "kr")) {
    return [directTicker];
  }

  return results;
}

export function getAutocompleteResultsInUniverse(query: string, universe: StockUniverseItem[], limit = 8, filter: SearchFilter = "all"): StockUniverseItem[] {
  const results = rankStocksInIndex(createSearchIndex(universe), query, filter)
    .slice(0, limit)
    .map((result) => result.stock);
  const directTicker = createKoreanDirectTicker(query);
  if (results.length === 0 && directTicker && (filter === "all" || filter === "kr")) {
    return [directTicker];
  }

  return results;
}

export function getSearchUniverseCount(): number {
  return stockUniverse.length;
}

export function getFilteredRecommendations(filter: SearchFilter = "all", limit = 6): StockUniverseItem[] {
  return searchIndex
    .filter((item) => matchesFilter(item, filter))
    .sort((a, b) => (b.stock.searchBoost ?? 0) - (a.stock.searchBoost ?? 0))
    .slice(0, limit)
    .map((item) => item.stock);
}
