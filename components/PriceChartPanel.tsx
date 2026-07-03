"use client";

import { useEffect, useState } from "react";
import MiniPriceChart from "@/components/MiniPriceChart";
import TradingViewChart from "@/components/TradingViewChart";
import type { RecentPricePoint, StockBasicInfo } from "@/lib/market/types";

type ChartMode = "mini" | "tradingview";

export default function PriceChartPanel({
  symbol,
  prices,
  currency,
  currentPrice,
  isLoading = false,
  error = "",
}: {
  symbol: string;
  prices: RecentPricePoint[];
  currency: StockBasicInfo["currency"];
  currentPrice: number;
  isLoading?: boolean;
  error?: string;
}) {
  const [chartMode, setChartMode] = useState<ChartMode>("mini");
  const isTradingViewMode = chartMode === "tradingview";

  useEffect(() => {
    setChartMode("mini");
  }, [symbol]);

  return (
    <section className="border-b border-line py-5">
      <div className="min-w-0 overflow-hidden rounded-lg bg-surface p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold">{isTradingViewMode ? "TradingView 상세 차트" : "최근 가격 흐름"}</h2>
            <p className="mt-1 text-sm font-bold text-muted">
              {isTradingViewMode ? "TradingView 기준 보조 상세 차트" : "종가 기준 미니 라인차트"}
            </p>
          </div>
          <button
            type="button"
            aria-expanded={isTradingViewMode}
            onClick={() => setChartMode((mode) => (mode === "mini" ? "tradingview" : "mini"))}
            className="h-11 shrink-0 rounded-full border border-line bg-panel/80 px-5 text-sm font-black text-ink transition hover:border-positive/50 hover:bg-positive/10"
          >
            {isTradingViewMode ? "미니 차트 보기" : "상세 차트 보기"}
          </button>
        </div>

        {isTradingViewMode ? (
          <TradingViewChart symbol={symbol} onBackToMini={() => setChartMode("mini")} />
        ) : (
          <MiniPriceChart prices={prices} currency={currency} currentPrice={currentPrice} isLoading={isLoading} error={error} embedded />
        )}
      </div>
    </section>
  );
}
