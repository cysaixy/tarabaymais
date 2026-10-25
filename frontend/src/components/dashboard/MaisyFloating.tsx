/**
 * MaisyFloating — small floating assistant widget (bottom-right).
 * Contextual tip computed from real data (e.g. count of overdue cases).
 * Replaces the large greeting banner on the Buod tab.
 */

import React, { useMemo } from "react";
import { Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";

interface MaisyFloatingProps {
  overdueCases: number;
  openCases: number;
}

export const MaisyFloating: React.FC<MaisyFloatingProps> = ({
  overdueCases,
  openCases,
}) => {
  // Memoized tip derived from props (avoids setState-in-effect lint)
  const tipText = useMemo(() => {
    if (overdueCases > 0) {
      return `May ${overdueCases} kasong higit 48 oras nang naghihintay. Aksyonan muna ito.`;
    }
    if (openCases > 0) {
      return `May ${openCases} bukas na kaso. Maaari mong susuriin ang mga ito sa tab na Konsultasyon.`;
    }
    return "Lahat ng kaso ay na-aasikaso na. Magandang araw!";
  }, [overdueCases, openCases]);

  const TipIcon =
    overdueCases > 0 ? AlertTriangle : openCases > 0 ? Sparkles : CheckCircle2;
  const tipColor =
    overdueCases > 0
      ? "text-rose-600"
      : openCases > 0
        ? "text-amber-600"
        : "text-emerald-600";

  return (
    <div className="fixed bottom-24 right-4 z-50">
      <div className="flex items-center gap-2 rounded-2xl bg-white border border-slate-200 shadow-lg px-3 py-2 text-sm min-w-50 max-w-65">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 ${tipColor}`}
        >
          <TipIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-slate-900 leading-tight">
            {tipText}
          </p>
        </div>
        <button
          type="button"
          className="ml-2 rounded-full bg-slate-100 p-1 text-slate-500 hover:bg-slate-200 transition"
          aria-label="Isara ang tip ni Maisy"
        >
          <span className="sr-only">Isara</span>
          <span className="h-3 w-3 text-current" aria-hidden="true">
            ✕
          </span>
        </button>
      </div>
    </div>
  );
};
