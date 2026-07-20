import type { StockMarketProvider } from "./marketProvider";
import { getAutocompleteResultsInUniverse, isTickerLikeInput, normalizeSymbolInput } from "../searchStocks";
import { getDiscoveredStocks, upsertDiscoveredStock } from "../discoveredUniverseStore";
import { getKoreanMarketSuffix, normalizeKoreanCode, normalizeMarketSymbol } from "../symbolUtils";
import { stockUniverse } from "../stockUniverse";
import type { CompanyProfile, HistoricalPrice, Quote, SearchFilter, ShortInterest, StockUniverseItem } from "../types";

interface YahooChartResult {
  meta?: {
    symbol?: string;
    exchangeName?: string;
    instrumentType?: string;
    currency?: string;
    regularMarketPrice?: number;
    chartPreviousClose?: number;
    previousClose?: number;
    currentTradingPeriod?: {
      pre?: YahooTradingPeriod;
      regular?: YahooTradingPeriod;
      post?: YahooTradingPeriod;
    };
  };
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      open?: Array<number | null>;
      high?: Array<number | null>;
      low?: Array<number | null>;
      close?: Array<number | null>;
      volume?: Array<number | null>;
    }>;
  };
}

interface YahooTradingPeriod {
  start?: number;
  end?: number;
}

interface YahooQuoteResult {
  symbol?: string;
  shortName?: string;
  longName?: string;
  quoteType?: string;
  exchange?: string;
  fullExchangeName?: string;
  currency?: string;
  marketState?: string;
  preMarketPrice?: number;
  regularMarketPrice?: number;
  postMarketPrice?: number;
  regularMarketPreviousClose?: number;
  preMarketChangePercent?: number;
  regularMarketChangePercent?: number;
  postMarketChangePercent?: number;
  marketCap?: number;
}

interface YahooQuoteResponse {
  quoteResponse?: {
    result?: YahooQuoteResult[];
    error?: unknown;
  };
}

interface YahooChartResponse {
  chart?: {
    result?: YahooChartResult[];
    error?: unknown;
  };
}

interface YahooQuoteSummaryResponse {
  quoteSummary?: {
    result?: Array<{
      price?: {
        marketCap?: {
          raw?: number;
        };
      };
    }>;
    error?: unknown;
  };
}

const yahooHeaders = {
  "User-Agent": "Mozilla/5.0",
  Accept: "application/json",
};

const koreanYahooSymbolCache = new Map<string, Promise<string | null>>();
const temporaryTickerAliases: Record<string, string> = {
  SKHYV: "SKHY",
};

const discoveredMetadataOverrides: Record<string, Partial<StockUniverseItem>> = {
  SKHY: {
    name: "SK hynix Inc. ADR",
    koreanName: "SK하이닉스 ADR",
    sector: "Semiconductor",
    industry: "Memory Semiconductor ADR",
    aliases: ["SKHY", "SKHYV", "SK hynix ADR", "SK Hynix ADR", "SK하이닉스 ADR", "하이닉스 ADR"],
  },
};

function mergeUniverseItems(...groups: StockUniverseItem[][]): StockUniverseItem[] {
  const itemsBySymbol = new Map<string, StockUniverseItem>();

  groups.flat().forEach((item) => {
    const key = normalizeSymbolInput(item.symbol);
    const existing = itemsBySymbol.get(key);
    itemsBySymbol.set(key, existing ? { ...existing, ...item, aliases: Array.from(new Set([...existing.aliases, ...item.aliases])) } : item);
  });

  return Array.from(itemsBySymbol.values());
}

function getUniverseItem(symbol: string) {
  const normalizedSymbol = normalizeSymbolInput(symbol);
  const normalizedKoreanCode = normalizeKoreanCode(symbol);

  return (
    stockUniverse.find((stock) => normalizeSymbolInput(stock.symbol) === normalizedSymbol) ??
    (normalizedKoreanCode
      ? stockUniverse.find((stock) => stock.country === "KR" && normalizeKoreanCode(stock.symbol) === normalizedKoreanCode)
      : null) ??
    null
  );
}

async function getUniverseItemAsync(symbol: string) {
  const staticItem = getUniverseItem(symbol);
  if (staticItem) return staticItem;

  const discoveredItems = await getDiscoveredStocks();
  const normalizedSymbol = normalizeSymbolInput(symbol);
  const normalizedKoreanCode = normalizeKoreanCode(symbol);

  return (
    discoveredItems.find((stock) => normalizeSymbolInput(stock.symbol) === normalizedSymbol) ??
    (normalizedKoreanCode
      ? discoveredItems.find((stock) => stock.country === "KR" && normalizeKoreanCode(stock.symbol) === normalizedKoreanCode)
      : null) ??
    null
  );
}

function getPreferredKoreanSuffix(item: StockUniverseItem | null, symbol: string): "KS" | "KQ" | null {
  return getKoreanMarketSuffix(item?.exchange, symbol);
}

function toYahooSymbolSync(symbol: string): string {
  const item = getUniverseItem(symbol);
  return normalizeMarketSymbol(symbol, item ?? undefined).yahooSymbol;
}

async function fetchYahooChartByYahooSymbol(yahooSymbol: string, range = "1y"): Promise<YahooChartResult | null> {
  const encodedSymbol = encodeURIComponent(yahooSymbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSymbol}?range=${encodeURIComponent(range)}&interval=1d&events=history`;
  const response = await fetch(url, {
    headers: yahooHeaders,
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as YahooChartResponse;
  if (payload.chart?.error) {
    return null;
  }

  const result = payload.chart?.result?.[0] ?? null;
  if (!result?.timestamp?.length && typeof result?.meta?.regularMarketPrice !== "number") {
    return null;
  }

  return result;
}

async function fetchYahooQuoteByYahooSymbol(yahooSymbol: string): Promise<YahooQuoteResult | null> {
  const encodedSymbol = encodeURIComponent(yahooSymbol);
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodedSymbol}`;

  try {
    const response = await fetch(url, {
      headers: yahooHeaders,
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as YahooQuoteResponse;
    if (payload.quoteResponse?.error) {
      return null;
    }

    return payload.quoteResponse?.result?.[0] ?? null;
  } catch {
    return null;
  }
}

async function resolveYahooSymbol(symbol: string): Promise<string | null> {
  const upperSymbol = symbol.toUpperCase();
  const lookupSymbol = temporaryTickerAliases[upperSymbol] ?? symbol;
  const item = await getUniverseItemAsync(lookupSymbol);
  const resolved = normalizeMarketSymbol(lookupSymbol, item ?? undefined);
  const normalizedSymbol = resolved.normalizedSymbol;

  if (upperSymbol.endsWith(".KS") || upperSymbol.endsWith(".KQ")) {
    return resolved.yahooSymbol;
  }

  if (!/^[0-9]{6}$/.test(normalizedSymbol)) {
    return resolved.yahooSymbol;
  }

  if (item?.exchange || upperSymbol.startsWith("A")) {
    return resolved.yahooSymbol;
  }

  if (!koreanYahooSymbolCache.has(normalizedSymbol)) {
    koreanYahooSymbolCache.set(
      normalizedSymbol,
      (async () => {
        for (const suffix of ["KS", "KQ"] as const) {
          const candidate = `${normalizedSymbol}.${suffix}`;
          const quote = await fetchYahooQuoteByYahooSymbol(candidate);
          if (quote && (typeof quote.regularMarketPrice === "number" || typeof quote.preMarketPrice === "number" || typeof quote.postMarketPrice === "number")) {
            return candidate;
          }

          const chart = await fetchYahooChartByYahooSymbol(candidate, "1mo");
          if (chart) {
            return candidate;
          }
        }

        return null;
      })(),
    );
  }

  return koreanYahooSymbolCache.get(normalizedSymbol) ?? null;
}

function createDirectTickerProfile(symbol: string): CompanyProfile | null {
  if (!isTickerLikeInput(symbol)) {
    return null;
  }

  const resolved = normalizeMarketSymbol(symbol);
  const normalizedSymbol = resolved.normalizedSymbol;
  const isKoreanTicker = /^[0-9]{6}$/.test(normalizedSymbol) || /\.KS$/i.test(symbol) || /\.KQ$/i.test(symbol) || /^A\d{1,6}$/i.test(symbol.trim());
  const preferredSuffix = getPreferredKoreanSuffix(null, symbol);

  return {
    symbol: normalizedSymbol,
    name: normalizedSymbol,
    koreanName: normalizedSymbol,
    exchange: isKoreanTicker ? (preferredSuffix === "KS" ? "KOSPI" : preferredSuffix === "KQ" ? "KOSDAQ" : "KOSPI/KOSDAQ") : "NASDAQ",
    country: isKoreanTicker ? "KR" : "US",
    assetType: "stock",
    sector: "Other",
    industry: "Other",
    aliases: [symbol, normalizedSymbol],
    listingDate: null,
    currency: isKoreanTicker ? "KRW" : "USD",
  };
}

function normalizeYahooExchange(quote: YahooQuoteResult | null): string {
  const rawExchange = `${quote?.fullExchangeName ?? quote?.exchange ?? ""}`.trim();
  const normalized = rawExchange.toUpperCase();

  if (["NMS", "NGM", "NAS", "NASDAQ", "NASDAQGS", "NASDAQGM", "NASDAQCM", "NASDAQ GLOBAL SELECT", "NASDAQ GLOBAL MARKET", "NASDAQ CAPITAL MARKET"].some((token) => normalized.includes(token))) {
    return "NASDAQ";
  }

  if (["NYQ", "NYSE", "NEW YORK STOCK EXCHANGE"].some((token) => normalized.includes(token))) {
    return "NYSE";
  }

  if (["ASE", "AMEX", "NYSE AMERICAN"].some((token) => normalized.includes(token))) {
    return "AMEX";
  }

  if (["PCX", "NYSEARCA", "NYSE ARCA"].some((token) => normalized.includes(token))) {
    return "NYSEARCA";
  }

  if (normalized.includes("BATS")) {
    return "BATS";
  }

  return rawExchange || "UNKNOWN";
}

function isYahooEtf(quote: YahooQuoteResult | null, name: string): boolean {
  const quoteType = quote?.quoteType?.toUpperCase();
  if (quoteType === "ETF") return true;

  const normalizedName = name.toUpperCase();
  const stockPhrases = [
    "AMERICAN DEPOSITARY SHARE",
    "AMERICAN DEPOSITARY SHARES",
    "DEPOSITARY SHARES",
    "ORDINARY SHARE",
    "ORDINARY SHARES",
    "COMMON SHARE",
    "COMMON SHARES",
    "CLASS A ORDINARY SHARES",
  ];

  if (stockPhrases.some((phrase) => normalizedName.includes(phrase))) {
    return false;
  }

  return /\bETF\b/.test(normalizedName) || normalizedName.includes("EXCHANGE TRADED FUND");
}

function createDiscoveredStockFromQuote(requestedQuery: string, resolvedSymbol: string, quote: YahooQuoteResult): StockUniverseItem | null {
  const symbol = normalizeSymbolInput(resolvedSymbol);
  if (!symbol || /^\d{1,6}$/.test(symbol)) return null;

  const rawName = quote.longName ?? quote.shortName ?? symbol;
  const override = discoveredMetadataOverrides[symbol];
  const name = override?.name ?? rawName;
  const exchange = override?.exchange ?? normalizeYahooExchange(quote);
  const assetType = override?.assetType ?? (isYahooEtf(quote, name) ? "etf" : "stock");
  const aliases = Array.from(
    new Set([symbol, requestedQuery.trim().toUpperCase(), quote.symbol, quote.shortName, quote.longName, name, ...(override?.aliases ?? [])].filter((value): value is string => Boolean(value?.trim()))),
  );

  return {
    symbol,
    name,
    koreanName: override?.koreanName ?? name,
    exchange,
    country: override?.country ?? "US",
    assetType,
    sector: override?.sector ?? (assetType === "etf" ? "ETF" : "Other"),
    industry: override?.industry ?? (assetType === "etf" ? "Exchange Traded Fund" : "Other"),
    aliases,
    searchBoost: override?.searchBoost,
  };
}

function createQuoteLikeFromChart(symbol: string, chart: YahooChartResult | null): YahooQuoteResult {
  return {
    symbol: chart?.meta?.symbol ?? symbol,
    quoteType: chart?.meta?.instrumentType,
    exchange: chart?.meta?.exchangeName,
    currency: chart?.meta?.currency,
    regularMarketPrice: chart?.meta?.regularMarketPrice,
  };
}

function getExternalLookupCandidates(query: string): string[] {
  const normalized = query.trim().toUpperCase();
  const candidates = [temporaryTickerAliases[normalized] ?? normalized, normalized];

  if (/^[A-Z]{2,8}V$/.test(normalized)) {
    candidates.push(normalized.slice(0, -1));
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

async function lookupExternalSymbol(query: string): Promise<StockUniverseItem | null> {
  if (!isTickerLikeInput(query) || query.trim().length < 2) {
    return null;
  }

  for (const candidate of getExternalLookupCandidates(query)) {
    const quote = await fetchYahooQuoteByYahooSymbol(candidate);
    const hasPrice =
      typeof quote?.regularMarketPrice === "number" ||
      typeof quote?.preMarketPrice === "number" ||
      typeof quote?.postMarketPrice === "number";
    const hasIdentity = Boolean(quote?.symbol || quote?.shortName || quote?.longName);

    if (!quote || (!hasPrice && !hasIdentity)) {
      const chart = await fetchYahooChartByYahooSymbol(candidate, "1mo");
      if (!chart?.timestamp?.length && typeof chart?.meta?.regularMarketPrice !== "number") {
        continue;
      }

      const discoveredStock = createDiscoveredStockFromQuote(query, chart.meta?.symbol ?? candidate, createQuoteLikeFromChart(candidate, chart));
      if (!discoveredStock) continue;

      await upsertDiscoveredStock(discoveredStock);
      return discoveredStock;
    }

    const discoveredStock = createDiscoveredStockFromQuote(query, quote?.symbol ?? candidate, quote ?? { symbol: candidate });
    if (!discoveredStock) continue;

    await upsertDiscoveredStock(discoveredStock);
    return discoveredStock;
  }

  return null;
}

async function fetchYahooChart(symbol: string, range = "1y"): Promise<YahooChartResult | null> {
  const yahooSymbol = await resolveYahooSymbol(symbol);
  if (!yahooSymbol) {
    return null;
  }

  const result = await fetchYahooChartByYahooSymbol(yahooSymbol, range);
  if (!result) {
    console.warn(`[market:yahoo] chart unavailable for ${symbol}`);
  }

  return result;
}

async function fetchYahooQuote(symbol: string): Promise<YahooQuoteResult | null> {
  const yahooSymbol = await resolveYahooSymbol(symbol);
  if (!yahooSymbol) {
    return null;
  }

  const quote = await fetchYahooQuoteByYahooSymbol(yahooSymbol);
  if (!quote) {
    console.warn(`[market:yahoo] quote unavailable for ${symbol}`);
  }

  return quote;
}

async function fetchYahooMarketCap(symbol: string): Promise<number | null> {
  const yahooSymbol = await resolveYahooSymbol(symbol);
  if (!yahooSymbol) {
    return null;
  }

  const encodedSymbol = encodeURIComponent(yahooSymbol);
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodedSymbol}?modules=price`;

  try {
    const response = await fetch(url, {
      headers: yahooHeaders,
      next: { revalidate: 900 },
    });

    if (!response.ok) {
      console.warn(`[market:yahoo] quoteSummary marketCap unavailable for ${symbol}: ${response.status}`);
      return null;
    }

    const payload = (await response.json()) as YahooQuoteSummaryResponse;
    return payload.quoteSummary?.result?.[0]?.price?.marketCap?.raw ?? null;
  } catch (error) {
    console.warn(`[market:yahoo] quoteSummary marketCap failed for ${symbol}`, error);
    return null;
  }
}

function normalizeMarketState(marketState?: string): Quote["marketState"] {
  const normalized = marketState?.toUpperCase();

  if (normalized === "PRE" || normalized === "PREPRE") {
    return "PRE";
  }

  if (normalized === "REGULAR") {
    return "OPEN";
  }

  if (normalized === "POST" || normalized === "POSTPOST") {
    return "POST";
  }

  if (normalized === "CLOSED") {
    return "CLOSED";
  }

  return "UNKNOWN";
}

function inferMarketStateFromChart(result: YahooChartResult | null): Quote["marketState"] {
  const now = Math.floor(Date.now() / 1000);
  const period = result?.meta?.currentTradingPeriod;

  if (period?.pre?.start && period.pre.end && now >= period.pre.start && now < period.pre.end) {
    return "PRE";
  }

  if (period?.regular?.start && period.regular.end && now >= period.regular.start && now < period.regular.end) {
    return "OPEN";
  }

  if (period?.post?.start && period.post.end && now >= period.post.start && now < period.post.end) {
    return "POST";
  }

  return "CLOSED";
}

function selectMarketPrice(quote: YahooQuoteResult | null): {
  currentPrice: number | null;
  previousClose: number | null;
  changePercent: number | null;
  marketState: Quote["marketState"];
} {
  const marketState = normalizeMarketState(quote?.marketState);
  const previousClose = quote?.regularMarketPreviousClose ?? null;

  function calculateChangePercent(currentPrice: number | null, fallbackChangePercent?: number) {
    if (typeof fallbackChangePercent === "number") {
      return fallbackChangePercent;
    }

    if (currentPrice === null || previousClose === null || previousClose === 0) {
      return null;
    }

    return ((currentPrice - previousClose) / previousClose) * 100;
  }

  if (marketState === "PRE" && typeof quote?.preMarketPrice === "number") {
    return {
      currentPrice: quote.preMarketPrice,
      previousClose,
      changePercent: calculateChangePercent(quote.preMarketPrice, quote.preMarketChangePercent),
      marketState,
    };
  }

  if (marketState === "OPEN" && typeof quote?.regularMarketPrice === "number") {
    return {
      currentPrice: quote.regularMarketPrice,
      previousClose,
      changePercent: calculateChangePercent(quote.regularMarketPrice, quote.regularMarketChangePercent),
      marketState,
    };
  }

  if (marketState === "POST" && typeof quote?.postMarketPrice === "number") {
    return {
      currentPrice: quote.postMarketPrice,
      previousClose,
      changePercent: calculateChangePercent(quote.postMarketPrice, quote.postMarketChangePercent),
      marketState,
    };
  }

  if (typeof quote?.regularMarketPrice === "number") {
    return {
      currentPrice: quote.regularMarketPrice,
      previousClose,
      changePercent: calculateChangePercent(quote.regularMarketPrice, quote.regularMarketChangePercent),
      marketState,
    };
  }

  if (typeof quote?.postMarketPrice === "number") {
    return {
      currentPrice: quote.postMarketPrice,
      previousClose,
      changePercent: calculateChangePercent(quote.postMarketPrice, quote.postMarketChangePercent),
      marketState,
    };
  }

  if (typeof quote?.preMarketPrice === "number") {
    return {
      currentPrice: quote.preMarketPrice,
      previousClose,
      changePercent: calculateChangePercent(quote.preMarketPrice, quote.preMarketChangePercent),
      marketState,
    };
  }

  return { currentPrice: null, previousClose, changePercent: null, marketState };
}

export const yahooMarketDataProvider: StockMarketProvider = {
  capabilities: {
    name: "Yahoo Finance",
    isMock: false,
  },

  async searchSymbols(query: string, limit = 8, filter: SearchFilter = "all") {
    const discoveredStocks = await getDiscoveredStocks();
    const searchableUniverse = mergeUniverseItems(stockUniverse, discoveredStocks);
    const results = getAutocompleteResultsInUniverse(query, searchableUniverse, limit, filter);
    const normalizedQuery = normalizeSymbolInput(query);
    const hasExactLocalTicker = results.some((stock) => normalizeSymbolInput(stock.symbol) === normalizedQuery);

    if (!isTickerLikeInput(query) || query.trim().length < 2 || hasExactLocalTicker) {
      return results;
    }

    const externalResult = await lookupExternalSymbol(query);
    if (!externalResult) {
      return results;
    }

    return [
      externalResult,
      ...results.filter((stock) => normalizeSymbolInput(stock.symbol) !== normalizeSymbolInput(externalResult.symbol)),
    ].slice(0, limit);
  },

  async getCompanyProfile(symbol: string): Promise<CompanyProfile | null> {
    const item = await getUniverseItemAsync(symbol);
    if (!item) {
      const externalItem = await lookupExternalSymbol(symbol);
      if (externalItem) {
        return {
          ...externalItem,
          listingDate: null,
          currency: externalItem.country === "KR" ? "KRW" : "USD",
        };
      }

      return createDirectTickerProfile(symbol);
    }

    return {
      ...item,
      listingDate: null,
      currency: item.country === "KR" ? "KRW" : "USD",
    };
  },

  async getQuote(symbol: string): Promise<Quote | null> {
    const profile = await this.getCompanyProfile(symbol);
    if (!profile) {
      return null;
    }

    const quote = await fetchYahooQuote(symbol);
    if (quote) {
      const selected = selectMarketPrice(quote);

      return {
        symbol,
        currentPrice: selected.currentPrice,
        previousClose: selected.previousClose,
        changePercent: selected.changePercent,
        marketCap: quote.marketCap ?? null,
        currency: quote.currency === "KRW" ? "KRW" : profile.currency,
        dataSource: this.capabilities.name,
        marketState: selected.marketState,
        fetchedAt: new Date().toISOString(),
      };
    }

    const result = await fetchYahooChart(symbol, "1mo");
    if (!result) {
      return {
        symbol,
        currentPrice: null,
        previousClose: null,
        changePercent: null,
        marketCap: null,
        currency: profile.currency,
        dataSource: this.capabilities.name,
        marketState: "UNKNOWN",
        fetchedAt: new Date().toISOString(),
      };
    }

    const marketCap = await fetchYahooMarketCap(symbol);

    return {
      symbol,
      currentPrice: result.meta?.regularMarketPrice ?? null,
      previousClose: null,
      changePercent: null,
      marketCap,
      currency: result.meta?.currency === "KRW" ? "KRW" : profile.currency,
      dataSource: this.capabilities.name,
      marketState: inferMarketStateFromChart(result),
      fetchedAt: new Date().toISOString(),
    };
  },

  async getHistoricalPrices(symbol: string, range = "1y"): Promise<HistoricalPrice[]> {
    const result = await fetchYahooChart(symbol, range);
    const quote = result?.indicators?.quote?.[0];
    const timestamps = result?.timestamp ?? [];

    if (!quote || timestamps.length === 0) {
      return [];
    }

    const prices: HistoricalPrice[] = [];

    const seenDates = new Set<string>();

    timestamps.forEach((timestamp, index) => {
      const open = quote.open?.[index];
      const high = quote.high?.[index];
      const low = quote.low?.[index];
      const close = quote.close?.[index];
      const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

      if (
        seenDates.has(date) ||
        open == null ||
        high == null ||
        low == null ||
        close == null ||
        !Number.isFinite(open) ||
        !Number.isFinite(high) ||
        !Number.isFinite(low) ||
        !Number.isFinite(close) ||
        open <= 0 ||
        high <= 0 ||
        low <= 0 ||
        close <= 0 ||
        high < low ||
        high < open ||
        high < close ||
        low > open ||
        low > close
      ) {
        return;
      }

      seenDates.add(date);
      prices.push({
        date,
        open,
        high,
        low,
        close,
        volume: quote.volume?.[index] ?? undefined,
      });
    });

    return prices;
  },

  async getShortInterest(symbol: string): Promise<ShortInterest | null> {
    const profile = await this.getCompanyProfile(symbol);
    if (!profile) {
      return null;
    }

    return {
      label: "데이터 없음",
    };
  },
};
