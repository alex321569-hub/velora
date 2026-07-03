import type { RecentPricePoint, StockBasicInfo, StockIndicators, SupportResistanceLevel } from "@/lib/market/types";

export type BreakdownCategory = "long" | "short" | "momentum" | "levels" | "volume" | "confidence";

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
  scoreItems: BreakdownItem[];
  confidenceItems: BreakdownItem[];
  volumeRising: boolean;
};

export type AnalysisInput = {
  indicators: StockIndicators;
  currentPrice: number;
  currency: StockBasicInfo["currency"];
  recentPrices: RecentPricePoint[];
};

export type HistoryEntry = {
  date: string;
  score: number;
  stars: string;
  risk: string;
  rsi: number;
  macd: string;
  trend: string;
  reasons: { label: string; points: number; reason: string }[];
};
