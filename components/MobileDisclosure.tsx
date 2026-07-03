"use client";

import { ReactNode, useEffect, useState } from "react";

export default function MobileDisclosure({
  title,
  children,
  className = "",
  contentClassName = "",
  desktopClassName = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  desktopClassName?: string;
}) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  if (isDesktop) {
    return <div className={desktopClassName || contentClassName}>{children}</div>;
  }

  return (
    <details className={className}>
      <summary className="flex min-h-11 cursor-pointer items-center justify-between text-sm font-black text-ink">
        <span>{title}</span>
        <span className="text-xs text-positive">자세히 보기</span>
      </summary>
      <div className={contentClassName}>{children}</div>
    </details>
  );
}
