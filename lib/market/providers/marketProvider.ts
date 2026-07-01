import type {
  CompanyProfile,
  HistoricalPrice,
  MarketDataProvider,
  Quote,
  ShortInterest,
  StockUniverseItem,
  SearchFilter,
} from "../types";

export type ProviderName = "Mock" | "Yahoo Finance" | "Finnhub" | "Polygon" | "KIS";

export interface ProviderCapabilities {
  name: ProviderName;
  isMock: boolean;
}

export interface StockMarketProvider extends MarketDataProvider {
  capabilities: ProviderCapabilities;
  searchSymbols(query: string, limit?: number, filter?: SearchFilter): Promise<StockUniverseItem[]>;
  getCompanyProfile(symbol: string): Promise<CompanyProfile | null>;
  getQuote(symbol: string): Promise<Quote | null>;
  getHistoricalPrices(symbol: string, range?: string): Promise<HistoricalPrice[]>;
  getShortInterest(symbol: string): Promise<ShortInterest | null>;
}
