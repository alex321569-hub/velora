"use client";

import { AlertTriangle, LineChart, Moon, Search, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AnalysisCards from "@/components/AnalysisCards";
import PriceChartPanel from "@/components/PriceChartPanel";
import RecentPriceList from "@/components/RecentPriceList";
import SearchBox from "@/components/SearchBox";
import StockBasicInfo from "@/components/StockBasicInfo";
import { useLiveQuote } from "@/hooks/useLiveQuote";
import { baseSearchFilters, sectorSearchFilters } from "@/lib/market/searchStocks";
import { normalizeMarketSymbol } from "@/lib/market/symbolUtils";
import type { SearchFilter, StockAlias, StockAnalysisResponse } from "@/lib/market/types";

const validSearchFilters = new Set<SearchFilter>([...baseSearchFilters, ...sectorSearchFilters].map((filter) => filter.id));

function VeloraApp({ routeSymbol }: { routeSymbol?: string }) {
  const router = useRouter();
  const [stock, setStock] = useState<StockAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [selectedFilter, setSelectedFilter] = useState<SearchFilter>("all");
  const hasSearched = Boolean(routeSymbol || stock || loading || error);
  const handleLiveUpdate = useCallback((nextStock: StockAnalysisResponse) => {
    setStock(nextStock);
  }, []);
  const liveQuote = useLiveQuote({
    symbol: stock?.basic.symbol ?? null,
    enabled: Boolean(stock && !loading),
    currentPrice: stock?.basic.currentPrice ?? null,
    onUpdate: handleLiveUpdate,
  });

  function getRouteSymbol(stockAlias: StockAlias) {
    return normalizeMarketSymbol(stockAlias.symbol, stockAlias).yahooSymbol;
  }

  const loadStock = useCallback(async (symbol: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/stocks?symbol=${encodeURIComponent(symbol)}`);
      if (!response.ok) {
        throw new Error("종목을 찾을 수 없습니다. 티커를 직접 입력해보세요.");
      }

      setStock((await response.json()) as StockAnalysisResponse);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "알 수 없는 오류가 발생했습니다.");
      setStock(null);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleSelect(stockAlias: StockAlias) {
    window.sessionStorage.setItem("velora-home-scroll-y", String(window.scrollY));
    router.push(`/stock/${encodeURIComponent(getRouteSymbol(stockAlias))}`);
  }

  function goHome() {
    router.push("/");
  }

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("stock-dashboard-theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
    }

    const savedFilter = window.localStorage.getItem("velora-selected-filter") as SearchFilter | null;
    if (savedFilter && validSearchFilters.has(savedFilter)) {
      setSelectedFilter(savedFilter);
    } else if (savedFilter) {
      window.localStorage.setItem("velora-selected-filter", "all");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("velora-selected-filter", selectedFilter);
  }, [selectedFilter]);

  useEffect(() => {
    if (routeSymbol) {
      void loadStock(routeSymbol);
      return;
    }

    setStock(null);
    setError("");
    setLoading(false);

    const savedScrollY = Number(window.sessionStorage.getItem("velora-home-scroll-y") ?? "0");
    if (savedScrollY > 0) {
      window.requestAnimationFrame(() => window.scrollTo({ top: savedScrollY, behavior: "instant" }));
    }
  }, [loadStock, routeSymbol]);

  function toggleTheme() {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      window.localStorage.setItem("stock-dashboard-theme", nextTheme);
      return nextTheme;
    });
  }

  return (
    <main className={`theme-${theme} min-h-screen overflow-x-hidden bg-[color:var(--page-bg)] px-3 py-4 text-ink transition-colors md:px-6 md:py-5 lg:px-8`}>
      <button
        type="button"
        onClick={toggleTheme}
        className="fixed right-3 top-3 z-40 flex h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-line bg-surface/90 px-3 text-sm font-extrabold text-ink shadow-glow backdrop-blur transition hover:bg-panel md:right-6 md:top-6"
        aria-label={theme === "dark" ? "일반모드로 전환" : "다크모드로 전환"}
      >
        {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
        <span className="hidden md:inline">{theme === "dark" ? "일반모드" : "다크모드"}</span>
      </button>

      {!hasSearched ? (
        <section
          className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-5xl flex-col items-center justify-center px-0 py-14 text-center md:min-h-[calc(100vh-2.5rem)] md:px-2 md:py-16"
        >
          <div className="mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-surface shadow-glow">
            <Search className="h-8 w-8 text-positive" aria-hidden="true" />
          </div>
          <h1 className="text-4xl font-black tracking-normal text-ink md:text-6xl">VELORA</h1>
          <p className="mt-4 text-base font-semibold text-muted md:text-lg">티커 또는 회사명을 검색하여 종목을 분석해보세요.</p>

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
        <header className="sticky top-0 z-20 -mx-3 bg-[color:var(--header-bg)] px-3 py-3 backdrop-blur transition-all md:-mx-6 md:px-6 md:py-4 lg:-mx-8 lg:px-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 md:flex-row md:items-center">
            <button
              type="button"
              onClick={goHome}
              className="inline-flex h-11 shrink-0 items-center justify-center self-start rounded-full border border-line bg-surface/90 px-4 text-sm font-black text-ink shadow-glow transition hover:border-positive/50 hover:bg-positive/10 focus:outline-none focus:ring-2 focus:ring-positive/50 md:h-10 md:self-auto"
              aria-label="홈으로 이동"
            >
              ← 홈
            </button>
            <button
              type="button"
              onClick={goHome}
              className="flex min-w-0 shrink-0 items-center gap-3 rounded-2xl text-left transition hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-positive/50 md:w-auto"
              aria-label="시작 화면으로 이동"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface">
                <LineChart className="h-5 w-5 text-positive" aria-hidden="true" />
              </div>
              <div className="min-w-0">
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

        <div className="mt-4 animate-fade-slide-up rounded-lg bg-panel p-3 shadow-glow md:mt-6 md:p-5">
          {loading && (
            <>
              <div className="py-8 text-center text-sm font-bold text-muted">데이터를 불러오는 중입니다.</div>
              <PriceChartPanel symbol="" prices={[]} currency="USD" currentPrice={0} isLoading />
            </>
          )}
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
              <PriceChartPanel
                symbol={stock.basic.symbol}
                prices={stock.chartPrices}
                currency={stock.basic.currency}
                currentPrice={stock.basic.currentPrice}
                error={liveQuote.refreshError}
              />
              <RecentPriceList prices={stock.recentPrices} currency={stock.basic.currency} />
              <AnalysisCards
                symbol={stock.basic.symbol}
                indicators={stock.indicators}
                currency={stock.basic.currency}
                currentPrice={stock.basic.currentPrice}
                recentPrices={stock.recentPrices}
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

export default VeloraApp;
