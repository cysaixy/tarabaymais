/**
 * SeverityBadge — color-coded severity badge (Tagalog).
 * critical → Kritikal (red), high → Mataas (orange), medium → Paminsan-minsan (amber), low → Mababa (green)
 */

import React from "react";

interface SeverityBadgeProps {
  severity: string;
  size?: "sm" | "base";
}

const CONFIG: Record<string, { label: string; tailwind: string }> = {
  critical: { label: "Kritikal", tailwind: "border-red-200 bg-red-50 text-red-700" },
  high: { label: "Mataas", tailwind: "border-orange-200 bg-orange-50 text-orange-700" },
  medium: { label: "Paminsan-minsan", tailwind: "border-amber-200 bg-amber-50 text-amber-700" },
  low: { label: "Mababa", tailwind: "border-emerald-200 bg-emerald-50 text-emerald-700" },
};

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({
  severity,
  size = "base",
}) => {
  const config = CONFIG[severity.toLowerCase()] ?? {
    label: severity,
    tailwind: "border-slate-200 bg-slate-50 text-slate-700",
  };
  const cls = size === "sm" ? "text-[10px] px-2 py-0.5" : "text-[11px] px-2.5 py-0.75";

  return (
    <span
      className={`inline-flex items-center rounded-full border ${cls} font-bold ${config.tailwind}`}
    >
      {config.label}
    </span>
  );
};
