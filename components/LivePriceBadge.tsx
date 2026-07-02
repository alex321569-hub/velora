import type { PriceFlashDirection } from "@/hooks/useLiveQuote";

export default function LivePriceBadge({
  secondsSinceUpdate,
  secondsUntilUpdate,
  refreshError,
  flashDirection,
}: {
  secondsSinceUpdate: number;
  secondsUntilUpdate: number;
  refreshError: string;
  flashDirection: PriceFlashDirection;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-extrabold text-muted">
      <span className="inline-flex items-center gap-1.5 text-positive">
        <span
          className={[
            "h-2 w-2 rounded-full bg-positive",
            flashDirection ? "animate-live-dot" : "",
          ].join(" ")}
          aria-hidden="true"
        />
        LIVE
      </span>
      <span>마지막 업데이트: {secondsSinceUpdate}초 전</span>
      <span>다음 업데이트: {secondsUntilUpdate}초</span>
      {refreshError && <span className="text-negative">{refreshError}</span>}
    </div>
  );
}
