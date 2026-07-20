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
import { normalizeKoreanCode } from "@/lib/market/symbolUtils";
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
  const [externalResults, setExternalResults] = useState<StockAlias[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const quickStocksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 150);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const localResults = useMemo(() => getAutocompleteResults(debouncedQuery, 8, selectedFilter), [debouncedQuery, selectedFilter]);
  const hasExactLocalTicker = localResults.some((stock) => normalizeSymbolInput(stock.symbol) === normalizeSymbolInput(debouncedQuery));
  const shouldPreferExternalResults = externalResults.length > 0 && isTickerLikeInput(debouncedQuery) && !hasExactLocalTicker;
  const results = shouldPreferExternalResults ? externalResults : localResults.length > 0 ? localResults : externalResults;
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
  const quickStocks = useMemo(() => {
    const seen = new Set<string>();
    const filteredRecentStocks = recentStocks.filter((stock) => stockMatchesFilter(stock, selectedFilter));

    return [...filteredRecentStocks, ...representativeStocks]
      .filter((stock) => {
        if (seen.has(stock.symbol)) return false;
        seen.add(stock.symbol);
        return true;
      })
      .slice(0, 8);
  }, [recentStocks, representativeStocks, selectedFilter]);

  const selectedFilterLabel = searchFilterOptions.find((filter) => filter.id === selectedFilter)?.label ?? selectedFilter;
  const shouldShowDropdown = isOpen && query.trim().length > 0;

  useEffect(() => {
    setActiveIndex(0);
    setIsOpen(query.trim().length > 0 && query !== selectedLabel);
  }, [query, selectedLabel]);

  useEffect(() => {
    const trimmedQuery = debouncedQuery.trim();
    setExternalResults([]);

    const hasExactLocalTickerResult = localResults.some((stock) => normalizeSymbolInput(stock.symbol) === normalizeSymbolInput(trimmedQuery));

    if (trimmedQuery.length < 2 || !isTickerLikeInput(trimmedQuery) || hasExactLocalTickerResult) {
      return;
    }

    const controller = new AbortController();

    async function fetchExternalResults() {
      try {
        const params = new URLSearchParams({ query: trimmedQuery, filter: selectedFilter });
        const response = await fetch(`/api/stocks?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) return;

        const payload = (await response.json()) as { results?: StockAlias[] };
        if (!controller.signal.aborted) {
          setExternalResults((payload.results ?? []).slice(0, 8));
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn("[search] external symbol lookup failed", error);
        }
      }
    }

    void fetchExternalResults();
    return () => controller.abort();
  }, [debouncedQuery, localResults.length, selectedFilter]);

  useEffect(() => {
    setIsOpen(false);
    setActiveIndex(0);
  }, [selectedFilter]);

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

    function handleClickOutside(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, []);

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

  function selectStock(stock: StockAlias) {
    const label = `${stock.koreanName} (${stock.symbol})`;
    setSelectedLabel(label);
    setQuery(label);
    setIsOpen(false);
    setActiveIndex(0);
    setRecentSymbols((currentSymbols) => {
      const nextSymbols = [stock.symbol, ...currentSymbols.filter((symbol) => symbol !== stock.symbol)].slice(0, 10);
      window.localStorage.setItem("stock-dashboard-recent-searches", JSON.stringify(nextSymbols));
      return nextSymbols;
    });
    onSelect(stock);
  }

  function selectDirectTicker(value: string) {
    const isKoreanTicker = /^A?[0-9]{1,6}(\.(KS|KQ))?$/i.test(value.trim());
    const symbol = isKoreanTicker ? (normalizeKoreanCode(value) ?? normalizeSymbolInput(value)) : normalizeSymbolInput(value);
    const directStock: StockAlias = {
      symbol,
      name: symbol,
      koreanName: symbol,
      exchange: isKoreanTicker ? "KOSPI/KOSDAQ" : "NASDAQ",
      country: isKoreanTicker ? "KR" : "US",
      assetType: "stock",
      sector: "Other",
      industry: "Other",
      aliases: [symbol],
    };

    selectStock(directStock);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(0);
      return;
    }

    if (event.key === "Enter" && query.trim().length > 0 && results.length === 0 && isTickerLikeInput(query)) {
      event.preventDefault();
      selectDirectTicker(query);
      return;
    }

    if (!shouldShowDropdown || results.length === 0) {
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
    <div ref={containerRef} className="relative w-full min-w-0">
      <div className="relative z-40 isolate">
        <div
          className={`flex min-w-0 items-center gap-2 rounded-full border border-line bg-surface px-4 shadow-glow transition md:gap-3 md:px-5 ${
            variant === "hero" ? "h-14 md:h-[72px]" : "h-12 md:h-14"
          }`}
        >
          <Search className={`${variant === "hero" ? "h-6 w-6" : "h-5 w-5"} shrink-0 text-muted`} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => {
              setSelectedLabel("");
              setQuery(event.target.value);
              setIsOpen(event.target.value.trim().length > 0);
            }}
            onFocus={() => setIsOpen(query.trim().length > 0 && query !== selectedLabel)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-expanded={shouldShowDropdown}
            aria-controls="stock-search-results"
            role="combobox"
            className={`h-full min-w-0 flex-1 bg-transparent font-semibold text-ink outline-none placeholder:truncate placeholder:font-medium placeholder:text-muted ${
              variant === "hero"
                ? "text-base placeholder:text-sm md:text-xl md:placeholder:text-lg"
                : "text-sm placeholder:text-xs md:text-base md:placeholder:text-base"
            }`}
          />
        </div>

        {shouldShowDropdown && (
          <div
            id="stock-search-results"
            role="listbox"
            className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(26rem,calc(100vh-8rem))] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/50"
          >
            {results.length > 0 ? (
              <ul className="max-h-[min(24rem,calc(100vh-10rem))] overflow-y-auto p-1">
                {results.map((stock, index) => (
                  <li key={stock.symbol} role="option" aria-selected={index === activeIndex}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectStock(stock)}
                      className={`flex min-h-16 w-full items-start justify-between gap-3 rounded-xl px-3 py-3 text-left transition md:gap-4 md:px-4 ${
                        index === activeIndex ? "bg-panel text-ink" : "text-muted hover:bg-panel/70 hover:text-ink"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">{stock.name}</span>
                        <span className="block truncate text-sm font-bold text-ink">{stock.koreanName}</span>
                        <span className="mt-1 block text-xs text-muted">
                          {stock.symbol} / {stock.exchange} / {stock.country === "US" ? "USA" : stock.country === "KR" ? "Korea" : "Global"}
                        </span>
                        <span className="block text-xs text-muted">
                          {stock.sector} / {stock.industry}
                        </span>
                      </span>
                      <span className="shrink-0 rounded border border-line px-2 py-1 text-[10px] font-bold text-ink md:text-xs">
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

      {showFilters && (
        <>
          <div className="mt-3">
            <ScrollableFilterChips
              filters={searchFilterOptions.map((filter) => filter.label)}
              selectedFilter={selectedFilterLabel}
              onSelect={(label) => {
                const nextFilter = searchFilterOptions.find((filter) => filter.label === label);
                if (nextFilter) {
                  setIsOpen(false);
                  setActiveIndex(0);
                  onFilterChange(nextFilter.id);
                }
              }}
            />
          </div>

          <div className="mt-3 flex justify-center">
            <div
              ref={quickStocksRef}
              key={selectedFilter}
              className="mx-auto flex max-w-full animate-fade-slide-up justify-start gap-2 overflow-x-auto pb-1 [scrollbar-width:none] md:justify-center [&::-webkit-scrollbar]:hidden"
            >
              {quickStocks.map((stock) => (
                <button
                  key={stock.symbol}
                  type="button"
                  onClick={() => selectStock(stock)}
                  className="min-h-11 shrink-0 rounded-full border border-line bg-panel/80 px-4 text-sm font-extrabold text-ink transition hover:border-positive/50 hover:bg-positive/10 md:min-h-10"
                  title={`${stock.name} (${stock.symbol})`}
                >
                  {getQuickLabel(stock)}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
