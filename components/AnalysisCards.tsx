import type { RecentPricePoint, StockBasicInfo, StockIndicators, SupportResistanceLevel } from "@/lib/market/types";
import {
  formatPercent as formatDisplayPercent,
  formatPrice as formatDisplayPrice,
  getPercentColorClass,
} from "@/lib/formatters";

function formatValue(value: number | null, currency: StockBasicInfo["currency"]) {
  return formatDisplayPrice(value, currency);
}

function formatPercent(value: number) {
  return formatDisplayPercent(value);
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

  return (
    <div title={tooltip} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 rounded-md px-2 py-1.5 hover:bg-panel/50">
      <span className="font-extrabold text-muted">{label}</span>
      <span className="text-ink">{formatValue(value, currency)}</span>
      <span className={`font-extrabold ${getPercentColorClass(percent)}`}>{formatDisplayPercent(percent)}</span>
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

function getRating(score: number, hasCaution: boolean) {
  if (score >= 95) return { stars: "★★★★★", label: hasCaution ? "긍정 / 과열 주의" : "긍정 우위" };
  if (score >= 90) return { stars: "★★★★☆", label: hasCaution ? "긍정 / 주의" : "긍정" };
  if (score >= 80) return { stars: "★★★★", label: hasCaution ? "다소 긍정 / 주의" : "긍정" };
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
  forceAtLeastModerate,
}: {
  rsi: number;
  supportDistancePercent: number | null;
  resistanceDistancePercent: number | null;
  volatilityPercent: number;
  score: number;
  forceAtLeastModerate: boolean;
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
  if (forceAtLeastModerate) riskScore = Math.max(riskScore, 2);

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
  recentPrices,
}: {
  indicators: StockIndicators;
  currentPrice: number;
  currency: StockBasicInfo["currency"];
  recentPrices: RecentPricePoint[];
}) {
  const ma = indicators.movingAverages;
  const score = indicators.compositeSignal.score;
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
  const noResistance = nearestResistance === null;
  const chronologicalRecent = [...recentPrices].reverse();
  const firstRecentClose = chronologicalRecent[0]?.close ?? currentPrice;
  const lastRecentClose = chronologicalRecent.at(-1)?.close ?? currentPrice;
  const recentTenReturn = firstRecentClose > 0 ? ((lastRecentClose - firstRecentClose) / firstRecentClose) * 100 : 0;
  const rsiCaution = indicators.rsi >= 70;
  const highCaution = nearHigh;
  const noResistanceCaution = noResistance && nearHigh;
  const shortRunCaution = recentTenReturn >= 12 || currentPrice > indicators.bollingerBands.upper;
  const hasCaution = rsiCaution || highCaution || noResistanceCaution || shortRunCaution;
  const rating = getRating(score, hasCaution);
  const risk = getRiskLevel({
    rsi: indicators.rsi,
    supportDistancePercent,
    resistanceDistancePercent,
    volatilityPercent: bollingerWidthPercent,
    score,
    forceAtLeastModerate: score >= 90 && (rsiCaution || highCaution || noResistance),
  });
  const seed = score + Math.round(indicators.rsi) + Math.round(currentPrice);
  const cautionText =
    (highCaution && "52주 고점권에 가까워 높은 점수와 별개로 단기 추격매수는 신중할 필요가 있습니다.") ||
    (noResistanceCaution && "의미 있는 저항선이 없어 상승 여력은 열려 있지만 변동성 확대 가능성도 함께 봐야 합니다.") ||
    (shortRunCaution && "최근 단기 상승폭이 커진 구간이라 신규 진입은 분할 접근이 더 적합합니다.") ||
    (rsiCaution && "RSI가 과열권에 가까워 단기 숨 고르기 가능성을 염두에 둘 필요가 있습니다.") ||
    null;
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
    sentences: [
      aboveCoreTrend
        ? "현재가는 60일, 120일, 200일선 위에 있어 중장기 흐름은 우호적입니다."
        : aboveShort && aboveLong
          ? "현재가는 20일선과 200일선 위에 있어 흐름은 아직 무너지지 않았습니다."
          : belowAll
            ? "현재가는 주요 이동평균선 아래에 있어 반등 확인 전까지 보수적인 접근이 필요합니다."
            : "이동평균선 기준으로는 상승과 조정 신호가 섞인 중립 구간입니다.",
      macdStatus === "상승 신호" && indicators.rsi < 70
        ? `RSI는 ${indicators.rsi.toFixed(0)}로 과열권은 아니며, MACD도 상승 신호를 유지하고 있습니다.`
        : macdStatus === "하락 신호"
          ? `RSI는 ${indicators.rsi.toFixed(0)}이고 MACD는 하락 신호라 단기 모멘텀은 약합니다.`
          : `RSI는 ${indicators.rsi.toFixed(0)}이며 MACD는 중립에 가까워 방향성 확인이 필요합니다.`,
      nearestSupport && supportDistancePercent !== null
        ? `가장 가까운 지지선은 ${formatValue(nearestSupport.price, currency)}로 현재가와 약 ${formatPercent(supportDistancePercent)} 차이입니다.`
        : "가까운 지지선이 뚜렷하지 않아 손절 기준을 보수적으로 잡을 필요가 있습니다.",
      cautionText ??
        (nearestResistance && resistanceDistancePercent !== null
          ? `가장 가까운 저항선은 현재가와 약 ${formatPercent(resistanceDistancePercent)} 떨어져 있습니다.`
          : nearLow
            ? "52주 저점권에 가까워 반등 여지는 있지만 추세 회복 확인이 우선입니다."
            : "현재는 지표 확인과 분할 접근이 더 적합한 구간입니다."),
    ],
  };
}

function AiOpinionCard({
  indicators,
  currentPrice,
  currency,
  recentPrices,
}: {
  indicators: StockIndicators;
  currentPrice: number;
  currency: StockBasicInfo["currency"];
  recentPrices: RecentPricePoint[];
}) {
  const opinion = buildAiOpinion({ indicators, currentPrice, currency, recentPrices });

  return (
    <Card title="🤖 AI 종합 의견" className="sm:col-span-2 xl:col-span-2">
      <div className="space-y-4">
        <p className="rounded-md border border-line/70 bg-panel/50 px-3 py-2 text-base font-black text-ink">
          {opinion.summary}
        </p>
        <div className="space-y-3 text-sm leading-7 text-ink">
          {opinion.sentences.map((sentence) => (
            <p key={sentence}>{sentence}</p>
          ))}
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
  recentPrices,
}: {
  indicators: StockIndicators;
  currency: StockBasicInfo["currency"];
  currentPrice: number;
  recentPrices: RecentPricePoint[];
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
                  <p>MACD: {formatValue(indicators.macd.macd, currency)}</p>
                  <p>Signal: {formatValue(indicators.macd.signal, currency)}</p>
                  <p>Hist: {formatValue(indicators.macd.histogram, currency)}</p>
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
          <AiOpinionCard indicators={indicators} currentPrice={currentPrice} currency={currency} recentPrices={recentPrices} />
        </div>
      )}
    </section>
  );
}
