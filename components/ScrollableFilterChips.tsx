"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  filters: string[];
  selectedFilter: string;
  onSelect: (filter: string) => void;
};

export default function ScrollableFilterChips({ filters, selectedFilter, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;

    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(updateScrollState);
    const el = scrollRef.current;
    if (!el) return () => window.cancelAnimationFrame(frame);
    const resizeObserver = new ResizeObserver(updateScrollState);

    el.addEventListener("scroll", updateScrollState);
    window.addEventListener("resize", updateScrollState);
    resizeObserver.observe(el);

    return () => {
      window.cancelAnimationFrame(frame);
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
      resizeObserver.disconnect();
    };
  }, [filters]);

  useEffect(() => {
    updateScrollState();
  }, [selectedFilter]);

  const scrollByAmount = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;

    const maxScrollLeft = el.scrollWidth - el.clientWidth;
    const nextLeft = direction === "left" ? Math.max(0, el.scrollLeft - 320) : Math.min(maxScrollLeft, el.scrollLeft + 320);

    el.scrollBy({
      left: nextLeft - el.scrollLeft,
      behavior: "smooth",
    });
    window.setTimeout(updateScrollState, 260);
  };

  return (
    <div className="relative mx-auto w-full min-w-0">
      <button
        type="button"
        onClick={() => scrollByAmount("left")}
        disabled={!canLeft}
        className="absolute left-0 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-positive/30 bg-surface/95 text-ink shadow-glow transition hover:bg-panel disabled:cursor-not-allowed disabled:border-line disabled:text-muted disabled:opacity-35"
        aria-label="이전 필터"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>

      <div
        ref={scrollRef}
        className="overflow-x-auto scroll-smooth px-14 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex w-max min-w-full justify-center gap-2">
          {filters.map((filter) => {
            const active = selectedFilter === filter;

            return (
              <button
                key={filter}
                type="button"
                onClick={() => onSelect(filter)}
                className={[
                  "h-11 shrink-0 rounded-full border px-5 text-sm font-extrabold transition",
                  active
                    ? "border-positive/50 bg-positive/15 text-ink"
                    : "border-line bg-surface/60 text-muted hover:bg-panel hover:text-ink",
                ].join(" ")}
              >
                {filter}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => scrollByAmount("right")}
        disabled={!canRight}
        className="absolute right-0 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-positive/30 bg-surface/95 text-ink shadow-glow transition hover:bg-panel disabled:cursor-not-allowed disabled:border-line disabled:text-muted disabled:opacity-35"
        aria-label="다음 필터"
      >
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
