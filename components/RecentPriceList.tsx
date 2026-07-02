import type { RecentPricePoint, StockBasicInfo } from "@/lib/market/types";

function formatPrice(value: number, currency: StockBasicInfo["currency"]) {
  return currency === "KRW"
    ? value.toLocaleString("ko-KR", { maximumFractionDigits: 0 })
    : value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
}

function isSamePrice(a: number, b: number) {
  return Math.abs(a - b) < 0.0001;
}

export default function RecentPriceList({
  prices,
  currency,
}: {
  prices: RecentPricePoint[];
  currency: StockBasicInfo["currency"];
}) {
  const tenDayHigh =
    prices.length > 0 ? Math.max(...prices.map((price) => price.high)) : null;
  const tenDayLow =
    prices.length > 0 ? Math.min(...prices.map((price) => price.low)) : null;

  return (
    <section className="border-b border-line py-5">
      <h2 className="mb-4 text-lg font-extrabold">최근 10일 기록</h2>
      <div className="grid gap-2 lg:grid-cols-2">
        {prices.map((price) => {
          const positive = price.changePercent >= 0;
          const isTenDayHigh =
            tenDayHigh !== null && isSamePrice(price.high, tenDayHigh);
          const isTenDayLow =
            tenDayLow !== null && isSamePrice(price.low, tenDayLow);

          return (
            <div
              key={price.date}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-md bg-surface px-3 py-2 text-sm font-bold"
            >
              <span className="text-muted">{price.date}</span>
              <span className="text-ink">
                {formatPrice(price.close, currency)}
              </span>
              <span className={positive ? "text-positive" : "text-negative"}>
                {positive ? "▲" : "▼"}{" "}
                {Math.abs(price.changePercent).toFixed(2)}%
              </span>
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
        })}
      </div>
    </section>
  );
}
