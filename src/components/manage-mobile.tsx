import type { ReactNode } from "react";

export function MobileSectionHeader({
  title,
  description,
  meta,
}: {
  title: string;
  description?: string;
  meta?: ReactNode;
}) {
  return (
    <div className="space-y-3 sm:flex sm:items-start sm:justify-between sm:gap-4 sm:space-y-0">
      <div className="min-w-0 space-y-1">
        <h2 className="text-2xl font-extrabold tracking-tight text-[var(--color-primary)] sm:text-3xl">{title}</h2>
        {description ? <p className="text-sm leading-6 text-neutral-500">{description}</p> : null}
      </div>
      {meta ? <div className="shrink-0">{meta}</div> : null}
    </div>
  );
}

export function MobileStickyActions({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white/95 p-3 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-7xl gap-2">{children}</div>
    </div>
  );
}

export function MobileInfoGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

export function MobileCollapsible({ summary, children, defaultOpen = false }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm md:hidden" open={defaultOpen}>
      <summary className="cursor-pointer list-none text-sm font-semibold text-neutral-900">{summary}</summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
