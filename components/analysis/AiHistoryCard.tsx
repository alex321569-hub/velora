import { getDisplayDate } from "@/lib/analysis/aiAnalysis";
import type { HistoryEntry } from "@/lib/analysis/types";
import MobileDisclosure from "../MobileDisclosure";
import Card from "./Card";

export default function AiHistoryCard({
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
    <MobileDisclosure
      title="AI 분석 이력"
      className="rounded-lg bg-surface p-3"
      contentClassName="mt-3"
      desktopClassName="contents"
    >
    <Card title="📜 AI 분석 이력" className="md:col-span-2 xl:col-span-2">
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
                  className={`min-h-20 min-w-28 rounded-xl border px-3 py-2 text-left transition ${
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

          <div className="rounded-xl border border-line/70 bg-panel/60 p-3 md:p-4">
            <p className="text-xs font-black text-muted">최근 변화</p>
            <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
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
            <>
              <details className="rounded-xl border border-line/70 bg-panel/60 md:hidden">
                <summary className="flex min-h-11 cursor-pointer items-center justify-between px-3 py-2 text-sm font-black text-ink">
                  <span>{getDisplayDate(selected.date)} 점수 변화 원인</span>
                  <span className="text-xs text-positive">자세히 보기</span>
                </summary>
                <div className="grid gap-2 border-t border-line/70 p-3">
                  {selected.reasons.slice(0, 6).map((reason, index) => (
                    <div key={`${reason.label}-${index}`} className="grid gap-1 rounded-lg bg-surface px-3 py-2">
                      <span className="text-muted">{reason.label}</span>
                      <span className={reason.points >= 0 ? "text-positive" : "text-negative"}>
                        {reason.points >= 0 ? `+${reason.points}` : reason.points}
                      </span>
                      <span className="text-muted">{reason.reason}</span>
                    </div>
                  ))}
                </div>
              </details>

            <div className="hidden rounded-xl border border-line/70 bg-panel/60 p-4 md:block">
              <p className="text-xs font-black text-muted">{getDisplayDate(selected.date)} 점수 변화 원인</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {selected.reasons.slice(0, 6).map((reason, index) => (
                  <div key={`${reason.label}-${index}`} className="grid gap-1 rounded-lg bg-surface px-3 py-2 md:grid-cols-[4rem_3rem_1fr] md:gap-2">
                    <span className="text-muted">{reason.label}</span>
                    <span className={reason.points >= 0 ? "text-positive" : "text-negative"}>
                      {reason.points >= 0 ? `+${reason.points}` : reason.points}
                    </span>
                    <span className="text-muted">{reason.reason}</span>
                  </div>
                ))}
              </div>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
    </MobileDisclosure>
  );
}
