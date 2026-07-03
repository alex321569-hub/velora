export default function StateTile({
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
