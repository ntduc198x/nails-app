"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type DeferredRenderProps = {
  children: ReactNode;
  className?: string;
  fallback?: ReactNode;
  rootMargin?: string;
};

export function DeferredRender({
  children,
  className,
  fallback = null,
  rootMargin = "240px",
}: DeferredRenderProps) {
  const [visible, setVisible] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = anchorRef.current;
    if (!node || visible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin, visible]);

  return (
    <div ref={anchorRef} className={className}>
      {visible ? children : fallback}
    </div>
  );
}
