import type { BollingerBands, HistoricalPriceValidationResult, PricePoint, RsiStatus, SupportResistance } from "./types";

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

export function calculateSupportResistance(prices: PricePoint[], currentPrice: number): SupportResistance {
  const last90Levels = prices.slice(-90).flatMap((price) => [price.low, price.close, price.high]);
  const bucketSize = currentPrice >= 10000 ? 1000 : currentPrice >= 1000 ? 50 : 5;
  const buckets = new Map<number, number>();

  for (const level of last90Levels) {
    const bucket = Math.round(level / bucketSize) * bucketSize;
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }

  const rankedLevels = [...buckets.entries()]
    .map(([price, touches]) => ({ price, touches, distance: Math.abs(price - currentPrice) }))
    .sort((a, b) => b.touches - a.touches || a.distance - b.distance)
    .map((level) => level.price);

  const supports = rankedLevels
    .filter((price) => price < currentPrice)
    .sort((a, b) => b - a)
    .slice(0, 5);

  const resistances = rankedLevels
    .filter((price) => price > currentPrice)
    .sort((a, b) => a - b)
    .slice(0, 5);

  return {
    supports,
    resistances,
    resistanceMessage:
      resistances.length === 0 ? "현재 의미 있는 저항선 없음 / 52주 최고가 돌파 구간" : undefined,
  };
}
