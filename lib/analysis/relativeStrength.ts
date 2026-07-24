import type {
  CompanyProfile,
  PricePoint,
  RelativeStrengthGrade,
  RelativeStrengthResult,
} from "@/lib/market/types";

export type RelativeStrengthBenchmarks = {
  marketSymbol: string;
  marketLabel: string;
  sectorSymbol: string | null;
  sectorLabel: string | null;
};

type RelativeStrengthOptions = {
  shortTermOverheatScore?: number;
  benchmarks?: RelativeStrengthBenchmarks;
};

const SECTOR_BENCHMARKS: Array<{
  terms: string[];
  symbol: string;
  label: string;
}> = [
  { terms: ["semiconductor"], symbol: "SOXX", label: "반도체 업종" },
  { terms: ["technology", "software"], symbol: "XLK", label: "기술 업종" },
  { terms: ["cloud"], symbol: "SKYY", label: "클라우드 업종" },
  { terms: ["cybersecurity"], symbol: "CIBR", label: "사이버보안 업종" },
  { terms: ["artificial intelligence", " ai"], symbol: "BOTZ", label: "인공지능 업종" },
  { terms: ["healthcare", "pharma"], symbol: "XLV", label: "헬스케어 업종" },
  { terms: ["biotech", "bio"], symbol: "XBI", label: "바이오 업종" },
  { terms: ["financial", "bank", "insurance"], symbol: "XLF", label: "금융 업종" },
  { terms: ["energy", "oil", "gas"], symbol: "XLE", label: "에너지 업종" },
  { terms: ["consumer staples", "food"], symbol: "XLP", label: "필수소비재 업종" },
  { terms: ["consumer", "retail", "automotive"], symbol: "XLY", label: "소비재 업종" },
  { terms: ["industrial", "logistics", "airline"], symbol: "XLI", label: "산업재 업종" },
  { terms: ["defense", "aerospace"], symbol: "ITA", label: "방산·항공 업종" },
  { terms: ["material", "chemical", "steel"], symbol: "XLB", label: "소재 업종" },
  { terms: ["utilities", "utility"], symbol: "XLU", label: "유틸리티 업종" },
  { terms: ["real estate", "reit"], symbol: "XLRE", label: "부동산 업종" },
  { terms: ["electric vehicle", " ev", "battery"], symbol: "DRIV", label: "전기차 업종" },
];

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));

function validCloses(prices: PricePoint[]) {
  return [...prices]
    .filter((price) => Number.isFinite(price.close) && price.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((price) => price.close);
}

function periodReturn(prices: PricePoint[], sessions: number) {
  const closes = validCloses(prices);
  const current = closes.at(-1);
  const previous = closes.at(-(sessions + 1));
  if (current === undefined || previous === undefined || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function difference(left: number | null, right: number | null) {
  return left === null || right === null ? null : left - right;
}

function scoreContribution(value: number | null, multiplier: number, cap: number) {
  if (value === null) return 0;
  return clamp(value * multiplier, -cap, cap);
}

function getGrade(score: number, available: boolean): RelativeStrengthGrade {
  if (!available) return "UNKNOWN";
  if (score >= 80) return "VERY_STRONG";
  if (score >= 65) return "STRONG";
  if (score >= 45) return "NEUTRAL";
  if (score >= 30) return "WEAK";
  return "VERY_WEAK";
}

export function getRelativeStrengthBenchmarks(
  profile: Pick<CompanyProfile, "country" | "exchange" | "sector" | "industry" | "assetType">,
): RelativeStrengthBenchmarks {
  const exchange = profile.exchange.toUpperCase();
  const isKorea = profile.country === "KR" || exchange.includes("KOSPI") || exchange.includes("KOSDAQ");
  const marketSymbol = isKorea
    ? exchange.includes("KOSDAQ")
      ? "^KQ11"
      : "^KS11"
    : "SPY";
  const marketLabel = isKorea
    ? exchange.includes("KOSDAQ")
      ? "코스닥"
      : "코스피"
    : "미국 시장";

  if (profile.assetType === "etf") {
    return { marketSymbol, marketLabel, sectorSymbol: null, sectorLabel: null };
  }

  const searchable = ` ${profile.sector} ${profile.industry}`.toLowerCase();
  const sector = SECTOR_BENCHMARKS.find(({ terms }) =>
    terms.some((term) => searchable.includes(term)),
  );

  return {
    marketSymbol,
    marketLabel,
    sectorSymbol: sector?.symbol ?? null,
    sectorLabel: sector?.label ?? null,
  };
}

export function calculateRelativeStrength(
  stockPrices: PricePoint[],
  marketPrices: PricePoint[],
  sectorPrices: PricePoint[] = [],
  options: RelativeStrengthOptions = {},
): RelativeStrengthResult {
  const stockReturn5d = periodReturn(stockPrices, 5);
  const stockReturn20d = periodReturn(stockPrices, 20);
  const stockReturn60d = periodReturn(stockPrices, 60);
  const marketReturn5d = periodReturn(marketPrices, 5);
  const marketReturn20d = periodReturn(marketPrices, 20);
  const marketReturn60d = periodReturn(marketPrices, 60);
  const sectorReturn5d = periodReturn(sectorPrices, 5);
  const sectorReturn20d = periodReturn(sectorPrices, 20);
  const sectorReturn60d = periodReturn(sectorPrices, 60);

  const relativeToMarket5d = difference(stockReturn5d, marketReturn5d);
  const relativeToMarket20d = difference(stockReturn20d, marketReturn20d);
  const relativeToMarket60d = difference(stockReturn60d, marketReturn60d);
  const relativeToSector5d = difference(stockReturn5d, sectorReturn5d);
  const relativeToSector20d = difference(stockReturn20d, sectorReturn20d);
  const relativeToSector60d = difference(stockReturn60d, sectorReturn60d);
  const comparisons = [
    relativeToMarket5d,
    relativeToMarket20d,
    relativeToMarket60d,
    relativeToSector5d,
    relativeToSector20d,
    relativeToSector60d,
  ];
  const available = comparisons.some((value) => value !== null);

  let score = 50;
  score += scoreContribution(relativeToMarket5d, 0.65, 6);
  score += scoreContribution(relativeToMarket20d, 1.15, 15);
  score += scoreContribution(relativeToMarket60d, 0.75, 14);
  score += scoreContribution(relativeToSector5d, 0.5, 5);
  score += scoreContribution(relativeToSector20d, 0.9, 11);
  score += scoreContribution(relativeToSector60d, 0.6, 10);

  const warnings: string[] = [];
  const shortTermSurge = (stockReturn5d ?? 0) >= 15;
  const sustainedOutperformance =
    (relativeToMarket20d ?? -Infinity) > 0 || (relativeToSector20d ?? -Infinity) > 0;
  if (
    shortTermSurge &&
    (!sustainedOutperformance || (options.shortTermOverheatScore ?? 100) < 50)
  ) {
    score = Math.min(score, 62);
    warnings.push("단기 급등의 영향이 커 상대적인 추세 지속 여부를 더 확인할 필요가 있습니다.");
  }

  score = Math.round(clamp(score));
  const grade = getGrade(score, available);
  const positives: string[] = [];
  const negatives: string[] = [];

  if ((relativeToMarket20d ?? 0) >= 3) {
    positives.push("최근 한 달 동안 시장보다 강한 흐름을 보였습니다.");
  } else if ((relativeToMarket20d ?? 0) <= -3) {
    negatives.push("최근 한 달 동안 시장 흐름을 따라가지 못했습니다.");
  }
  if ((relativeToSector20d ?? 0) >= 3) {
    positives.push("같은 업종과 비교해 상대적인 흐름이 우위에 있습니다.");
  } else if ((relativeToSector20d ?? 0) <= -3) {
    negatives.push("같은 업종보다 상대적인 흐름이 약합니다.");
  }
  if (
    (relativeToMarket20d ?? 0) > 0 &&
    (relativeToMarket60d ?? 0) > 0 &&
    (relativeToSector20d === null || relativeToSector20d > 0)
  ) {
    positives.push("중단기 상대강도가 함께 유지되고 있습니다.");
  }
  if (!available) {
    warnings.push("비교 지수 데이터가 부족해 상대강도를 점수에 반영하지 않았습니다.");
  } else if (sectorReturn20d === null) {
    warnings.push("업종 비교 데이터가 없어 시장 대비 흐름만 반영했습니다.");
  }

  return {
    score,
    grade,
    benchmarks: options.benchmarks ?? {
      marketSymbol: "",
      marketLabel: "시장 지수",
      sectorSymbol: null,
      sectorLabel: null,
    },
    metrics: {
      stockReturn5d,
      stockReturn20d,
      stockReturn60d,
      marketReturn5d,
      marketReturn20d,
      marketReturn60d,
      sectorReturn5d,
      sectorReturn20d,
      sectorReturn60d,
      relativeToMarket5d,
      relativeToMarket20d,
      relativeToMarket60d,
      relativeToSector5d,
      relativeToSector20d,
      relativeToSector60d,
    },
    positives: [...new Set(positives)],
    negatives: [...new Set(negatives)],
    warnings: [...new Set(warnings)],
  };
}

export function getRelativeStrengthLabel(grade: RelativeStrengthGrade) {
  const labels: Record<RelativeStrengthGrade, string> = {
    VERY_STRONG: "매우 강함",
    STRONG: "강함",
    NEUTRAL: "중립",
    WEAK: "약함",
    VERY_WEAK: "매우 약함",
    UNKNOWN: "비교 데이터 없음",
  };
  return labels[grade];
}
