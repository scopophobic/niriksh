import { Severity } from "@/lib/types";

export function SeverityBadge({ level, pulse = false }: { level: Severity; pulse?: boolean }) {
  return <span className={`badge severity-${level.toLowerCase().replace(" ", "-")}`}>{pulse && <i/>}{level}</span>;
}
