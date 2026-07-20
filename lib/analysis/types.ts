import type { ChartHealthResult, RecentPricePoint, StockBasicInfo, StockIndicators, SupportResistanceLevel } from "@/lib/market/types";

export type BreakdownCategory = "long" | "short" | "momentum" | "levels" | "volume" | "chartHealth" | "confidence";

export type BreakdownItem = {
  label: string;
  points: number;
  reason: string;
  category: BreakdownCategory;
};

export type CheckpointPriority = "critical" | "watch" | "info";

export type Checkpoint = {
  title: string;
  description: string;
  priority: CheckpointPriority;
};

export type RiskTone = {
  icon: string;
  label: string;
  className: string;
};

export type Rating = {
  stars: string;
  label: string;
};

export type AiOpinion = {
  aiScore: number;
  rating: Rating;
  risk: RiskTone;
  confidenceScore: number;
  confidenceGrade: Rating;
  aiComment: string;
  caution: string | null;
  trendLabel: string;
  shortLabel: string;
  rsiLabel: string;
  macdLabel: string;
  support: SupportResistanceLevel | null;
  resistance: SupportResistanceLevel | null;
  supportDistance: number | null;
  resistanceDistance: number | null;
  chartHealth: ChartHealthResult | null;
  rawAiScore: number;
  scoreCapApplied: boolean;
  scoreItems: BreakdownItem[];
  confidenceItems: BreakdownItem[];
  volumeRising: boolean;
};

export type LocalScoreHistoryItem = {
  symbol: string;
  market: "KR" | "US" | "UNKNOWN";
  analyzedAt: string;
  price: number | null;
  compositeScore: number | null;
  chartHealthScore: number | null;
  confidence: number | null;
  summary?: string;
  risk?: string;
  trend?: string;
  macd?: string;
  rsi?: number;
  reasons?: Array<{
    label: string;
    points: number;
    reason: string;
  }>;
};

export type AnalysisInput = {
  indicators: StockIndicators;
  currentPrice: number;
  currency: StockBasicInfo["currency"];
  recentPrices: RecentPricePoint[];
};
