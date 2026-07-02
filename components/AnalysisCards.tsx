import type { StockBasicInfo, StockIndicators, SupportResistanceLevel } from "@/lib/market/types";

function formatValue(value: number | null, currency: StockBasicInfo["currency"]) {
  if (value === null) {
    return "데이터 없음";
  }

  return currency === "KRW"
    ? value.toLocaleString("ko-KR", { maximumFractionDigits: 0 })
    : value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function getDistancePercent(price: number | null, currentPrice: number) {
  if (price === null || currentPrice <= 0) {
    return null;
  }

  return (Math.abs(currentPrice - price) / currentPrice) * 100;
}

function Card({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={`min-h-40 rounded-lg bg-surface p-4 ${className}`}>
      <h3 className="mb-3 text-sm font-extrabold text-muted">{title}</h3>
      <div className="space-y-1 text-sm font-bold leading-6 text-ink">{children}</div>
    </article>
  );
}

function MovingAverageRow({
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
  const isSame = Math.abs(percent) < 0.005;
  const positive = percent > 0;
  const relationClass = isSame ? "text-muted" : positive ? "text-positive" : "text-negative";
  const relationText = isSame ? "— 0.00%" : `${positive ? "▲ +" : "▼ -"}${Math.abs(percent).toFixed(2)}%`;

  return (
    <div title={tooltip} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 rounded-md px-2 py-1.5 hover:bg-panel/50">
      <span className="font-extrabold text-muted">{label}</span>
      <span className="text-ink">{formatValue(value, currency)}</span>
      <span className={`font-extrabold ${relationClass}`}>{relationText}</span>
    </div>
  );
}

function getMacdStatusClass(status: NonNullable<StockIndicators["macd"]>["status"]) {
  if (status === "상승 신호") {
    return "text-positive";
  }

  if (status === "하락 신호") {
    return "text-negative";
  }

  return "text-muted";
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

function getRating(score: number) {
  if (score >= 95) return { stars: "★★★★★", label: "매우 긍정" };
  if (score >= 90) return { stars: "★★★★☆", label: "긍정" };
  if (score >= 80) return { stars: "★★★★", label: "긍정" };
  if (score >= 70) return { stars: "★★★☆", label: "다소 긍정" };
  if (score >= 60) return { stars: "★★★", label: "중립 우위" };
  if (score >= 50) return { stars: "★★☆", label: "중립" };
  if (score >= 40) return { stars: "★★", label: "주의" };
  return { stars: "★", label: "위험" };
}

function getRiskLevel({
  rsi,
  supportDistancePercent,
  resistanceDistancePercent,
  volatilityPercent,
  score,
}: {
  rsi: number;
  supportDistancePercent: number | null;
  resistanceDistancePercent: number | null;
  volatilityPercent: number;
  score: number;
}) {
  let riskScore = 0;

  if (rsi >= 75 || rsi <= 25) riskScore += 2;
  else if (rsi >= 70 || rsi <= 30) riskScore += 1;

  if (supportDistancePercent === null) riskScore += 1;
  else if (supportDistancePercent <= 3) riskScore += 2;
  else if (supportDistancePercent > 20) riskScore += 1;

  if (resistanceDistancePercent !== null && resistanceDistancePercent <= 3) riskScore += 1;
  if (volatilityPercent >= 18) riskScore += 2;
  else if (volatilityPercent >= 10) riskScore += 1;

  if (score < 40) riskScore += 2;
  else if (score < 60) riskScore += 1;

  if (riskScore >= 6) return { label: "매우 높음", icon: "🔴", className: "text-negative" };
  if (riskScore >= 4) return { label: "높음", icon: "🟠", className: "text-orange-300" };
  if (riskScore >= 2) return { label: "보통", icon: "🟡", className: "text-yellow-300" };
  return { label: "낮음", icon: "🟢", className: "text-positive" };
}

function chooseTemplate<T>(items: T[], seed: number) {
  return items[Math.abs(Math.round(seed)) % items.length];
}

function buildAiOpinion({
  indicators,
  currentPrice,
  currency,
}: {
  indicators: StockIndicators;
  currentPrice: number;
  currency: StockBasicInfo["currency"];
}) {
  const ma = indicators.movingAverages;
  const score = indicators.compositeSignal.score;
  const rating = getRating(score);
  const nearestSupport = indicators.supportResistance.supports[0] ?? null;
  const nearestResistance = indicators.supportResistance.resistances[0] ?? null;
  const supportDistancePercent = getDistancePercent(nearestSupport?.price ?? null, currentPrice);
  const resistanceDistancePercent = getDistancePercent(nearestResistance?.price ?? null, currentPrice);
  const week52Range = Math.max(indicators.week52High - indicators.week52Low, 0);
  const week52Position = week52Range > 0 ? (currentPrice - indicators.week52Low) / week52Range : 0.5;
  const bollingerWidthPercent =
    indicators.bollingerBands.middle > 0
      ? ((indicators.bollingerBands.upper - indicators.bollingerBands.lower) / indicators.bollingerBands.middle) * 100
      : 0;
  const risk = getRiskLevel({
    rsi: indicators.rsi,
    supportDistancePercent,
    resistanceDistancePercent,
    volatilityPercent: bollingerWidthPercent,
    score,
  });
  const aboveShort = ma.sma20 !== null && currentPrice > ma.sma20;
  const aboveLong = ma.sma200 !== null && currentPrice > ma.sma200;
  const aboveCoreTrend =
    ma.sma60 !== null &&
    ma.sma120 !== null &&
    ma.sma200 !== null &&
    currentPrice > ma.sma60 &&
    currentPrice > ma.sma120 &&
    currentPrice > ma.sma200;
  const belowAll =
    [ma.sma5, ma.sma20, ma.sma60, ma.sma120, ma.sma200].every((value) => value !== null && currentPrice < value);
  const nearHigh = week52Position >= 0.85;
  const nearLow = week52Position <= 0.15;
  const macdStatus = indicators.macd?.status ?? "중립";
  const seed = score + Math.round(indicators.rsi) + Math.round(currentPrice);
  const summary = chooseTemplate(
    [
      aboveCoreTrend && nearHigh
        ? "장기 흐름은 견조하지만 52주 고점권에 가까워 단기 추격매수는 신중한 구간입니다."
        : belowAll
          ? "주요 이동평균선 아래에 머물러 있어 반등 확인 전까지는 보수적인 접근이 필요합니다."
          : score >= 70
            ? "추세와 모멘텀이 대체로 양호해 긍정적인 흐름이 이어지는 구간입니다."
            : "방향성은 아직 뚜렷하지 않아 지지선 확인과 리스크 관리가 우선인 구간입니다.",
      macdStatus === "상승 신호" && indicators.rsi < 70
        ? "MACD 모멘텀은 살아 있고 RSI도 과열권은 아니어서 흐름은 비교적 안정적입니다."
        : macdStatus === "하락 신호"
          ? "MACD가 약세를 가리키고 있어 단기 반등보다 변동성 관리가 더 중요합니다."
          : "뚜렷한 과열 신호는 제한적이지만 확인해야 할 가격대가 남아 있습니다.",
      nearLow
        ? "52주 저점권에 가까워 가격 매력은 생겼지만 추세 회복 신호는 더 확인해야 합니다."
        : resistanceDistancePercent !== null && resistanceDistancePercent <= 3
          ? "가까운 저항선이 있어 상승 여력보다 돌파 여부 확인이 먼저인 구간입니다."
          : "현재 가격대는 주요 지표를 함께 확인하며 분할 접근을 고려할 만한 구간입니다.",
    ],
    seed,
  );

  return {
    rating,
    risk,
    summary,
    supportDistancePercent,
    resistanceDistancePercent,
    nearestSupport,
    nearestResistance,
    paragraphs: {
      trend: aboveCoreTrend
        ? "현재가는 60일, 120일, 200일선 위에서 거래되고 있어 중장기 추세는 긍정적으로 해석됩니다."
        : aboveShort && aboveLong
          ? "현재가는 20일선과 200일선 위에 있어 단기와 장기 흐름이 모두 나쁘지 않습니다."
          : belowAll
            ? "현재가는 주요 이동평균선 대부분을 밑돌고 있어 아직 추세 회복은 확인되지 않았습니다."
            : "이동평균선 기준으로는 상승과 조정 신호가 섞여 있어 중립적인 흐름에 가깝습니다.",
      rsi:
        indicators.rsi >= 70
          ? `RSI는 ${indicators.rsi.toFixed(0)}로 과열권에 가까워 단기 변동성 확대에 유의해야 합니다.`
          : indicators.rsi <= 30
            ? `RSI는 ${indicators.rsi.toFixed(0)}로 과매도권에 가까워 기술적 반등 가능성은 있지만 확인이 필요합니다.`
            : `RSI는 ${indicators.rsi.toFixed(0)}로 과열 구간은 아니며, 수급 부담은 비교적 제한적입니다.`,
      macd:
        macdStatus === "상승 신호"
          ? "MACD는 상승 신호를 유지하고 있어 추세 모멘텀이 아직 살아 있습니다."
          : macdStatus === "하락 신호"
            ? "MACD는 하락 신호를 보이고 있어 단기 모멘텀은 약해진 상태입니다."
            : "MACD는 중립에 가까워 강한 방향성보다는 확인 구간으로 보는 편이 좋습니다.",
      support:
        nearestSupport && supportDistancePercent !== null
          ? `가장 가까운 지지선은 ${formatValue(nearestSupport.price, currency)}이며 현재가와 약 ${formatPercent(supportDistancePercent)} 차이가 있습니다.`
          : "현재 가격 근처에서 신뢰도 높은 지지선은 뚜렷하지 않습니다.",
      resistance:
        nearestResistance && resistanceDistancePercent !== null
          ? `가장 가까운 저항선은 ${formatValue(nearestResistance.price, currency)}이며 현재가와 약 ${formatPercent(resistanceDistancePercent)} 차이가 있습니다.`
          : "의미 있는 저항선은 제한적이며, 신고가 돌파 구간일 가능성이 있습니다.",
      position: nearHigh
        ? "현재는 52주 고점 부근에서 거래되고 있으므로 단기 추격매수는 다소 신중할 필요가 있습니다."
        : nearLow
          ? "현재는 52주 저점권에 가까워 반등 여지는 있지만 추세 확인이 우선입니다."
          : "52주 범위 기준으로는 중간 구간에 있어 방향성 확인이 중요합니다.",
    },
  };
}

function AiOpinionCard({
  indicators,
  currentPrice,
  currency,
}: {
  indicators: StockIndicators;
  currentPrice: number;
  currency: StockBasicInfo["currency"];
}) {
  const opinion = buildAiOpinion({ indicators, currentPrice, currency });

  return (
    <Card title="🤖 AI 종합 의견" className="sm:col-span-2 xl:col-span-2">
      <div className="space-y-4">
        <p className="rounded-md border border-line/70 bg-panel/50 px-3 py-2 text-base font-black text-ink">
          {opinion.summary}
        </p>
        <div className="space-y-3 text-sm leading-7 text-ink">
          <p>
            <span className="font-black text-positive">{indicators.compositeSignal.longTermTrend}</span>{" "}
            관점에서 보면 {opinion.paragraphs.trend}
          </p>
          <p>
            {opinion.paragraphs.rsi}{" "}
            <span className={indicators.macd ? getMacdStatusClass(indicators.macd.status) : "text-muted"}>
              {opinion.paragraphs.macd}
            </span>
          </p>
          <p>
            {opinion.paragraphs.support} {opinion.paragraphs.resistance}
          </p>
          <p>{opinion.paragraphs.position}</p>
        </div>
        <div className="rounded-lg border border-line/70 bg-panel/60 p-3">
          <p className="text-xs font-extrabold text-muted">AI 종합 판단</p>
          <p className="mt-1 text-2xl font-black tracking-normal text-positive">{opinion.rating.stars}</p>
          <p className="text-sm font-extrabold text-muted">({opinion.rating.label})</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-extrabold text-muted">
            <span className={opinion.risk.className}>
              리스크 {opinion.risk.icon} {opinion.risk.label}
            </span>
            <span>종합 점수 {indicators.compositeSignal.score}점</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function AnalysisCards({
  indicators,
  currency,
  currentPrice,
}: {
  indicators: StockIndicators;
  currency: StockBasicInfo["currency"];
  currentPrice: number;
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
            <p>중심: {formatValue(indicators.bollingerBands.middle, currency)}</p>
            <p>하단: {formatValue(indicators.bollingerBands.lower, currency)}</p>
          </Card>
          <Card title="이동평균선">
            <div className="space-y-1">
              <MovingAverageRow label="5일" tooltip="단기 추세" value={ma.sma5} currentPrice={currentPrice} currency={currency} />
              <MovingAverageRow label="20일" tooltip="한 달 추세" value={ma.sma20} currentPrice={currentPrice} currency={currency} />
              <MovingAverageRow label="60일" tooltip="분기 추세" value={ma.sma60} currentPrice={currentPrice} currency={currency} />
              <MovingAverageRow label="120일" tooltip="중기 추세" value={ma.sma120} currentPrice={currentPrice} currency={currency} />
              <MovingAverageRow label="200일" tooltip="장기 추세" value={ma.sma200} currentPrice={currentPrice} currency={currency} />
            </div>
          </Card>
          <Card title="RSI / MACD">
            <div>
              <p className="text-xs font-extrabold text-muted">RSI</p>
              <p>
                [{indicators.rsiStatus}] {indicators.rsi.toFixed(2)}
              </p>
            </div>
            <div className="pt-3">
              <p className="text-xs font-extrabold text-muted">MACD</p>
              {indicators.macd ? (
                <>
                  <p className={`font-extrabold ${getMacdStatusClass(indicators.macd.status)}`}>
                    {indicators.macd.status}
                  </p>
                  <p>MACD: {indicators.macd.macd.toFixed(2)}</p>
                  <p>Signal: {indicators.macd.signal.toFixed(2)}</p>
                  <p>Hist: {indicators.macd.histogram.toFixed(2)}</p>
                </>
              ) : (
                <p>MACD: 데이터 없음</p>
              )}
            </div>
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
          <AiOpinionCard indicators={indicators} currentPrice={currentPrice} currency={currency} />
        </div>
      )}
    </section>
  );
}
