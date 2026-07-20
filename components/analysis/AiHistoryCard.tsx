"use client";

import { useState } from "react";
import type { LocalScoreHistoryItem } from "@/lib/analysis/types";
import { formatPrice } from "@/lib/formatters";
import type { StockBasicInfo } from "@/lib/market/types";
import MobileDisclosure from "../MobileDisclosure";
import Card from "./Card";

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getDelta(current: number | null | undefined, previous: number | null | undefined) {
  if (current == null || previous == null) return null;
  return current - previous;
}

function DeltaText({ value }: { value: number | null }) {
  if (value === null || Math.abs(value) < 0.005) {
    return <span className="text-muted">→ 0</span>;
  }

  return value > 0 ? (
    <span className="text-positive">▲ +{value.toFixed(0)}</span>
  ) : (
    <span className="text-negative">▼ {value.toFixed(0)}</span>
  );
}

export default function AiHistoryCard({
  history,
  currency,
}: {
  history: LocalScoreHistoryItem[];
  currency: StockBasicInfo["currency"];
}) {
  const [selectedAt, setSelectedAt] = useState<string | null>(null);
  const latest = history[0] ?? null;
  const previous = history[1] ?? null;
  const selected = history.find((entry) => entry.analyzedAt === selectedAt) ?? latest;
  const scoreDelta = getDelta(latest?.compositeScore, previous?.compositeScore);
  const chartHealthDelta = getDelta(latest?.chartHealthScore, previous?.chartHealthScore);
  const confidenceDelta = getDelta(latest?.confidence, previous?.confidence);

  if (history.length === 0) {
    return null;
  }

  return (
    <MobileDisclosure
      title="점수 추이"
      className="rounded-lg bg-surface p-3"
      contentClassName="mt-3"
      desktopClassName="contents"
    >
      <Card title="📈 점수 추이" className="md:col-span-2 xl:col-span-2">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-line/70 bg-panel/60 p-3">
              <p className="text-xs font-black text-muted">종합점수 변화</p>
              <p className="mt-2 text-xl font-black text-ink">{latest?.compositeScore ?? "데이터 없음"}점</p>
              <p className="text-sm font-black">
                <DeltaText value={scoreDelta} />
              </p>
            </div>
            <div className="rounded-xl border border-line/70 bg-panel/60 p-3">
              <p className="text-xs font-black text-muted">차트 건전도 변화</p>
              <p className="mt-2 text-xl font-black text-ink">{latest?.chartHealthScore ?? "데이터 없음"}점</p>
              <p className="text-sm font-black">
                <DeltaText value={chartHealthDelta} />
              </p>
            </div>
            <div className="rounded-xl border border-line/70 bg-panel/60 p-3">
              <p className="text-xs font-black text-muted">AI 신뢰도 변화</p>
              <p className="mt-2 text-xl font-black text-ink">{latest?.confidence ?? "데이터 없음"}%</p>
              <p className="text-sm font-black">
                <DeltaText value={confidenceDelta} />
              </p>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {history.map((entry, index) => {
              const prior = history[index + 1];
              const diff = getDelta(entry.compositeScore, prior?.compositeScore);
              const active = selected?.analyzedAt === entry.analyzedAt;

              return (
                <button
                  key={entry.analyzedAt}
                  type="button"
                  onClick={() => setSelectedAt(entry.analyzedAt)}
                  className={`min-h-24 min-w-36 rounded-xl border px-3 py-2 text-left transition ${
                    active ? "border-positive bg-positive/10" : "border-line bg-panel/60 hover:border-muted"
                  }`}
                >
                  <p className="text-xs font-black text-muted">{formatDateTime(entry.analyzedAt)}</p>
                  <p className="mt-1 text-lg font-black text-ink">{entry.compositeScore ?? "데이터 없음"}점</p>
                  <p className="text-xs font-bold text-muted">건전도 {entry.chartHealthScore ?? "데이터 없음"}점</p>
                  <p className="text-xs font-black">
                    <DeltaText value={diff} />
                  </p>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="rounded-xl border border-line/70 bg-panel/60 p-3 md:p-4">
              <div className="grid gap-2 text-sm font-bold md:grid-cols-2">
                <p>분석 시각: {formatDateTime(selected.analyzedAt)}</p>
                <p>현재가: {formatPrice(selected.price, currency)}</p>
                <p>리스크: {selected.risk ?? "데이터 없음"}</p>
                <p>추세: {selected.trend ?? "데이터 없음"}</p>
              </div>
              {selected.summary && <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm font-bold text-muted">{selected.summary}</p>}

              {selected.reasons && selected.reasons.length > 0 && (
                <details className="mt-3 rounded-xl border border-line/70 bg-surface md:hidden">
                  <summary className="flex min-h-11 cursor-pointer items-center justify-between px-3 py-2 text-sm font-black text-ink">
                    <span>점수 변화 원인</span>
                    <span className="text-xs text-positive">자세히 보기</span>
                  </summary>
                  <div className="grid gap-2 border-t border-line/70 p-3">
                    {selected.reasons.slice(0, 6).map((reason, index) => (
                      <div key={`${reason.label}-${index}`} className="grid gap-1 rounded-lg bg-panel/60 px-3 py-2">
                        <span className="text-muted">{reason.label}</span>
                        <span className={reason.points >= 0 ? "text-positive" : "text-negative"}>
                          {reason.points >= 0 ? `+${reason.points}` : reason.points}
                        </span>
                        <span className="text-muted">{reason.reason}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {selected.reasons && selected.reasons.length > 0 && (
                <div className="mt-3 hidden rounded-xl border border-line/70 bg-surface p-3 md:block">
                  <p className="text-xs font-black text-muted">점수 변화 원인</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {selected.reasons.slice(0, 6).map((reason, index) => (
                      <div key={`${reason.label}-${index}`} className="grid gap-1 rounded-lg bg-panel/60 px-3 py-2 md:grid-cols-[5rem_3rem_1fr] md:gap-2">
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
        </div>
      </Card>
    </MobileDisclosure>
  );
}
