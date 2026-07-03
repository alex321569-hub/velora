import { formatPrice } from "@/lib/formatters";
import type { StockBasicInfo, SupportResistanceLevel } from "@/lib/market/types";

export default function LevelList({
  levels,
  currency,
}: {
  levels: SupportResistanceLevel[];
  currency: StockBasicInfo["currency"];
}) {
  if (levels.length === 0) return <p>데이터 없음</p>;

  return (
    <div className="space-y-2">
      {levels.map((level, index) => (
        <div key={`${level.type}-${level.price}-${index}`} className="rounded-md border border-line/70 bg-panel/50 px-3 py-2">
          <p>
            {index + 1}단계: {formatPrice(level.price, currency)}
          </p>
          <p className="text-xs font-extrabold text-muted">신뢰도 {level.confidence}점</p>
          <p className="text-xs font-bold text-muted">{level.reason}</p>
        </div>
      ))}
    </div>
  );
}
