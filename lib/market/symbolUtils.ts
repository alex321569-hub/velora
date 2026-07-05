import type { StockUniverseItem } from "./types";

export type ResolvedMarketSymbol = {
  originalSymbol: string;
  normalizedSymbol: string;
  yahooSymbol: string;
  market: "KOSPI" | "KOSDAQ" | "US" | "GLOBAL" | "UNKNOWN";
};

export function normalizeKoreanCode(value: string): string | null {
  const digits = value.replace(/^A/i, "").replace(/\.(KS|KQ)$/i, "").replace(/\D/g, "");
  if (digits.length === 0 || digits.length > 6) return null;
  return digits.padStart(6, "0");
}

export function getKoreanMarketSuffix(exchange?: string, symbol?: string): "KS" | "KQ" | null {
  const upperSymbol = symbol?.toUpperCase() ?? "";
  const upperExchange = exchange?.toUpperCase() ?? "";

  if (upperSymbol.endsWith(".KS")) return "KS";
  if (upperSymbol.endsWith(".KQ")) return "KQ";
  if (upperExchange.includes("KOSPI") && upperExchange.includes("KOSDAQ")) return null;
  if (upperExchange.includes("KOSDAQ")) return "KQ";
  if (upperExchange.includes("KOSPI")) return "KS";
  return null;
}

export function normalizeMarketSymbol(
  symbol: string,
  context?: Partial<Pick<StockUniverseItem, "exchange" | "country" | "assetType">>,
): ResolvedMarketSymbol {
  const originalSymbol = symbol.trim();
  const upperSymbol = originalSymbol.toUpperCase();
  const isKoreanContext =
    context?.country === "KR" ||
    /\.(KS|KQ)$/i.test(upperSymbol) ||
    /^A?\d{1,6}(\.(KS|KQ))?$/i.test(upperSymbol);

  if (isKoreanContext) {
    const code = normalizeKoreanCode(upperSymbol);
    if (code) {
      const suffix = getKoreanMarketSuffix(context?.exchange, upperSymbol);
      const resolvedSuffix = suffix ?? "KS";
      const market = resolvedSuffix === "KQ" ? "KOSDAQ" : "KOSPI";

      return {
        originalSymbol,
        normalizedSymbol: code,
        yahooSymbol: `${code}.${resolvedSuffix}`,
        market,
      };
    }
  }

  return {
    originalSymbol,
    normalizedSymbol: upperSymbol,
    yahooSymbol: upperSymbol,
    market: context?.country === "GLOBAL" ? "GLOBAL" : context?.country === "US" ? "US" : "UNKNOWN",
  };
}
