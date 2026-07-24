"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildCheckpoints,
  getMacdStatusClass,
  getProgressColor,
  groupBreakdownItems,
} from "@/lib/analysis/aiAnalysis";
import type { AiOpinion, LocalScoreHistoryItem } from "@/lib/analysis/types";
import { formatPercent, formatPrice, getPercentColorClass } from "@/lib/formatters";
import type { RecentPricePoint, StockBasicInfo, StockIndicators } from "@/lib/market/types";
import MobileDisclosure from "../MobileDisclosure";
import AiCheckpointsCard from "./AiCheckpointsCard";
import AiHistoryCard from "./AiHistoryCard";
import Card from "./Card";
import StateTile from "./StateTile";

const MAX_LOCAL_SCORE_HISTORY = 10;
const LOCAL_SCORE_HISTORY_WINDOW_MS = 5 * 60 * 1000;

function getLocalHistoryKey(symbol: string) {
  return `velora-local-score-history-${symbol.trim().toUpperCase()}`;
}

function readLocalHistory(symbol: string): LocalScoreHistoryItem[] {
  try {
    const stored = window.localStorage.getItem(getLocalHistoryKey(symbol));
    const parsed = stored ? (JSON.parse(stored) as LocalScoreHistoryItem[]) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_LOCAL_SCORE_HISTORY) : [];
  } catch (error) {
    console.warn("[local-score-history] read failed", error);
    return [];
  }
}

function shouldReplaceLatest(next: LocalScoreHistoryItem, latest: LocalScoreHistoryItem | undefined) {
  if (!latest) return false;

  const nextTime = new Date(next.analyzedAt).getTime();
  const latestTime = new Date(latest.analyzedAt).getTime();
  const closeInTime = Number.isFinite(nextTime) && Number.isFinite(latestTime) && nextTime - latestTime < LOCAL_SCORE_HISTORY_WINDOW_MS;
  const sameScores =
    next.compositeScore === latest.compositeScore &&
    next.chartHealthScore === latest.chartHealthScore &&
    next.confidence === latest.confidence;

  return closeInTime || sameScores;
}

export default function AiOpinionCard({
  symbol,
  indicators,
  currentPrice,
  currency,
  opinion,
}: {
  symbol: string;
  indicators: StockIndicators;
  currentPrice: number;
  currency: StockBasicInfo["currency"];
  recentPrices: RecentPricePoint[];
  opinion: AiOpinion;
}) {
  const [localHistory, setLocalHistory] = useState<LocalScoreHistoryItem[]>([]);
  const confidenceWarning =
    opinion.confidenceScore < 60
      ? "데이터가 부족하거나 기술지표의 일치도가 낮아 분석 신뢰도가 낮습니다."
      : opinion.confidenceScore < 80
        ? "현재 분석은 참고용으로 사용하시기 바랍니다."
        : null;
  const scoreItemsKey = useMemo(
    () => opinion.scoreItems.map((item) => `${item.label}:${item.points}:${item.reason}`).join("|"),
    [opinion.scoreItems],
  );
  const checkpoints = useMemo(() => buildCheckpoints(opinion, indicators, currency), [opinion, indicators, currency]);

  useEffect(() => {
    const entry: LocalScoreHistoryItem = {
      symbol,
      market: symbol.includes(".KS") || symbol.includes(".KQ") || /^\d{6}$/.test(symbol) ? "KR" : /^[A-Z]/i.test(symbol) ? "US" : "UNKNOWN",
      analyzedAt: new Date().toISOString(),
      price: Number.isFinite(currentPrice) ? currentPrice : null,
      compositeScore: Number.isFinite(opinion.aiScore) ? opinion.aiScore : null,
      chartHealthScore: indicators.chartHealth?.score ?? null,
      confidence: Number.isFinite(opinion.confidenceScore) ? opinion.confidenceScore : null,
      summary: opinion.aiComment,
      risk: opinion.risk.label,
      trend: opinion.trendLabel,
      macd: opinion.macdLabel,
      rsi: Number.isFinite(indicators.rsi) ? indicators.rsi : undefined,
      reasons: opinion.scoreItems
        .slice()
        .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
        .slice(0, 8)
        .map((item) => ({ label: item.label, points: item.points, reason: item.reason })),
    };

    try {
      const currentHistory = readLocalHistory(symbol);
      const nextHistory = shouldReplaceLatest(entry, currentHistory[0])
        ? [entry, ...currentHistory.slice(1)]
        : [entry, ...currentHistory];
      const trimmedHistory = nextHistory.slice(0, MAX_LOCAL_SCORE_HISTORY);
      window.localStorage.setItem(getLocalHistoryKey(symbol), JSON.stringify(trimmedHistory));
      setLocalHistory(trimmedHistory);
    } catch (error) {
      console.warn("[local-score-history] write failed", error);
      setLocalHistory([entry]);
    }
  }, [
    symbol,
    currentPrice,
    indicators.chartHealth?.score,
    indicators.rsi,
    opinion.aiScore,
    opinion.aiComment,
    opinion.confidenceScore,
    opinion.macdLabel,
    opinion.risk.label,
    opinion.trendLabel,
    scoreItemsKey,
  ]);

  return (
    <>
      <MobileDisclosure
        title="AI 종합 의견"
        className="rounded-lg bg-surface p-3"
        contentClassName="mt-3"
        desktopClassName="contents"
      >
      <Card title="" className="md:col-span-2 xl:col-span-4">
        <div className="space-y-6">
          <div className="flex flex-col items-start gap-3 border-b border-line pb-4 md:flex-row md:justify-between md:gap-4">
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

          <div className="grid gap-3 min-[420px]:grid-cols-2 md:gap-4 xl:grid-cols-3">
            <StateTile icon="📈" label="장기 추세" value={opinion.trendLabel} tone={opinion.trendLabel === "상승" ? "text-positive" : opinion.trendLabel === "하락" ? "text-negative" : "text-muted"} />
            <StateTile icon="📉" label="단기 추세" value={opinion.shortLabel} tone={opinion.shortLabel === "조정 중" ? "text-yellow-300" : opinion.shortLabel === "단기 급등" ? "text-orange-300" : "text-positive"} />
            <StateTile icon="📊" label="RSI" value={indicators.rsi.toFixed(1)} sub={opinion.rsiLabel} tone={indicators.rsi >= 70 ? "text-yellow-300" : indicators.rsi <= 30 ? "text-negative" : "text-positive"} />
            <StateTile icon="📈" label="MACD" value={opinion.macdLabel} tone={getMacdStatusClass(opinion.macdLabel)} />
            <StateTile
              icon="RS"
              label="상대강도"
              value={opinion.relativeStrengthLabel}
              sub={
                indicators.relativeStrength?.grade === "UNKNOWN"
                  ? "벤치마크 데이터 부족"
                  : `${indicators.relativeStrength?.score ?? 0}점`
              }
              tone={
                indicators.relativeStrength?.grade === "VERY_STRONG" ||
                indicators.relativeStrength?.grade === "STRONG"
                  ? "text-positive"
                  : indicators.relativeStrength?.grade === "WEAK" ||
                      indicators.relativeStrength?.grade === "VERY_WEAK"
                    ? "text-negative"
                    : "text-muted"
              }
            />
            <StateTile
              icon="CH"
              label="차트 건전도"
              value={opinion.chartHealth ? `${opinion.chartHealth.score}점` : "데이터 없음"}
              sub={opinion.chartHealth?.label}
              tone={
                !opinion.chartHealth
                  ? "text-muted"
                  : opinion.chartHealth.score >= 70
                    ? "text-positive"
                    : opinion.chartHealth.score >= 55
                      ? "text-yellow-300"
                      : opinion.chartHealth.score >= 40
                        ? "text-orange-300"
                        : "text-negative"
              }
            />
            <StateTile
              icon="🛡"
              label="지지선"
              value={opinion.support ? formatPrice(opinion.support.price, currency) : "데이터 없음"}
              sub={opinion.supportDistance !== null ? `(${formatPercent(-opinion.supportDistance)})` : undefined}
              tone="text-sky-300"
            />
            <StateTile
              icon="🚀"
              label="저항선"
              value={opinion.resistance ? formatPrice(opinion.resistance.price, currency) : "저항선 없음"}
              sub={opinion.resistanceDistance !== null ? `(${formatPercent(opinion.resistanceDistance)})` : "52주 신고가 구간 가능"}
              tone="text-orange-300"
            />
            <StateTile
              icon="EP"
              label="진입 매력도"
              value={`${opinion.entryAttractivenessScore}점`}
              sub={
                opinion.entryAttractivenessScore >= 75
                  ? "부담 낮음"
                  : opinion.entryAttractivenessScore >= 55
                    ? "보통"
                    : "진입 부담"
              }
              tone={
                opinion.entryAttractivenessScore >= 75
                  ? "text-positive"
                  : opinion.entryAttractivenessScore >= 55
                    ? "text-yellow-300"
                    : "text-orange-300"
              }
            />
          </div>

          {indicators.relativeStrength && (
            <div className="rounded-2xl border border-line/70 bg-panel/50 p-4 md:p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm font-black text-ink">상대강도 비교 기준</p>
                  <p className="mt-1 text-xs font-bold leading-5 text-muted">
                    시장: {indicators.relativeStrength.benchmarks.marketLabel}
                    {indicators.relativeStrength.benchmarks.marketSymbol
                      ? ` (${indicators.relativeStrength.benchmarks.marketSymbol})`
                      : ""}
                    <span className="mx-2 text-line">·</span>
                    섹터:{" "}
                    {indicators.relativeStrength.benchmarks.sectorLabel
                      ? `${indicators.relativeStrength.benchmarks.sectorLabel} (${indicators.relativeStrength.benchmarks.sectorSymbol})`
                      : "비교 가능한 섹터 지수 없음"}
                  </p>
                </div>
                <p className="text-xs font-bold text-muted">
                  양수는 비교 기준보다 강한 흐름을 의미합니다.
                </p>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 md:gap-3">
                {([
                  {
                    label: "5일",
                    market: indicators.relativeStrength.metrics.relativeToMarket5d,
                    sector: indicators.relativeStrength.metrics.relativeToSector5d,
                  },
                  {
                    label: "20일",
                    market: indicators.relativeStrength.metrics.relativeToMarket20d,
                    sector: indicators.relativeStrength.metrics.relativeToSector20d,
                  },
                  {
                    label: "60일",
                    market: indicators.relativeStrength.metrics.relativeToMarket60d,
                    sector: indicators.relativeStrength.metrics.relativeToSector60d,
                  },
                ] as const).map((period) => (
                  <div
                    key={period.label}
                    className="min-w-0 rounded-xl border border-line/60 bg-surface px-2.5 py-3 md:px-4"
                  >
                    <p className="text-xs font-black text-muted">{period.label}</p>
                    <p className={`mt-2 break-words text-xs font-black md:text-sm ${getPercentColorClass(period.market)}`}>
                      시장 {formatPercent(period.market)}
                    </p>
                    <p className={`mt-1 break-words text-xs font-black md:text-sm ${getPercentColorClass(period.sector)}`}>
                      섹터 {formatPercent(period.sector)}
                    </p>
                  </div>
                ))}
              </div>

              {indicators.relativeStrength.warnings.length > 0 && (
                <p className="mt-3 text-xs font-bold leading-5 text-yellow-300">
                  {indicators.relativeStrength.warnings[0]}
                </p>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-line/70 bg-panel/70 p-4 md:p-5">
            <p className="text-sm font-black text-muted">💬 AI 한줄 의견</p>
            <p className="mt-3 text-base font-black leading-7 text-ink md:text-lg md:leading-8">
              &quot;{opinion.aiComment}&quot;
              {opinion.caution && <span className="block text-yellow-300">{opinion.caution}</span>}
            </p>
          </div>

          <div className="grid gap-4 border-t border-line pt-5 md:grid-cols-3">
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
            <summary className="cursor-pointer px-4 py-4 text-sm font-black text-muted hover:text-ink md:px-5">🧾 분석 근거 보기</summary>
            <div className="space-y-4 border-t border-line/70 p-3 text-sm font-bold md:space-y-5 md:p-5">
              {groupBreakdownItems(opinion.scoreItems).map((group) => (
                <div key={group.key} className="rounded-xl border border-line/70 bg-surface p-3 md:p-4">
                  <p className="mb-3 font-black text-ink">{group.title}</p>
                  <div className="grid gap-2">
                    {group.items.map((item, index) => (
                      <div key={`${item.label}-${index}`} className="grid gap-1 rounded-lg bg-panel/60 px-3 py-2 md:grid-cols-[6rem_3rem_1fr] md:gap-3">
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

              <div className="rounded-xl border border-line/70 bg-surface p-3 md:p-4">
                <p className="mb-3 font-black text-ink">🤖 AI 신뢰도</p>
                <div className="grid gap-2">
                  {opinion.confidenceItems.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="grid gap-1 rounded-lg bg-panel/60 px-3 py-2 md:grid-cols-[6rem_3rem_1fr] md:gap-3">
                      <span className="text-muted">{item.label}</span>
                      <span className={item.points >= 0 ? "text-positive" : "text-negative"}>
                        {item.points >= 0 ? `+${item.points}` : item.points}
                      </span>
                      <span className="text-muted">{item.reason}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-line/70 bg-surface p-3 md:p-4">
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
      </MobileDisclosure>

      <AiCheckpointsCard checkpoints={checkpoints} />
      <AiHistoryCard history={localHistory} currency={currency} />
    </>
  );
}
