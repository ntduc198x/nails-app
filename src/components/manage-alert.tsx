export function ManageAlert({ tone = "info", children, className = "" }: { tone?: "info" | "error" | "warn"; children: React.ReactNode; className?: string }) {
  const toneClass = tone === "error" ? "manage-error-box" : tone === "warn" ? "manage-warn-box" : "manage-info-box";
  return <div className={`${toneClass} ${className}`.trim()}>{children}</div>;
}
