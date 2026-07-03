"use client";

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

type ChartPoint = RecentPricePoint & {
  label: string;
};

function getReturnPercent(prices: RecentPricePoint[], currentPrice: number) {
  const firstClose = prices[0]?.close;
  if (!firstClose || firstClose <= 0) return 0;
  return ((currentPrice - firstClose) / firstClose) * 100;
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
      <p className={getPercentColorClass(point.changePercent)}>전일 대비: {formatPercent(point.changePercent)}</p>
      <p>거래량: {formatVolume(point.volume)}</p>
    </div>
  );
}

export default function MiniPriceChart({
  prices,
  currency,
  currentPrice,
}: {
  prices: RecentPricePoint[];
  currency: StockBasicInfo["currency"];
  currentPrice: number;
}) {
  const chartData: ChartPoint[] = prices.slice(-30).map((price) => ({
    ...price,
    label: price.date.slice(5),
  }));
  const returnPercent = getReturnPercent(chartData, currentPrice);
  const lineColor = returnPercent >= 0 ? "#34d399" : "#fb7185";

  return (
    <section className="border-b border-line py-5">
      <div className="min-w-0 overflow-hidden rounded-lg bg-surface p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-extrabold">최근 30일 가격 추이</h2>
            <p className="mt-1 text-sm font-bold text-muted">종가 기준 미니 라인차트</p>
          </div>
          <div className="grid gap-2 text-sm font-extrabold sm:flex sm:flex-wrap">
            <span className="rounded-full border border-line bg-panel/70 px-3 py-1 text-center text-ink">
              현재가 {formatPrice(currentPrice, currency)}
            </span>
            <span className={`rounded-full border border-line bg-panel/70 px-3 py-1 text-center ${getPercentColorClass(returnPercent)}`}>
              30일 수익률 {formatPercent(returnPercent)}
            </span>
          </div>
        </div>

        {chartData.length < 2 ? (
          <div className="flex h-40 items-center justify-center rounded-lg border border-line bg-panel/50 text-sm font-bold text-muted">
            차트 데이터 없음
          </div>
        ) : (
          <div className="h-40 min-w-0 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
                <CartesianGrid stroke="rgba(167, 173, 183, 0.16)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--muted)", fontSize: 11, fontWeight: 700 }}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(167, 173, 183, 0.2)" }}
                  minTickGap={18}
                  interval="preserveStartEnd"
                />
                <YAxis
                  width={42}
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
                  strokeWidth={2.4}
                  dot={false}
                  activeDot={{ r: 4, stroke: lineColor, strokeWidth: 2, fill: "#111418" }}
                  isAnimationActive
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
