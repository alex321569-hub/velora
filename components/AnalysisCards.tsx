"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
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
  category: "long" | "short" | "momentum" | "levels" | "volume" | "confidence";
};

type HistoryEntry = {
  date: string;
  score: number;
  stars: string;
  risk: string;
  rsi: number;
  macd: string;
  trend: string;
  reasons: { label: string; points: number; reason: string }[];
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
  if (score >= 95) return { stars: "★★★★★", label: "긍정 / 과열 점검" };
  if (score >= 90) return { stars: "★★★★☆", label: "긍정 / 주의" };
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

function getRisk(score: number, rsi: number, supportDistance: number | null, resistanceDistance: number | null, nearHigh: boolean, recentReturn: number) {
  let risk = 0;
  if (score < 50) risk += 2;
  else if (score < 70) risk += 1;
  if (rsi >= 75 || rsi <= 25) risk += 2;
  else if (rsi >= 70 || rsi <= 30) risk += 1;
  if (supportDistance === null || supportDistance <= 3 || supportDistance >= 20) risk += 1;
  if (resistanceDistance !== null && resistanceDistance <= 3) risk += 1;
  if (nearHigh || recentReturn >= 12) risk += 1;

  if (risk >= 5) return { icon: "🔴", label: "매우 높음", className: "text-negative" };
  if (risk >= 3) return { icon: "🟠", label: "높음", className: "text-orange-300" };
  if (risk >= 1) return { icon: "🟡", label: "보통", className: "text-yellow-300" };
  return { icon: "🟢", label: "낮음", className: "text-positive" };
}

function chooseTemplate(items: string[], seed: number) {
  return items[Math.abs(Math.round(seed)) % items.length];
}

function buildAiTemplates(trendLabel: string, shortLabel: string, macdLabel: string) {
  return [
    `단기 흐름은 ${shortLabel}입니다. 장기 추세는 ${trendLabel}이며 MACD는 ${macdLabel}입니다.`,
    `상태는 ${trendLabel}, 단기 흐름은 ${shortLabel}입니다. 핵심은 지지선 유지 여부입니다.`,
    `현재는 ${shortLabel} 구간입니다. 장기 구조가 ${trendLabel}인지 먼저 확인해야 합니다.`,
    `${macdLabel}가 이어지고 있습니다. 단기 가격대보다 추세 유지 여부가 중요합니다.`,
    `추세는 ${trendLabel} 쪽에 가깝습니다. 단기 변동성은 ${shortLabel}으로 분류됩니다.`,
    `방향성은 ${trendLabel}입니다. 과열 신호가 있으면 추격보다 확인이 우선입니다.`,
    `단기 판단은 ${shortLabel}입니다. 지지선 이탈 여부가 리스크를 좌우합니다.`,
    `MACD는 ${macdLabel}입니다. RSI와 평균선 정렬을 함께 봐야 합니다.`,
    `장기 흐름은 ${trendLabel}입니다. 저항선 근접 시 속도 조절이 필요합니다.`,
    `현재 구간은 ${shortLabel}입니다. 거래량이 동반되어야 신뢰도가 높아집니다.`,
    `추세는 살아 있지만 단기 가격 부담은 확인해야 합니다. 핵심은 다음 저항선입니다.`,
    `평균선 구조는 ${trendLabel}입니다. MACD 변화가 다음 방향을 결정할 수 있습니다.`,
    `지표는 ${trendLabel} 흐름을 가리킵니다. 단기 조정은 지지선 반응을 봐야 합니다.`,
    `RSI가 안정권이면 과열 부담은 제한적입니다. MACD는 ${macdLabel}입니다.`,
    `저항선이 가까우면 점수가 높아도 신중해야 합니다. 단기 흐름은 ${shortLabel}입니다.`,
    `지지선이 멀면 손익비가 약해질 수 있습니다. 추세 판단은 ${trendLabel}입니다.`,
    `현재는 가격 위치가 중요합니다. 고점 부근에서는 분할 접근이 유리합니다.`,
    `거래량 증가가 확인되면 현재 흐름의 신뢰도가 올라갑니다. 추세는 ${trendLabel}입니다.`,
    `하락 신호가 겹치면 방어가 우선입니다. MACD는 ${macdLabel}입니다.`,
    `중립 구간에서는 예측보다 가격대 반응이 중요합니다. 단기 흐름은 ${shortLabel}입니다.`,
    `장기 평균선 위라면 구조는 견조합니다. 단기 과열은 별도 관리가 필요합니다.`,
    `가격 발견 구간에서는 저항선이 부족해 변동성이 커질 수 있습니다.`,
    `단기 상승폭이 크면 점수가 높아도 리스크를 낮게 보지 않습니다.`,
    `MACD와 RSI 방향이 맞으면 신뢰도는 개선됩니다. 현재 MACD는 ${macdLabel}입니다.`,
    `현재는 추세보다 매수 가격이 더 중요합니다. 단기 흐름은 ${shortLabel}입니다.`,
    `지지선과 평균선이 겹치면 방어 신뢰도가 높아집니다.`,
    `저항선 부재는 강세 신호일 수 있지만 가격 발견 리스크도 있습니다.`,
    `추세는 확인되지만 진입은 지지/저항 사이에서 판단해야 합니다.`,
    `지표가 충돌하면 결론을 크게 잡기보다 다음 캔들을 확인하는 편이 낫습니다.`,
    `점수는 참고값입니다. 고점, 저항, 급등 조건은 항상 별도 점검해야 합니다.`,
  ];
}

function getProgressColor(score: number) {
  if (score >= 80) return "bg-positive";
  if (score >= 60) return "bg-yellow-400";
  if (score >= 40) return "bg-orange-400";
  return "bg-negative";
}

function getTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getDisplayDate(date: string) {
  return date.slice(5).replace("-", "-");
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
  const scoreItems: BreakdownItem[] = [];
  let score = 50;

  function add(label: string, points: number, reason: string, category: BreakdownItem["category"]) {
    scoreItems.push({ label, points, reason, category });
    score += points;
  }

  if (ma.sma5 !== null && currentPrice < ma.sma5) add("5일선", -8, "단기 평균선 하회", "short");
  if (ma.sma20 !== null) currentPrice > ma.sma20 ? add("20일선", 4, "단기 추세 상회", "short") : add("20일선", -10, "단기 추세 하회", "short");
  if (ma.sma60 !== null) currentPrice > ma.sma60 ? add("60일선", 6, "분기 추세 상회", "long") : add("60일선", -10, "분기 추세 하회", "long");
  if (ma.sma120 !== null) currentPrice > ma.sma120 ? add("120일선", 8, "중기 상승 추세 유지", "long") : add("120일선", -12, "중기 추세 하회", "long");
  if (ma.sma200 !== null) currentPrice > ma.sma200 ? add("200일선", 10, "장기 상승 추세 유지", "long") : add("200일선", -15, "장기 추세 하회", "long");

  if (indicators.rsi >= 80) add("RSI", -12, "강한 과열 구간", "momentum");
  else if (indicators.rsi >= 75) add("RSI", -8, "과열 주의", "momentum");
  else if (indicators.rsi >= 45 && indicators.rsi <= 65) add("RSI", 5, "적정 구간", "momentum");

  if (indicators.macd?.status === "상승 신호") add("MACD", 6, "Signal 위", "momentum");
  if (indicators.macd?.status === "하락 신호") add("MACD", -8, "Signal 아래", "momentum");

  if (supportDistance === null) add("지지선", -5, "의미 있는 지지선 부족", "levels");
  else if (supportDistance >= 3 && supportDistance <= 10) add("지지선", 5, "현재가와 적정 거리", "levels");
  else if (supportDistance >= 20) add("지지선", -5, "지지선이 너무 멂", "levels");

  if (resistanceDistance !== null && resistanceDistance <= 3) add("저항선", -5, "저항선 근접", "levels");
  if (nearHigh) add("52주 고점", -3, "52주 고점 2% 이내", "levels");
  if (volumeRising) add("최근 거래량", 3, "평균 거래량 증가", "volume");

  const aiScore = Math.round(clamp(score));
  const rating = getAiRating(aiScore);
  const risk = getRisk(aiScore, indicators.rsi, supportDistance, resistanceDistance, nearHigh, recentReturn);
  const confidenceItems: BreakdownItem[] = [];
  let confidence = 80;

  function addConfidence(label: string, points: number, reason: string) {
    confidenceItems.push({ label, points, reason, category: "confidence" });
    confidence += points;
  }

  const hasEnoughData = recentPrices.length >= 10;
  const hasSupportOverlap =
    support !== null &&
    [ma.sma20, ma.sma60, ma.sma120, ma.sma200].some((value) => value !== null && Math.abs(value - support.price) / currentPrice <= 0.02);
  const rsiMacdAligned =
    (indicators.rsi >= 50 && indicators.macd?.status === "상승 신호") ||
    (indicators.rsi < 50 && indicators.macd?.status === "하락 신호");
  const volumeProfileExists = indicators.supportResistance.supports
    .concat(indicators.supportResistance.resistances)
    .some((level) => level.reason.includes("거래량"));

  hasEnoughData ? addConfidence("데이터 품질", 5, "최근 시세 확보") : addConfidence("데이터 품질", -10, "최근 데이터 부족");
  ma.sma200 !== null ? addConfidence("장기 데이터", 3, "200일선 계산 가능") : addConfidence("장기 데이터", -8, "200일선 부족");
  if (hasSupportOverlap) addConfidence("지지/평균선", 5, "지지선과 평균선 중첩");
  if (rsiMacdAligned) addConfidence("지표 일치", 4, "RSI와 MACD 방향 일치");
  if (volumeProfileExists) addConfidence("매물대", 3, "거래량 기반 가격대 포함");
  if (volumeRising) addConfidence("거래량", 2, "최근 거래량 충분");
  if (indicators.macd === null) addConfidence("MACD", -6, "MACD 계산 불가");
  if (!support) addConfidence("지지선", -8, "지지 정보 부족");
  if (!resistance) addConfidence("저항선", priceDiscovery ? -6 : -5, priceDiscovery ? "가격 발견 구간" : "저항 정보 부족");

  const confidenceScore = Math.round(clamp(confidence));
  const confidenceGrade = getConfidenceGrade(confidenceScore);
  const aboveLongMas = [ma.sma60, ma.sma120, ma.sma200].filter((value): value is number => value !== null).every((value) => currentPrice > value);
  const belowAllMas = [ma.sma5, ma.sma20, ma.sma60, ma.sma120, ma.sma200].filter((value): value is number => value !== null).every((value) => currentPrice < value);
  const trendLabel = belowAllMas ? "하락" : aboveLongMas ? "상승" : "중립";
  const shortLabel = currentPrice < (ma.sma5 ?? 0) || recentReturn < -3 ? "조정 중" : recentReturn > 8 ? "단기 급등" : "안정";
  const rsiLabel = indicators.rsi >= 70 ? "과열" : indicators.rsi <= 30 ? "과매도" : "과열 아님";
  const macdLabel = indicators.macd?.status ?? "데이터 없음";
  const seed = aiScore + confidenceScore + Math.round(indicators.rsi) + Math.round(recentReturn);
  const aiComment = chooseTemplate(buildAiTemplates(trendLabel, shortLabel, macdLabel), seed);
  const caution =
    nearHigh || priceDiscovery || recentReturn >= 12
      ? "고점 근접 또는 저항선 부재 구간입니다. 추격 매수는 신중해야 합니다."
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
    volumeRising,
  };
}

function StateTile({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-line/70 bg-panel/60 p-4 transition hover:border-line">
      <div className="flex items-center gap-2 text-xs font-black text-muted">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <p className={`mt-3 text-lg font-black ${tone}`}>{value}</p>
      {sub && <p className="mt-1 text-xs font-bold text-muted">{sub}</p>}
    </div>
  );
}

function groupItems(items: BreakdownItem[]) {
  return [
    { key: "long", title: "📈 장기 추세", items: items.filter((item) => item.category === "long") },
    { key: "short", title: "📉 단기 추세", items: items.filter((item) => item.category === "short") },
    { key: "momentum", title: "📊 모멘텀", items: items.filter((item) => item.category === "momentum") },
    { key: "levels", title: "🛡 지지/저항", items: items.filter((item) => item.category === "levels") },
    { key: "volume", title: "📈 거래량", items: items.filter((item) => item.category === "volume") },
  ].filter((group) => group.items.length > 0);
}

function buildCheckpoints(
  opinion: ReturnType<typeof buildAiOpinion>,
  indicators: StockIndicators,
  currency: StockBasicInfo["currency"],
) {
  const checkpoints: string[] = [];
  if (indicators.movingAverages.sma5 !== null) checkpoints.push("5일선 회복 여부");
  if (!opinion.volumeRising) checkpoints.push("거래량 증가 여부");
  if (opinion.resistance) checkpoints.push(`${formatValue(opinion.resistance.price, currency)} 돌파 여부`);
  if (indicators.rsi < 50) checkpoints.push("RSI 50 회복 여부");
  if (opinion.support) checkpoints.push(`${formatValue(opinion.support.price, currency)} 지지 여부`);
  if (indicators.macd?.status === "하락 신호") checkpoints.push("MACD 하락 신호 완화 여부");
  checkpoints.push("다음 실적 발표 확인");
  return checkpoints.slice(0, 5);
}

function AiCheckpointsCard({
  checkpoints,
}: {
  checkpoints: string[];
}) {
  return (
    <Card title="🎯 AI 체크포인트" className="sm:col-span-2 xl:col-span-2">
      <div className="grid gap-3 sm:grid-cols-2">
        {checkpoints.map((checkpoint) => (
          <div key={checkpoint} className="flex items-center gap-3 rounded-xl border border-line/70 bg-panel/60 px-4 py-3">
            <span className="text-positive">✓</span>
            <span>{checkpoint}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AiHistoryCard({
  history,
  selectedDate,
  onSelectDate,
}: {
  history: HistoryEntry[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}) {
  const latest = history[0];
  const previous = history[1];
  const selected = history.find((entry) => entry.date === selectedDate) ?? latest;
  const scoreDelta = latest && previous ? latest.score - previous.score : 0;
  const deltaText = scoreDelta > 0 ? `▲ +${scoreDelta}` : scoreDelta < 0 ? `▼ ${scoreDelta}` : "→ 0";
  const deltaClass = scoreDelta > 0 ? "text-positive" : scoreDelta < 0 ? "text-negative" : "text-muted";

  return (
    <Card title="📜 AI 분석 이력" className="sm:col-span-2 xl:col-span-2">
      {history.length === 0 ? (
        <p className="text-muted">분석 이력을 저장하는 중입니다.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {history.slice(0, 30).map((entry, index) => {
              const prev = history[index + 1];
              const diff = prev ? entry.score - prev.score : 0;
              const diffText = diff > 0 ? `▲ +${diff}` : diff < 0 ? `▼ ${diff}` : "→ 0";
              return (
                <button
                  key={entry.date}
                  type="button"
                  onClick={() => onSelectDate(entry.date)}
                  className={`min-w-28 rounded-xl border px-3 py-2 text-left transition ${
                    selected?.date === entry.date ? "border-positive bg-positive/10" : "border-line bg-panel/60 hover:border-muted"
                  }`}
                >
                  <p className="text-xs font-black text-muted">{getDisplayDate(entry.date)}</p>
                  <p className="text-lg font-black text-ink">{entry.score}점</p>
                  <p className="text-xs font-bold text-muted">{entry.stars}</p>
                  <p className={`text-xs font-black ${diff > 0 ? "text-positive" : diff < 0 ? "text-negative" : "text-muted"}`}>{diffText}</p>
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-line/70 bg-panel/60 p-4">
            <p className="text-xs font-black text-muted">최근 변화</p>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <p>장기 추세: {previous ? `${previous.trend} → ${latest.trend}` : "데이터 축적 중"}</p>
              <p>MACD: {previous ? `${previous.macd} → ${latest.macd}` : "데이터 축적 중"}</p>
              <p>RSI: {previous ? `${previous.rsi.toFixed(0)} → ${latest.rsi.toFixed(0)}` : "데이터 축적 중"}</p>
              <p>
                점수: {previous ? `${previous.score} → ${latest.score}` : latest.score}
                <span className={`ml-2 ${deltaClass}`}>{deltaText}</span>
              </p>
              <p>리스크: {previous ? `${previous.risk} → ${latest.risk}` : latest.risk}</p>
            </div>
          </div>

          {selected && (
            <div className="rounded-xl border border-line/70 bg-panel/60 p-4">
              <p className="text-xs font-black text-muted">{getDisplayDate(selected.date)} 점수 변화 원인</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {selected.reasons.slice(0, 6).map((reason, index) => (
                  <div key={`${reason.label}-${index}`} className="grid grid-cols-[4rem_3rem_1fr] gap-2 rounded-lg bg-surface px-3 py-2">
                    <span className="text-muted">{reason.label}</span>
                    <span className={reason.points >= 0 ? "text-positive" : "text-negative"}>
                      {reason.points >= 0 ? `+${reason.points}` : reason.points}
                    </span>
                    <span className="text-muted">{reason.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function AiOpinionCard({
  symbol,
  indicators,
  currentPrice,
  currency,
  recentPrices,
  opinion,
}: {
  symbol: string;
  indicators: StockIndicators;
  currentPrice: number;
  currency: StockBasicInfo["currency"];
  recentPrices: RecentPricePoint[];
  opinion: ReturnType<typeof buildAiOpinion>;
}) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const confidenceWarning =
    opinion.confidenceScore < 60
      ? "데이터가 부족하거나 기술지표의 일치도가 낮아 분석 신뢰도가 낮습니다."
      : opinion.confidenceScore < 80
        ? "현재 분석은 참고용으로 사용하시기 바랍니다."
        : null;

  useEffect(() => {
    const key = `velora-ai-history-${symbol}`;
    const today = getTodayKey();
    const entry: HistoryEntry = {
      date: today,
      score: opinion.aiScore,
      stars: opinion.rating.stars,
      risk: opinion.risk.label,
      rsi: indicators.rsi,
      macd: opinion.macdLabel,
      trend: opinion.trendLabel,
      reasons: opinion.scoreItems
        .slice()
        .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
        .map((item) => ({ label: item.label, points: item.points, reason: item.reason })),
    };

    try {
      const stored = window.localStorage.getItem(key);
      const parsed = stored ? (JSON.parse(stored) as HistoryEntry[]) : [];
      const next = [entry, ...parsed.filter((item) => item.date !== today)].slice(0, 30);
      window.localStorage.setItem(key, JSON.stringify(next));
      setHistory(next);
      setSelectedDate((current) => current ?? today);
    } catch {
      setHistory([entry]);
      setSelectedDate(today);
    }
  }, [symbol, opinion.aiScore, opinion.rating.stars, opinion.risk.label, opinion.macdLabel, opinion.trendLabel, opinion.scoreItems, indicators.rsi]);

  const checkpointCard = useMemo(() => buildCheckpoints(opinion, indicators, currency), [opinion, indicators, currency]);

  return (
    <>
      <Card title="" className="sm:col-span-2 xl:col-span-4">
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
            <div>
              <h3 className="text-xl font-black text-ink">🤖 AI 종합 의견</h3>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-muted">Velora Core Analysis</p>
            </div>
            <div
              title="AI 분석 신뢰도는 현재 정보의 신선도, 데이터의 충분성, 기술지표의 일치도를 기반으로 계산합니다."
              className="animate-ai-fade rounded-full border border-positive/30 bg-positive/10 px-4 py-2 text-sm font-black text-positive"
              key={opinion.confidenceScore}
            >
              신뢰도 {opinion.confidenceScore}%
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StateTile icon="📈" label="장기 추세" value={opinion.trendLabel} tone={opinion.trendLabel === "상승" ? "text-positive" : opinion.trendLabel === "하락" ? "text-negative" : "text-muted"} />
            <StateTile icon="📉" label="단기 추세" value={opinion.shortLabel} tone={opinion.shortLabel === "조정 중" ? "text-yellow-300" : opinion.shortLabel === "단기 급등" ? "text-orange-300" : "text-positive"} />
            <StateTile icon="📊" label="RSI" value={indicators.rsi.toFixed(1)} sub={opinion.rsiLabel} tone={indicators.rsi >= 70 ? "text-yellow-300" : indicators.rsi <= 30 ? "text-negative" : "text-positive"} />
            <StateTile icon="📈" label="MACD" value={opinion.macdLabel} tone={indicators.macd ? getMacdStatusClass(indicators.macd.status) : "text-muted"} />
            <StateTile
              icon="🛡"
              label="지지선"
              value={opinion.support ? formatValue(opinion.support.price, currency) : "데이터 없음"}
              sub={opinion.supportDistance !== null ? `(${formatDisplayPercent(-opinion.supportDistance)})` : undefined}
              tone="text-sky-300"
            />
            <StateTile
              icon="🚀"
              label="저항선"
              value={opinion.resistance ? formatValue(opinion.resistance.price, currency) : "저항선 없음"}
              sub={opinion.resistanceDistance !== null ? `(${formatDisplayPercent(opinion.resistanceDistance)})` : "52주 신고가 구간 가능"}
              tone="text-orange-300"
            />
          </div>

          <div className="rounded-2xl border border-line/70 bg-panel/70 p-5">
            <p className="text-sm font-black text-muted">💬 AI 한줄 의견</p>
            <p className="mt-3 text-lg font-black leading-8 text-ink">
              &quot;{opinion.aiComment}&quot;
              {opinion.caution && <span className="block text-yellow-300">{opinion.caution}</span>}
            </p>
          </div>

          <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
            <div>
              <p className="text-3xl font-black tracking-normal text-positive">{opinion.rating.stars}</p>
              <p className="mt-1 text-base font-black text-ink">{opinion.rating.label}</p>
            </div>
            <div>
              <p className="text-xs font-black text-muted">리스크</p>
              <p className={`mt-2 text-lg font-black ${opinion.risk.className}`}>
                {opinion.risk.icon} {opinion.risk.label}
              </p>
            </div>
            <div>
              <p className="text-xs font-black text-muted">종합 점수</p>
              <p key={opinion.aiScore} className="animate-ai-fade mt-2 text-2xl font-black text-ink">
                {opinion.aiScore}점
              </p>
            </div>
          </div>

          {confidenceWarning && <p className="rounded-xl bg-panel/70 px-4 py-3 text-sm font-bold text-yellow-300">{confidenceWarning}</p>}

          <details className="rounded-2xl border border-line/70 bg-panel/40">
            <summary className="cursor-pointer px-5 py-4 text-sm font-black text-muted hover:text-ink">🧾 분석 근거 보기</summary>
            <div className="space-y-5 border-t border-line/70 p-5 text-sm font-bold">
              {groupItems(opinion.scoreItems).map((group) => (
                <div key={group.key} className="rounded-xl border border-line/70 bg-surface p-4">
                  <p className="mb-3 font-black text-ink">{group.title}</p>
                  <div className="grid gap-2">
                    {group.items.map((item, index) => (
                      <div key={`${item.label}-${index}`} className="grid grid-cols-[6rem_3rem_1fr] gap-3 rounded-lg bg-panel/60 px-3 py-2">
                        <span className="text-muted">{item.label}</span>
                        <span className={item.points >= 0 ? "text-positive" : "text-negative"}>
                          {item.points >= 0 ? `+${item.points}` : item.points}
                        </span>
                        <span className="text-muted">{item.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="rounded-xl border border-line/70 bg-surface p-4">
                <p className="mb-3 font-black text-ink">🤖 AI 신뢰도</p>
                <div className="grid gap-2">
                  {opinion.confidenceItems.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="grid grid-cols-[6rem_3rem_1fr] gap-3 rounded-lg bg-panel/60 px-3 py-2">
                      <span className="text-muted">{item.label}</span>
                      <span className={item.points >= 0 ? "text-positive" : "text-negative"}>
                        {item.points >= 0 ? `+${item.points}` : item.points}
                      </span>
                      <span className="text-muted">{item.reason}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-line/70 bg-surface p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-black text-ink">AI 종합 점수</p>
                  <p className="font-black text-ink">{opinion.aiScore}점</p>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-panel">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ease-out ${getProgressColor(opinion.aiScore)}`}
                    style={{ width: `${opinion.aiScore}%` }}
                  />
                </div>
              </div>
            </div>
          </details>
        </div>
      </Card>

      <AiCheckpointsCard checkpoints={checkpointCard} />
      <AiHistoryCard history={history} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
    </>
  );
}

export default function AnalysisCards({
  symbol,
  indicators,
  currency,
  currentPrice,
  recentPrices,
}: {
  symbol: string;
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

  const opinion = buildAiOpinion({ indicators, currentPrice, currency, recentPrices });

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

        <AiOpinionCard
          symbol={symbol}
          indicators={indicators}
          currentPrice={currentPrice}
          currency={currency}
          recentPrices={recentPrices}
          opinion={opinion}
        />
      </div>
    </section>
  );
}
