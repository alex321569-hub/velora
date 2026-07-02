import {
  calculateBollingerBands,
  calculatePercentChange,
  calculateRSI,
  calculateSMA,
  calculateSupportResistance,
  getRsiStatus,
  validateHistoricalPrices,
} from "./calculateIndicators";
import { mockMarketDataProvider } from "./providers/mockProvider";
import type { StockMarketProvider } from "./providers/marketProvider";
import { yahooMarketDataProvider } from "./providers/yahooProvider";
import type { CompanyProfile, Quote, StockAnalysisResponse, StockBasicInfo, SupportResistanceLevel } from "./types";

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

function buildBasicInfo(profile: CompanyProfile, quote: Quote, currentPrice: number, previousClose: number): StockBasicInfo {
  const changePercent = quote.changePercent ?? calculatePercentChange(currentPrice, previousClose);

  console.log("quote change debug", {
    currentPrice,
    previousClose,
    changePercent,
    marketState: quote.marketState,
  });

  return {
    symbol: profile.symbol,
    name: profile.name,
    koreanName: profile.koreanName,
    exchange: profile.exchange,
    country: profile.country,
    currentPrice,
    previousClose,
    changePercent,
    currency: quote.currency,
    dataSource: quote.dataSource,
    dataSourceNotice: quote.dataSourceNotice,
    marketState: quote.marketState,
    fetchedAt: quote.fetchedAt,
  };
}

function getScoreLabel(score: number) {
  if (score >= 80) {
    return "매우 양호";
  }

  if (score >= 65) {
    return "양호";
  }

  if (score >= 50) {
    return "중립";
  }

  if (score >= 35) {
    return "주의";
  }

  return "위험";
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

export function getMarketProvider(): StockMarketProvider {
  const providerName = process.env.MARKET_PROVIDER?.toLowerCase();

  if (providerName === "mock") {
    return mockMarketDataProvider;
  }

  return yahooMarketDataProvider;
}

export async function getStockAnalysis(symbol: string, provider = getMarketProvider()): Promise<StockAnalysisResponse | null> {
  const [profile, quote, historicalPrices, shortInterest] = await Promise.all([
    provider.getCompanyProfile(symbol),
    provider.getQuote(symbol),
    provider.getHistoricalPrices(symbol, "1y"),
    provider.getShortInterest(symbol),
  ]);

  if (!profile) {
    return null;
  }

  const effectiveQuote: Quote = quote ?? {
    symbol,
    currentPrice: null,
    previousClose: null,
    changePercent: null,
    marketCap: null,
    currency: profile.currency,
    dataSource: provider.capabilities.name,
  };

  const validation = validateHistoricalPrices(historicalPrices, symbol);
  const sortedPrices = validation.sortedPrices;
  const closes = sortedPrices.map((price) => price.close);
  const lastHistoricalClose = closes.at(-1) ?? 0;
  const currentPrice = effectiveQuote.currentPrice ?? lastHistoricalClose;
  const previousClose = effectiveQuote.previousClose ?? closes.at(-2) ?? lastHistoricalClose;
  const basic = buildBasicInfo(profile, effectiveQuote, currentPrice, previousClose);

  if (!validation.isValid || closes.length === 0 || currentPrice <= 0) {
    return {
      basic,
      recentPrices: sortedPrices.slice(-10).reverse().map((price) => ({ ...price, changePercent: 0 })),
      indicators: {
        calculationError: "데이터 없음",
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
        shortInterestLabel: "데이터 없음",
      },
    };
  }

  if (effectiveQuote.currentPrice !== null && Math.abs(effectiveQuote.currentPrice - lastHistoricalClose) > 0.0001) {
    console.warn(`[market:${provider.capabilities.name}] ${symbol} quote price differs from last historical close. Using market-state quote price.`);
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
  const highDrawdownPercent = week52High > 0 ? ((currentPrice - week52High) / week52High) * 100 : 0;
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
  const hasOverheatWarning =
    rsi >= 70 ||
    recentTenReturn >= 12 ||
    highDistancePercent <= 2 ||
    currentPrice > bollingerBands.upper;

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
        scoreLabel: getScoreLabel(compositeScore),
        warning: hasOverheatWarning ? "단기 과열 가능성이 있습니다." : undefined,
      },
      shortInterestLabel: shortInterest?.label ?? "",
    },
  };
}
