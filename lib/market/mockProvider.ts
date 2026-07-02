import {
  calculateBollingerBands,
  calculatePercentChange,
  calculateRSI,
  calculateSMA,
  calculateSupportResistance,
  getRsiStatus,
  validateHistoricalPrices,
} from "./calculateIndicators";
import type { StockMarketProvider } from "./marketProvider";
import { getAutocompleteResults } from "./searchStocks";
import { stockUniverse } from "./stockUniverse";
import type {
  CompanyProfile,
  HistoricalPrice,
  Quote,
  ShortInterest,
  StockAnalysisResponse,
  StockBasicInfo,
  SearchFilter,
  SupportResistanceLevel,
} from "./types";

interface MockSeed {
  currentPrice: number;
  marketCap: number;
  listingDate: string;
  currency: "USD" | "KRW";
  startPrice: number;
  volatility: number;
  recentCloses?: number[];
}

const mockNotice = "현재 개발용 Mock 데이터를 사용하고 있습니다.";

const seedBySymbol: Record<string, MockSeed> = {
  AMAT: {
    currentPrice: 705.97,
    marketCap: 530_365_000_000,
    listingDate: "1972-10-12",
    currency: "USD",
    startPrice: 452,
    volatility: 11,
    recentCloses: [568.23, 592.92, 617.11, 640.18, 585.88, 588.97, 668, 626.84, 694.64, 705.97],
  },
  NVDA: { currentPrice: 162.83, marketCap: 3_850_000_000_000, listingDate: "1999-01-22", currency: "USD", startPrice: 108, volatility: 3.6 },
  NVDL: { currentPrice: 87.42, marketCap: 7_200_000_000, listingDate: "2022-12-13", currency: "USD", startPrice: 48, volatility: 3.8 },
  NVD3: { currentPrice: 31.64, marketCap: 1_300_000_000, listingDate: "2024-01-08", currency: "USD", startPrice: 17, volatility: 1.7 },
  AAPL: { currentPrice: 214.18, marketCap: 3_250_000_000_000, listingDate: "1980-12-12", currency: "USD", startPrice: 178, volatility: 3.8 },
  TSM: { currentPrice: 212.76, marketCap: 1_090_000_000_000, listingDate: "1997-10-08", currency: "USD", startPrice: 158, volatility: 4.5 },
  "005930": { currentPrice: 81700, marketCap: 487_000_000_000_000, listingDate: "1975-06-11", currency: "KRW", startPrice: 64200, volatility: 1300 },
  "207940": { currentPrice: 1_012_000, marketCap: 72_000_000_000_000, listingDate: "2016-11-10", currency: "KRW", startPrice: 820000, volatility: 14000 },
  "006400": { currentPrice: 363500, marketCap: 25_000_000_000_000, listingDate: "1979-02-27", currency: "KRW", startPrice: 415000, volatility: 9800 },
  "009150": { currentPrice: 149800, marketCap: 11_200_000_000_000, listingDate: "1979-02-27", currency: "KRW", startPrice: 121000, volatility: 3600 },
};

const historicalCache = new Map<string, HistoricalPrice[]>();

function createTradingDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const holidays = new Set(["2026-06-19"]);
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  while (cursor <= end) {
    const day = cursor.getUTCDay();
    const date = cursor.toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !holidays.has(date)) {
      dates.push(date);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

const tradingDates = createTradingDates("2025-01-02", "2026-06-30");

function hashSymbol(symbol: string): number {
  return [...symbol].reduce((hash, character) => hash * 31 + character.charCodeAt(0), 7);
}

function getSeed(symbol: string): MockSeed {
  const knownSeed = seedBySymbol[symbol];
  if (knownSeed) {
    return knownSeed;
  }

  const profile = stockUniverse.find((stock) => stock.symbol === symbol);
  const hash = hashSymbol(symbol);
  const currency = profile?.country === "KR" ? "KRW" : "USD";
  const basePrice = currency === "KRW" ? 8000 + (hash % 250) * 1200 : 18 + (hash % 260);
  const currentPrice = Number((basePrice * (0.92 + (hash % 23) / 100)).toFixed(currency === "KRW" ? 0 : 2));

  return {
    currentPrice,
    marketCap: currency === "KRW" ? currentPrice * (40_000_000 + (hash % 200_000_000)) : currentPrice * (80_000_000 + (hash % 3_000_000_000)),
    listingDate: `${1985 + (hash % 35)}-${String((hash % 12) + 1).padStart(2, "0")}-${String((hash % 25) + 1).padStart(2, "0")}`,
    currency,
    startPrice: Number((currentPrice * (0.72 + (hash % 18) / 100)).toFixed(currency === "KRW" ? 0 : 2)),
    volatility: Math.max(currentPrice * 0.018, currency === "KRW" ? 300 : 0.8),
  };
}

function generateHistoricalPrices(symbol: string): HistoricalPrice[] {
  const cached = historicalCache.get(symbol);
  if (cached) {
    return cached;
  }

  const seed = getSeed(symbol);
  let previousClose = seed.startPrice;
  const lastTenStart = tradingDates.length - 10;

  const prices = tradingDates.map((date, index) => {
    const progress = tradingDates.length <= 1 ? 1 : index / (tradingDates.length - 1);
    const trend = seed.startPrice + (seed.currentPrice - seed.startPrice) * progress;
    const wave = Math.sin(index * 0.16 + hashSymbol(symbol) * 0.001) * seed.volatility + Math.cos(index * 0.047) * seed.volatility * 0.55;
    const recentClose = seed.recentCloses?.[index - lastTenStart];
    const close = Number((recentClose ?? (index === tradingDates.length - 1 ? seed.currentPrice : trend + wave)).toFixed(seed.currency === "KRW" ? 0 : 2));
    const open = Number((previousClose + Math.sin(index * 0.31) * seed.volatility * 0.18).toFixed(seed.currency === "KRW" ? 0 : 2));
    const high = Number((Math.max(open, close) + seed.volatility * (0.45 + (index % 5) * 0.04)).toFixed(seed.currency === "KRW" ? 0 : 2));
    const low = Number((Math.min(open, close) - seed.volatility * (0.38 + (index % 7) * 0.035)).toFixed(seed.currency === "KRW" ? 0 : 2));
    previousClose = close;

    return {
      date,
      open: Math.max(open, 0.01),
      high: Math.max(high, open, close, 0.01),
      low: Math.max(Math.min(low, open, close), 0.01),
      close: Math.max(close, 0.01),
      volume: Math.round(900000 + Math.abs(Math.sin(index + hashSymbol(symbol))) * 1800000),
    };
  });

  historicalCache.set(symbol, prices);
  return prices;
}

function getNearestDistance(levels: SupportResistanceLevel[], currentPrice: number): { distance: number | null; percent: number | null } {
  if (levels.length === 0 || currentPrice === 0) {
    return { distance: null, percent: null };
  }

  const nearest = levels.reduce((closest, level) =>
    Math.abs(level.price - currentPrice) < Math.abs(closest.price - currentPrice) ? level : closest,
  );
  const distance = Math.abs(currentPrice - nearest.price);

  return {
    distance,
    percent: (distance / currentPrice) * 100,
  };
}

function getSupportDistanceScore(percent: number | null) {
  if (percent === null) {
    return -5;
  }

  if (percent <= 3) {
    return -5;
  }

  if (percent <= 10) {
    return 10;
  }

  if (percent <= 20) {
    return 3;
  }

  return 0;
}

function getResistanceDistanceScore(percent: number | null, isNearWeek52High: boolean) {
  if (percent === null) {
    return isNearWeek52High ? 5 : 0;
  }

  if (percent <= 3) {
    return -5;
  }

  if (percent < 10) {
    return 3;
  }

  return 10;
}

function buildBasicInfo(profile: CompanyProfile, quote: Quote, currentPrice: number, previousClose: number): StockBasicInfo {
  return {
    symbol: profile.symbol,
    name: profile.name,
    koreanName: profile.koreanName,
    exchange: profile.exchange,
    country: profile.country,
    currentPrice,
    previousClose,
    changePercent: calculatePercentChange(currentPrice, previousClose),
    currency: quote.currency,
    dataSource: quote.dataSource,
    dataSourceNotice: quote.dataSourceNotice,
    marketState: quote.marketState,
    fetchedAt: quote.fetchedAt,
  };
}

export const mockMarketDataProvider: StockMarketProvider = {
  capabilities: {
    name: "Mock",
    isMock: true,
  },

  async searchSymbols(query: string, limit = 8, filter: SearchFilter = "all") {
    return getAutocompleteResults(query, limit, filter);
  },

  async getCompanyProfile(symbol: string) {
    const universeItem = stockUniverse.find((stock) => stock.symbol === symbol);
    if (!universeItem) {
      return null;
    }

    const seed = getSeed(symbol);
    return {
      ...universeItem,
      listingDate: seed.listingDate,
      currency: seed.currency,
    };
  },

  async getHistoricalPrices(symbol: string) {
    return generateHistoricalPrices(symbol);
  },

  async getQuote(symbol: string) {
    const profile = await this.getCompanyProfile(symbol);
    if (!profile) {
      return null;
    }

    const historicalPrices = await this.getHistoricalPrices(symbol);
    const sortedPrices = [...historicalPrices].sort((a, b) => a.date.localeCompare(b.date));
    const lastClose = sortedPrices.at(-1)?.close ?? null;
    const previousClose = sortedPrices.at(-2)?.close ?? null;
    const seed = getSeed(symbol);

    return {
      symbol,
      currentPrice: lastClose,
      previousClose,
      marketCap: seed.marketCap,
      currency: seed.currency,
      dataSource: this.capabilities.name,
      dataSourceNotice: mockNotice,
      marketState: "CLOSED",
      fetchedAt: new Date().toISOString(),
    };
  },

  async getShortInterest(symbol: string) {
    const profile = await this.getCompanyProfile(symbol);
    if (!profile) {
      return null;
    }

    return {
      label: profile.country === "KR" ? "공매도 비율 0.42%" : "공매도 잔고 21,911,355주",
      reportDate: "2026-06-15",
    };
  },
};

export async function getStockAnalysis(symbol: string): Promise<StockAnalysisResponse | null> {
  const [profile, quote, historicalPrices, shortInterest] = await Promise.all([
    mockMarketDataProvider.getCompanyProfile(symbol),
    mockMarketDataProvider.getQuote(symbol),
    mockMarketDataProvider.getHistoricalPrices(symbol),
    mockMarketDataProvider.getShortInterest(symbol),
  ]);

  if (!profile || !quote) {
    return null;
  }

  const validation = validateHistoricalPrices(historicalPrices, symbol);
  const sortedPrices = validation.sortedPrices;
  const closes = sortedPrices.map((price) => price.close);
  const currentPrice = closes.at(-1) ?? 0;
  const previousClose = closes.at(-2) ?? currentPrice;
  const basic = buildBasicInfo(profile, quote, currentPrice, previousClose);

  if (!validation.isValid || closes.length === 0) {
    return {
      basic,
      recentPrices: sortedPrices.slice(-10).reverse().map((price) => ({ ...price, changePercent: 0 })),
      indicators: {
        calculationError: "데이터 오류로 지표 계산 불가",
        week52High: 0,
        week52Low: 0,
        bollingerBands: { upper: 0, middle: 0, lower: 0 },
        movingAverages: { sma5: null, sma20: null, sma60: null, sma120: null, sma365: null },
        rsi: 0,
        rsiStatus: "보통",
        supportResistance: { supports: [], resistances: [] },
        compositeSignal: {
          trendStatus: "횡보",
          pricePosition: "중간 구간",
          rsiStatus: "보통",
          nearestSupportDistance: null,
          nearestSupportDistancePercent: null,
          nearestResistanceDistance: null,
          nearestResistanceDistancePercent: null,
          score: 0,
          scoreLabel: "위험",
        },
        shortInterestLabel: "",
      },
    };
  }

  const week52High = Math.max(...sortedPrices.map((price) => price.high));
  const week52Low = Math.min(...sortedPrices.map((price) => price.low));
  const bollingerBands = calculateBollingerBands(closes);
  const movingAverages = {
    sma5: calculateSMA(closes, 5),
    sma20: calculateSMA(closes, 20),
    sma60: calculateSMA(closes, 60),
    sma120: calculateSMA(closes, 120),
    sma365: calculateSMA(closes, 365),
  };
  const rsi = calculateRSI(closes);
  const supportResistance = calculateSupportResistance(sortedPrices, currentPrice);
  const recentPrices = sortedPrices.slice(-10).reverse().map((price) => {
    const originalIndex = sortedPrices.findIndex((candidate) => candidate.date === price.date);
    const previous = sortedPrices[Math.max(originalIndex - 1, 0)]?.close ?? price.close;
    return { ...price, changePercent: calculatePercentChange(price.close, previous) };
  });
  const recentTenChronological = sortedPrices.slice(-10);
  const recentTenReturn = calculatePercentChange(
    recentTenChronological.at(-1)?.close ?? currentPrice,
    recentTenChronological[0]?.close ?? currentPrice,
  );
  const nearestSupport = getNearestDistance(supportResistance.supports, currentPrice);
  const nearestResistance = getNearestDistance(supportResistance.resistances, currentPrice);
  const highDrawdownPercent = calculatePercentChange(currentPrice, week52High);
  const highDistancePercent = Math.abs(highDrawdownPercent);
  const range = week52High - week52Low;
  const rangePosition = range === 0 ? 0.5 : (currentPrice - week52Low) / range;
  const trendStatus =
    movingAverages.sma20 !== null && movingAverages.sma60 !== null && currentPrice > movingAverages.sma20 && movingAverages.sma20 > movingAverages.sma60
      ? "상승 추세"
      : movingAverages.sma20 !== null && movingAverages.sma60 !== null && currentPrice < movingAverages.sma20 && movingAverages.sma20 < movingAverages.sma60
        ? "하락 추세"
        : "횡보";
  const pricePosition =
    rangePosition >= 0.85 ? "52주 고점 근처" : rangePosition <= 0.15 ? "52주 저점 근처" : "중간 구간";
  let compositeScore = 0;
  compositeScore += movingAverages.sma20 !== null && currentPrice > movingAverages.sma20 ? 10 : 0;
  compositeScore += movingAverages.sma60 !== null && currentPrice > movingAverages.sma60 ? 10 : 0;
  compositeScore += movingAverages.sma120 !== null && currentPrice > movingAverages.sma120 ? 10 : 0;
  compositeScore += movingAverages.sma20 !== null && movingAverages.sma60 !== null && movingAverages.sma20 > movingAverages.sma60 ? 10 : 0;
  compositeScore += movingAverages.sma60 !== null && movingAverages.sma120 !== null && movingAverages.sma60 > movingAverages.sma120 ? 10 : 0;
  compositeScore += rsi >= 45 && rsi <= 65 ? 15 : 0;
  compositeScore += rsi > 65 && rsi < 70 ? 5 : 0;
  compositeScore += rsi >= 70 ? -10 : 0;
  compositeScore += rsi <= 35 ? -10 : 0;
  compositeScore += recentTenReturn > 0 && recentTenReturn <= 5 ? 10 : 0;
  compositeScore += recentTenReturn > 5 && recentTenReturn < 12 ? 5 : 0;
  compositeScore += recentTenReturn >= 12 ? -10 : 0;
  compositeScore += highDrawdownPercent <= -5 && highDrawdownPercent >= -20 ? 10 : 0;
  compositeScore += highDistancePercent <= 2 ? -5 : 0;
  compositeScore += getSupportDistanceScore(nearestSupport.percent);
  compositeScore += getResistanceDistanceScore(nearestResistance.percent, highDistancePercent <= 2);
  compositeScore = Math.max(0, Math.min(100, compositeScore));

  return {
    basic,
    recentPrices,
    indicators: {
      week52High,
      week52Low,
      bollingerBands,
      movingAverages,
      rsi,
      rsiStatus: getRsiStatus(rsi),
      supportResistance,
      compositeSignal: {
        trendStatus,
        pricePosition,
        rsiStatus: getRsiStatus(rsi),
        nearestSupportDistance: nearestSupport.distance,
        nearestSupportDistancePercent: nearestSupport.percent,
        nearestResistanceDistance: nearestResistance.distance,
        nearestResistanceDistancePercent: nearestResistance.percent,
        score: compositeScore,
        scoreLabel: compositeScore >= 80 ? "매우 양호" : compositeScore >= 65 ? "양호" : compositeScore >= 50 ? "중립" : compositeScore >= 35 ? "주의" : "위험",
        warning:
          rsi >= 70 || recentTenReturn >= 12 || highDistancePercent <= 2 || currentPrice > bollingerBands.upper
            ? "단기 과열 가능성이 있습니다."
            : undefined,
      },
      shortInterestLabel: shortInterest?.label ?? "데이터 없음",
    },
  };
}
