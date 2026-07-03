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
    <div className="rounded-xl border border-line/70 bg-panel/60 p-3 transition hover:border-line md:p-4">
      <div className="flex items-center gap-2 text-xs font-black text-muted">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <p className={`mt-3 break-words text-base font-black md:text-lg ${tone}`}>{value}</p>
      {sub && <p className="mt-1 text-xs font-bold text-muted">{sub}</p>}
    </div>
  );
}
