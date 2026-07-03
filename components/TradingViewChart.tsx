"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toTradingViewSymbol } from "@/lib/market/toTradingViewSymbol";

declare global {
  interface Window {
    TradingView?: {
      widget: new (options: Record<string, unknown>) => unknown;
    };
  }
}

type LoadState = "loading" | "ready" | "error";

const WIDGET_TIMEOUT_MS = 8000;
const TRADING_VIEW_SCRIPT_SRC = "https://s3.tradingview.com/tv.js";

function makeSafeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function isKoreanTradingViewSymbol(tvSymbol: string | null) {
  return tvSymbol?.startsWith("KRX:") ?? false;
}

function normalizeTradingViewSymbol(value: string) {
  return value.trim().toUpperCase();
}

function extractIframeSymbol(src: string) {
  try {
    const url = new URL(src);
    return url.searchParams.get("symbol");
  } catch {
    const match = src.match(/[?&]symbol=([^&]+)/i);
    return match ? decodeURIComponent(match[1]) : null;
  }
}

function iframeHasDifferentSymbol(iframe: HTMLIFrameElement, expectedSymbol: string) {
  const iframeSymbol = extractIframeSymbol(iframe.src);
  if (!iframeSymbol) return false;

  return normalizeTradingViewSymbol(iframeSymbol) !== normalizeTradingViewSymbol(expectedSymbol);
}

function TradingViewSkeleton() {
  return (
    <div className="h-[22rem] animate-pulse rounded-lg border border-line bg-panel/70 sm:h-[28rem] lg:h-[34rem]" aria-hidden="true">
      <div className="flex h-full flex-col justify-between p-4">
        <div className="space-y-2">
          <div className="h-4 w-36 rounded bg-surface" />
          <div className="h-3 w-52 rounded bg-surface/80" />
        </div>
        <div className="space-y-3">
          <div className="h-2 w-full rounded bg-surface/70" />
          <div className="h-2 w-10/12 rounded bg-surface/70" />
          <div className="h-2 w-8/12 rounded bg-surface/70" />
        </div>
      </div>
    </div>
  );
}

function UnsupportedKoreanChart({ onBackToMini }: { onBackToMini: () => void }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-line bg-panel/60 px-4 text-center text-sm font-bold text-muted">
      <p className="max-w-lg leading-6">이 종목은 TradingView의 외부 위젯 데이터 정책으로 상세 차트를 표시할 수 없습니다.</p>
      <p className="text-xs leading-5 text-muted">기본 미니 차트는 Velora 가격 데이터 기준으로 계속 사용할 수 있습니다.</p>
      <button
        type="button"
        onClick={onBackToMini}
        className="h-10 rounded-full border border-line bg-surface px-4 text-sm font-black text-ink transition hover:border-positive/50 hover:bg-positive/10"
      >
        미니 차트로 돌아가기
      </button>
    </div>
  );
}

function UnsupportedSymbolChart({ onBackToMini }: { onBackToMini: () => void }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-line bg-panel/60 px-4 text-center text-sm font-bold text-muted">
      <p>이 종목은 TradingView 심볼로 변환할 수 없어 상세 차트를 표시하지 않습니다.</p>
      <button
        type="button"
        onClick={onBackToMini}
        className="h-10 rounded-full border border-line bg-surface px-4 text-sm font-black text-ink transition hover:border-positive/50 hover:bg-positive/10"
      >
        미니 차트로 돌아가기
      </button>
    </div>
  );
}

export default function TradingViewChart({
  symbol,
  onBackToMini,
}: {
  symbol: string;
  onBackToMini: () => void;
}) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [retryKey, setRetryKey] = useState(0);
  const instanceIdRef = useRef(`tv-${Math.random().toString(36).slice(2)}`);
  const containerRef = useRef<HTMLDivElement>(null);
  const tvSymbol = useMemo(() => toTradingViewSymbol(symbol), [symbol]);
  const isUnsupportedKoreanSymbol = isKoreanTradingViewSymbol(tvSymbol);
  const containerId = useMemo(() => makeSafeId(`${instanceIdRef.current}-${tvSymbol ?? "unsupported"}`), [tvSymbol]);

  useEffect(() => {
    if (!tvSymbol || isUnsupportedKoreanSymbol) {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      setLoadState("error");
      return undefined;
    }

    const expectedSymbol = tvSymbol;
    let cancelled = false;
    let timeoutId: number | null = null;
    let observer: MutationObserver | null = null;
    const script = document.createElement("script");

    setLoadState("loading");
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }

    script.id = `${containerId}-script`;
    script.src = TRADING_VIEW_SCRIPT_SRC;
    script.async = true;

    function cleanupWidget() {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      observer?.disconnect();
      script.remove();
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    }

    function failAndHideWidget() {
      cleanupWidget();
      if (!cancelled) {
        setLoadState("error");
      }
    }

    function markReadyWhenExpectedIframeAppears() {
      const container = containerRef.current;
      if (!container) return;

      observer = new MutationObserver(() => {
        const iframe = container.querySelector("iframe");
        if (!iframe) return;

        if (iframeHasDifferentSymbol(iframe, expectedSymbol)) {
          failAndHideWidget();
          return;
        }

        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
        setLoadState("ready");
        observer?.disconnect();
      });

      observer.observe(container, { childList: true, subtree: true });
    }

    function createWidget() {
      const container = containerRef.current;
      if (cancelled || !container || !window.TradingView?.widget) return;

      container.innerHTML = "";
      markReadyWhenExpectedIframeAppears();

      try {
        new window.TradingView.widget({
          autosize: true,
          symbol: expectedSymbol,
          interval: "D",
          timezone: "Asia/Seoul",
          theme: "dark",
          style: "1",
          locale: "kr",
          toolbar_bg: "#262a30",
          enable_publishing: false,
          allow_symbol_change: false,
          hide_side_toolbar: false,
          withdateranges: true,
          container_id: containerId,
        });
      } catch {
        failAndHideWidget();
      }
    }

    script.onload = createWidget;
    script.onerror = () => {
      if (!cancelled) setLoadState("error");
    };

    timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        failAndHideWidget();
      }
    }, WIDGET_TIMEOUT_MS);

    document.body.appendChild(script);

    return () => {
      cancelled = true;
      cleanupWidget();
    };
  }, [containerId, isUnsupportedKoreanSymbol, retryKey, tvSymbol]);

  function retry() {
    setLoadState("loading");
    setRetryKey((value) => value + 1);
  }

  if (isUnsupportedKoreanSymbol) {
    return <UnsupportedKoreanChart onBackToMini={onBackToMini} />;
  }

  if (!tvSymbol) {
    return <UnsupportedSymbolChart onBackToMini={onBackToMini} />;
  }

  return (
    <div className="relative min-h-[22rem] sm:min-h-[28rem] lg:min-h-[34rem]">
      {loadState === "loading" && (
        <div aria-live="polite" className="absolute inset-0 z-10">
          <TradingViewSkeleton />
          <p className="mt-2 text-xs font-bold text-muted">TradingView 차트를 불러오는 중입니다.</p>
        </div>
      )}

      {loadState === "error" && (
        <div
          role="alert"
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg border border-line bg-panel/60 px-4 text-center"
        >
          <p className="text-sm font-extrabold text-negative">TradingView 차트를 불러오지 못했습니다.</p>
          <p className="max-w-lg text-xs font-bold leading-5 text-muted">
            네트워크 차단, 외부 스크립트 제한, TradingView 응답 지연, 또는 요청 심볼과 다른 기본 차트 응답이 원인일 수 있습니다.
            기본 미니 차트는 계속 사용할 수 있습니다.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={retry}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-black text-ink transition hover:border-positive/50 hover:bg-positive/10"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              다시 시도
            </button>
            <button
              type="button"
              onClick={onBackToMini}
              className="h-10 rounded-full border border-line bg-surface px-4 text-sm font-black text-ink transition hover:border-positive/50 hover:bg-positive/10"
            >
              미니 차트로 돌아가기
            </button>
          </div>
        </div>
      )}

      <div
        id={containerId}
        ref={containerRef}
        className={`absolute inset-0 overflow-hidden rounded-lg border border-line bg-panel transition-opacity ${
          loadState === "ready" ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
    </div>
  );
}
