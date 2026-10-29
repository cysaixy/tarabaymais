import React from "react";

export interface BarangayAnalyticsItem {
  name: string;
  farmCount: number;
  hectares: number;
  openCases: number;
  damageReports: number;
  risk: number; // 0-100
}

export interface BarangayStripsProps {
  barangays: BarangayAnalyticsItem[];
  isLoading?: boolean;
}

export function getRiskColor(risk: number): string {
  if (risk >= 75) return "#9b1c1c";
  if (risk >= 40) return "#9a4a05";
  return "#0a6b45";
}

export const BarangayStripsSkeleton: React.FC = () => (
  <div className="space-y-3" role="status" aria-busy="true" aria-label="Ikinakarga ang buod ng barangay...">
    {/* Rank 1 Skeleton */}
    <div className="w-full bg-white border border-[#dde3d8] rounded-tl-[28px] rounded-tr-[28px] rounded-br-[28px] rounded-bl-[72px] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-slate-200 animate-pulse shrink-0" />
        <div className="space-y-2">
          <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
          <div className="h-3 w-32 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-8 w-28 bg-slate-200 rounded-full animate-pulse" />
        <div className="h-8 w-24 bg-slate-200 rounded-full animate-pulse" />
      </div>
      <div className="w-56 space-y-2">
        <div className="h-8 w-16 bg-slate-200 rounded animate-pulse" />
        <div className="h-3 w-full bg-slate-200 rounded-full animate-pulse" />
      </div>
    </div>

    {/* Rank 2 Skeleton */}
    <div className="w-full bg-white border border-[#dde3d8] rounded-[20px] p-4 px-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-slate-200 animate-pulse shrink-0" />
        <div className="space-y-1.5">
          <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
          <div className="h-3 w-28 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-7 w-28 bg-slate-200 rounded-full animate-pulse" />
        <div className="h-7 w-24 bg-slate-200 rounded-full animate-pulse" />
      </div>
      <div className="w-56 space-y-1.5">
        <div className="h-7 w-14 bg-slate-200 rounded animate-pulse" />
        <div className="h-3 w-full bg-slate-200 rounded-full animate-pulse" />
      </div>
    </div>
  </div>
);

/**
 * BarangayStrips — Row C replacing the table with uneven horizontal cards sorted by risk
 */
export const BarangayStrips: React.FC<BarangayStripsProps> = ({
  barangays,
  isLoading = false,
}) => {
  if (isLoading) return <BarangayStripsSkeleton />;

  // Sort by risk descending
  const sorted = [...barangays].sort((a, b) => b.risk - a.risk);

  if (sorted.length === 0) {
    return (
      <div className="w-full bg-white border border-[#dde3d8] rounded-[20px] p-8 text-center text-slate-400 font-semibold text-sm">
        Walang datos ng barangay sa panahong ito.
      </div>
    );
  }

  return (
    <section aria-label="Buod Ayon sa Barangay" className="w-full space-y-3">
      {/* HEADER */}
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2 className="text-[20px] font-extrabold text-slate-900 leading-none">
          Buod Ayon sa Barangay
        </h2>
        <span className="text-[13px] font-medium text-[#4b5563]">
          Pinakamataas na risk muna
        </span>
      </div>

      {/* STRIP LIST */}
      <div className="space-y-3">
        {sorted.map((item, index) => {
          const isRank1 = index === 0;
          const riskColor = getRiskColor(item.risk);
          const isCasesZero = item.openCases === 0;

          return (
            <div
              key={item.name}
              className={`w-full bg-white border border-[#dde3d8] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-5 transition-all ${
                isRank1
                  ? "rounded-tl-[28px] rounded-tr-[28px] rounded-br-[28px] rounded-bl-[72px] p-5 sm:p-[22px_28px]"
                  : "rounded-[20px] p-4 sm:p-[14px_24px]"
              }`}
            >
              {/* 1. RANK + NAME + SUBTITLE */}
              <div className="flex items-center gap-3.5 min-w-0">
                {/* Rank Circle */}
                <div
                  className={`rounded-full bg-[#0f2a5c] text-white flex items-center justify-center font-extrabold shrink-0 shadow-2xs ${
                    isRank1 ? "w-11 h-11 text-lg" : "w-[34px] h-[34px] text-sm"
                  }`}
                  aria-label={`Ranggo ${index + 1}`}
                >
                  {index + 1}
                </div>

                {/* Name & Subtitle */}
                <div className="min-w-0">
                  <h3
                    className={`font-extrabold text-slate-900 leading-tight truncate ${
                      isRank1 ? "text-[22px] sm:text-[26px]" : "text-[17px] sm:text-[19px]"
                    }`}
                    title={item.name}
                  >
                    {item.name}
                  </h3>
                  <p className="text-[13px] font-medium text-[#4b5563] mt-0.5 truncate">
                    {item.farmCount} sakahan · {item.hectares} ha
                  </p>
                </div>
              </div>

              {/* 2. CHIPS */}
              <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
                {/* Cases Chip */}
                <span
                  className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-[13px] font-extrabold shadow-2xs ${
                    isCasesZero
                      ? "bg-[#d9f3e5] text-[#0a6b45]"
                      : "bg-[#fdeccd] text-[#7a3a04]"
                  }`}
                >
                  {item.openCases} bukas na kaso
                </span>

                {/* Pinsala Chip */}
                <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-[13px] font-extrabold bg-[#fde8e8] text-[#9b1c1c] shadow-2xs">
                  {item.damageReports} pinsala
                </span>
              </div>

              {/* 3. RISK BLOCK (min-width 220px) */}
              <div className="w-full md:w-auto md:min-w-[220px] flex flex-col justify-center">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-[12px] font-bold tracking-[0.08em] uppercase text-[#4b5563]">
                    RISK
                  </span>
                  <span
                    className={`font-black leading-none ${
                      isRank1 ? "text-[44px] sm:text-[56px]" : "text-[32px] sm:text-[38px]"
                    }`}
                    style={{ color: riskColor }}
                  >
                    {item.risk}
                  </span>
                </div>

                {/* 12px Tall Risk Bar */}
                <div
                  className="w-full h-3 rounded-full bg-[#eef3e8] overflow-hidden p-0.5"
                  role="img"
                  aria-label={`Risk ${item.risk} sa 100`}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(Math.max(item.risk, 4), 100)}%`,
                      backgroundColor: riskColor,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
