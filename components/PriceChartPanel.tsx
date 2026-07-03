"use client";

import { useEffect, useState } from "react";
import MiniPriceChart from "@/components/MiniPriceChart";
import TradingViewChart from "@/components/TradingViewChart";
import { toTradingViewSymbol } from "@/lib/market/toTradingViewSymbol";
import type { RecentPricePoint, StockBasicInfo } from "@/lib/market/types";

type ChartMode = "mini" | "tradingview";

const KOREA_TRADINGVIEW_POLICY_MESSAGE = "국내 종목은 TradingView 외부 위젯 정책상 미니 차트만 지원합니다.";

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
  const [showUnsupportedPopup, setShowUnsupportedPopup] = useState(false);
  const tradingViewSymbol = toTradingViewSymbol(symbol);
  const isTradingViewMode = chartMode === "tradingview";
  const isKoreanTradingViewSymbol = tradingViewSymbol?.startsWith("KRX:") ?? false;
  const canOpenTradingView = Boolean(tradingViewSymbol) && !isKoreanTradingViewSymbol;

  useEffect(() => {
    setChartMode("mini");
    setShowUnsupportedPopup(false);
  }, [symbol]);

  useEffect(() => {
    if (!showUnsupportedPopup) return undefined;

    const timeoutId = window.setTimeout(() => {
      setShowUnsupportedPopup(false);
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [showUnsupportedPopup]);

  function toggleChartMode() {
    if (isTradingViewMode) {
      setChartMode("mini");
      return;
    }

    if (!canOpenTradingView) {
      setShowUnsupportedPopup(true);
      return;
    }

    setChartMode("tradingview");
  }

  return (
    <section className="border-b border-line py-5">
      <div className="relative min-w-0 overflow-hidden rounded-lg bg-surface p-4 sm:p-5">
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
            aria-describedby={showUnsupportedPopup ? "tradingview-policy-popup" : undefined}
            title={!isTradingViewMode && isKoreanTradingViewSymbol ? KOREA_TRADINGVIEW_POLICY_MESSAGE : undefined}
            onClick={toggleChartMode}
            className="h-11 shrink-0 rounded-full border border-line bg-panel/80 px-5 text-sm font-black text-ink transition hover:border-positive/50 hover:bg-positive/10 focus:outline-none focus:ring-2 focus:ring-positive/50"
          >
            {isTradingViewMode ? "미니 차트 보기" : "상세 차트 보기"}
          </button>
        </div>

        {showUnsupportedPopup && (
          <div
            id="tradingview-policy-popup"
            role="alert"
            className="absolute right-4 top-16 z-20 max-w-sm rounded-lg border border-line bg-panel px-4 py-3 text-sm font-bold leading-5 text-ink shadow-glow sm:right-5"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted/20 text-xs text-muted">!</span>
              <div className="min-w-0">
                <p>{KOREA_TRADINGVIEW_POLICY_MESSAGE}</p>
                <button
                  type="button"
                  onClick={() => setShowUnsupportedPopup(false)}
                  className="mt-2 text-xs font-black text-positive transition hover:text-ink"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}

        {isTradingViewMode ? (
          <TradingViewChart symbol={symbol} onBackToMini={() => setChartMode("mini")} />
        ) : (
          <MiniPriceChart prices={prices} currency={currency} currentPrice={currentPrice} isLoading={isLoading} error={error} embedded />
        )}
      </div>
    </section>
  );
}
