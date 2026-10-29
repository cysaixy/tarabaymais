import React from "react";
import type { StageData, StageKey } from "../dashboard/PanahonNgMaisCard";

export interface StageStripProps {
  stages: StageData[];
  isLoading?: boolean;
}

interface StageStripConfig {
  number: number;
  label: string;
  bg: string;
  textColor: string;
  strokeColor: string;
}

const STAGE_CONFIGS: Record<StageKey, StageStripConfig> = {
  pagtatanim: {
    number: 1,
    label: "PAGTATANIM",
    bg: "#eef3e8",
    textColor: "#3f5230",
    strokeColor: "#3f5230",
  },
  paglago: {
    number: 2,
    label: "PAGLAGO",
    bg: "#d9f3e5",
    textColor: "#0a6b45",
    strokeColor: "#0a6b45",
  },
  pagbubunga: {
    number: 3,
    label: "PAGBUBUNGA",
    bg: "#fdeccd",
    textColor: "#7a3a04",
    strokeColor: "#7a3a04",
  },
  "pag-ani": {
    number: 4,
    label: "PAG-ANI",
    bg: "#fff6d6",
    textColor: "#6b5300",
    strokeColor: "#6b5300",
  },
};

/**
 * Small seedling illustration for StageStrip
 */
const MiniSeedling: React.FC<{ className?: string }> = ({ className = "" }) => (
  <svg
    viewBox="0 0 60 80"
    fill="none"
    stroke="#3f5230"
    strokeWidth="3.5"
    strokeLinecap="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M30 78V48" />
    <path d="M30 56c-10 0-14-8-14-14 10 0 14 6 14 14Z" fill="#8aa37a" />
    <path d="M30 50c8 0 12-6 12-12-8 0-12 5-12 12Z" fill="#8aa37a" />
  </svg>
);

/**
 * Small corn plant illustration for StageStrip
 */
const MiniCornPlant: React.FC<{ strokeColor: string; withCob?: boolean; className?: string }> = ({
  strokeColor,
  withCob = true,
  className = "",
}) => (
  <svg
    viewBox="0 0 130 210"
    fill="none"
    stroke={strokeColor}
    strokeWidth="3.5"
    strokeLinecap="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M50 210V20" />
    <path d="M50 150c-24-4-36-24-36-40 24 4 36 20 36 40Z" fill="#8aa37a" />
    <path d="M50 110c24-4 40-22 40-38-24 4-40 18-40 38Z" fill="#8aa37a" />
    {withCob && (
      <>
        <ellipse cx="86" cy="150" rx="15" ry="32" fill="#f5c518" />
        <path d="M86 120v60M78 130v40M94 130v40" stroke="#b45309" />
      </>
    )}
    <path d="M50 40c-14-14-12-30 0-36 12 6 14 22 0 36Z" fill="#8aa37a" />
  </svg>
);

export const StageStripSkeleton: React.FC = () => (
  <div
    className="w-full bg-white rounded-[20px] border border-[#dde3d8] p-4 pb-0 shadow-2xs space-y-4"
    role="status"
    aria-busy="true"
    aria-label="Ikinakarga ang taniman ayon sa yugto..."
  >
    <div className="flex items-center justify-between">
      <div className="h-4 w-36 bg-slate-200 rounded animate-pulse" />
      <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
    </div>
    <div className="grid grid-cols-4 gap-2 items-end h-[85px] border-b-[3px] border-[#6b4a2b]">
      <div className="h-[65px] bg-slate-100 rounded-t-xl animate-pulse" />
      <div className="h-[40px] bg-slate-100 rounded-t-xl animate-pulse" />
      <div className="h-[80px] bg-slate-100 rounded-t-xl animate-pulse" />
      <div className="h-[40px] bg-slate-100 rounded-t-xl animate-pulse" />
    </div>
    <div className="h-3 w-56 bg-slate-200 rounded animate-pulse pb-3" />
  </div>
);

/**
 * StageStrip — Taniman ayon sa Yugto compact data-driven strip (Columns 5-12 of Row B)
 */
export const StageStrip: React.FC<StageStripProps> = ({
  stages,
  isLoading = false,
}) => {
  if (isLoading) return <StageStripSkeleton />;

  const totalHa = stages.reduce((sum, s) => sum + (Number(s.ha) || 0), 0);
  const maxHa = Math.max(...stages.map((s) => Number(s.ha) || 0), 0);

  // Column widths follow hectares: Math.max(ha, totalHa * 0.087)fr
  const gridTemplateColumns = stages
    .map((s) => {
      const minFraction = totalHa > 0 ? totalHa * 0.087 : 1;
      const widthFr = Math.max(Number(s.ha) || 0, minFraction);
      return `${Math.round(widthFr * 100) / 100}fr`;
    })
    .join(" ");

  return (
    <article className="w-full bg-white rounded-[20px] border border-[#dde3d8] pt-4 px-5 sm:px-[22px] pb-0 shadow-2xs overflow-hidden flex flex-col justify-between">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-[16px] font-extrabold text-slate-900 leading-none">
          Taniman ayon sa Yugto
        </h2>
        <span className="text-[15px] font-extrabold text-slate-900 leading-none">
          {totalHa} ha
        </span>
      </div>

      {/* STAGE STRIP WITH GROUND LINE */}
      <div className="w-full overflow-x-auto no-scrollbar">
        <div
          className="grid gap-2 items-end border-b-[3px] border-[#6b4a2b] pb-0 min-w-[320px]"
          style={{ gridTemplateColumns }}
        >
          {stages.map((stage) => {
            const ha = Number(stage.ha) || 0;
            const config = STAGE_CONFIGS[stage.key];
            const isFilled = ha > 0;
            const isLargest = isFilled && ha === maxHa && maxHa > 0;

            // Height calculation:
            // Filled: 58 + (ha / maxHa) * 20 px (range 58px to 78px)
            // Empty: 40px
            const blockHeight = isFilled && maxHa > 0
              ? Math.round(58 + (ha / maxHa) * 20)
              : 40;

            if (!isFilled) {
              // EMPTY BLOCK (ha = 0)
              return (
                <div
                  key={stage.key}
                  style={{ height: "40px" }}
                  className="border-2 border-dashed border-[#b9c4ae] rounded-[10px] p-1.5 bg-transparent flex flex-col justify-between overflow-hidden"
                >
                  <p
                    className="text-[10px] font-extrabold tracking-wide uppercase leading-tight truncate"
                    style={{ color: config.textColor }}
                  >
                    {config.number} · {config.label}
                  </p>
                  <span className="text-[11px] font-bold text-[#4b5563] leading-none">
                    — ha
                  </span>
                </div>
              );
            }

            // FILLED BLOCK (ha > 0)
            return (
              <div
                key={stage.key}
                style={{
                  height: `${blockHeight}px`,
                  backgroundColor: config.bg,
                  color: config.textColor,
                }}
                className="rounded-t-[14px] rounded-b-[4px] p-[6px_10px] relative overflow-hidden flex flex-col justify-between shadow-2xs"
              >
                {/* Top Label */}
                <p
                  className="text-[11px] font-extrabold tracking-[0.05em] uppercase leading-none truncate relative z-10"
                  style={{ color: config.textColor }}
                >
                  {config.number} · {config.label}
                </p>

                {/* Bottom Number */}
                <div className="flex items-baseline relative z-10 leading-none">
                  <span
                    className={`font-extrabold leading-none ${
                      isLargest ? "text-[38px]" : "text-[22px]"
                    }`}
                    style={{ color: config.textColor }}
                    aria-label={`${ha} ektarya sa ${config.label}`}
                  >
                    {ha}
                  </span>
                  <span
                    className="text-[13px] font-extrabold ml-1 leading-none"
                    style={{ color: config.textColor }}
                    aria-hidden="true"
                  >
                    ha
                  </span>
                </div>

                {/* Small Corn Illustration on Right */}
                <div className="absolute right-1 bottom-0 pointer-events-none select-none overflow-hidden" aria-hidden="true">
                  {stage.key === "pagtatanim" && (
                    <MiniSeedling className="w-6 h-9 opacity-85" />
                  )}
                  {stage.key === "paglago" && (
                    <MiniCornPlant strokeColor={config.strokeColor} withCob={false} className="w-8 h-12 opacity-85" />
                  )}
                  {(stage.key === "pagbubunga" || stage.key === "pag-ani") && (
                    <MiniCornPlant strokeColor={config.strokeColor} withCob={true} className="w-8 h-12 opacity-85" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FOOTER LEGEND LINE */}
      <p className="py-2.5 text-[11px] text-[#4b5563] font-medium truncate">
        1 Pagtatanim · 2 Paglago · 3 Pagbubunga · 4 Pag-ani
      </p>
    </article>
  );
};
