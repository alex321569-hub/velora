"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ScrollableFilterChips from "@/components/ScrollableFilterChips";
import { filterRecommendations } from "@/lib/market/filterRecommendations";
import {
  baseSearchFilters,
  getAutocompleteResults,
  getBestMatch,
  getStockByRecommendationSymbol,
  isTickerLikeInput,
  normalizeSymbolInput,
  sectorSearchFilters,
  stockMatchesFilter,
} from "@/lib/market/searchStocks";
import type { SearchFilter, StockAlias } from "@/lib/market/types";

interface SearchBoxProps {
  onSelect: (stock: StockAlias) => void;
  placeholder?: string;
  variant?: "hero" | "compact";
  selectedFilter: SearchFilter;
  onFilterChange: (filter: SearchFilter) => void;
  showFilters?: boolean;
}

function getStockBySymbol(symbol: string) {
  return getStockByRecommendationSymbol(symbol) ?? getBestMatch(symbol);
}

function getQuickLabel(stock: StockAlias) {
  return stock.country === "KR" ? stock.koreanName : stock.symbol;
}

const searchFilterOptions = [...baseSearchFilters, ...sectorSearchFilters];

export default function SearchBox({
  onSelect,
  placeholder = "티커, 회사명 또는 한글명을 입력하세요",
  variant = "compact",
  selectedFilter,
  onFilterChange,
  showFilters = true,
}: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [recentSymbols, setRecentSymbols] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const quickStocksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 150);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const results = useMemo(() => getAutocompleteResults(debouncedQuery, 8, selectedFilter), [debouncedQuery, selectedFilter]);
  const recentStocks = useMemo(
    () => recentSymbols.map(getStockBySymbol).filter((stock): stock is StockAlias => stock !== null),
    [recentSymbols],
  );
  const representativeStocks = useMemo(
    () =>
      filterRecommendations[selectedFilter]
        .map(getStockBySymbol)
        .filter((stock): stock is StockAlias => stock !== null),
    [selectedFilter],
  );
  const quickStocks = useMemo(
    () => {
      const seen = new Set<string>();
      const filteredRecentStocks = recentStocks.filter((stock) => stockMatchesFilter(stock, selectedFilter));
      return [...filteredRecentStocks, ...representativeStocks]
        .filter((stock) => {
          if (seen.has(stock.symbol)) return false;
          seen.add(stock.symbol);
          return true;
        })
        .slice(0, 8);
    },
    [recentStocks, representativeStocks, selectedFilter],
  );
  const showEmptySuggestions = isOpen && query.trim().length === 0;
  const selectedFilterLabel = searchFilterOptions.find((filter) => filter.id === selectedFilter)?.label ?? selectedFilter;

  useEffect(() => {
    setActiveIndex(0);
    setIsOpen(query !== selectedLabel);
  }, [query, selectedLabel]);

  useEffect(() => {
    const savedRecent = window.localStorage.getItem("stock-dashboard-recent-searches");
    if (savedRecent) {
      try {
        const parsed = JSON.parse(savedRecent) as string[];
        setRecentSymbols(parsed.slice(0, 10));
      } catch {
        setRecentSymbols([]);
      }
    }

    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectStock(stock: StockAlias) {
    const label = `${stock.koreanName} (${stock.symbol})`;
    setSelectedLabel(label);
    setQuery(label);
    setIsOpen(false);
    setRecentSymbols((currentSymbols) => {
      const nextSymbols = [stock.symbol, ...currentSymbols.filter((symbol) => symbol !== stock.symbol)].slice(0, 10);
      window.localStorage.setItem("stock-dashboard-recent-searches", JSON.stringify(nextSymbols));
      return nextSymbols;
    });
    onSelect(stock);
  }

  useEffect(() => {
    const el = quickStocksRef.current;
    if (!el) return;

    const savedScrollLeft = Number(window.sessionStorage.getItem(`velora-quick-scroll-${selectedFilter}`) ?? "0");
    el.scrollLeft = savedScrollLeft;

    const handleScroll = () => {
      window.sessionStorage.setItem(`velora-quick-scroll-${selectedFilter}`, String(el.scrollLeft));
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [selectedFilter, quickStocks.length]);

  function selectDirectTicker(value: string) {
    const symbol = normalizeSymbolInput(value);
    const directStock: StockAlias = {
      symbol,
      name: symbol,
      koreanName: symbol,
      exchange: "NASDAQ",
      country: "US",
      assetType: "stock",
      sector: "Other",
      industry: "Other",
      aliases: [symbol],
    };

    selectStock(directStock);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && query.trim().length > 0 && results.length === 0 && isTickerLikeInput(query)) {
      event.preventDefault();
      selectDirectTicker(query);
      return;
    }

    if (!isOpen || (query.trim().length > 0 && results.length === 0)) {
      return;
    }

    if (showEmptySuggestions && event.key === "Enter" && recentStocks[0]) {
      event.preventDefault();
      selectStock(recentStocks[0]);
      return;
    }

    if (showEmptySuggestions) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    }

    if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      selectStock(results[activeIndex]);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className={`flex items-center gap-3 rounded-full border border-line bg-surface/95 px-5 shadow-glow transition ${
          variant === "hero" ? "h-16 sm:h-[72px]" : "h-14"
        }`}
      >
        <Search className={`${variant === "hero" ? "h-6 w-6" : "h-5 w-5"} shrink-0 text-muted`} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => {
            setSelectedLabel("");
            setQuery(event.target.value);
          }}
          onFocus={() => setIsOpen(query !== selectedLabel || query.trim().length === 0)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`h-full min-w-0 flex-1 bg-transparent font-semibold text-ink outline-none placeholder:font-medium placeholder:text-muted ${
            variant === "hero" ? "text-lg placeholder:text-base sm:text-xl sm:placeholder:text-lg" : "text-base placeholder:text-sm sm:placeholder:text-base"
          }`}
        />
      </div>

      {showFilters && (
        <>
          <div className="mt-3">
            <ScrollableFilterChips
              filters={searchFilterOptions.map((filter) => filter.label)}
              selectedFilter={selectedFilterLabel}
              onSelect={(label) => {
                const nextFilter = searchFilterOptions.find((filter) => filter.label === label);
                if (nextFilter) onFilterChange(nextFilter.id);
              }}
            />
          </div>

          <div className="mt-3 flex justify-center">
            <div
              ref={quickStocksRef}
              key={selectedFilter}
              className="mx-auto flex max-w-full animate-fade-slide-up justify-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {quickStocks.map((stock) => (
                <button
                  key={stock.symbol}
                  type="button"
                  onClick={() => selectStock(stock)}
                  className="min-h-10 shrink-0 rounded-full border border-line bg-panel/80 px-4 text-sm font-extrabold text-ink transition hover:border-positive/50 hover:bg-positive/10"
                  title={`${stock.name} (${stock.symbol})`}
                >
                  {getQuickLabel(stock)}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {isOpen && (
        <div
          className={`absolute left-0 right-0 z-30 overflow-hidden rounded-2xl border border-line bg-surface shadow-glow ${
            showFilters ? (variant === "hero" ? "top-44" : "top-40") : variant === "hero" ? "top-20" : "top-16"
          }`}
        >
          {showEmptySuggestions ? (
            <div className="space-y-4 p-4">
              {recentStocks.length > 0 && (
                <section>
                  <p className="px-2 pb-2 text-xs font-extrabold text-muted">최근 검색</p>
                  <div className="space-y-1">
                    {recentStocks.map((stock) => (
                      <button
                        key={stock.symbol}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectStock(stock)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-bold text-muted transition hover:bg-panel hover:text-ink"
                      >
                        <span>{stock.koreanName}</span>
                        <span>{stock.symbol}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <section>
                <p className="px-2 pb-2 text-xs font-extrabold text-muted">추천 종목</p>
                <div className="space-y-1">
                  {quickStocks.map((stock) => (
                    <button
                      key={stock.symbol}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectStock(stock)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-bold text-muted transition hover:bg-panel hover:text-ink"
                    >
                      <span>{stock.country === "KR" ? stock.koreanName : stock.name}</span>
                      <span>{stock.symbol}</span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          ) : results.length > 0 ? (
            <ul className="max-h-80 overflow-y-auto p-1">
              {results.map((stock, index) => (
                <li key={stock.symbol}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectStock(stock)}
                    className={`flex w-full items-start justify-between gap-4 rounded-xl px-4 py-3 text-left transition ${
                      index === activeIndex ? "bg-panel text-ink" : "text-muted hover:bg-panel/70 hover:text-ink"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{stock.name}</span>
                      <span className="block truncate text-sm font-bold text-ink">{stock.koreanName}</span>
                      <span className="mt-1 block text-xs text-muted">
                        {stock.symbol} / {stock.exchange} / {stock.country === "US" ? "USA" : stock.country === "KR" ? "Korea" : "Global"}
                      </span>
                      <span className="block text-xs text-muted">
                        {stock.sector} / {stock.industry}
                      </span>
                    </span>
                    <span className="shrink-0 rounded border border-line px-2 py-1 text-xs font-bold text-ink">
                      {stock.assetType.toUpperCase()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-5 text-sm font-semibold text-muted">종목을 찾을 수 없습니다. 티커를 직접 입력해보세요.</div>
          )}
        </div>
      )}
    </div>
  );
}
