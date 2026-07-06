export type RsiStatus = "과매수" | "보통" | "과매도";

export interface StockUniverseItem {
  symbol: string;
  name: string;
  koreanName: string;
  exchange: string;
  country: "US" | "KR" | "GLOBAL";
  assetType: "stock" | "etf";
  sector: string;
  industry: string;
  aliases: string[];
  searchBoost?: number;
}

export type SearchFilter =
  | "all"
  | "us"
  | "kr"
  | "etf"
  | "Technology"
  | "Semiconductor"
  | "Healthcare"
  | "Financials"
  | "Energy"
  | "Consumer"
  | "Industrials"
  | "Materials"
  | "Utilities"
  | "Real Estate"
  | "Defense"
  | "Aerospace"
  | "AI"
  | "Bio"
  | "EV"
  | "Software"
  | "Cloud"
  | "Cybersecurity";

export type StockAlias = StockUniverseItem;

export interface HistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type PricePoint = HistoricalPrice;

export interface RecentPricePoint extends PricePoint {
  changePercent: number;
}

export interface CompanyProfile extends StockUniverseItem {
  listingDate: string | null;
  currency: "USD" | "KRW";
}

export interface Quote {
  symbol: string;
  currentPrice: number | null;
  previousClose: number | null;
  changePercent?: number | null;
  marketCap: number | null;
  currency: "USD" | "KRW";
  dataSource: string;
  dataSourceNotice?: string;
  marketState?: "PRE" | "OPEN" | "POST" | "CLOSED" | "UNKNOWN";
  fetchedAt?: string;
}

export interface ShortInterest {
  label: string;
  reportDate?: string;
}

export interface StockBasicInfo {
  symbol: string;
  name: string;
  koreanName: string;
  exchange: string;
  country: "US" | "KR" | "GLOBAL";
  currentPrice: number;
  previousClose: number;
  changePercent: number;
  currency: "USD" | "KRW";
  dataSource: string;
  dataSourceNotice?: string;
  marketState?: "PRE" | "OPEN" | "POST" | "CLOSED" | "UNKNOWN";
  fetchedAt?: string;
}

export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
}

export interface MovingAverages {
  sma5: number | null;
  sma20: number | null;
  sma60: number | null;
  sma120: number | null;
  sma200: number | null;
}

export interface MacdIndicator {
  macd: number;
  signal: number;
  histogram: number;
  status: "상승 신호" | "하락 신호" | "중립";
}

export interface SupportResistanceLevel {
  price: number;
  type: "support" | "resistance";
  confidence: number;
  reason: string;
}

export interface SupportResistance {
  supports: SupportResistanceLevel[];
  resistances: SupportResistanceLevel[];
  resistanceMessage?: string;
}

export type MarketStructure = "HH_HL" | "LH_HL" | "HH_LL" | "LH_LL" | "UNKNOWN";

export type ChartHealthGrade = "VERY_HEALTHY" | "HEALTHY" | "NEUTRAL" | "DAMAGED" | "SEVERELY_DAMAGED";

export interface MarketStructurePresentation {
  code: MarketStructure;
  label: string;
  summary: string;
}

export interface ChartHealthResult {
  score: number;
  grade: ChartHealthGrade;
  label: string;
  components: {
    maAlignment: number;
    maSlope: number;
    marketStructure: number;
    pricePosition: number;
    volatility: number;
    volumeHealth: number;
  };
  metrics: {
    ma20: number | null;
    ma60: number | null;
    ma120: number | null;
    currentPrice: number | null;
    ma20Slope: number | null;
    ma60Slope: number | null;
    ma120Slope: number | null;
    highChangePercent: number | null;
    lowChangePercent: number | null;
    distanceFromMa20: number | null;
    drawdownFromRecentHigh: number | null;
    atrPercent: number | null;
    distributionDays: number;
    volumeRatio: number | null;
    marketStructure: MarketStructure;
  };
  marketStructure: MarketStructurePresentation;
  damagePenalty: number;
  appliedScoreCap: number | null;
  appliedScoreCapReason: string | null;
  positives: string[];
  negatives: string[];
  warnings: string[];
  insufficientData: boolean;
}

export interface HistoricalPriceValidationResult {
  isValid: boolean;
  sortedPrices: PricePoint[];
  errors: string[];
}

export type TrendStatus = "상승 추세" | "횡보" | "하락 추세";
export type PricePosition = "52주 고점 근처" | "중간 구간" | "52주 저점 근처";

export interface CompositeSignal {
  trendStatus: TrendStatus;
  longTermTrend: "강한 상승" | "상승" | "중립" | "하락" | "강한 하락";
  pricePosition: PricePosition;
  rsiStatus: RsiStatus;
  nearestSupportDistance: number | null;
  nearestSupportDistancePercent: number | null;
  nearestResistanceDistance: number | null;
  nearestResistanceDistancePercent: number | null;
  score: number;
  scoreLabel: "매우 양호" | "양호" | "중립" | "주의" | "위험";
  warning?: string;
}

export interface StockIndicators {
  calculationError?: string;
  chartHealth?: ChartHealthResult;
  week52High: number;
  week52Low: number;
  bollingerBands: BollingerBands;
  movingAverages: MovingAverages;
  rsi: number;
  rsiStatus: RsiStatus;
  macd: MacdIndicator | null;
  supportResistance: SupportResistance;
  compositeSignal: CompositeSignal;
  shortInterestLabel: string;
}

export interface StockRecord {
  basic: StockBasicInfo;
  prices: PricePoint[];
}

export interface StockAnalysisResponse {
  basic: StockBasicInfo;
  recentPrices: RecentPricePoint[];
  chartPrices: RecentPricePoint[];
  indicators: StockIndicators;
  aiScore?: number;
}

export interface MarketDataProvider {
  getCompanyProfile(symbol: string): Promise<CompanyProfile | null>;
  getQuote(symbol: string): Promise<Quote | null>;
  getHistoricalPrices(symbol: string, range?: string): Promise<HistoricalPrice[]>;
  searchSymbols(query: string, limit?: number, filter?: SearchFilter): Promise<StockUniverseItem[]>;
  getShortInterest(symbol: string): Promise<ShortInterest | null>;
}
