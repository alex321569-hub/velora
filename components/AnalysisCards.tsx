import type { ReactNode } from "react";
import {
  formatPercent as formatDisplayPercent,
  formatPrice as formatDisplayPrice,
  getPercentColorClass,
} from "@/lib/formatters";
import type { RecentPricePoint, StockBasicInfo, StockIndicators, SupportResistanceLevel } from "@/lib/market/types";

type BreakdownItem = {
  label: string;
  points: number;
  reason: string;
  group: "score" | "confidence";
};

type RiskTone = {
  label: "낮음" | "보통" | "높음" | "매우 높음";
  icon: string;
  className: string;
};

function formatValue(value: number | null | undefined, currency: StockBasicInfo["currency"]) {
  return formatDisplayPrice(value, currency);
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function getDistancePercent(price: number | null | undefined, currentPrice: number) {
  if (price == null || currentPrice <= 0) return null;
  return (Math.abs(currentPrice - price) / currentPrice) * 100;
}

function Card({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article className={`min-h-40 rounded-lg bg-surface p-4 ${className}`}>
      {title && <h3 className="mb-3 text-sm font-extrabold text-muted">{title}</h3>}
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
  if (status === "상승 신호") return "text-positive";
  if (status === "하락 신호") return "text-negative";
  return "text-muted";
}

function LevelList({
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
            {index + 1}단계: {formatValue(level.price, currency)}
          </p>
          <p className="text-xs font-extrabold text-muted">신뢰도 {level.confidence}점</p>
          <p className="text-xs font-bold text-muted">{level.reason}</p>
        </div>
      ))}
    </div>
  );
}

function getAiRating(score: number) {
  if (score >= 95) return { stars: "★★★★★", label: "매우 우호적이지만 검증 필요" };
  if (score >= 90) return { stars: "★★★★☆", label: "긍정 / 과열 점검" };
  if (score >= 80) return { stars: "★★★★", label: "긍정" };
  if (score >= 70) return { stars: "★★★☆", label: "양호" };
  if (score >= 60) return { stars: "★★★", label: "중립 우위" };
  if (score >= 50) return { stars: "★★☆", label: "중립" };
  if (score >= 40) return { stars: "★★", label: "주의" };
  return { stars: "★", label: "위험" };
}

function getConfidenceGrade(confidence: number) {
  if (confidence >= 95) return { stars: "★★★★★", label: "매우 높음" };
  if (confidence >= 90) return { stars: "★★★★☆", label: "높음" };
  if (confidence >= 80) return { stars: "★★★★", label: "양호" };
  if (confidence >= 70) return { stars: "★★★☆", label: "보통" };
  if (confidence >= 60) return { stars: "★★★", label: "낮음" };
  return { stars: "★★", label: "매우 낮음" };
}

function getRisk({
  score,
  rsi,
  supportDistance,
  resistanceDistance,
  nearHigh,
  recentReturn,
  volatility,
}: {
  score: number;
  rsi: number;
  supportDistance: number | null;
  resistanceDistance: number | null;
  nearHigh: boolean;
  recentReturn: number;
  volatility: number;
}): RiskTone {
  let risk = 0;
  if (score < 50) risk += 2;
  else if (score < 70) risk += 1;
  if (rsi >= 75 || rsi <= 25) risk += 2;
  else if (rsi >= 70 || rsi <= 30) risk += 1;
  if (supportDistance === null || supportDistance <= 3 || supportDistance >= 20) risk += 1;
  if (resistanceDistance !== null && resistanceDistance <= 3) risk += 1;
  if (nearHigh || recentReturn >= 12) risk += 1;
  if (volatility >= 6) risk += 1;

  if (risk >= 5) return { icon: "🔴", label: "매우 높음", className: "text-negative" };
  if (risk >= 3) return { icon: "🟠", label: "높음", className: "text-orange-300" };
  if (risk >= 1) return { icon: "🟡", label: "보통", className: "text-yellow-300" };
  return { icon: "🟢", label: "낮음", className: "text-positive" };
}

function chooseTemplate(items: string[], seed: number) {
  return items[Math.abs(Math.round(seed)) % items.length];
}

function buildAiTemplates({
  trendLabel,
  shortLabel,
  macdLabel,
  resistanceText,
  supportText,
}: {
  trendLabel: string;
  shortLabel: string;
  macdLabel: string;
  resistanceText: string;
  supportText: string;
}) {
  return [
    `장기 추세는 ${trendLabel}이고 단기 흐름은 ${shortLabel}입니다. ${supportText}을 확인하면서 ${resistanceText} 대응이 필요합니다.`,
    `${trendLabel} 흐름은 유지되지만 단기 변동성은 남아 있습니다. ${macdLabel}와 지지선 위치를 함께 확인하세요.`,
    `중장기 구조는 ${trendLabel} 쪽에 가깝습니다. 다만 ${resistanceText} 구간에서는 추격보다 눌림 확인이 유리합니다.`,
    `현재 구간은 ${shortLabel} 성격이 강합니다. ${supportText} 이탈 여부가 단기 판단의 핵심입니다.`,
    `${macdLabel}가 유지되는 동안 추세 훼손은 제한적입니다. ${resistanceText} 부근에서는 속도 조절이 필요합니다.`,
    `가격은 주요 평균선과 지지선 사이에서 방향을 탐색 중입니다. ${supportText} 반응을 우선 확인하세요.`,
    `추세 점수는 양호하지만 매수 가격의 안전마진은 별도 확인이 필요합니다. ${resistanceText} 여부가 관건입니다.`,
    `단기 모멘텀은 살아 있으나 과열 신호가 섞이면 리스크가 커집니다. ${supportText} 기준을 정해 접근하세요.`,
    `${trendLabel} 추세가 우세합니다. 단기적으로는 ${shortLabel} 흐름을 소화하는지가 중요합니다.`,
    `지표 조합은 한쪽으로 치우치지 않습니다. ${macdLabel}와 RSI가 같은 방향으로 정렬되는지 확인하세요.`,
    `상승 여력보다 방어 기준이 중요한 구간입니다. ${supportText}과 거래량 변화를 함께 보세요.`,
    `저항이 가까운 구간에서는 좋은 종목도 매수 타이밍이 까다롭습니다. ${resistanceText}을 먼저 확인하세요.`,
    `중기 평균선 위 흐름은 긍정적입니다. 다만 단기 급등 이후에는 변동성 확대 가능성이 있습니다.`,
    `장기 추세가 흔들리지 않는다면 조정은 관찰 구간입니다. ${supportText}을 기준으로 리스크를 관리하세요.`,
    `가격 발견 구간에서는 저항선이 부족해 판단 신뢰도가 낮아질 수 있습니다. 거래량 확인이 필요합니다.`,
    `기술적 흐름은 나쁘지 않지만 고점 근접 시 기대수익 대비 리스크가 빠르게 커집니다.`,
    `단기 흐름은 안정적이나 명확한 돌파 신호는 더 필요합니다. ${resistanceText} 반응을 보세요.`,
    `하락 신호가 겹치면 반등보다 방어가 우선입니다. ${supportText} 이탈 시 보수적 대응이 좋습니다.`,
    `RSI가 안정 구간이면 과열 부담은 제한적입니다. ${macdLabel} 지속 여부가 다음 판단 기준입니다.`,
    `모멘텀은 살아 있으나 지지선이 너무 멀면 손익비가 약해질 수 있습니다. 진입 가격을 낮춰 보세요.`,
    `장기 평균선 위에서는 구조적 흐름이 비교적 견조합니다. 단기 저항과 과열 여부는 별도 점검하세요.`,
    `현재는 추세보다 위치가 더 중요합니다. 고점 부근이면 분할 접근이 더 합리적입니다.`,
    `지지선과 평균선이 겹치는 가격대가 있으면 신뢰도는 높아집니다. 해당 구간의 반응을 확인하세요.`,
    `저항선 부재는 강세 신호일 수 있지만 가격 발견 구간의 변동성도 함께 의미합니다.`,
    `최근 수익률이 과도하면 점수가 높아도 위험도는 낮게 보지 않습니다. 쉬어가는 흐름을 확인하세요.`,
    `기술 지표는 긍정과 경계가 공존합니다. ${supportText}과 ${resistanceText} 사이에서 대응하세요.`,
    `평균선 정렬이 우호적이면 추세 지속 가능성은 높습니다. 단기 과열은 별도로 관리해야 합니다.`,
    `MACD가 약하면 반등의 신뢰도는 낮아집니다. RSI 회복과 거래량 동반을 확인하세요.`,
    `거래량이 뒷받침되면 현재 흐름의 신뢰도는 높아집니다. 거래량 없는 돌파는 보수적으로 보세요.`,
    `지표가 충돌하는 구간에서는 결론을 크게 잡기보다 핵심 가격대 반응을 확인하는 편이 낫습니다.`,
    `현재 점수는 참고값입니다. 고점 근접, 저항 부재, 단기 급등 중 하나라도 있으면 리스크를 보통 이상으로 봅니다.`,
    `추세는 확인되지만 매매 판단은 가격대가 좌우합니다. ${supportText}과 ${resistanceText}을 기준으로 보세요.`,
  ];
}

function getVolatility(prices: RecentPricePoint[]) {
  const returns = prices
    .slice()
    .reverse()
    .map((price, index, list) => {
      const previous = list[index - 1]?.close;
      return previous ? ((price.close - previous) / previous) * 100 : null;
    })
    .filter((value): value is number => value !== null);

  if (returns.length === 0) return 0;
  const average = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - average) ** 2, 0) / returns.length;
  return Math.sqrt(variance);
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
  const support = indicators.supportResistance.supports[0] ?? null;
  const resistance = indicators.supportResistance.resistances[0] ?? null;
  const supportDistance = getDistancePercent(support?.price, currentPrice);
  const resistanceDistance = getDistancePercent(resistance?.price, currentPrice);
  const range = indicators.week52High - indicators.week52Low;
  const week52Position = range > 0 ? (currentPrice - indicators.week52Low) / range : 0.5;
  const nearHigh = indicators.week52High > 0 && Math.abs(currentPrice - indicators.week52High) / indicators.week52High <= 0.02;
  const priceDiscovery = !resistance && week52Position >= 0.85;
  const chronological = [...recentPrices].reverse();
  const recentReturn = chronological[0]?.close
    ? (((chronological.at(-1)?.close ?? currentPrice) - chronological[0].close) / chronological[0].close) * 100
    : 0;
  const avgVolume = chronological.length ? chronological.reduce((sum, price) => sum + (price.volume ?? 0), 0) / chronological.length : 0;
  const volumeRising = (chronological.at(-1)?.volume ?? 0) > avgVolume && avgVolume > 0;
  const volatility = getVolatility(recentPrices);
  const scoreItems: BreakdownItem[] = [];
  let score = 50;

  function add(label: string, points: number, reason: string) {
    scoreItems.push({ label, points, reason, group: "score" });
    score += points;
  }

  if (ma.sma5 !== null && currentPrice < ma.sma5) add("5일선", -8, "단기 평균선 하회");
  if (ma.sma20 !== null) currentPrice > ma.sma20 ? add("20일선", 4, "단기 추세 상회") : add("20일선", -10, "단기 추세 하회");
  if (ma.sma60 !== null) currentPrice > ma.sma60 ? add("60일선", 6, "분기 추세 상회") : add("60일선", -10, "분기 추세 하회");
  if (ma.sma120 !== null) currentPrice > ma.sma120 ? add("120일선", 8, "중기 추세 상회") : add("120일선", -12, "중기 추세 하회");
  if (ma.sma200 !== null) currentPrice > ma.sma200 ? add("200일선", 10, "장기 추세 상회") : add("200일선", -15, "장기 추세 하회");

  if (indicators.rsi >= 80) add("RSI", -12, "강한 과열 구간");
  else if (indicators.rsi >= 75) add("RSI", -8, "과열 주의");
  else if (indicators.rsi >= 45 && indicators.rsi <= 65) add("RSI", 5, "중립 우위 구간");

  if (indicators.macd?.status === "상승 신호") add("MACD", 6, "상승 신호 유지");
  if (indicators.macd?.status === "하락 신호") add("MACD", -8, "하락 신호");

  if (supportDistance === null) add("지지선", -5, "의미 있는 지지선 부족");
  else if (supportDistance >= 3 && supportDistance <= 10) add("지지선", 5, "현재가와 적정 거리");
  else if (supportDistance >= 20) add("지지선", -5, "지지선이 너무 멂");

  if (resistanceDistance !== null && resistanceDistance <= 3) add("저항선", -5, "저항선 근접");
  if (nearHigh) add("52주 고점", -3, "52주 고점 2% 이내");
  if (volumeRising) add("거래량", 3, "최근 거래량 증가");

  const aiScore = Math.round(clamp(score));
  const rating = getAiRating(aiScore);
  const risk = getRisk({ score: aiScore, rsi: indicators.rsi, supportDistance, resistanceDistance, nearHigh, recentReturn, volatility });
  const confidenceItems: BreakdownItem[] = [];
  let confidence = 80;

  function addConfidence(label: string, points: number, reason: string) {
    confidenceItems.push({ label, points, reason, group: "confidence" });
    confidence += points;
  }

  const hasEnoughData = recentPrices.length >= 10;
  const hasSupportOverlap =
    support !== null &&
    [ma.sma20, ma.sma60, ma.sma120, ma.sma200].some((value) => value !== null && Math.abs(value - support.price) / currentPrice <= 0.02);
  const rsiMacdAligned =
    (indicators.rsi >= 50 && indicators.macd?.status === "상승 신호") ||
    (indicators.rsi < 50 && indicators.macd?.status === "하락 신호");
  const indicatorConflict =
    (indicators.rsi >= 65 && indicators.macd?.status === "하락 신호") ||
    (indicators.rsi <= 40 && indicators.macd?.status === "상승 신호") ||
    (currentPrice > (ma.sma200 ?? Number.POSITIVE_INFINITY) && indicators.macd?.status === "하락 신호");
  const volumeProfileExists = indicators.supportResistance.supports
    .concat(indicators.supportResistance.resistances)
    .some((level) => level.reason.includes("거래량"));

  hasEnoughData ? addConfidence("최근 데이터", 5, "최근 시세 확보") : addConfidence("최근 데이터", -10, "90일 미만 데이터 가능성");
  ma.sma200 !== null ? addConfidence("200일선", 3, "장기 추세 계산 가능") : addConfidence("200일선", -8, "장기 추세 데이터 부족");
  if (hasSupportOverlap) addConfidence("지지/평균선", 5, "지지선과 이동평균선 중첩");
  if (rsiMacdAligned) addConfidence("RSI/MACD", 4, "모멘텀 방향 일치");
  if (volumeProfileExists) addConfidence("매물대", 3, "거래량 기반 가격대 포함");
  if (volumeRising) addConfidence("거래량", 2, "최근 거래량 충분");
  if (indicators.macd === null) addConfidence("MACD", -6, "MACD 계산 불가");
  if (!Number.isFinite(indicators.rsi)) addConfidence("RSI", -5, "RSI 계산 불가");
  if (!support) addConfidence("지지선", -8, "지지 정보 부족");
  if (!resistance) addConfidence("저항선", priceDiscovery ? -6 : -5, priceDiscovery ? "가격 발견 구간" : "저항 정보 부족");
  if (indicatorConflict) addConfidence("지표 충돌", -8, "기술지표 방향 불일치");
  if (volatility >= 6) addConfidence("변동성", -5, "최근 변동성 높음");

  const confidenceScore = Math.round(clamp(confidence));
  const confidenceGrade = getConfidenceGrade(confidenceScore);
  const aboveLongMas = [ma.sma60, ma.sma120, ma.sma200].filter((value): value is number => value !== null).every((value) => currentPrice > value);
  const belowAllMas = [ma.sma5, ma.sma20, ma.sma60, ma.sma120, ma.sma200].filter((value): value is number => value !== null).every((value) => currentPrice < value);
  const trendLabel = belowAllMas ? "하락" : aboveLongMas ? "상승" : "중립";
  const shortLabel = currentPrice < (ma.sma5 ?? 0) || recentReturn < -3 ? "조정 중" : recentReturn > 8 ? "단기 급등" : "안정";
  const rsiLabel = indicators.rsi >= 70 ? `${indicators.rsi.toFixed(1)} (과열)` : indicators.rsi <= 30 ? `${indicators.rsi.toFixed(1)} (과매도)` : `${indicators.rsi.toFixed(1)} (과열 아님)`;
  const macdLabel = indicators.macd?.status ?? "데이터 없음";
  const supportText = support ? `지지선 ${formatValue(support.price, currency)}` : "지지선 데이터 부족";
  const resistanceText = resistance ? `저항선 ${formatValue(resistance.price, currency)}` : "의미 있는 저항선 없음";
  const seed = aiScore + confidenceScore + Math.round(indicators.rsi) + Math.round(recentReturn);
  const aiComment = chooseTemplate(buildAiTemplates({ trendLabel, shortLabel, macdLabel, resistanceText, supportText }), seed);
  const caution =
    nearHigh || priceDiscovery || recentReturn >= 12
      ? "52주 고점 근접, 저항선 부재, 단기 상승폭 확대 중 하나가 확인되어 추격 매수는 신중해야 합니다."
      : null;

  return {
    aiScore,
    rating,
    risk,
    confidenceScore,
    confidenceGrade,
    aiComment,
    caution,
    trendLabel,
    shortLabel,
    rsiLabel,
    macdLabel,
    support,
    resistance,
    supportDistance,
    resistanceDistance,
    scoreItems,
    confidenceItems,
  };
}

function MetricTile({
  label,
  value,
  sub,
  tone = "text-ink",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-md border border-line/70 bg-panel/50 px-3 py-2">
      <p className="text-[11px] font-extrabold text-muted">{label}</p>
      <p className={`mt-0.5 text-sm font-black ${tone}`}>{value}</p>
      {sub && <p className="text-[11px] font-bold text-muted">{sub}</p>}
    </div>
  );
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
  const confidenceWarning =
    opinion.confidenceScore < 60
      ? "데이터가 부족하거나 기술지표의 일치도가 낮아 분석 신뢰도가 낮습니다."
      : opinion.confidenceScore < 80
        ? "현재 분석은 참고용으로 사용하시기 바랍니다."
        : null;

  return (
    <Card title="" className="sm:col-span-2 xl:col-span-2">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3 border-b border-line pb-2">
          <div>
            <h3 className="text-sm font-black text-ink">🤖 AI 종합 의견</h3>
            <p className="text-xs font-bold text-muted">규칙 기반 기술지표 대시보드</p>
          </div>
          <div
            title="AI 분석 신뢰도는 현재 정보의 신선도, 데이터의 충분성, 기술지표의 일치도를 기반으로 계산합니다."
            className="rounded-full border border-positive/30 bg-positive/10 px-3 py-1 text-xs font-black text-positive"
          >
            신뢰도 {opinion.confidenceScore}%
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <MetricTile label="장기 추세" value={opinion.trendLabel} tone={opinion.trendLabel === "상승" ? "text-positive" : opinion.trendLabel === "하락" ? "text-negative" : "text-muted"} />
          <MetricTile label="단기 추세" value={opinion.shortLabel} tone={opinion.shortLabel === "단기 급등" ? "text-yellow-300" : opinion.shortLabel === "조정 중" ? "text-negative" : "text-positive"} />
          <MetricTile label="RSI" value={opinion.rsiLabel} tone={indicators.rsi >= 70 ? "text-yellow-300" : indicators.rsi <= 30 ? "text-negative" : "text-positive"} />
          <MetricTile label="MACD" value={opinion.macdLabel} tone={indicators.macd ? getMacdStatusClass(indicators.macd.status) : "text-muted"} />
          <MetricTile
            label="지지선"
            value={opinion.support ? formatValue(opinion.support.price, currency) : "데이터 없음"}
            sub={opinion.supportDistance !== null ? `현재가 대비 ${formatDisplayPercent(-opinion.supportDistance)}` : undefined}
          />
          <MetricTile
            label="저항선"
            value={opinion.resistance ? formatValue(opinion.resistance.price, currency) : "의미 있는 저항선 없음"}
            sub={opinion.resistanceDistance !== null ? `현재가 대비 ${formatDisplayPercent(opinion.resistanceDistance)}` : "52주 신고가 구간 가능"}
          />
        </div>

        <div className="rounded-md border border-line/70 bg-panel/60 px-3 py-2">
          <p className="text-[11px] font-extrabold text-muted">AI 최종 의견</p>
          <p className="mt-1 text-sm font-black leading-6 text-ink">
            {opinion.aiComment}
            {opinion.caution && <span className="text-yellow-300"> {opinion.caution}</span>}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="text-2xl font-black tracking-normal text-positive">{opinion.rating.stars}</p>
            <p className="text-sm font-extrabold text-muted">{opinion.rating.label}</p>
          </div>
          <div className="text-left text-xs font-extrabold text-muted sm:text-right">
            <p className={opinion.risk.className}>리스크 {opinion.risk.icon} {opinion.risk.label}</p>
            <p>AI 종합 점수 {opinion.aiScore}점</p>
            <p>신뢰도 {opinion.confidenceGrade.stars} {opinion.confidenceGrade.label}</p>
          </div>
        </div>

        {confidenceWarning && <p className="rounded-md bg-panel/60 px-3 py-2 text-xs font-bold text-yellow-300">{confidenceWarning}</p>}

        <details className="rounded-md border border-line/70 bg-panel/40">
          <summary className="cursor-pointer px-3 py-2 text-xs font-black text-muted hover:text-ink">🧾 분석 근거 보기</summary>
          <div className="space-y-3 border-t border-line/70 p-3 text-xs font-bold">
            <div>
              <p className="mb-2 font-black text-ink">점수 근거</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {opinion.scoreItems.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="grid grid-cols-[5rem_3rem_1fr] gap-2 rounded bg-surface px-2 py-1.5">
                    <span className="text-muted">{item.label}</span>
                    <span className={item.points >= 0 ? "text-positive" : "text-negative"}>
                      {item.points >= 0 ? `+${item.points}` : item.points}
                    </span>
                    <span className="text-muted">{item.reason}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 font-black text-ink">신뢰도 근거</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {opinion.confidenceItems.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="grid grid-cols-[5rem_3rem_1fr] gap-2 rounded bg-surface px-2 py-1.5">
                    <span className="text-muted">{item.label}</span>
                    <span className={item.points >= 0 ? "text-positive" : "text-negative"}>
                      {item.points >= 0 ? `+${item.points}` : item.points}
                    </span>
                    <span className="text-muted">{item.reason}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="rounded bg-surface px-2 py-1.5 text-right font-black text-ink">
              최종 점수 {opinion.aiScore}점 / 신뢰도 {opinion.confidenceScore}%
            </p>
          </div>
        </details>
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
  if (indicators.calculationError) {
    return (
      <section className="mt-6">
        <h2 className="mb-4 text-lg font-extrabold">종목 분석</h2>
        <div className="rounded-lg bg-surface p-4 text-sm font-extrabold text-negative">데이터 오류로 지표 계산 불가</div>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <h2 className="mb-4 text-lg font-extrabold">종목 분석</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="52주 최고/최저">
          <p>최저: {formatValue(indicators.week52Low, currency)}</p>
          <p>최고: {formatValue(indicators.week52High, currency)}</p>
        </Card>

        <Card title="볼린저밴드">
          <p>상단: {formatValue(indicators.bollingerBands.upper, currency)}</p>
          <p>중심: {formatValue(indicators.bollingerBands.middle, currency)}</p>
          <p>하단: {formatValue(indicators.bollingerBands.lower, currency)}</p>
        </Card>

        <Card title="이동평균선" className="sm:col-span-2 xl:col-span-2">
          <div className="space-y-1">
            <MovingAverageRow label="5일" tooltip="단기 추세" value={indicators.movingAverages.sma5} currentPrice={currentPrice} currency={currency} />
            <MovingAverageRow label="20일" tooltip="한 달 추세" value={indicators.movingAverages.sma20} currentPrice={currentPrice} currency={currency} />
            <MovingAverageRow label="60일" tooltip="분기 추세" value={indicators.movingAverages.sma60} currentPrice={currentPrice} currency={currency} />
            <MovingAverageRow label="120일" tooltip="중기 추세" value={indicators.movingAverages.sma120} currentPrice={currentPrice} currency={currency} />
            <MovingAverageRow label="200일" tooltip="장기 추세" value={indicators.movingAverages.sma200} currentPrice={currentPrice} currency={currency} />
          </div>
        </Card>

        <Card title="RSI / MACD">
          <div>
            <p className="text-xs font-extrabold text-muted">RSI</p>
            <p>
              [{indicators.rsiStatus}] {indicators.rsi.toFixed(2)}
            </p>
          </div>
          <div className="mt-3 border-t border-line pt-3">
            <p className="text-xs font-extrabold text-muted">MACD</p>
            {indicators.macd ? (
              <div className="space-y-1">
                <p className={getMacdStatusClass(indicators.macd.status)}>{indicators.macd.status}</p>
                <p>MACD: {formatValue(indicators.macd.macd, currency)}</p>
                <p>Signal: {formatValue(indicators.macd.signal, currency)}</p>
                <p>Hist: {formatValue(indicators.macd.histogram, currency)}</p>
              </div>
            ) : (
              <p>MACD: 데이터 없음</p>
            )}
          </div>
        </Card>

        <Card title="지지선">
          <LevelList levels={indicators.supportResistance.supports} currency={currency} />
        </Card>

        <Card title="저항선">
          {indicators.supportResistance.resistances.length > 0 ? (
            <LevelList levels={indicators.supportResistance.resistances} currency={currency} />
          ) : (
            <p>{indicators.supportResistance.resistanceMessage ?? "데이터 없음"}</p>
          )}
        </Card>

        <AiOpinionCard indicators={indicators} currentPrice={currentPrice} currency={currency} recentPrices={recentPrices} />
      </div>
    </section>
  );
}
