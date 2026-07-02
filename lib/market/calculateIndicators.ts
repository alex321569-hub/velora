import type {
  BollingerBands,
  HistoricalPriceValidationResult,
  MacdIndicator,
  PricePoint,
  RsiStatus,
  SupportResistance,
  SupportResistanceLevel,
} from "./types";

export function calculatePercentChange(current: number, previous: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return 0;
  }

  return ((current - previous) / previous) * 100;
}

export function calculateSMA(values: number[], period: number): number | null {
  if (values.length < period || period <= 0) {
    return null;
  }

  const slice = values.slice(-period);
  return slice.reduce((sum, value) => sum + value, 0) / period;
}

export function calculateRSI(values: number[], period = 14): number {
  if (values.length <= period) {
    return 50;
  }

  const recentValues = values.slice(-(period + 1));
  let gains = 0;
  let losses = 0;

  for (let index = 1; index < recentValues.length; index += 1) {
    const difference = recentValues[index] - recentValues[index - 1];
    if (difference >= 0) {
      gains += difference;
    } else {
      losses += Math.abs(difference);
    }
  }

  const averageGain = gains / period;
  const averageLoss = losses / period;

  if (averageLoss === 0) {
    return 100;
  }

  const relativeStrength = averageGain / averageLoss;
  return 100 - 100 / (1 + relativeStrength);
}

function calculateEMA(values: number[], period: number): Array<number | null> {
  if (values.length < period || period <= 0) {
    return values.map(() => null);
  }

  const multiplier = 2 / (period + 1);
  const emaValues: Array<number | null> = values.map(() => null);
  let ema = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  emaValues[period - 1] = ema;

  for (let index = period; index < values.length; index += 1) {
    ema = (values[index] - ema) * multiplier + ema;
    emaValues[index] = ema;
  }

  return emaValues;
}

export function calculateMACD(values: number[]): MacdIndicator | null {
  const fastPeriod = 12;
  const slowPeriod = 26;
  const signalPeriod = 9;

  if (values.length < slowPeriod + signalPeriod) {
    return null;
  }

  const ema12 = calculateEMA(values, fastPeriod);
  const ema26 = calculateEMA(values, slowPeriod);
  const macdSeries = values.map((_, index) => {
    const fast = ema12[index];
    const slow = ema26[index];
    return fast === null || slow === null ? null : fast - slow;
  });
  const validMacdValues = macdSeries.filter((value): value is number => value !== null);

  if (validMacdValues.length < signalPeriod) {
    return null;
  }

  const signalSeries = calculateEMA(validMacdValues, signalPeriod);
  const macd = validMacdValues.at(-1);
  const signal = signalSeries.at(-1);

  if (macd === undefined || signal === undefined || signal === null) {
    return null;
  }

  const histogram = macd - signal;
  const status =
    macd > signal && histogram > 0
      ? "상승 신호"
      : macd < signal && histogram < 0
        ? "하락 신호"
        : "중립";

  return {
    macd,
    signal,
    histogram,
    status,
  };
}

export function getRsiStatus(rsi: number): RsiStatus {
  if (rsi >= 70) {
    return "과매수";
  }

  if (rsi <= 30) {
    return "과매도";
  }

  return "보통";
}

export function calculateBollingerBands(values: number[], period = 20, multiplier = 2): BollingerBands {
  const source = values.length >= period ? values.slice(-period) : values;
  const middle = source.reduce((sum, value) => sum + value, 0) / source.length;
  const variance = source.reduce((sum, value) => sum + (value - middle) ** 2, 0) / source.length;
  const deviation = Math.sqrt(variance);

  return {
    upper: middle + deviation * multiplier,
    middle,
    lower: middle - deviation * multiplier,
  };
}

export function validateHistoricalPrices(prices: PricePoint[], symbol = "UNKNOWN"): HistoricalPriceValidationResult {
  const errors: string[] = [];
  const seenDates = new Set<string>();
  const sortedPrices = [...prices].sort((a, b) => a.date.localeCompare(b.date));
  const wasAlreadySorted = prices.every((price, index) => index === 0 || prices[index - 1].date <= price.date);

  if (!wasAlreadySorted) {
    console.warn(`[market:${symbol}] historicalPrices 날짜가 오름차순이 아니어서 정렬 후 검증합니다.`);
  }

  for (const price of sortedPrices) {
    if (seenDates.has(price.date)) {
      errors.push(`${price.date}: 날짜 중복`);
    }
    seenDates.add(price.date);

    if (price.open <= 0 || price.high <= 0 || price.low <= 0 || price.close <= 0) {
      errors.push(`${price.date}: open/high/low/close는 모두 0보다 커야 합니다.`);
    }

    if (price.high < price.low) {
      errors.push(`${price.date}: high가 low보다 작습니다.`);
    }

    if (price.high < price.close || price.high < price.open) {
      errors.push(`${price.date}: high가 open 또는 close보다 작습니다.`);
    }

    if (price.low > price.close || price.low > price.open) {
      errors.push(`${price.date}: low가 open 또는 close보다 큽니다.`);
    }
  }

  if (errors.length > 0) {
    console.warn(`[market:${symbol}] 데이터 오류로 지표 계산 불가`, errors);
  }

  return {
    isValid: errors.length === 0,
    sortedPrices,
    errors,
  };
}

const roundPrice = (value: number) => Math.round(value * 100) / 100;

const percentDistance = (a: number, b: number) => Math.abs(a - b) / b;

function clusterPrices(
  candidates: SupportResistanceLevel[],
  currentPrice: number,
  tolerancePct = 0.015,
): SupportResistanceLevel[] {
  const sorted = [...candidates].sort((a, b) => a.price - b.price);
  const clusters: SupportResistanceLevel[][] = [];

  for (const candidate of sorted) {
    const lastCluster = clusters[clusters.length - 1];

    if (!lastCluster) {
      clusters.push([candidate]);
      continue;
    }

    const average = lastCluster.reduce((sum, item) => sum + item.price, 0) / lastCluster.length;

    if (Math.abs(candidate.price - average) / currentPrice <= tolerancePct) {
      lastCluster.push(candidate);
    } else {
      clusters.push([candidate]);
    }
  }

  return clusters.map((cluster) => {
    const totalWeight = cluster.reduce((sum, item) => sum + Math.max(item.confidence, 1), 0);
    const weightedPrice =
      cluster.reduce((sum, item) => sum + item.price * Math.max(item.confidence, 1), 0) / totalWeight;
    const confidence = Math.min(
      100,
      Math.round(
        cluster.reduce((sum, item) => sum + item.confidence, 0) / cluster.length +
          Math.min(cluster.length * 6, 18),
      ),
    );
    const reasons = Array.from(new Set(cluster.map((item) => item.reason)));

    return {
      price: roundPrice(weightedPrice),
      type: cluster[0].type,
      confidence,
      reason: reasons.slice(0, 2).join(" + "),
    };
  });
}

function getPivotCandidates(prices: PricePoint[], currentPrice: number): SupportResistanceLevel[] {
  const candidates: SupportResistanceLevel[] = [];
  const lookback = 3;
  const recent = prices.slice(-90);

  for (let index = lookback; index < recent.length - lookback; index += 1) {
    const item = recent[index];
    const previous = recent.slice(index - lookback, index);
    const next = recent.slice(index + 1, index + lookback + 1);

    const isPivotLow = previous.every((price) => item.low <= price.low) && next.every((price) => item.low <= price.low);
    const isPivotHigh =
      previous.every((price) => item.high >= price.high) && next.every((price) => item.high >= price.high);
    const recencyBonus = Math.round((index / recent.length) * 15);

    if (isPivotLow && item.low < currentPrice) {
      candidates.push({
        price: item.low,
        type: "support",
        confidence: 55 + recencyBonus,
        reason: "최근 피벗 저점",
      });
    }

    if (isPivotHigh && item.high > currentPrice) {
      candidates.push({
        price: item.high,
        type: "resistance",
        confidence: 55 + recencyBonus,
        reason: "최근 피벗 고점",
      });
    }
  }

  return candidates;
}

function getVolumeProfileCandidates(prices: PricePoint[], currentPrice: number): SupportResistanceLevel[] {
  const recent = prices.slice(-120);
  const withVolume = recent.filter((price) => typeof price.volume === "number");

  if (withVolume.length < 30) {
    return [];
  }

  const minPrice = Math.min(...withVolume.map((price) => price.low));
  const maxPrice = Math.max(...withVolume.map((price) => price.high));

  if (minPrice <= 0 || maxPrice <= minPrice) {
    return [];
  }

  const binCount = 40;
  const binSize = (maxPrice - minPrice) / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({
    index,
    low: minPrice + index * binSize,
    high: minPrice + (index + 1) * binSize,
    volume: 0,
  }));

  for (const price of withVolume) {
    const typicalPrice = (price.high + price.low + price.close) / 3;
    const index = Math.min(binCount - 1, Math.max(0, Math.floor((typicalPrice - minPrice) / binSize)));
    bins[index].volume += price.volume ?? 0;
  }

  const maxVolume = Math.max(...bins.map((bin) => bin.volume));
  if (maxVolume <= 0) {
    return [];
  }

  return bins
    .filter((bin) => bin.volume / maxVolume >= 0.55)
    .map((bin) => {
      const price = (bin.low + bin.high) / 2;
      const volumeScore = Math.round((bin.volume / maxVolume) * 30);

      return {
        price,
        type: price < currentPrice ? "support" : "resistance",
        confidence: 50 + volumeScore,
        reason: "거래량 집중 구간",
      };
    });
}

function getMovingAverageCandidates(prices: PricePoint[], currentPrice: number): SupportResistanceLevel[] {
  const closes = prices.map((price) => price.close);
  const periods = [20, 60, 120, 200];
  const candidates: SupportResistanceLevel[] = [];

  const sma = (period: number) => {
    if (closes.length < period) {
      return null;
    }

    const slice = closes.slice(-period);
    return slice.reduce((sum, value) => sum + value, 0) / period;
  };

  for (const period of periods) {
    const value = sma(period);
    if (!value) {
      continue;
    }

    candidates.push({
      price: value,
      type: value < currentPrice ? "support" : "resistance",
      confidence: period === 20 ? 58 : period === 60 ? 62 : 65,
      reason: `${period}일 이동평균선`,
    });
  }

  return candidates;
}

function getFibonacciCandidates(prices: PricePoint[], currentPrice: number): SupportResistanceLevel[] {
  const recent = prices.slice(-180);
  if (recent.length < 60) {
    return [];
  }

  const high = Math.max(...recent.map((price) => price.high));
  const low = Math.min(...recent.map((price) => price.low));

  if (low <= 0 || high <= low) {
    return [];
  }

  const range = high - low;
  const levels = [0.236, 0.382, 0.5, 0.618, 0.786];

  return levels.map((ratio) => {
    const price = high - range * ratio;

    return {
      price,
      type: price < currentPrice ? "support" : "resistance",
      confidence: 42,
      reason: `피보나치 ${(ratio * 100).toFixed(1)}%`,
    };
  });
}

export function calculateSupportResistance(prices: PricePoint[], currentPrice: number): SupportResistance {
  if (!prices || prices.length < 30) {
    return { supports: [], resistances: [] };
  }

  const sorted = [...prices]
    .filter(
      (price) =>
        price.open > 0 &&
        price.high > 0 &&
        price.low > 0 &&
        price.close > 0 &&
        price.high >= price.low &&
        price.high >= price.close &&
        price.high >= price.open &&
        price.low <= price.close &&
        price.low <= price.open,
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (sorted.length < 30) {
    return { supports: [], resistances: [] };
  }

  const lastClose = sorted[sorted.length - 1].close;
  const price = currentPrice && currentPrice > 0 ? currentPrice : lastClose;
  const candidatePool = [
    ...getPivotCandidates(sorted, price),
    ...getVolumeProfileCandidates(sorted, price),
    ...getMovingAverageCandidates(sorted, price),
    ...getFibonacciCandidates(sorted, price),
  ];
  const maxDistancePct = 0.25;
  const minConfidence = 55;
  const filtered = candidatePool.filter((level) => {
    const distance = percentDistance(level.price, price);

    if (distance > maxDistancePct) return false;
    if (level.price <= 0) return false;
    if (level.type === "support" && level.price >= price) return false;
    if (level.type === "resistance" && level.price <= price) return false;

    return true;
  });

  const supports = clusterPrices(
    filtered.filter((level) => level.type === "support"),
    price,
  )
    .filter((level) => level.confidence >= minConfidence)
    .sort((a, b) => Math.abs(a.price - price) - Math.abs(b.price - price))
    .slice(0, 5);

  const resistances = clusterPrices(
    filtered.filter((level) => level.type === "resistance"),
    price,
  )
    .filter((level) => level.confidence >= minConfidence)
    .sort((a, b) => Math.abs(a.price - price) - Math.abs(b.price - price))
    .slice(0, 5);

  return {
    supports,
    resistances,
    resistanceMessage: resistances.length === 0 ? "현재 의미 있는 저항선 없음 / 52주 최고가 돌파 구간" : undefined,
  };
}
