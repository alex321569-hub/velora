import { formatPercent, formatPrice, getPercentColorClass } from "@/lib/formatters";
import type { StockBasicInfo } from "@/lib/market/types";

export default function MovingAverageRow({
  label,
  tooltip,
  value,
  currentPrice,
  currency,
}: {
  label: string;
  tooltip: string;
  value: number | null;
  currentPrice: number;
  currency: StockBasicInfo["currency"];
}) {
  if (value === null) {
    return (
      <div title={tooltip} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 rounded-md px-2 py-1.5">
        <span className="font-extrabold text-muted">{label}</span>
        <span className="text-ink">데이터 없음</span>
        <span className="text-muted">-</span>
      </div>
    );
  }

  const percent = ((currentPrice - value) / value) * 100;

  return (
    <div title={tooltip} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 rounded-md px-2 py-1.5 hover:bg-panel/50">
      <span className="font-extrabold text-muted">{label}</span>
      <span className="text-ink">{formatPrice(value, currency)}</span>
      <span className={`font-extrabold ${getPercentColorClass(percent)}`}>{formatPercent(percent)}</span>
    </div>
  );
}
