"use client";

import { AlertTriangle, LineChart, Moon, Search, Sun } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import AnalysisCards from "@/components/AnalysisCards";
import RecentPriceList from "@/components/RecentPriceList";
import SearchBox from "@/components/SearchBox";
import StockBasicInfo from "@/components/StockBasicInfo";
import { useLiveQuote } from "@/hooks/useLiveQuote";
import type { SearchFilter, StockAlias, StockAnalysisResponse } from "@/lib/market/types";

export default function Home() {
  const [stock, setStock] = useState<StockAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [selectedFilter, setSelectedFilter] = useState<SearchFilter>("all");
  const hasSearched = Boolean(stock || loading || error);
  const handleLiveUpdate = useCallback((nextStock: StockAnalysisResponse) => {
    setStock(nextStock);
  }, []);
  const liveQuote = useLiveQuote({
    symbol: stock?.basic.symbol ?? null,
    enabled: Boolean(stock && !loading),
    currentPrice: stock?.basic.currentPrice ?? null,
    onUpdate: handleLiveUpdate,
  });

  async function loadStock(symbol: string) {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/stocks?symbol=${encodeURIComponent(symbol)}`);
      if (!response.ok) {
        throw new Error("종목 정보를 불러오지 못했습니다.");
      }

      setStock((await response.json()) as StockAnalysisResponse);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "알 수 없는 오류가 발생했습니다.");
      setStock(null);
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(stockAlias: StockAlias) {
    void loadStock(stockAlias.symbol);
  }

  function goHome() {
    setStock(null);
    setError("");
    setLoading(false);
  }

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("stock-dashboard-theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
    }
  }, []);

  function toggleTheme() {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      window.localStorage.setItem("stock-dashboard-theme", nextTheme);
      return nextTheme;
    });
  }

  return (
    <main className={`theme-${theme} min-h-screen bg-[color:var(--page-bg)] px-4 py-5 text-ink transition-colors sm:px-6 lg:px-8`}>
      <button
        type="button"
        onClick={toggleTheme}
        className="fixed right-4 top-4 z-40 flex h-11 items-center justify-center gap-2 rounded-full border border-line bg-surface/90 px-3 text-sm font-extrabold text-ink shadow-glow backdrop-blur transition hover:bg-panel sm:right-6 sm:top-6"
        aria-label={theme === "dark" ? "일반모드로 전환" : "다크모드로 전환"}
      >
        {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
        <span className="hidden sm:inline">{theme === "dark" ? "일반모드" : "다크모드"}</span>
      </button>

      {!hasSearched ? (
        <section className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-5xl flex-col items-center justify-center px-2 py-16 text-center">
          <div className="mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-surface shadow-glow">
            <Search className="h-8 w-8 text-positive" aria-hidden="true" />
          </div>
          <h1 className="text-4xl font-black tracking-normal text-ink sm:text-6xl">VELORA</h1>
          <p className="mt-4 text-base font-semibold text-muted sm:text-lg">티커 또는 회사명을 검색하여 종목을 분석해보세요.</p>

          <div className="mt-10 w-full animate-fade-slide-up">
            <SearchBox
              onSelect={handleSelect}
              variant="hero"
              placeholder="티커, 회사명 또는 한글명을 입력하세요"
              selectedFilter={selectedFilter}
              onFilterChange={setSelectedFilter}
            />
          </div>

        </section>
      ) : (
      <div className="mx-auto max-w-6xl">
        <header className="sticky top-0 z-20 -mx-4 bg-[color:var(--header-bg)] px-4 py-4 backdrop-blur transition-all sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={goHome}
              className="flex shrink-0 items-center gap-3 rounded-2xl text-left transition hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-positive/50"
              aria-label="시작 화면으로 이동"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface">
                <LineChart className="h-5 w-5 text-positive" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-positive">VELORA</p>
                <h1 className="text-lg font-black text-ink">종목 분석</h1>
              </div>
            </button>
            <div className="min-w-0 flex-1">
              <SearchBox
                onSelect={handleSelect}
                placeholder="티커, 회사명 또는 한글명을 입력하세요"
                selectedFilter={selectedFilter}
                onFilterChange={setSelectedFilter}
                showFilters={false}
              />
            </div>
          </div>
        </header>

        <div className="mt-6 animate-fade-slide-up rounded-lg bg-panel p-4 shadow-glow sm:p-5">
          {loading && <div className="py-20 text-center text-sm font-bold text-muted">데이터를 불러오는 중입니다.</div>}
          {error && <div className="py-20 text-center text-sm font-bold text-negative">{error}</div>}
          {!loading && !error && stock && (
            <>
              <StockBasicInfo
                basic={stock.basic}
                flashDirection={liveQuote.flashDirection}
                liveStatus={{
                  secondsSinceUpdate: liveQuote.secondsSinceUpdate,
                  secondsUntilUpdate: liveQuote.secondsUntilUpdate,
                  refreshError: liveQuote.refreshError,
                }}
              />
              <RecentPriceList prices={stock.recentPrices} currency={stock.basic.currency} />
              <AnalysisCards
                indicators={stock.indicators}
                currency={stock.basic.currency}
                currentPrice={stock.basic.currentPrice}
              />
              <section className="border-t border-line pt-5">
                <h2 className="mb-4 text-lg font-extrabold">주의사항 및 태그</h2>
                <div className="space-y-2">
                  <p className="rounded-md bg-surface px-4 py-3 text-sm font-bold text-muted">
                    지지선/저항선은 90거래일 데이터로 생성합니다.
                  </p>
                  <p className="flex items-start gap-2 rounded-md bg-surface px-4 py-3 text-sm font-bold text-muted">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-negative" aria-hidden="true" />
                    본 정보는 참고용이며, 투자 판단의 책임은 본인에게 있습니다.
                  </p>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
      )}
    </main>
  );
}
