import React from "react";
import type { BarangayDistribution } from "../../services/analytics.service";

export interface FarmDistributionPanelProps {
  municipality: string;
  barangays: BarangayDistribution[];
  isLoading: boolean;
  error: string | null;
}

function formatHa(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export const FarmDistributionPanel: React.FC<FarmDistributionPanelProps> = ({
  municipality,
  barangays,
  isLoading,
  error,
}) => {
  const maxHa = barangays.length > 0
    ? Math.max(...barangays.map((b) => Number(b.totalHectares) || 0))
    : 0;

  const totalFarms = barangays.reduce((s, b) => s + (Number(b.farmCount) || 0), 0);
  const totalHa = barangays.reduce((s, b) => s + (Number(b.totalHectares) || 0), 0);

  return (
    <section
      aria-labelledby="dist-heading"
      className="bg-[#0a3d2e] text-white rounded-[28px_28px_72px_28px] p-[26px_28px] flex flex-col gap-[18px]"
    >
      {/* Header */}
      <div className="flex flex-col gap-1">
        <p
          className="text-[12px] font-bold tracking-[0.1em] text-[#bfe8d3] uppercase"
          aria-hidden="true"
        >
          DISTRIBUSYON NG SAKAHAN
        </p>
        <h2
          id="dist-heading"
          className="text-[22px] font-extrabold text-white leading-tight"
        >
          {municipality}
        </h2>
      </div>

      {/* Body */}
      {isLoading ? (
        /* Loading skeletons */
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Kinukuha ang datos...">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-2 animate-pulse">
              <div className="flex justify-between">
                <div className="h-4 w-28 rounded bg-white/20" />
                <div className="h-4 w-24 rounded bg-white/10" />
              </div>
              <div className="h-2.5 w-full rounded-full bg-[#1d5a45]">
                <div className="h-2.5 rounded-full bg-white/20" style={{ width: `${30 + i * 20}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-[13px] font-semibold text-[#fecaca]" role="alert">
          {error}
        </p>
      ) : barangays.length === 0 ? (
        <p className="text-[14px] font-semibold text-[#dff5e9]">
          Walang naitalang sakahan.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {barangays.map((b) => {
            const ha = Number(b.totalHectares) || 0;
            const farms = Number(b.farmCount) || 0;
            const pct = maxHa > 0 ? (ha / maxHa) * 100 : 0;
            return (
              <div key={b.barangay} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[15px] font-bold text-white leading-snug">
                    {b.barangay}
                  </span>
                  <span className="text-[15px] font-bold text-[#dff5e9] shrink-0 tabular-nums">
                    {farms} sakahan · {formatHa(ha)} ha
                  </span>
                </div>
                {/* Track */}
                <div
                  className="w-full h-[10px] rounded-full bg-[#1d5a45] overflow-hidden"
                  role="presentation"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-[#f5c518] transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}

          {/* Divider */}
          <div className="border-t border-[#2a6b53]" aria-hidden="true" />

          {/* Total */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-bold text-[#bfe8d3] tracking-[0.05em] uppercase">
              Kabuuan
            </span>
            <div className="flex items-baseline gap-2 shrink-0">
              <span className="text-[30px] font-extrabold text-[#f5c518] leading-none tabular-nums">
                {totalFarms}
              </span>
              <span className="text-[14px] text-[#dff5e9] font-semibold">
                sakahan · {formatHa(totalHa)} ha
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
