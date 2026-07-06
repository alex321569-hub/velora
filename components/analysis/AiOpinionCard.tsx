"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildCheckpoints,
  getMacdStatusClass,
  getProgressColor,
  getTodayKey,
  groupBreakdownItems,
} from "@/lib/analysis/aiAnalysis";
import type { AiOpinion, HistoryEntry } from "@/lib/analysis/types";
import { formatPercent, formatPrice } from "@/lib/formatters";
import type { RecentPricePoint, StockBasicInfo, StockIndicators } from "@/lib/market/types";
import MobileDisclosure from "../MobileDisclosure";
import AiCheckpointsCard from "./AiCheckpointsCard";
import AiHistoryCard from "./AiHistoryCard";
import Card from "./Card";
import StateTile from "./StateTile";

export default function AiOpinionCard({
  symbol,
  indicators,
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
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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

  useEffect(() => {
    const key = `velora-ai-history-${symbol}`;
    const today = getTodayKey();
    const reasons = opinion.scoreItems
      .slice()
      .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
      .map((item) => ({ label: item.label, points: item.points, reason: item.reason }));
    const entry: HistoryEntry = {
      date: today,
      score: opinion.aiScore,
      stars: opinion.rating.stars,
      risk: opinion.risk.label,
      rsi: indicators.rsi,
      macd: opinion.macdLabel,
      trend: opinion.trendLabel,
      reasons,
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
  }, [
    symbol,
    indicators.rsi,
    opinion.aiScore,
    opinion.rating.stars,
    opinion.risk.label,
    opinion.macdLabel,
    opinion.trendLabel,
    scoreItemsKey,
  ]);

  const checkpoints = useMemo(() => buildCheckpoints(opinion, indicators, currency), [opinion, indicators, currency]);

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
          </div>

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
      <AiHistoryCard history={history} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
    </>
  );
}
