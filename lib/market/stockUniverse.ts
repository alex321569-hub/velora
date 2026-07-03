import generatedStockUniverse from "./generated/stockUniverse.json";
import generatedKoreaStockUniverse from "./generated/koreaStockUniverse.json";
import type { StockUniverseItem } from "./types";

type GeneratedStockUniverseItem = {
  symbol: string;
  name: string;
  exchange: string;
  koreanName?: string;
  country: "US" | "KR" | "GLOBAL";
  assetType: "stock" | "etf";
  sector: string;
  industry: string;
  aliases: string[];
};

type ManualStockOverride = Partial<Omit<StockUniverseItem, "symbol">> & {
  symbol: string;
};

const manualStockOverrides: ManualStockOverride[] = [
  { symbol: "NVDA", koreanName: "엔비디아", sector: "AI", industry: "AI Semiconductor", aliases: ["엔비디아", "엔비"] },
  { symbol: "AAPL", koreanName: "애플", aliases: ["애플"] },
  { symbol: "TSLA", koreanName: "테슬라", sector: "EV", industry: "Automotive", aliases: ["테슬라"] },
  { symbol: "AMAT", koreanName: "어플라이드 머티리얼즈", sector: "Semiconductor", industry: "Semiconductor Equipment", aliases: ["어플라이드", "어플"] },
  { symbol: "TSM", koreanName: "대만반도체", sector: "Semiconductor", industry: "Foundry", aliases: ["TSMC", "Taiwan Semiconductor", "대만반도체"] },
  { symbol: "MSFT", koreanName: "마이크로소프트", aliases: ["마소"] },
  { symbol: "META", koreanName: "메타", aliases: ["페이스북"] },
  { symbol: "AMZN", koreanName: "아마존", aliases: ["AWS"] },
  { symbol: "GOOGL", koreanName: "알파벳", aliases: ["Google", "구글"] },
  { symbol: "AMD", koreanName: "AMD", sector: "Semiconductor", industry: "AI Semiconductor" },
  { symbol: "AVGO", koreanName: "브로드컴", sector: "Semiconductor" },
  {
    symbol: "ASX",
    name: "ASE Technology Holding Co., Ltd.",
    koreanName: "ASE 테크놀로지",
    exchange: "NYSE",
    country: "GLOBAL",
    assetType: "stock",
    sector: "Semiconductor",
    industry: "Semiconductor Assembly & Test",
    aliases: ["ASE", "ASE Technology", "ASE 테크놀로지", "일월광"],
  },
  { symbol: "MU", koreanName: "마이크론", sector: "Semiconductor", aliases: ["Micron"] },
  { symbol: "LRCX", koreanName: "램리서치", sector: "Semiconductor", aliases: ["Lam Research"] },
  { symbol: "ASML", koreanName: "ASML", sector: "Semiconductor" },
  { symbol: "QQQ", koreanName: "인베스코 QQQ", assetType: "etf", sector: "ETF", industry: "Nasdaq 100 ETF", aliases: ["나스닥", "Nasdaq ETF"] },
  { symbol: "SPY", koreanName: "SPDR S&P 500 ETF", assetType: "etf", sector: "ETF", industry: "Large Cap ETF", aliases: ["S&P500", "스파이"] },
  { symbol: "VOO", koreanName: "Vanguard S&P 500 ETF", assetType: "etf", sector: "ETF", industry: "Large Cap ETF" },
  { symbol: "VTI", koreanName: "Vanguard Total Stock Market ETF", assetType: "etf", sector: "ETF", industry: "Total Market ETF" },
  { symbol: "SOXX", koreanName: "반도체 ETF", assetType: "etf", sector: "ETF", industry: "Semiconductor ETF", aliases: ["반도체 ETF"] },
  { symbol: "SCHD", koreanName: "슈왑 미국 배당 ETF", assetType: "etf", sector: "ETF", industry: "Dividend ETF", aliases: ["배당 ETF"] },
  { symbol: "JEPQ", koreanName: "제이피모건 나스닥 인컴 ETF", assetType: "etf", sector: "ETF", aliases: ["나스닥 인컴 ETF"] },
  { symbol: "TQQQ", koreanName: "나스닥 3배 ETF", assetType: "etf", sector: "ETF", aliases: ["나스닥 3배"] },
  { symbol: "005930", name: "Samsung Electronics", koreanName: "삼성전자", exchange: "KOSPI", country: "KR", sector: "Technology", industry: "Semiconductor", assetType: "stock", aliases: ["005930.KS", "Samsung Electronics", "samsung", "삼전", "삼"] },
  { symbol: "000660", name: "SK Hynix", koreanName: "SK하이닉스", exchange: "KOSPI", country: "KR", sector: "Semiconductor", industry: "Memory Semiconductor", assetType: "stock", aliases: ["000660.KS", "SK Hynix", "하이닉스", "닉스"] },
  { symbol: "005380", name: "Hyundai Motor", koreanName: "현대차", exchange: "KOSPI", country: "KR", sector: "EV", industry: "Automotive & EV", assetType: "stock", aliases: ["005380.KS", "HYUNDAI", "현대자동차", "현차"] },
  { symbol: "035420", name: "NAVER", koreanName: "NAVER", exchange: "KOSPI", country: "KR", sector: "Technology", industry: "Internet Services", assetType: "stock", aliases: ["035420.KS", "네이버"] },
  { symbol: "035720", name: "Kakao", koreanName: "카카오", exchange: "KOSPI", country: "KR", sector: "Technology", industry: "Internet Services", assetType: "stock", aliases: ["035720.KS"] },
  { symbol: "068270", name: "Celltrion", koreanName: "셀트리온", exchange: "KOSPI", country: "KR", sector: "Bio", industry: "Biopharmaceuticals", assetType: "stock", aliases: ["068270.KS", "셀트"] },
  { symbol: "373220", name: "LG Energy Solution", koreanName: "LG에너지솔루션", exchange: "KOSPI", country: "KR", sector: "EV", industry: "Battery", assetType: "stock", aliases: ["373220.KS", "LG엔솔", "엘지엔솔"] },
  { symbol: "012450", name: "Hanwha Aerospace", koreanName: "한화에어로스페이스", exchange: "KOSPI", country: "KR", sector: "Aerospace", industry: "Defense & Aerospace", assetType: "stock", aliases: ["012450.KS", "한화에어로"] },
];

function normalizeSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/\.(KS|KQ)$/i, "");
}

function mergeAliases(...aliases: Array<string[] | undefined>): string[] {
  return Array.from(new Set(aliases.flatMap((items) => items ?? []).filter(Boolean)));
}

function toUniverseItem(item: GeneratedStockUniverseItem): StockUniverseItem {
  const override = manualStockOverrides.find((candidate) => normalizeSymbol(candidate.symbol) === normalizeSymbol(item.symbol));

  return {
    symbol: normalizeSymbol(item.symbol),
    name: override?.name ?? item.name,
    koreanName: override?.koreanName ?? item.koreanName ?? item.name,
    exchange: override?.exchange ?? item.exchange,
    country: override?.country ?? item.country,
    assetType: override?.assetType ?? item.assetType,
    sector: override?.sector ?? item.sector,
    industry: override?.industry ?? item.industry,
    aliases: mergeAliases([item.symbol, item.name, item.koreanName ?? ""], item.aliases, override?.aliases),
    searchBoost: override?.searchBoost,
  };
}

function toManualItem(item: ManualStockOverride): StockUniverseItem {
  return {
    symbol: normalizeSymbol(item.symbol),
    name: item.name ?? normalizeSymbol(item.symbol),
    koreanName: item.koreanName ?? item.name ?? normalizeSymbol(item.symbol),
    exchange: item.exchange ?? "NASDAQ",
    country: item.country ?? "US",
    assetType: item.assetType ?? "stock",
    sector: item.sector ?? "Other",
    industry: item.industry ?? "Other",
    aliases: mergeAliases([item.symbol, item.name ?? "", item.koreanName ?? ""], item.aliases),
    searchBoost: item.searchBoost,
  };
}

const generatedItems = ([...generatedStockUniverse, ...generatedKoreaStockUniverse] as GeneratedStockUniverseItem[]).map(toUniverseItem);
const generatedSymbols = new Set(generatedItems.map((item) => normalizeSymbol(item.symbol)));
const manualOnlyItems = manualStockOverrides
  .filter((item) => !generatedSymbols.has(normalizeSymbol(item.symbol)))
  .map(toManualItem);

export const stockUniverse: StockUniverseItem[] = [...generatedItems, ...manualOnlyItems];
