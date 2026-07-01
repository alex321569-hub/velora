import type { StockMarketProvider } from "./marketProvider";
import { getAutocompleteResults, isTickerLikeInput, normalizeSymbolInput } from "../searchStocks";
import { stockUniverse } from "../stockUniverse";
import type { CompanyProfile, HistoricalPrice, Quote, SearchFilter, ShortInterest, StockUniverseItem } from "../types";

interface YahooChartResult {
  meta?: {
    currency?: string;
    regularMarketPrice?: number;
    chartPreviousClose?: number;
    previousClose?: number;
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

function getUniverseItem(symbol: string) {
  const normalizedSymbol = normalizeSymbolInput(symbol);
  return stockUniverse.find((stock) => normalizeSymbolInput(stock.symbol) === normalizedSymbol) ?? null;
}

function toYahooSymbol(symbol: string): string {
  const item = getUniverseItem(symbol);
  const normalizedSymbol = normalizeSymbolInput(symbol);

  if (symbol.toUpperCase().endsWith(".KS") || symbol.toUpperCase().endsWith(".KQ")) {
    return symbol.toUpperCase();
  }

  if (item?.country === "KR" && /^[0-9]{6}$/.test(normalizedSymbol)) {
    return `${normalizedSymbol}.KS`;
  }

  if (item?.country === "KR" && !normalizedSymbol.includes(".")) {
    return `${normalizedSymbol}.KS`;
  }

  if (!item && /^[0-9]{6}$/.test(normalizedSymbol)) {
    return `${normalizedSymbol}.KS`;
  }

  return normalizedSymbol;
}

function createDirectTickerProfile(symbol: string): CompanyProfile | null {
  if (!isTickerLikeInput(symbol)) {
    return null;
  }

  const normalizedSymbol = normalizeSymbolInput(symbol);
  const isKoreanTicker = /^[0-9]{6}$/.test(normalizedSymbol) || /\.KS$/i.test(symbol) || /\.KQ$/i.test(symbol);

  return {
    symbol: normalizedSymbol,
    name: normalizedSymbol,
    koreanName: normalizedSymbol,
    exchange: isKoreanTicker ? "KRX" : "NASDAQ",
    country: isKoreanTicker ? "KR" : "US",
    assetType: "stock",
    sector: "Other",
    industry: "Other",
    aliases: [symbol, normalizedSymbol],
    listingDate: null,
    currency: isKoreanTicker ? "KRW" : "USD",
  };
}

function toDirectTickerResult(symbol: string): StockUniverseItem | null {
  const profile = createDirectTickerProfile(symbol);
  if (!profile) return null;

  const { listingDate, currency, ...stock } = profile;
  void listingDate;
  void currency;
  return stock;
}

async function fetchYahooChart(symbol: string, range = "1y"): Promise<YahooChartResult | null> {
  const yahooSymbol = encodeURIComponent(toYahooSymbol(symbol));
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=${encodeURIComponent(range)}&interval=1d&events=history`;
  const response = await fetch(url, {
    headers: yahooHeaders,
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    console.warn(`[market:yahoo] chart request failed for ${symbol}: ${response.status}`);
    return null;
  }

  const payload = (await response.json()) as YahooChartResponse;
  if (payload.chart?.error) {
    console.warn(`[market:yahoo] chart error for ${symbol}`, payload.chart.error);
    return null;
  }

  return payload.chart?.result?.[0] ?? null;
}

async function fetchYahooMarketCap(symbol: string): Promise<number | null> {
  const yahooSymbol = encodeURIComponent(toYahooSymbol(symbol));
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${yahooSymbol}?modules=price`;

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

export const yahooMarketDataProvider: StockMarketProvider = {
  capabilities: {
    name: "Yahoo Finance",
    isMock: false,
  },

  async searchSymbols(query: string, limit = 8, filter: SearchFilter = "all") {
    const results = getAutocompleteResults(query, limit, filter);
    if (results.length > 0 || !isTickerLikeInput(query) || query.trim().length < 2) {
      return results;
    }

    const result = await fetchYahooChart(query, "1mo");
    if (!result?.meta?.regularMarketPrice && !result?.timestamp?.length) {
      return results;
    }

    const directTicker = toDirectTickerResult(query);
    return directTicker ? [directTicker] : results;
  },

  async getCompanyProfile(symbol: string): Promise<CompanyProfile | null> {
    const item = getUniverseItem(symbol);
    if (!item) {
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

    const result = await fetchYahooChart(symbol, "1mo");
    if (!result) {
      return {
        symbol,
        currentPrice: null,
        previousClose: null,
        marketCap: null,
        currency: profile.currency,
        dataSource: this.capabilities.name,
      };
    }

    const marketCap = await fetchYahooMarketCap(symbol);

    return {
      symbol,
      currentPrice: result.meta?.regularMarketPrice ?? null,
      previousClose: result.meta?.previousClose ?? result.meta?.chartPreviousClose ?? null,
      marketCap,
      currency: result.meta?.currency === "KRW" ? "KRW" : profile.currency,
      dataSource: this.capabilities.name,
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

    timestamps.forEach((timestamp, index) => {
      const open = quote.open?.[index];
      const high = quote.high?.[index];
      const low = quote.low?.[index];
      const close = quote.close?.[index];

      if (open == null || high == null || low == null || close == null) {
        return;
      }

      prices.push({
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
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
