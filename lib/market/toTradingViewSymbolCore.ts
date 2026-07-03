export type TradingViewSymbolStock = {
  symbol: string;
  exchange: string;
  country: "US" | "KR" | "GLOBAL";
};

const tradingViewExchangeMap: Record<string, string> = {
  NASDAQ: "NASDAQ",
  NYSE: "NYSE",
  AMEX: "AMEX",
  "NYSE AMERICAN": "AMEX",
  NYSEAMERICAN: "AMEX",
  NYSEARCA: "AMEX",
  "NYSE ARCA": "AMEX",
};

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

export function stripKoreaSuffix(symbol: string) {
  return normalizeSymbol(symbol).replace(/\.(KS|KQ)$/i, "");
}

function isKoreanCode(symbol: string) {
  return /^[0-9]{6}(\.(KS|KQ))?$/i.test(symbol.trim());
}

function getTradingViewExchange(exchange: string) {
  return tradingViewExchangeMap[exchange.trim().toUpperCase()] ?? null;
}

function isKnownKoreanExchange(exchange: string) {
  const normalizedExchange = exchange.trim().toUpperCase();
  return normalizedExchange === "KOSPI" || normalizedExchange === "KOSDAQ" || normalizedExchange === "KRX";
}

export function toTradingViewSymbolForStock(symbol: string, stock?: TradingViewSymbolStock | null): string | null {
  const normalizedSymbol = normalizeSymbol(symbol);
  if (!normalizedSymbol) return null;

  if (isKoreanCode(normalizedSymbol)) {
    if (normalizedSymbol.endsWith(".KS") || normalizedSymbol.endsWith(".KQ")) {
      return `KRX:${stripKoreaSuffix(normalizedSymbol)}`;
    }

    if (stock && stock.country === "KR" && isKnownKoreanExchange(stock.exchange)) {
      return `KRX:${stripKoreaSuffix(normalizedSymbol)}`;
    }

    return null;
  }

  if (!stock) {
    return null;
  }

  const tradingViewExchange = getTradingViewExchange(stock.exchange);
  if (!tradingViewExchange) {
    return null;
  }

  return `${tradingViewExchange}:${stripKoreaSuffix(stock.symbol)}`;
}
