import React from "react";
import { DeltaTrendArrow } from "../dashboard/KpiOverview";

export interface StatBarProps {
  farmCount: number;
  activeHectares: number;
  openCases: number;
  avgResponseHours: number;
  responseDelta?: { value: number; percent: number };
  isLoading?: boolean;
}

export const StatBarSkeleton: React.FC = () => (
  <div
    className="w-full bg-white border border-[#dde3d8] rounded-[28px] md:rounded-full p-4 md:py-3.5 md:px-9 shadow-2xs grid grid-cols-2 md:flex md:flex-row md:items-center md:justify-between gap-4 md:gap-0"
    role="status"
    aria-busy="true"
    aria-label="Ikinakarga ang mga pangkalahatang estadistika..."
  >
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="flex-1 flex items-baseline gap-2">
        <div className="h-8 w-12 bg-slate-200 rounded animate-pulse" />
        <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
      </div>
    ))}
  </div>
);

/**
 * StatBar — Single pill container with 4 non-uniform KPI metrics separated by dividers
 */
export const StatBar: React.FC<StatBarProps> = ({
  farmCount,
  activeHectares,
  openCases,
  avgResponseHours,
  responseDelta,
  isLoading = false,
}) => {
  if (isLoading) return <StatBarSkeleton />;

  const isCasesZero = openCases === 0;

  return (
    <div className="w-full bg-white border border-[#dde3d8] rounded-[28px] md:rounded-full p-5 md:py-3.5 md:px-9 shadow-2xs grid grid-cols-2 md:flex md:flex-row md:items-center md:justify-between gap-4 md:gap-0">
      {/* 1. REHISTRADONG SAKAHAN */}
      <div className="flex-1 flex items-baseline gap-2 min-w-0">
        <span
          className="text-[30px] font-black leading-none text-[#0a6b45] tracking-tight shrink-0"
          aria-label={`${farmCount} rehistradong sakahan`}
        >
          {farmCount}
        </span>
        <span className="text-[13px] font-bold text-[#4b5563] uppercase tracking-wide truncate">
          Rehistradong Sakahan
        </span>
      </div>

      {/* Divider 1 */}
      <div
        className="hidden md:block w-px h-8 bg-[#dde3d8] mx-4 shrink-0"
        aria-hidden="true"
      />

      {/* 2. AKTIBONG TANIMAN (BIGGEST NUMBER) */}
      <div className="flex-1 flex items-baseline gap-2 min-w-0">
        <div className="flex items-baseline shrink-0">
          <span
            className="text-[44px] font-black leading-none text-[#1d4ed8] tracking-tight"
            aria-label={`${activeHectares} ektarya ng aktibong taniman`}
          >
            {activeHectares}
          </span>
          <span className="text-[16px] font-extrabold text-[#1d4ed8] ml-1 leading-none">
            ha
          </span>
        </div>
        <span className="text-[13px] font-bold text-[#4b5563] uppercase tracking-wide truncate">
          Aktibong Taniman
        </span>
      </div>

      {/* Divider 2 */}
      <div
        className="hidden md:block w-px h-8 bg-[#dde3d8] mx-4 shrink-0"
        aria-hidden="true"
      />

      {/* 3. BUKAS NA KASO (GREEN if 0, ORANGE if > 0) */}
      <div className="flex-1 flex items-baseline gap-2 min-w-0">
        <span
          className={`text-[30px] font-black leading-none tracking-tight shrink-0 ${
            isCasesZero ? "text-[#0a6b45]" : "text-[#9a4a05]"
          }`}
          aria-label={`${openCases} bukas na kaso`}
        >
          {openCases}
        </span>
        <span className="text-[13px] font-bold text-[#4b5563] uppercase tracking-wide truncate">
          Bukas na Kaso
        </span>
      </div>

      {/* Divider 3 */}
      <div
        className="hidden md:block w-px h-8 bg-[#dde3d8] mx-4 shrink-0"
        aria-hidden="true"
      />

      {/* 4. KARANIWANG ORAS NG TUGON */}
      <div className="flex-1 flex items-baseline gap-2 min-w-0">
        <div className="flex items-baseline shrink-0">
          <span
            className="text-[30px] font-black leading-none text-[#14213d] tracking-tight"
            aria-label={`${avgResponseHours.toFixed(1)} oras karaniwang tugon`}
          >
            {avgResponseHours.toFixed(1)}
          </span>
          <span className="text-[14px] font-bold text-[#14213d] ml-1 leading-none">
            oras
          </span>
          {responseDelta && (
            <span className="text-xs font-bold text-[#9a4a05] ml-2 inline-flex items-center gap-0.5">
              <DeltaTrendArrow
                type={responseDelta.value > 0 ? "up" : responseDelta.value < 0 ? "down" : "neutral"}
                className="w-3 h-3 stroke-current"
              />
              <span>
                {responseDelta.value >= 0 ? "+" : ""}
                {responseDelta.value.toFixed(1)}
              </span>
            </span>
          )}
        </div>
        <span className="text-[13px] font-bold text-[#4b5563] uppercase tracking-wide truncate">
          Karaniwang Oras ng Tugon
        </span>
      </div>
    </div>
  );
};
