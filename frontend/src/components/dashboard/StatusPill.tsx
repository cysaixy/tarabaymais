/**
 * StatusPill — case status badge (Tagalog).
 */

import React from "react";

const CONFIG: Record<string, { label: string; tailwind: string }> = {
  SUBMITTED: { label: "Naipasa", tailwind: "border-blue-200 bg-blue-50 text-blue-700" },
  UNDER_REVIEW: { label: "Sinusuri", tailwind: "border-amber-200 bg-amber-50 text-amber-700" },
  INSPECTED: { label: "Nainspeksyon", tailwind: "border-purple-200 bg-purple-50 text-purple-700" },
  RESOLVED: { label: "Nalutas", tailwind: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  REJECTED: { label: "Hindi Naaprubahan", tailwind: "border-rose-200 bg-rose-50 text-rose-700" },
};

interface StatusPillProps {
  status: string;
  size?: "sm" | "base";
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, size = "base" }) => {
  const config = CONFIG[status.toUpperCase()] ?? {
    label: status,
    tailwind: "border-slate-200 bg-slate-50 text-slate-700",
  };
  const cls = size === "sm" ? "text-[10px] px-2 py-0.5" : "text-[11px] px-2.5 py-0.75";

  return (
    <span className={`inline-flex items-center rounded-full border ${cls} font-bold ${config.tailwind}`}>
      {config.label}
    </span>
  );
};
