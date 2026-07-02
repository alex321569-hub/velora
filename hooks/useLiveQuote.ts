"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StockAnalysisResponse } from "@/lib/market/types";

const POLL_INTERVAL_SECONDS = 15;

export type PriceFlashDirection = "up" | "down" | null;

export function useLiveQuote({
  symbol,
  enabled,
  currentPrice,
  onUpdate,
}: {
  symbol: string | null;
  enabled: boolean;
  currentPrice: number | null;
  onUpdate: (stock: StockAnalysisResponse) => void;
}) {
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  const [secondsUntilUpdate, setSecondsUntilUpdate] = useState(POLL_INTERVAL_SECONDS);
  const [flashDirection, setFlashDirection] = useState<PriceFlashDirection>(null);
  const [refreshError, setRefreshError] = useState("");
  const lastKnownPriceRef = useRef<number | null>(null);
  const currentPriceRef = useRef<number | null>(currentPrice);
  const lastPollAtRef = useRef<number>(Date.now());
  const flashTimerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    currentPriceRef.current = currentPrice;
  }, [currentPrice]);

  const clearFlashTimer = useCallback(() => {
    if (flashTimerRef.current) {
      window.clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled || !symbol || document.hidden) {
      return;
    }

    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const response = await fetch(`/api/stocks?symbol=${encodeURIComponent(symbol)}`, {
        cache: "no-store",
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error("가격 갱신 실패");
      }

      const nextStock = (await response.json()) as StockAnalysisResponse;
      const nextPrice = nextStock.basic.currentPrice;
      const previousPrice = lastKnownPriceRef.current;

      if (previousPrice !== null && nextPrice !== previousPrice) {
        clearFlashTimer();
        setFlashDirection(nextPrice > previousPrice ? "up" : "down");
        flashTimerRef.current = window.setTimeout(() => {
          setFlashDirection(null);
          flashTimerRef.current = null;
        }, 800);
      }

      lastKnownPriceRef.current = nextPrice;
      lastPollAtRef.current = Date.now();
      setLastUpdatedAt(new Date());
      setSecondsSinceUpdate(0);
      setSecondsUntilUpdate(POLL_INTERVAL_SECONDS);
      setRefreshError("");
      onUpdate(nextStock);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setRefreshError("가격 갱신 실패");
      lastPollAtRef.current = Date.now();
      setSecondsUntilUpdate(POLL_INTERVAL_SECONDS);
    }
  }, [clearFlashTimer, enabled, onUpdate, symbol]);

  useEffect(() => {
    abortRef.current?.abort();
    clearFlashTimer();
    setFlashDirection(null);
    setRefreshError("");
    setSecondsSinceUpdate(0);
    setSecondsUntilUpdate(POLL_INTERVAL_SECONDS);
    setLastUpdatedAt(enabled && symbol ? new Date() : null);
    lastKnownPriceRef.current = currentPriceRef.current;
    lastPollAtRef.current = Date.now();

    if (!enabled || !symbol) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      if (document.hidden) {
        return;
      }

      const elapsedSeconds = Math.floor((Date.now() - lastPollAtRef.current) / 1000);
      setSecondsSinceUpdate(elapsedSeconds);
      setSecondsUntilUpdate(Math.max(POLL_INTERVAL_SECONDS - elapsedSeconds, 0));

      if (elapsedSeconds >= POLL_INTERVAL_SECONDS) {
        void refresh();
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
      abortRef.current?.abort();
      clearFlashTimer();
    };
  }, [clearFlashTimer, enabled, refresh, symbol]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      clearFlashTimer();
    };
  }, [clearFlashTimer]);

  return {
    flashDirection,
    lastUpdatedAt,
    secondsSinceUpdate,
    secondsUntilUpdate,
    refreshError,
  };
}
