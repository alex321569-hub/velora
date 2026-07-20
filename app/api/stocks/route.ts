import { NextResponse } from "next/server";
import { buildAiOpinion } from "@/lib/analysis/aiAnalysis";
import { getMarketProvider, getStockAnalysis } from "@/lib/market/providerFactory";
import { getBestMatch } from "@/lib/market/searchStocks";
import { normalizeMarketSymbol } from "@/lib/market/symbolUtils";
import type { SearchFilter } from "@/lib/market/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const symbol = searchParams.get("symbol");
  const filter = (searchParams.get("filter") ?? "all") as SearchFilter;
  const provider = getMarketProvider();

  if (query !== null) {
    const results = await provider.searchSymbols(query, 8, filter);
    return NextResponse.json({
      results,
      bestMatch: getBestMatch(query, filter) ?? results[0] ?? null,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  const stock = await getStockAnalysis(symbol, provider);
  if (!stock) {
    const matchedStock = getBestMatch(symbol);
    const resolved = normalizeMarketSymbol(symbol, matchedStock ?? undefined);
    const payload = {
      symbol,
      resolvedSymbol: resolved.yahooSymbol,
      status: "error",
      errorCode: "STOCK_DATA_NOT_FOUND",
      message: "종목 데이터를 찾을 수 없습니다.",
      receivedCandles: 0,
      validCloses: 0,
    };

    if (process.env.NODE_ENV !== "production") {
      console.warn("[api/stocks] stock data not found", payload);
    }

    return NextResponse.json(payload, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const opinion = stock.indicators.calculationError
    ? null
    : buildAiOpinion({
        indicators: stock.indicators,
        currentPrice: stock.basic.currentPrice,
        currency: stock.basic.currency,
        recentPrices: stock.recentPrices,
      });
  return NextResponse.json(
    {
      ...stock,
      aiScore: opinion?.aiScore,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
