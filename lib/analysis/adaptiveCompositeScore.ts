import { calculateMACD, calculateRSI, calculateSMA } from "@/lib/market/calculateIndicators";
import type {
  ChartHealthResult,
  MacdIndicator,
  MovingAverages,
  PricePoint,
  RelativeStrengthResult,
} from "@/lib/market/types";

export type AdaptiveScoreBreakdown = {
  chartHealthScore: number;
  shortTermRecoveryScore: number;
  momentumScore: number;
  volumeFlowScore: number;
  riskScore: number;
  dataQualityScore: number;
  relativeStrengthScore: number | null;
  entryAttractivenessScore: number;
  rawScore: number;
  finalScore: number;
  appliedCap: number | null;
  appliedCapReason: string | null;
  signals: {
    fiveDayReturn: number | null;
    twentyDayReturn: number | null;
    recoveredMa5: boolean;
    recoveredMa20: boolean;
    rsiImproving: boolean;
    macdImproving: boolean;
    volumeRatio: number | null;
  };
};

type AdaptiveScoreInput = {
  prices: PricePoint[];
  currentPrice: number;
  movingAverages: MovingAverages;
  rsi: number;
  macd: MacdIndicator | null;
  chartHealth: ChartHealthResult;
  relativeStrength?: RelativeStrengthResult;
};

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));

function percentChange(current: number, previous: number | undefined) {
  if (!previous || !Number.isFinite(current) || !Number.isFinite(previous)) return null;
  return ((current - previous) / previous) * 100;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateVolumeFlowScore(prices: PricePoint[]) {
  const recent = prices.slice(-21);
  const upVolumes: number[] = [];
  const downVolumes: number[] = [];

  for (let index = 1; index < recent.length; index += 1) {
    const volume = recent[index].volume ?? 0;
    if (volume <= 0) continue;
    if (recent[index].close >= recent[index - 1].close) upVolumes.push(volume);
    else downVolumes.push(volume);
  }

  const averageUp = average(upVolumes);
  const averageDown = average(downVolumes);
  const volumeRatio =
    averageUp !== null && averageDown !== null && averageDown > 0
      ? averageUp / averageDown
      : null;
  const latestFiveAverage = average(
    recent.slice(-5).map((price) => price.volume ?? 0).filter((volume) => volume > 0),
  );
  const priorAverage = average(
    recent.slice(0, -5).map((price) => price.volume ?? 0).filter((volume) => volume > 0),
  );

  let score = 50;
  if (volumeRatio !== null) {
    if (volumeRatio >= 1.5) score += 30;
    else if (volumeRatio >= 1.2) score += 20;
    else if (volumeRatio >= 1) score += 10;
    else if (volumeRatio < 0.7) score -= 25;
    else if (volumeRatio < 0.9) score -= 10;
  }
  if (latestFiveAverage !== null && priorAverage !== null && priorAverage > 0) {
    const recentRatio = latestFiveAverage / priorAverage;
    if (recentRatio >= 1.25) score += 15;
    else if (recentRatio >= 1.05) score += 7;
    else if (recentRatio < 0.7) score -= 10;
  }

  return { score: Math.round(clamp(score)), volumeRatio };
}

function calculateDataQualityScore(prices: PricePoint[], input: AdaptiveScoreInput) {
  let score = 20;
  if (prices.length >= 60) score += 25;
  if (prices.length >= 120) score += 20;
  if (prices.length >= 200) score += 20;
  if (prices.filter((price) => (price.volume ?? 0) > 0).length >= Math.min(40, prices.length)) {
    score += 10;
  }
  if (input.macd !== null && Number.isFinite(input.rsi)) score += 5;
  return Math.round(clamp(score));
}

export function calculateAdaptiveCompositeScore(
  input: AdaptiveScoreInput,
): AdaptiveScoreBreakdown {
  const prices = [...input.prices]
    .filter((price) => Number.isFinite(price.close) && price.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const closes = prices.map((price) => price.close);
  const previousClose = closes.at(-2);
  const previousMa5 = calculateSMA(closes.slice(0, -1), 5);
  const previousMa20 = calculateSMA(closes.slice(0, -1), 20);
  const fiveDayReturn = percentChange(input.currentPrice, closes.at(-6));
  const twentyDayReturn = percentChange(input.currentPrice, closes.at(-21));
  const recoveredMa5 =
    previousClose !== undefined &&
    previousMa5 !== null &&
    input.movingAverages.sma5 !== null &&
    previousClose <= previousMa5 &&
    input.currentPrice > input.movingAverages.sma5;
  const recoveredMa20 =
    previousClose !== undefined &&
    previousMa20 !== null &&
    input.movingAverages.sma20 !== null &&
    previousClose <= previousMa20 &&
    input.currentPrice > input.movingAverages.sma20;

  const previousRsi = closes.length > 15 ? calculateRSI(closes.slice(0, -1)) : input.rsi;
  const previousMacd = closes.length > 36 ? calculateMACD(closes.slice(0, -1)) : null;
  const rsiImproving = input.rsi > previousRsi && input.rsi <= 70;
  const macdImproving =
    input.macd !== null &&
    (input.macd.histogram > 0 ||
      (previousMacd !== null && input.macd.histogram > previousMacd.histogram));

  let shortTermRecoveryScore = 25;
  if (input.movingAverages.sma5 !== null && input.currentPrice > input.movingAverages.sma5) {
    shortTermRecoveryScore += 12;
  }
  if (input.movingAverages.sma20 !== null && input.currentPrice > input.movingAverages.sma20) {
    shortTermRecoveryScore += 13;
  }
  if (recoveredMa5) shortTermRecoveryScore += 15;
  if (recoveredMa20) shortTermRecoveryScore += 20;
  if (fiveDayReturn !== null && fiveDayReturn > 0 && fiveDayReturn <= 8) {
    shortTermRecoveryScore += 10;
  }
  if (twentyDayReturn !== null && twentyDayReturn > 0 && twentyDayReturn <= 15) {
    shortTermRecoveryScore += 5;
  }
  if (
    input.movingAverages.sma5 !== null &&
    input.movingAverages.sma20 !== null &&
    input.movingAverages.sma5 > input.movingAverages.sma20
  ) {
    shortTermRecoveryScore += 10;
  }
  if ((fiveDayReturn ?? 0) < -5) shortTermRecoveryScore -= 15;
  if (
    input.movingAverages.sma5 !== null &&
    input.movingAverages.sma20 !== null &&
    input.currentPrice < input.movingAverages.sma5 &&
    input.currentPrice < input.movingAverages.sma20
  ) {
    shortTermRecoveryScore -= 15;
  }
  shortTermRecoveryScore = Math.round(clamp(shortTermRecoveryScore));

  let momentumScore = 45;
  if (input.rsi >= 45 && input.rsi <= 65) momentumScore += 20;
  else if (input.rsi > 35 && input.rsi < 45) momentumScore += rsiImproving ? 15 : 5;
  else if (input.rsi > 65 && input.rsi < 70) momentumScore += 8;
  else if (input.rsi >= 75) momentumScore -= 25;
  else if (input.rsi <= 30) momentumScore -= rsiImproving ? 5 : 20;
  if (rsiImproving) momentumScore += 10;
  if (input.macd?.histogram && input.macd.histogram > 0) momentumScore += 18;
  else if (macdImproving) momentumScore += 10;
  else if (input.macd !== null && input.macd.histogram < 0) momentumScore -= 15;
  if ((fiveDayReturn ?? 0) > 0 && (fiveDayReturn ?? 0) <= 8) momentumScore += 7;
  if ((fiveDayReturn ?? 0) >= 12) momentumScore -= 15;
  momentumScore = Math.round(clamp(momentumScore));

  const volumeFlow = calculateVolumeFlowScore(prices);

  let riskScore = 80;
  const atrPercent = input.chartHealth.metrics.atrPercent;
  const drawdown = input.chartHealth.metrics.drawdownFromRecentHigh;
  const distributionDays = input.chartHealth.metrics.distributionDays;
  if (atrPercent !== null && atrPercent > 8) riskScore -= 30;
  else if (atrPercent !== null && atrPercent > 5) riskScore -= 15;
  if (distributionDays >= 5) riskScore -= 25;
  else if (distributionDays >= 3) riskScore -= 12;
  if (drawdown !== null && drawdown > 25) riskScore -= 25;
  else if (drawdown !== null && drawdown > 15) riskScore -= 12;
  if (input.rsi >= 75 || (fiveDayReturn ?? 0) >= 12) riskScore -= 15;
  if (
    input.movingAverages.sma20 !== null &&
    input.currentPrice > input.movingAverages.sma20 * 1.15
  ) {
    riskScore -= 15;
  }
  const overheatStabilityScore = input.chartHealth.components.shortTermOverheat;
  if (overheatStabilityScore < 40) riskScore -= 20;
  else if (overheatStabilityScore < 65) riskScore -= 10;
  riskScore = Math.round(clamp(riskScore));

  const distanceFromMa20 = input.chartHealth.metrics.distanceFromMa20;
  let entryPricePositionScore = 70;
  if (distanceFromMa20 !== null) {
    if (distanceFromMa20 >= -3 && distanceFromMa20 <= 8) entryPricePositionScore = 90;
    else if (distanceFromMa20 > 8 && distanceFromMa20 <= 12) entryPricePositionScore = 65;
    else if (distanceFromMa20 > 12 && distanceFromMa20 <= 20) entryPricePositionScore = 35;
    else if (distanceFromMa20 > 20) entryPricePositionScore = 10;
    else if (distanceFromMa20 < -8) entryPricePositionScore = 35;
  }
  let entryAttractivenessScore = Math.round(
    overheatStabilityScore * 0.55 +
      riskScore * 0.25 +
      entryPricePositionScore * 0.2,
  );
  if ((fiveDayReturn ?? 0) > 15) entryAttractivenessScore -= 10;
  if (input.chartHealth.metrics.highVolumeDownDays >= 1) entryAttractivenessScore -= 10;
  entryAttractivenessScore = Math.round(clamp(entryAttractivenessScore));

  const dataQualityScore = calculateDataQualityScore(prices, input);
  const effectiveChartHealth = input.chartHealth.insufficientData
    ? 50
    : input.chartHealth.score;
  const hasRelativeStrength =
    input.relativeStrength !== undefined && input.relativeStrength.grade !== "UNKNOWN";
  const relativeStrengthScore = hasRelativeStrength
    ? input.relativeStrength?.score ?? null
    : null;
  const rawScore = Math.round(
    hasRelativeStrength && relativeStrengthScore !== null
      ? effectiveChartHealth * 0.22 +
          shortTermRecoveryScore * 0.18 +
          momentumScore * 0.17 +
          volumeFlow.score * 0.13 +
          relativeStrengthScore * 0.15 +
          riskScore * 0.08 +
          dataQualityScore * 0.07
      : effectiveChartHealth * 0.25 +
          shortTermRecoveryScore * 0.2 +
          momentumScore * 0.2 +
          volumeFlow.score * 0.15 +
          riskScore * 0.1 +
          dataQualityScore * 0.1,
  );

  let appliedCap: number | null = null;
  let appliedCapReason: string | null = null;
  const metrics = input.chartHealth.metrics;
  const severeLongTermDowntrend =
    metrics.currentPrice !== null &&
    metrics.ma120 !== null &&
    metrics.ma60Slope !== null &&
    metrics.ma120Slope !== null &&
    metrics.currentPrice < metrics.ma120 &&
    metrics.ma60Slope < 0 &&
    metrics.ma120Slope < 0;
  const confirmedMediumTermDowntrend =
    metrics.marketStructure === "LH_LL" &&
    metrics.currentPrice !== null &&
    metrics.ma60 !== null &&
    metrics.ma60Slope !== null &&
    metrics.currentPrice < metrics.ma60 &&
    metrics.ma60Slope < 0;

  if (severeLongTermDowntrend) {
    appliedCap = 45;
    appliedCapReason =
      "현재가가 120일선 아래에 있고 중장기 기울기도 하락해 점수가 제한되었습니다.";
  } else if (confirmedMediumTermDowntrend) {
    appliedCap = recoveredMa20 || (macdImproving && (fiveDayReturn ?? 0) > 0) ? 65 : 60;
    appliedCapReason =
      "중기 하락 흐름이 확인되어 회복 신호를 반영하되 점수 상한을 적용했습니다.";
  }

  return {
    chartHealthScore: effectiveChartHealth,
    shortTermRecoveryScore,
    momentumScore,
    volumeFlowScore: volumeFlow.score,
    riskScore,
    dataQualityScore,
    relativeStrengthScore,
    entryAttractivenessScore,
    rawScore,
    finalScore: appliedCap === null ? rawScore : Math.min(rawScore, appliedCap),
    appliedCap,
    appliedCapReason,
    signals: {
      fiveDayReturn,
      twentyDayReturn,
      recoveredMa5,
      recoveredMa20,
      rsiImproving,
      macdImproving,
      volumeRatio: volumeFlow.volumeRatio,
    },
  };
}
