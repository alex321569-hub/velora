import { formatPercent, formatPrice, formatVolume, getPercentColorClass } from "@/lib/formatters";
import type { RecentPricePoint, StockBasicInfo } from "@/lib/market/types";

function isSamePrice(a: number, b: number) {
  return Math.abs(a - b) < 0.0001;
}

function buildTooltip(price: RecentPricePoint, currency: StockBasicInfo["currency"]) {
  return [
    price.date,
    `시가: ${formatPrice(price.open, currency)}`,
    `고가: ${formatPrice(price.high, currency)}`,
    `저가: ${formatPrice(price.low, currency)}`,
    `종가: ${formatPrice(price.close, currency)}`,
    `거래량: ${formatVolume(price.volume)}`,
  ].join("\n");
}

function RecentPriceRow({
  price,
  currency,
  isTenDayHigh,
  isTenDayLow,
}: {
  price: RecentPricePoint;
  currency: StockBasicInfo["currency"];
  isTenDayHigh: boolean;
  isTenDayLow: boolean;
}) {
  return (
    <div
      title={buildTooltip(price, currency)}
      className="group relative grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-md bg-surface px-3 py-2 text-sm font-bold transition hover:bg-panel/70"
    >
      <span className="text-muted">{price.date}</span>
      <span className="text-ink">{formatPrice(price.close, currency)}</span>
      <span className={getPercentColorClass(price.changePercent)}>{formatPercent(price.changePercent)}</span>

      <div className="pointer-events-none absolute left-3 top-[calc(100%+0.35rem)] z-20 hidden min-w-56 rounded-md border border-line bg-[#111418] px-3 py-2 text-xs font-bold leading-5 text-ink shadow-glow group-hover:block">
        <p className="font-extrabold text-positive">{price.date}</p>
        <p>시가: {formatPrice(price.open, currency)}</p>
        <p>고가: {formatPrice(price.high, currency)}</p>
        <p>저가: {formatPrice(price.low, currency)}</p>
        <p>종가: {formatPrice(price.close, currency)}</p>
        <p>거래량: {formatVolume(price.volume)}</p>
      </div>

      {(isTenDayHigh || isTenDayLow) && (
        <div className="col-span-3 flex flex-wrap justify-end gap-2 text-xs font-extrabold">
          {isTenDayHigh && (
            <span className="rounded-full border border-positive/30 bg-positive/10 px-2 py-1 text-positive">
              10일 고점 {formatPrice(price.high, currency)}
            </span>
          )}
          {isTenDayLow && (
            <span className="rounded-full border border-negative/30 bg-negative/10 px-2 py-1 text-negative">
              10일 저점 {formatPrice(price.low, currency)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function RecentPriceList({
  prices,
  currency,
}: {
  prices: RecentPricePoint[];
  currency: StockBasicInfo["currency"];
}) {
  const tenDayHigh = prices.length > 0 ? Math.max(...prices.map((price) => price.high)) : null;
  const tenDayLow = prices.length > 0 ? Math.min(...prices.map((price) => price.low)) : null;
  const columns = [prices.slice(0, 5), prices.slice(5, 10)];

  return (
    <section className="border-b border-line py-5">
      <h2 className="mb-4 text-lg font-extrabold">최근 10일 기록</h2>
      <div className="grid gap-2 lg:grid-cols-2">
        {columns.map((column, columnIndex) => (
          <div key={columnIndex === 0 ? "latest" : "previous"} className="space-y-2">
            {column.map((price) => (
              <RecentPriceRow
                key={price.date}
                price={price}
                currency={currency}
                isTenDayHigh={tenDayHigh !== null && isSamePrice(price.high, tenDayHigh)}
                isTenDayLow={tenDayLow !== null && isSamePrice(price.low, tenDayLow)}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
