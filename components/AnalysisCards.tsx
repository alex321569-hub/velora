import type { StockBasicInfo, StockIndicators, SupportResistanceLevel } from "@/lib/market/types";

function formatValue(value: number | null, currency: StockBasicInfo["currency"]) {
  if (value === null) {
    return "데이터 없음";
  }

  return currency === "KRW"
    ? value.toLocaleString("ko-KR", { maximumFractionDigits: 0 })
    : value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDistance(value: number | null, percent: number | null, currency: StockBasicInfo["currency"]) {
  if (value === null || percent === null) {
    return "의미 있는 구간 없음";
  }

  return `${formatValue(value, currency)} (${percent.toFixed(2)}%)`;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="min-h-40 rounded-lg bg-surface p-4">
      <h3 className="mb-3 text-sm font-extrabold text-muted">{title}</h3>
      <div className="space-y-1 text-sm font-bold leading-6 text-ink">{children}</div>
    </article>
  );
}

function LevelList({
  levels,
  currency,
}: {
  levels: SupportResistanceLevel[];
  currency: StockBasicInfo["currency"];
}) {
  if (levels.length === 0) {
    return <p>데이터 없음</p>;
  }

  return (
    <div className="space-y-2">
      {levels.map((level, index) => (
        <div key={`${level.type}-${level.price}-${index}`} className="rounded-md border border-line/70 bg-panel/50 px-3 py-2">
          <p>
            {index + 1}단계: {formatValue(level.price, currency)}
          </p>
          <p className="text-xs font-extrabold text-muted">신뢰도 {level.confidence}점</p>
          <p className="text-xs font-bold text-muted">{level.reason}</p>
        </div>
      ))}
    </div>
  );
}

export default function AnalysisCards({
  indicators,
  currency,
}: {
  indicators: StockIndicators;
  currency: StockBasicInfo["currency"];
}) {
  const ma = indicators.movingAverages;

  return (
    <section className="py-5">
      <h2 className="mb-4 text-lg font-extrabold">종목 분석</h2>
      {indicators.calculationError ? (
        <div className="rounded-lg bg-surface p-4 text-sm font-extrabold text-negative">
          {indicators.calculationError}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card title="52주 최고/최저">
            <p>최저: {formatValue(indicators.week52Low, currency)}</p>
            <p>최고: {formatValue(indicators.week52High, currency)}</p>
          </Card>
          <Card title="볼린저밴드">
            <p>상단: {formatValue(indicators.bollingerBands.upper, currency)}</p>
            <p>중앙: {formatValue(indicators.bollingerBands.middle, currency)}</p>
            <p>하단: {formatValue(indicators.bollingerBands.lower, currency)}</p>
          </Card>
          <Card title="이동평균선">
            <p>5일: {formatValue(ma.sma5, currency)}</p>
            <p>20일: {formatValue(ma.sma20, currency)}</p>
            <p>60일: {formatValue(ma.sma60, currency)}</p>
            <p>120일: {formatValue(ma.sma120, currency)}</p>
            <p>365일: {formatValue(ma.sma365, currency)}</p>
          </Card>
          <Card title="RSI">
            <p>
              [{indicators.rsiStatus}] {indicators.rsi.toFixed(2)}
            </p>
          </Card>
          <Card title="지지선">
            <LevelList levels={indicators.supportResistance.supports} currency={currency} />
          </Card>
          <Card title="저항선">
            {indicators.supportResistance.resistanceMessage ? (
              <p>{indicators.supportResistance.resistanceMessage}</p>
            ) : (
              <LevelList levels={indicators.supportResistance.resistances} currency={currency} />
            )}
          </Card>
          <Card title="종합 신호">
            <p>추세 상태: {indicators.compositeSignal.trendStatus}</p>
            <p>현재 위치: {indicators.compositeSignal.pricePosition}</p>
            <p>RSI 상태: {indicators.compositeSignal.rsiStatus}</p>
            <p>
              지지선 거리:{" "}
              {formatDistance(
                indicators.compositeSignal.nearestSupportDistance,
                indicators.compositeSignal.nearestSupportDistancePercent,
                currency,
              )}
            </p>
            <p>
              저항선 거리:{" "}
              {formatDistance(
                indicators.compositeSignal.nearestResistanceDistance,
                indicators.compositeSignal.nearestResistanceDistancePercent,
                currency,
              )}
            </p>
            <p>
              종합 점수: {indicators.compositeSignal.score}점 · {indicators.compositeSignal.scoreLabel}
            </p>
            {indicators.compositeSignal.warning && (
              <p className="font-extrabold text-negative">{indicators.compositeSignal.warning}</p>
            )}
          </Card>
        </div>
      )}
    </section>
  );
}
