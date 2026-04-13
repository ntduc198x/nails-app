export function ManageStatCard({ label, value, className = "", hint }: { label: string; value: React.ReactNode; className?: string; hint?: React.ReactNode }) {
  return (
    <div className={`manage-stat-card ${className}`.trim()}>
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-2 text-xs font-medium text-[var(--color-primary)]">{hint}</p> : null}
    </div>
  );
}
