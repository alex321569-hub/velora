import type { ReactNode } from "react";

export default function Card({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article className={`min-w-0 rounded-lg bg-surface p-3 md:min-h-40 md:p-4 ${className}`}>
      {title && <h3 className="mb-3 text-sm font-extrabold text-muted">{title}</h3>}
      <div className="space-y-1 text-sm font-bold leading-6 text-ink">{children}</div>
    </article>
  );
}
