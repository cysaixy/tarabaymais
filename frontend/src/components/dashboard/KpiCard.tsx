/**
 * KpiCard — key performance indicator card.
 * Value, unit, delta arrow with color, sparkline, null-safe "—".
 * Tagalog labels. Large tap target for outdoor readability.
 */

import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: number | null;
  unit?: string;
  delta?: { absolute: number | null; percent: number | null };
  sparkline?: { date: string; value: number }[];
  labelShort?: string; // mobile short label
}

const fmt = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 2 });

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  unit,
  delta,
  sparkline,
  labelShort,
}) => {
  const showValue = value !== null;
  const hasDelta = delta && delta.percent !== null && delta.absolute !== null;

  const renderDelta = () => {
    if (!hasDelta) return null;
    const abs = delta!.absolute!;
    const pct = Math.abs(delta!.percent!);
    const isUp = abs >= 0;
    return (
      <div className="flex items-center gap-1 text-[12px] font-bold">
        {isUp ? (
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
        )}
        <span
          className={`font-bold ${isUp ? "text-emerald-700" : "text-rose-700"}`}
        >
          {isUp ? "+" : ""}
          {abs} ({pct}%)
        </span>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <p
          className={`text-[13px] sm:text-[14px] font-bold text-slate-600 truncate ${
            showValue ? "max-w-[60%]" : ""
          }`}
          title={title}
        >
          {labelShort ?? title}
        </p>
      </div>
      <div className="flex items-baseline gap-1 mb-2">
        <span
          className={`text-[28px] sm:text-[36px] font-black tabular-nums text-slate-900`}
        >
          {showValue ? fmt(value) : "—"}
        </span>
        {unit && showValue && (
          <span className="text-[14px] sm:text-[16px] font-bold text-slate-500 tabular-nums">
            {unit}
          </span>
        )}
      </div>
      {renderDelta()}
      {sparkline && sparkline.length > 0 && showValue && (
        <div className="mt-2 h-6 w-full flex items-end gap-0.5">
          {sparkline.map((p) => {
            const max = Math.max(...sparkline.map((s) => s.value));
            const pct = max > 0 ? (p.value / max) * 100 : 0;
            return (
              <div
                key={p.date}
                className="w-full bg-slate-100 rounded-full"
                style={{ height: `${Math.max(4, pct)}%` }}
                title={`${p.date}: ${p.value}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
