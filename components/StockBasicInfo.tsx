import type { PriceFlashDirection } from "@/hooks/useLiveQuote";
import { formatPercent, formatPrice, getPercentColorClass } from "@/lib/formatters";
import type { StockBasicInfo as StockBasicInfoType } from "@/lib/market/types";
import LivePriceBadge from "./LivePriceBadge";

function getMarketStateLabel(marketState: StockBasicInfoType["marketState"]) {
  if (marketState === "PRE") {
    return "🟡 PRE";
  }

  if (marketState === "OPEN") {
    return "🟢 OPEN";
  }

  if (marketState === "POST") {
    return "🔵 POST";
  }

  return "⚪ CLOSED";
}

export default function StockBasicInfo({
  basic,
  flashDirection = null,
  liveStatus,
}: {
  basic: StockBasicInfoType;
  flashDirection?: PriceFlashDirection;
  liveStatus?: {
    secondsSinceUpdate: number;
    secondsUntilUpdate: number;
    refreshError: string;
  };
}) {
  const flashClass =
    flashDirection === "up"
      ? "animate-price-flash-up"
      : flashDirection === "down"
        ? "animate-price-flash-down"
        : "";

  return (
    <section className="border-b border-line pb-5">
      <h2 className="mb-4 text-lg font-extrabold">기본 정보</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs font-bold text-muted">회사명</p>
          <p className="mt-1 text-base font-extrabold text-ink">{basic.name}</p>
          <p className="text-sm font-semibold text-muted">{basic.koreanName}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-muted">티커 / 거래소 / 국가</p>
          <p className="mt-1 text-base font-extrabold text-ink">
            {basic.symbol} · {basic.exchange}
          </p>
          <p className="text-sm font-semibold text-muted">{basic.country}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-muted">현재가</p>
          <p
            className={[
              "mt-1 inline-flex rounded-md px-2 py-1 text-base font-extrabold text-ink transition-colors",
              flashClass,
            ].join(" ")}
          >
            {basic.currency === "USD" ? "$" : ""}
            {formatPrice(basic.currentPrice, basic.currency)}
            {basic.currency === "KRW" ? "원" : ""}
          </p>
          <span className="ml-2 inline-flex rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-extrabold text-muted">
            {getMarketStateLabel(basic.marketState)}
          </span>
          <p className={`text-sm font-extrabold ${getPercentColorClass(basic.changePercent)}`}>
            전일 대비: {formatPercent(basic.changePercent)}
          </p>
          {liveStatus && (
            <LivePriceBadge
              secondsSinceUpdate={liveStatus.secondsSinceUpdate}
              secondsUntilUpdate={liveStatus.secondsUntilUpdate}
              refreshError={liveStatus.refreshError}
              flashDirection={flashDirection}
            />
          )}
        </div>
        <div>
          <p className="text-xs font-bold text-muted">데이터 출처</p>
          <p className="mt-1 text-base font-extrabold text-ink">{basic.dataSource}</p>
        </div>
      </div>
      {basic.dataSourceNotice && (
        <p className="mt-4 rounded-md bg-surface px-4 py-3 text-sm font-bold text-muted">
          {basic.dataSourceNotice}
        </p>
      )}
    </section>
  );
}
