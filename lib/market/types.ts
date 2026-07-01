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
  marketCap: number | null;
  currency: "USD" | "KRW";
  dataSource: string;
  dataSourceNotice?: string;
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
  sma365: number | null;
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

export interface HistoricalPriceValidationResult {
  isValid: boolean;
  sortedPrices: PricePoint[];
  errors: string[];
}

export type TrendStatus = "상승 추세" | "횡보" | "하락 추세";
export type PricePosition = "52주 고점 근처" | "중간 구간" | "52주 저점 근처";

export interface CompositeSignal {
  trendStatus: TrendStatus;
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
  week52High: number;
  week52Low: number;
  bollingerBands: BollingerBands;
  movingAverages: MovingAverages;
  rsi: number;
  rsiStatus: RsiStatus;
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
  indicators: StockIndicators;
}

export interface MarketDataProvider {
  getCompanyProfile(symbol: string): Promise<CompanyProfile | null>;
  getQuote(symbol: string): Promise<Quote | null>;
  getHistoricalPrices(symbol: string, range?: string): Promise<HistoricalPrice[]>;
  searchSymbols(query: string, limit?: number, filter?: SearchFilter): Promise<StockUniverseItem[]>;
  getShortInterest(symbol: string): Promise<ShortInterest | null>;
}
