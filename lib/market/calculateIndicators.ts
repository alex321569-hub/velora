import type {
  BollingerBands,
  HistoricalPriceValidationResult,
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
  const recentPrices = prices
    .slice(-180)
    .filter((price) => price.high > 0 && price.low > 0 && price.close > 0 && price.high >= price.low);

  if (recentPrices.length < 10 || currentPrice <= 0) {
    return { supports: [], resistances: [] };
  }

  const low = Math.min(...recentPrices.map((price) => price.low));
  const high = Math.max(...recentPrices.map((price) => price.high));
  const range = high - low;

  if (range <= 0) {
    return { supports: [], resistances: [] };
  }

  const binCount = Math.max(30, Math.min(50, Math.round(Math.sqrt(recentPrices.length) * 3)));
  const binSize = range / binCount;
  const volumeBins = Array.from({ length: binCount }, (_, index) => ({
    index,
    price: low + binSize * (index + 0.5),
    volume: 0,
  }));

  for (const price of recentPrices) {
    const typicalPrice = (price.high + price.low + price.close) / 3;
    const index = Math.max(0, Math.min(binCount - 1, Math.floor((typicalPrice - low) / binSize)));
    volumeBins[index].volume += price.volume ?? 0;
  }

  const maxVolume = Math.max(...volumeBins.map((bin) => bin.volume), 1);
  const mergeDistance = Math.max(binSize * 0.85, currentPrice * 0.006);
  const proximity = Math.max(binSize * 1.25, currentPrice * 0.012);
  const pivotWindow = 3;
  const pivotCandidates: Array<{ price: number; type: "support" | "resistance"; count: number }> = [];

  for (let index = pivotWindow; index < recentPrices.length - pivotWindow; index += 1) {
    const current = recentPrices[index];
    const neighbors = recentPrices.slice(index - pivotWindow, index + pivotWindow + 1).filter((_, neighborIndex) => neighborIndex !== pivotWindow);
    const isLocalHigh = neighbors.every((neighbor) => current.high >= neighbor.high);
    const isLocalLow = neighbors.every((neighbor) => current.low <= neighbor.low);

    if (isLocalHigh) {
      pivotCandidates.push({ price: current.high, type: "resistance", count: 1 });
    }

    if (isLocalLow) {
      pivotCandidates.push({ price: current.low, type: "support", count: 1 });
    }
  }

  const pivotClusters = pivotCandidates.reduce<Array<{ price: number; type: "support" | "resistance"; count: number }>>((clusters, pivot) => {
    const existing = clusters.find((cluster) => cluster.type === pivot.type && Math.abs(cluster.price - pivot.price) <= mergeDistance);
    if (!existing) {
      clusters.push({ ...pivot });
      return clusters;
    }

    existing.price = (existing.price * existing.count + pivot.price) / (existing.count + 1);
    existing.count += 1;
    return clusters;
  }, []);

  const fibonacciLevels = [0.236, 0.382, 0.5, 0.618, 0.786].map((ratio) => high - range * ratio);
  const candidates = new Map<string, SupportResistanceLevel>();

  function addCandidate(price: number, type: "support" | "resistance", confidence: number, reason: string) {
    if (!Number.isFinite(price) || price <= 0) return;
    if (type === "support" && price >= currentPrice) return;
    if (type === "resistance" && price <= currentPrice) return;

    const key = `${type}:${Math.round(price / mergeDistance)}`;
    const existing = candidates.get(key);

    if (!existing) {
      candidates.set(key, {
        price,
        type,
        confidence: Math.max(0, Math.min(100, confidence)),
        reason,
      });
      return;
    }

    existing.price = (existing.price + price) / 2;
    existing.confidence = Math.max(existing.confidence, confidence) + 8;
    existing.reason = Array.from(new Set([...existing.reason.split(" + "), reason])).join(" + ");
  }

  for (const bin of volumeBins) {
    const volumeRatio = bin.volume / maxVolume;
    if (volumeRatio < 0.45) continue;

    addCandidate(
      bin.price,
      bin.price < currentPrice ? "support" : "resistance",
      45 + volumeRatio * 35,
      "거래량 집중 구간",
    );
  }

  for (const pivot of pivotClusters) {
    addCandidate(
      pivot.price,
      pivot.type,
      Math.min(72, 36 + pivot.count * 12),
      pivot.type === "support" ? "과거 저점 반복" : "과거 고점 반복",
    );
  }

  for (const level of candidates.values()) {
    const hasPivotOverlap = pivotClusters.some((pivot) => pivot.type === level.type && Math.abs(pivot.price - level.price) <= proximity);
    const hasFibonacciOverlap = fibonacciLevels.some((fibPrice) => Math.abs(fibPrice - level.price) <= proximity);

    if (hasPivotOverlap && level.reason.includes("거래량 집중 구간")) {
      level.confidence += 16;
      level.reason = "거래량 + 피벗 중첩";
    }

    if (hasFibonacciOverlap) {
      level.confidence += 6;
      if (!level.reason.includes("피보나치")) {
        level.reason = `${level.reason} + 피보나치 보조 구간`;
      }
    }

    const distancePenalty = Math.min(14, (Math.abs(level.price - currentPrice) / currentPrice) * 25);
    level.confidence = Math.round(Math.max(0, Math.min(100, level.confidence - distancePenalty)));
  }

  function rankLevels(type: "support" | "resistance") {
    return Array.from(candidates.values())
      .filter((level) => level.type === type)
      .sort((a, b) => b.confidence - a.confidence || Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice))
      .slice(0, 5);
  }

  const supports = rankLevels("support");
  const resistances = rankLevels("resistance");

  return {
    supports,
    resistances,
    resistanceMessage: resistances.length === 0 ? "현재 의미 있는 저항선 없음 / 52주 최고가 돌파 구간" : undefined,
  };
}
