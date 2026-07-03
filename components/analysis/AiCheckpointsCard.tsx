import type { Checkpoint, CheckpointPriority } from "@/lib/analysis/types";
import MobileDisclosure from "../MobileDisclosure";
import Card from "./Card";

export default function AiCheckpointsCard({
  checkpoints,
}: {
  checkpoints: Checkpoint[];
}) {
  const priorityStyle: Record<CheckpointPriority, { badge: string; label: string; className: string }> = {
    critical: { badge: "🔥", label: "가장 중요", className: "border-red-400/40 bg-red-500/10 text-red-300" },
    watch: { badge: "⭐", label: "확인 필요", className: "border-yellow-400/40 bg-yellow-500/10 text-yellow-300" },
    info: { badge: "ℹ", label: "참고", className: "border-sky-400/40 bg-sky-500/10 text-sky-300" },
  };

  return (
    <MobileDisclosure
      title="AI 체크포인트"
      className="rounded-lg bg-surface p-3"
      contentClassName="mt-3"
      desktopClassName="contents"
    >
    <Card title="🎯 AI 체크포인트" className="md:col-span-2 xl:col-span-2">
      <div className="grid gap-3 md:grid-cols-2 md:gap-4">
        {checkpoints.map((checkpoint) => (
          <div key={checkpoint.title} className="rounded-2xl border border-line/70 bg-panel/60 p-4 md:p-5">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${priorityStyle[checkpoint.priority].className}`}>
              <span>{priorityStyle[checkpoint.priority].badge}</span>
              <span>{priorityStyle[checkpoint.priority].label}</span>
            </div>
            <p className="mt-4 text-base font-black text-ink">{checkpoint.title}</p>
            <p className="mt-2 text-sm font-bold leading-6 text-muted">{checkpoint.description}</p>
          </div>
        ))}
      </div>
    </Card>
    </MobileDisclosure>
  );
}
