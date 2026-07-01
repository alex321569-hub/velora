import { NextResponse } from "next/server";
import { getMarketProvider, getStockAnalysis } from "@/lib/market/providerFactory";
import { getBestMatch } from "@/lib/market/searchStocks";
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
    });
  }

  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  const stock = await getStockAnalysis(symbol, provider);
  if (!stock) {
    return NextResponse.json({ error: "stock not found" }, { status: 404 });
  }

  return NextResponse.json(stock);
}
