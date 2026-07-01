import type { RecentPricePoint, StockBasicInfo } from "@/lib/market/types";

function formatPrice(value: number, currency: StockBasicInfo["currency"]) {
  return currency === "KRW"
    ? value.toLocaleString("ko-KR", { maximumFractionDigits: 0 })
    : value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function RecentPriceList({
  prices,
  currency,
}: {
  prices: RecentPricePoint[];
  currency: StockBasicInfo["currency"];
}) {
  return (
    <section className="border-b border-line py-5">
      <h2 className="mb-4 text-lg font-extrabold">최근 10일 기록</h2>
      <div className="grid gap-2 lg:grid-cols-2">
        {prices.map((price, index) => {
          const positive = price.changePercent >= 0;
          return (
            <div
              key={price.date}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-md bg-surface px-3 py-2 text-sm font-bold"
            >
              <span className="text-muted">{price.date}</span>
              <span className="text-ink">{formatPrice(price.close, currency)}</span>
              <span className={positive ? "text-positive" : "text-negative"}>
                {positive ? "▲" : "▼"} {Math.abs(price.changePercent).toFixed(2)}%
              </span>
              {index === 0 && <span className="col-span-3 text-right text-xs text-muted">10일 고점</span>}
              {index === prices.length - 1 && <span className="col-span-3 text-right text-xs text-muted">10일 저점</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
