"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPercent, formatPrice, formatVolume, getPercentColorClass } from "@/lib/formatters";
import type { RecentPricePoint, StockBasicInfo } from "@/lib/market/types";

type ChartRange = "1D" | "5D" | "1M";

type ChartPoint = RecentPricePoint & {
  label: string;
};

const rangeOptions: Array<{ id: ChartRange; label: string; count: number }> = [
  { id: "1D", label: "1D", count: 2 },
  { id: "5D", label: "5D", count: 5 },
  { id: "1M", label: "1M", count: 30 },
];

function getRangePrices(prices: RecentPricePoint[], range: ChartRange) {
  const count = rangeOptions.find((option) => option.id === range)?.count ?? 30;
  const chronological = [...prices].sort((a, b) => a.date.localeCompare(b.date));
  return chronological.slice(-count);
}

function getReturnPercent(prices: RecentPricePoint[], currentPrice: number) {
  const firstClose = prices[0]?.close;
  if (!firstClose || firstClose <= 0) return 0;
  return ((currentPrice - firstClose) / firstClose) * 100;
}

function getPriceStats(prices: RecentPricePoint[], currentPrice: number, range: ChartRange) {
  const statPrices = range === "1D" ? prices.slice(-1) : prices;
  const highs = statPrices.map((price) => price.high).filter(Number.isFinite);
  const lows = statPrices.map((price) => price.low).filter(Number.isFinite);

  return {
    high: highs.length > 0 ? Math.max(...highs) : currentPrice,
    low: lows.length > 0 ? Math.min(...lows) : currentPrice,
  };
}

function MiniTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
  currency: StockBasicInfo["currency"];
}) {
  if (!active || !payload?.[0]) return null;

  const point = payload[0].payload;

  return (
    <div className="max-w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-line bg-[#111418] px-3 py-2 text-xs font-bold leading-5 text-ink shadow-glow">
      <p className="font-extrabold text-positive">{point.date}</p>
      <p>종가: {formatPrice(point.close, currency)}</p>
      <p className={getPercentColorClass(point.changePercent)}>전일 대비 {formatPercent(point.changePercent)}</p>
      <p>거래량: {formatVolume(point.volume)}</p>
    </div>
  );
}

function StatPill({
  label,
  value,
  className = "text-ink",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-panel/70 px-3 py-2">
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 truncate text-sm font-black sm:text-base ${className}`}>{value}</p>
    </div>
  );
}

function MiniPriceChartSkeleton() {
  return (
    <section className="border-b border-line py-5">
      <div className="overflow-hidden rounded-lg bg-surface p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="h-5 w-36 animate-pulse rounded bg-panel" />
            <div className="h-4 w-56 animate-pulse rounded bg-panel/80" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-14 w-full min-w-24 animate-pulse rounded-lg bg-panel" />
            ))}
          </div>
        </div>
        <div className="h-40 animate-pulse rounded-lg bg-panel/70 sm:h-52" />
      </div>
    </section>
  );
}

export default function MiniPriceChart({
  prices,
  currency,
  currentPrice,
  isLoading = false,
  error = "",
}: {
  prices: RecentPricePoint[];
  currency: StockBasicInfo["currency"];
  currentPrice: number;
  isLoading?: boolean;
  error?: string;
}) {
  const [range, setRange] = useState<ChartRange>("1M");

  const rangePrices = useMemo(() => getRangePrices(prices, range), [prices, range]);
  const chartData: ChartPoint[] = useMemo(
    () =>
      rangePrices.map((price) => ({
        ...price,
        label: range === "1D" ? price.date.slice(5) : price.date.slice(5),
      })),
    [range, rangePrices],
  );
  const returnPercent = getReturnPercent(rangePrices, currentPrice);
  const { high, low } = getPriceStats(rangePrices, currentPrice, range);
  const lineColor = returnPercent >= 0 ? "#34d399" : "#fb7185";

  if (isLoading) {
    return <MiniPriceChartSkeleton />;
  }

  return (
    <section className="border-b border-line py-5">
      <div className="min-w-0 overflow-hidden rounded-lg bg-surface p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-extrabold">최근 가격 흐름</h2>
              {error && <span className="rounded-full bg-negative/10 px-2 py-1 text-xs font-extrabold text-negative">API 오류</span>}
            </div>
            <p className="mt-1 text-sm font-bold text-muted">종가 기준 미니 라인차트</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[28rem]">
            <StatPill label="현재가" value={formatPrice(currentPrice, currency)} />
            <StatPill label={`${range} 수익률`} value={formatPercent(returnPercent)} className={getPercentColorClass(returnPercent)} />
            <StatPill label="고가" value={formatPrice(high, currency)} />
            <StatPill label="저가" value={formatPrice(low, currency)} />
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex rounded-full border border-line bg-panel/70 p-1">
            {rangeOptions.map((option) => {
              const active = option.id === range;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setRange(option.id)}
                  className={`h-9 min-w-12 rounded-full px-3 text-sm font-black transition ${
                    active ? "bg-positive/20 text-positive" : "text-muted hover:bg-surface hover:text-ink"
                  }`}
                  aria-pressed={active}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {error && <p className="hidden truncate text-xs font-bold text-negative sm:block">{error}</p>}
        </div>

        {chartData.length < 2 ? (
          <div className="flex h-40 items-center justify-center rounded-lg border border-line bg-panel/50 px-4 text-center text-sm font-bold text-muted sm:h-52">
            차트 데이터 없음
          </div>
        ) : (
          <div className="h-44 min-w-0 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="rgba(167, 173, 183, 0.14)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--muted)", fontSize: 11, fontWeight: 700 }}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(167, 173, 183, 0.2)" }}
                  minTickGap={18}
                  interval="preserveStartEnd"
                />
                <YAxis
                  width={currency === "KRW" ? 58 : 48}
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(value) => formatPrice(Number(value), currency)}
                  tick={{ fill: "var(--muted)", fontSize: 11, fontWeight: 700 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={<MiniTooltip currency={currency} />}
                  cursor={{ stroke: "rgba(167, 173, 183, 0.28)", strokeWidth: 1 }}
                  allowEscapeViewBox={{ x: false, y: true }}
                  wrapperStyle={{ outline: "none" }}
                />
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke={lineColor}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, stroke: lineColor, strokeWidth: 2, fill: "#111418" }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
