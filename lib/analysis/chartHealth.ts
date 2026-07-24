import { calculateSMA } from "@/lib/market/calculateIndicators";
import type { ChartHealthGrade, ChartHealthResult, MarketStructure, MarketStructurePresentation, PricePoint } from "@/lib/market/types";

const MIN_REQUIRED_CANDLES = 60;

const MARKET_STRUCTURE_PRESENTATION: Record<MarketStructure, MarketStructurePresentation> = {
  HH_HL: {
    code: "HH_HL",
    label: "안정적인 상승 흐름",
    summary: "최근 고점과 저점이 함께 높아지며 안정적인 상승 흐름을 보이고 있습니다.",
  },
  LH_HL: {
    code: "LH_HL",
    label: "상승세 확인 필요",
    summary: "최근 저점은 높아졌지만 이전 고점을 넘지 못해 상승세가 아직 뚜렷하지 않습니다.",
  },
  HH_LL: {
    code: "HH_LL",
    label: "변동성 확대",
    summary: "고점은 높아졌지만 저점은 낮아져 가격 변동이 불안정합니다.",
  },
  LH_LL: {
    code: "LH_LL",
    label: "약한 흐름",
    summary: "최근 고점과 저점이 모두 낮아져 중기 흐름이 약해지고 있습니다.",
  },
  UNKNOWN: {
    code: "UNKNOWN",
    label: "판단 보류",
    summary: "가격 흐름을 판단하기 위한 데이터가 부족한 상태입니다.",
  },
};

function getMarketStructurePresentation(marketStructure: MarketStructure) {
  return MARKET_STRUCTURE_PRESENTATION[marketStructure];
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function isValidPrice(price: PricePoint) {
  return (
    Number.isFinite(price.open) &&
    Number.isFinite(price.high) &&
    Number.isFinite(price.low) &&
    Number.isFinite(price.close) &&
    price.open > 0 &&
    price.high > 0 &&
    price.low > 0 &&
    price.close > 0 &&
    price.high >= price.low &&
    price.high >= price.open &&
    price.high >= price.close &&
    price.low <= price.open &&
    price.low <= price.close
  );
}

function pct(current: number, previous: number) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getGrade(score: number): { grade: ChartHealthGrade; label: string } {
  if (score >= 85) return { grade: "VERY_HEALTHY", label: "매우 건강" };
  if (score >= 70) return { grade: "HEALTHY", label: "건강" };
  if (score >= 55) return { grade: "NEUTRAL", label: "보통" };
  if (score >= 40) return { grade: "DAMAGED", label: "약화" };
  return { grade: "SEVERELY_DAMAGED", label: "크게 약화" };
}

function calculateATR(prices: PricePoint[], period = 14) {
  if (prices.length < period + 1) return null;
  const recent = prices.slice(-(period + 1));
  const trueRanges: number[] = [];

  for (let index = 1; index < recent.length; index += 1) {
    const current = recent[index];
    const previous = recent[index - 1];
    trueRanges.push(Math.max(current.high - current.low, Math.abs(current.high - previous.close), Math.abs(current.low - previous.close)));
  }

  return average(trueRanges);
}

function findPivots(prices: PricePoint[], side: "high" | "low") {
  const lookback = 3;
  const recent = prices.slice(-120);
  const pivots: number[] = [];

  for (let index = lookback; index < recent.length - lookback; index += 1) {
    const current = recent[index];
    const neighbors = [...recent.slice(index - lookback, index), ...recent.slice(index + 1, index + lookback + 1)];

    if (side === "high" && neighbors.every((price) => current.high >= price.high)) {
      pivots.push(current.high);
    }

    if (side === "low" && neighbors.every((price) => current.low <= price.low)) {
      pivots.push(current.low);
    }
  }

  return pivots.slice(-2);
}

function getMarketStructure(prices: PricePoint[]): MarketStructure {
  const highs = findPivots(prices, "high");
  const lows = findPivots(prices, "low");
  if (highs.length < 2 || lows.length < 2) return "UNKNOWN";

  const higherHigh = highs[1] > highs[0];
  const higherLow = lows[1] > lows[0];

  if (higherHigh && higherLow) return "HH_HL";
  if (!higherHigh && higherLow) return "LH_HL";
  if (higherHigh && !higherLow) return "HH_LL";
  return "LH_LL";
}

function getMeaningfulDirection(previous: number, recent: number, atr: number | null) {
  const threshold = Math.max(previous * 0.01, (atr ?? 0) * 0.5);
  const diff = recent - previous;
  if (Math.abs(diff) < threshold) return "flat";
  return diff > 0 ? "up" : "down";
}

function getMarketStructureAnalysis(prices: PricePoint[], atr: number | null) {
  const highs = findPivots(prices, "high");
  const lows = findPivots(prices, "low");

  if (highs.length < 2 || lows.length < 2) {
    return {
      marketStructure: "UNKNOWN" as MarketStructure,
      score: 6,
      highChangePercent: null,
      lowChangePercent: null,
    };
  }

  const previousHigh = highs[0];
  const recentHigh = highs[1];
  const previousLow = lows[0];
  const recentLow = lows[1];
  const highChangePercent = pct(recentHigh, previousHigh) ?? 0;
  const lowChangePercent = pct(recentLow, previousLow) ?? 0;
  const highDirection = getMeaningfulDirection(previousHigh, recentHigh, atr);
  const lowDirection = getMeaningfulDirection(previousLow, recentLow, atr);

  let marketStructure: MarketStructure = "UNKNOWN";
  if (highDirection !== "down" && lowDirection === "up") marketStructure = "HH_HL";
  else if (highDirection === "down" && lowDirection === "up") marketStructure = "LH_HL";
  else if (highDirection === "up" && lowDirection === "down") marketStructure = "HH_LL";
  else if (highDirection === "down" && lowDirection === "down") marketStructure = "LH_LL";
  else marketStructure = "UNKNOWN";

  let score = 6;
  if (highDirection === "up" && lowDirection === "up") score = 20;
  else if (lowDirection === "up" && highDirection === "flat") score = 17;
  else if (lowDirection === "up" && highDirection === "down") score = 14;
  else if (highDirection === "up" && lowDirection === "down") score = Math.abs(lowChangePercent) <= 3 ? 12 : 8;
  else if (highDirection === "flat" && lowDirection === "flat") score = 12;
  else if (highDirection === "down" && lowDirection === "down") {
    const averageDrop = (Math.abs(Math.min(highChangePercent, 0)) + Math.abs(Math.min(lowChangePercent, 0))) / 2;
    if (averageDrop <= 1) score = 7;
    else if (averageDrop <= 3) score = 4;
    else score = 0;
  }

  return { marketStructure, score, highChangePercent, lowChangePercent };
}

function scoreVolatility(atrPercent: number | null) {
  if (atrPercent === null) return 0;
  if (atrPercent <= 2) return 10;
  if (atrPercent <= 4) return 8;
  if (atrPercent <= 6) return 5;
  if (atrPercent <= 8) return 2;
  return 0;
}

function scorePricePosition(distanceFromMa20: number | null, drawdown: number | null) {
  let score = 0;

  if (distanceFromMa20 !== null) {
    if (distanceFromMa20 >= 0 && distanceFromMa20 <= 8) score += 8;
    else if (distanceFromMa20 > 8 && distanceFromMa20 <= 15) score += 5;
    else if (distanceFromMa20 > 15) score += 1;
    else if (distanceFromMa20 >= -3) score += 4;
  }

  if (drawdown !== null) {
    if (drawdown <= 5) score += 7;
    else if (drawdown <= 10) score += 5;
    else if (drawdown <= 15) score += 3;
  }

  return Math.min(score, 15);
}

function getDistributionDays(prices: PricePoint[]) {
  const recent = prices.slice(-21);
  let count = 0;

  for (let index = 1; index < recent.length; index += 1) {
    const current = recent[index];
    const previous = recent[index - 1];
    const drop = ((current.close - previous.close) / previous.close) * 100;
    if (drop <= -1.5 && (current.volume ?? 0) > (previous.volume ?? 0)) count += 1;
  }

  return count;
}

function scoreVolumeHealth(prices: PricePoint[]) {
  const recent = prices.slice(-21);
  const upVolumes: number[] = [];
  const downVolumes: number[] = [];

  for (let index = 1; index < recent.length; index += 1) {
    const current = recent[index];
    const previous = recent[index - 1];
    const volume = current.volume ?? 0;
    if (volume <= 0) continue;
    if (current.close >= previous.close) upVolumes.push(volume);
    else downVolumes.push(volume);
  }

  const avgUp = average(upVolumes);
  const avgDown = average(downVolumes);
  if (avgUp === null || avgDown === null || avgDown === 0) {
    return { score: upVolumes.length > 0 ? 9 : 0, ratio: null };
  }

  const ratio = avgUp / avgDown;
  if (ratio >= 1.5) return { score: 15, ratio };
  if (ratio >= 1.2) return { score: 12, ratio };
  if (ratio >= 1.0) return { score: 9, ratio };
  if (ratio >= 0.8) return { score: 5, ratio };
  return { score: 2, ratio };
}

function scoreShortTermOverheat(
  prices: PricePoint[],
  close: number,
  ma20: number | null,
  ma60: number | null,
  ma20Slope: number | null,
  ma60Slope: number | null,
  marketStructure: MarketStructure,
  fiveDayReturn: number | null,
  twentyDayReturn: number | null,
  atr: number | null,
  volumeRatio: number | null,
) {
  const recent = prices.slice(-5);
  const averageVolume20 = average(
    prices
      .slice(-20)
      .map((price) => price.volume ?? 0)
      .filter((volume) => volume > 0),
  );
  const priorAtr = prices.length >= 20 ? calculateATR(prices.slice(0, -5), 14) : null;
  const atrExpansionRatio =
    atr !== null && priorAtr !== null && priorAtr > 0 ? atr / priorAtr : null;
  const upperWickCount = recent.filter((price) => {
    const range = price.high - price.low;
    if (range <= 0) return false;
    const upperWick = price.high - Math.max(price.open, price.close);
    return upperWick / range >= 0.45;
  }).length;
  const highVolumeDownDays = recent.filter((price, index) => {
    const previous = prices[prices.length - recent.length + index - 1];
    const isDown = price.close < price.open && (!previous || price.close < previous.close);
    const hasHeavyVolume =
      averageVolume20 !== null &&
      (price.volume ?? 0) >= averageVolume20 * 1.25;
    return isDown && hasHeavyVolume;
  }).length;
  const distanceFromMa20 = ma20 !== null ? pct(close, ma20) : null;
  const healthyTrend =
    ma20 !== null &&
    ma60 !== null &&
    ma20Slope !== null &&
    ma60Slope !== null &&
    close > ma20 &&
    ma20 > ma60 &&
    ma20Slope > 0 &&
    ma60Slope >= 0 &&
    marketStructure !== "LH_LL";

  let score = 100;
  if ((fiveDayReturn ?? 0) > 12) score -= 12;
  if ((fiveDayReturn ?? 0) > 20) score -= 8;
  if ((twentyDayReturn ?? 0) > 25) score -= 10;
  if ((twentyDayReturn ?? 0) > 40) score -= 10;
  if ((distanceFromMa20 ?? 0) > 12) score -= 15;
  if ((distanceFromMa20 ?? 0) > 20) score -= 15;
  if ((atrExpansionRatio ?? 1) >= 1.35) score -= 10;
  if ((atrExpansionRatio ?? 1) >= 1.7) score -= 10;
  if (upperWickCount >= 2) score -= 10;
  if (upperWickCount >= 3) score -= 8;
  if (highVolumeDownDays >= 1) score -= 12;
  if (highVolumeDownDays >= 2) score -= 13;

  // A healthy trend can remain strong after a breakout. Only unstable price
  // action should push this stability score into the weak range.
  if (
    healthyTrend &&
    highVolumeDownDays === 0 &&
    upperWickCount < 3 &&
    (volumeRatio ?? 1) >= 0.9
  ) {
    score = Math.max(score, 72);
  }

  return {
    score: Math.round(clamp(score)),
    atrExpansionRatio,
    upperWickCount,
    highVolumeDownDays,
  };
}

export function calculateChartHealth(prices: PricePoint[], currentPrice?: number): ChartHealthResult {
  const cleaned = prices.filter(isValidPrice).sort((a, b) => a.date.localeCompare(b.date));
  const warnings: string[] = [];
  const positives: string[] = [];
  const negatives: string[] = [];

  if (cleaned.length < MIN_REQUIRED_CANDLES) {
    return {
      score: 0,
      grade: "SEVERELY_DAMAGED",
      label: "데이터 부족",
      components: { maAlignment: 0, maSlope: 0, marketStructure: 0, pricePosition: 0, volatility: 0, volumeHealth: 0, shortTermRecovery: 0, shortTermOverheat: 0 },
      metrics: {
        ma20: null,
        ma60: null,
        ma120: null,
        currentPrice: null,
        ma20Slope: null,
        ma60Slope: null,
        ma120Slope: null,
        highChangePercent: null,
        lowChangePercent: null,
        distanceFromMa20: null,
        drawdownFromRecentHigh: null,
        atrPercent: null,
        distributionDays: 0,
        volumeRatio: null,
        marketStructure: "UNKNOWN",
        fiveDayReturn: null,
        twentyDayReturn: null,
        atrExpansionRatio: null,
        upperWickCount: 0,
        highVolumeDownDays: 0,
      },
      damagePenalty: 0,
      appliedScoreCap: null,
      appliedScoreCapReason: null,
      marketStructure: getMarketStructurePresentation("UNKNOWN"),
      positives: [],
      negatives: ["유효한 가격 데이터가 부족해 차트 건전도 평가가 제한됩니다."],
      warnings: ["최소 60거래일 이상의 OHLCV 데이터가 필요합니다."],
      insufficientData: true,
    };
  }

  const closes = cleaned.map((price) => price.close);
  const close = currentPrice && currentPrice > 0 ? currentPrice : closes.at(-1) ?? 0;
  const ma20 = calculateSMA(closes, 20);
  const ma60 = calculateSMA(closes, 60);
  const ma120 = calculateSMA(closes, 120);
  const ma20Ago = cleaned.length >= 25 ? calculateSMA(closes.slice(0, -5), 20) : null;
  const ma60Ago = cleaned.length >= 70 ? calculateSMA(closes.slice(0, -10), 60) : null;
  const ma120Ago = cleaned.length >= 140 ? calculateSMA(closes.slice(0, -20), 120) : null;
  const ma20Slope = ma20 !== null && ma20Ago !== null ? pct(ma20, ma20Ago) : null;
  const ma60Slope = ma60 !== null && ma60Ago !== null ? pct(ma60, ma60Ago) : null;
  const ma120Slope = ma120 !== null && ma120Ago !== null ? pct(ma120, ma120Ago) : null;
  const recentHigh = Math.max(...cleaned.slice(-60).map((price) => price.high));
  const drawdownFromRecentHigh = recentHigh > 0 ? ((recentHigh - close) / recentHigh) * 100 : null;
  const distanceFromMa20 = ma20 !== null ? pct(close, ma20) : null;
  const atr = calculateATR(cleaned, 14);
  const atrPercent = atr !== null && close > 0 ? (atr / close) * 100 : null;
  const marketStructureAnalysis = getMarketStructureAnalysis(cleaned, atr);
  const marketStructure = marketStructureAnalysis.marketStructure;
  const distributionDays = getDistributionDays(cleaned);
  const volume = scoreVolumeHealth(cleaned);
  const fiveDayReturn = cleaned.length >= 6 ? pct(close, cleaned.at(-6)?.close ?? close) : null;
  const twentyDayReturn = cleaned.length >= 21 ? pct(close, cleaned.at(-21)?.close ?? close) : null;
  const previousClose = cleaned.at(-2)?.close ?? null;
  const previousMa5 = cleaned.length >= 6 ? calculateSMA(closes.slice(0, -1), 5) : null;
  const previousMa20 = cleaned.length >= 21 ? calculateSMA(closes.slice(0, -1), 20) : null;
  const recoveredMa5 = previousClose !== null && previousMa5 !== null && previousClose <= previousMa5 && close > (calculateSMA(closes, 5) ?? close);
  const recoveredMa20 = previousClose !== null && previousMa20 !== null && previousClose <= previousMa20 && close > (ma20 ?? close);

  let maAlignment = 0;
  if (ma20 !== null && close > ma20) maAlignment += 7;
  if (ma20 !== null && ma60 !== null && ma20 > ma60) maAlignment += 8;
  if (ma60 !== null && ma120 !== null && ma60 > ma120) maAlignment += 7;
  if (ma20 !== null && ma60 !== null && ma120 !== null && close > ma20 && ma20 > ma60 && ma60 > ma120) maAlignment += 3;
  maAlignment = Math.min(Math.round(maAlignment * 0.8), 20);

  let maSlope = 0;
  if (ma20Slope !== null) maSlope += ma20Slope > 1 ? 8 : ma20Slope >= 0 ? 5 : ma20Slope >= -1 ? 2 : 0;
  if (ma60Slope !== null) maSlope += ma60Slope > 1 ? 7 : ma60Slope >= 0 ? 5 : ma60Slope >= -1 ? 2 : 0;

  const marketStructureScore = Math.round(marketStructureAnalysis.score * 0.75);
  const pricePosition = scorePricePosition(distanceFromMa20, drawdownFromRecentHigh);
  const volatility = scoreVolatility(atrPercent);
  const volumeHealth = volume.score;
  let shortTermRecovery = 0;
  if (close > (calculateSMA(closes, 5) ?? Number.POSITIVE_INFINITY)) shortTermRecovery += 2;
  if (ma20 !== null && close > ma20) shortTermRecovery += 2;
  if ((fiveDayReturn ?? 0) > 0) shortTermRecovery += 2;
  if ((twentyDayReturn ?? 0) > 0) shortTermRecovery += 2;
  if (recoveredMa5) shortTermRecovery += 1;
  if (recoveredMa20) shortTermRecovery += 1;
  const shortTermOverheat = scoreShortTermOverheat(
    cleaned,
    close,
    ma20,
    ma60,
    ma20Slope,
    ma60Slope,
    marketStructure,
    fiveDayReturn,
    twentyDayReturn,
    atr,
    volume.ratio,
  );

  let damagePenalty = 0;
  if (ma20 !== null && close < ma20) damagePenalty += 5;
  if (ma60 !== null && close < ma60) damagePenalty += 10;
  if (ma60Slope !== null && ma60Slope < 0) damagePenalty += 8;
  if (drawdownFromRecentHigh !== null && drawdownFromRecentHigh > 15) damagePenalty += 7;
  if (drawdownFromRecentHigh !== null && drawdownFromRecentHigh > 25) damagePenalty += 10;
  if (distributionDays >= 3) damagePenalty += 6;
  if (distributionDays >= 5) damagePenalty += 6;
  if (atrPercent !== null && atrPercent > 8) damagePenalty += 5;
  damagePenalty = Math.round(Math.min(damagePenalty, 40) * 0.5);
  if (shortTermRecovery >= 7) damagePenalty = Math.max(0, damagePenalty - 3);
  else if (shortTermRecovery >= 5) damagePenalty = Math.max(0, damagePenalty - 1);

  const weightedHealthScore =
    (maAlignment / 20) * 100 * 0.18 +
    (maSlope / 15) * 100 * 0.18 +
    (marketStructureScore / 15) * 100 * 0.18 +
    (pricePosition / 15) * 100 * 0.14 +
    (volatility / 10) * 100 * 0.1 +
    (volumeHealth / 15) * 100 * 0.14 +
    shortTermOverheat.score * 0.08;
  const recoveryAdjustment = shortTermRecovery >= 7 ? 4 : shortTermRecovery >= 5 ? 2 : 0;
  let rawScore = weightedHealthScore + recoveryAdjustment - damagePenalty;
  let appliedScoreCap: number | null = null;
  let appliedScoreCapReason: string | null = null;
  const capReasons: string[] = [];

  if (marketStructure === "LH_LL" && ma60 !== null && ma60Slope !== null && close < ma60 && ma60Slope < 0) {
    appliedScoreCap = 50;
    appliedScoreCapReason = "현재 주가가 60일 이동평균선 아래에 있고 중기 흐름도 하락하고 있어 최종 점수가 낮게 조정되었습니다.";
    capReasons.push("단기 상승이 나타나더라도 중기 추세 전환으로 보기에는 아직 이릅니다.");
  }

  if (ma120 !== null && ma60Slope !== null && ma120Slope !== null && close < ma120 && ma60Slope < 0 && ma120Slope < 0) {
    appliedScoreCap = Math.min(appliedScoreCap ?? 100, 40);
    appliedScoreCapReason = "현재 주가가 120일 이동평균선 아래에 있고 중장기 흐름도 하락하고 있어 최종 점수가 낮게 조정되었습니다.";
    capReasons.push("중장기 흐름이 회복되기 전까지는 반등 신호를 보수적으로 볼 필요가 있습니다.");
  }

  if (appliedScoreCap !== null) rawScore = Math.min(rawScore, appliedScoreCap);
  const score = Math.round(clamp(rawScore));
  const grade = getGrade(score);

  if (maAlignment >= 20) positives.push("현재가와 이동평균선 배열이 상승 추세에 우호적입니다.");
  if (shortTermRecovery >= 7) positives.push("최근 5~20거래일 흐름에서 회복 신호가 빠르게 나타나고 있습니다.");
  if (ma20Slope !== null && ma20Slope > 0) positives.push("20일 이동평균선이 상승 기울기를 유지하고 있습니다.");
  if (marketStructure === "HH_HL") positives.push(getMarketStructurePresentation(marketStructure).summary);
  if (volume.ratio !== null && volume.ratio >= 1.2) positives.push("상승일 평균 거래량이 하락일보다 우세합니다.");

  if (ma60Slope !== null && ma60Slope < 0) negatives.push("60일 이동평균선 기울기가 하락 중입니다.");
  if (marketStructure === "LH_LL") {
    const mediumTrendHeld =
      ma60 !== null &&
      ma20 !== null &&
      ma60Slope !== null &&
      close > ma60 &&
      ma60Slope > 0 &&
      ma20 > ma60 &&
      (drawdownFromRecentHigh ?? 100) <= 10;

    if (mediumTrendHeld) {
      warnings.push("단기 고점과 저점은 낮아졌지만, 중기 이동평균선은 상승하고 있어 전체 추세가 완전히 무너진 상태는 아닙니다.");
    } else {
      negatives.push(getMarketStructurePresentation(marketStructure).summary);
    }
  }
  if (marketStructure === "LH_HL") warnings.push("이전 고점을 넘어서는지 확인하기 전까지는 상승세를 보수적으로 해석하는 편이 좋습니다.");
  if (marketStructure === "HH_LL") warnings.push("가격 변동 폭이 커진 구간이므로 진입 가격과 손실 관리 기준을 명확히 둘 필요가 있습니다.");
  if (distributionDays >= 3) negatives.push(`최근 20거래일 동안 분산일이 ${distributionDays}회 발생했습니다.`);
  if (drawdownFromRecentHigh !== null && drawdownFromRecentHigh > 15) negatives.push("최근 고점 대비 낙폭이 커 차트 회복 확인이 필요합니다.");
  if (atrPercent !== null && atrPercent > 8) negatives.push("ATR 기준 변동성이 높아 가격 안정성이 낮습니다.");
  if (shortTermOverheat.highVolumeDownDays >= 1) {
    negatives.push("최근 거래량이 크게 늘어난 하락일이 있어 매도 압력 확인이 필요합니다.");
  }

  if (distanceFromMa20 !== null && distanceFromMa20 > 15) warnings.push("현재 위치에서는 추격 진입 부담이 커질 수 있습니다.");
  if (shortTermOverheat.score < 55) {
    warnings.push("단기 상승 속도와 가격 변동이 함께 커져 안정 여부를 확인할 필요가 있습니다.");
  } else if (shortTermOverheat.score < 75) {
    warnings.push("상승 흐름은 유지되고 있지만 단기 과열 부담이 일부 반영되었습니다.");
  }
  warnings.push(...capReasons);
  if (cleaned.length < 120) warnings.push("120거래일 미만 데이터로 장기 추세 평가는 제한적입니다.");

  return {
    score,
    grade: grade.grade,
    label: grade.label,
    components: { maAlignment, maSlope, marketStructure: marketStructureScore, pricePosition, volatility, volumeHealth, shortTermRecovery, shortTermOverheat: shortTermOverheat.score },
    metrics: {
      ma20,
      ma60,
      ma120,
      currentPrice: close,
      ma20Slope,
      ma60Slope,
      ma120Slope,
      highChangePercent: marketStructureAnalysis.highChangePercent,
      lowChangePercent: marketStructureAnalysis.lowChangePercent,
      distanceFromMa20,
      drawdownFromRecentHigh,
      atrPercent,
      distributionDays,
      volumeRatio: volume.ratio,
      marketStructure,
      fiveDayReturn,
      twentyDayReturn,
      atrExpansionRatio: shortTermOverheat.atrExpansionRatio,
      upperWickCount: shortTermOverheat.upperWickCount,
      highVolumeDownDays: shortTermOverheat.highVolumeDownDays,
    },
    damagePenalty,
    appliedScoreCap,
    appliedScoreCapReason,
    marketStructure: getMarketStructurePresentation(marketStructure),
    positives: positives.slice(0, 3),
    negatives: negatives.slice(0, 3),
    warnings: warnings.slice(0, 3),
    insufficientData: false,
  };
}

export function applyCompositeScoreCapByChartHealth(score: number, chartHealth: ChartHealthResult) {
  let cap = 100;

  if (
    chartHealth.metrics.marketStructure === "LH_LL" &&
    chartHealth.metrics.currentPrice !== null &&
    chartHealth.metrics.ma60 !== null &&
    chartHealth.metrics.ma60Slope !== null &&
    chartHealth.metrics.currentPrice < chartHealth.metrics.ma60 &&
    chartHealth.metrics.ma60Slope < 0
  ) {
    cap = Math.min(cap, 60);
  }
  if (
    (chartHealth.metrics.ma120 ?? 0) > 0 &&
    (chartHealth.metrics.currentPrice ?? 0) > 0 &&
    (chartHealth.metrics.currentPrice ?? 0) < (chartHealth.metrics.ma120 ?? 0) &&
    (chartHealth.metrics.ma60Slope ?? 0) < 0 &&
    (chartHealth.metrics.ma120Slope ?? 0) < 0
  ) {
    cap = Math.min(cap, 45);
  }

  return Math.min(score, cap);
}
