import React from "react";

export type StageKey = "pagtatanim" | "paglago" | "pagbubunga" | "pag-ani";

export interface StageData {
  key: StageKey;
  ha: number;
}

export interface PanahonNgMaisCardProps {
  /** Array of 4 stages in exact order: pagtatanim, paglago, pagbubunga, pag-ani */
  stages: StageData[];
  /** Loading state flag */
  isLoading?: boolean;
  /** Error state */
  error?: string | Error | null;
  /** Optional container class name */
  className?: string;
}

interface StageConfig {
  number: number;
  label: string;
  bg: string;
  textColor: string;
  strokeColor: string;
}

const STAGE_CONFIGS: Record<StageKey, StageConfig> = {
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
 * Seedling SVG for Pagtatanim
 */
const SeedlingIllustration: React.FC<{ className?: string }> = ({ className = "" }) => (
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
 * Corn plant SVG for Pagbubunga, Paglago (without cob), and Pag-ani
 */
const CornPlantIllustration: React.FC<{
  strokeColor: string;
  withCob?: boolean;
  className?: string;
}> = ({ strokeColor, withCob = true, className = "" }) => (
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

/**
 * Renders the stage illustration according to stage key and size
 */
const StageIllustration: React.FC<{
  stageKey: StageKey;
  isLargest: boolean;
}> = ({ stageKey, isLargest }) => {
  const config = STAGE_CONFIGS[stageKey];
  const sizeClass = isLargest
    ? "w-[62px] h-[100px] absolute right-[22px] bottom-0 pointer-events-none select-none"
    : "w-[36px] h-[46px] absolute right-[16px] bottom-[6px] pointer-events-none select-none";

  if (stageKey === "pagtatanim") {
    return <SeedlingIllustration className={sizeClass} />;
  }

  if (stageKey === "paglago") {
    return (
      <CornPlantIllustration
        strokeColor={config.strokeColor}
        withCob={false}
        className={sizeClass}
      />
    );
  }

  // pagbubunga and pag-ani both show the plant with cob
  return (
    <CornPlantIllustration
      strokeColor={config.strokeColor}
      withCob={true}
      className={sizeClass}
    />
  );
};

/**
 * Skeleton loader for PanahonNgMaisCard
 */
export const PanahonNgMaisSkeleton: React.FC = () => {
  const skeletonHeights = [84, 60, 112, 60];
  const skeletonWidths = ["5fr", "1.3fr", "10fr", "1.3fr"].join(" ");

  return (
    <div
      className="grid gap-2 items-end border-b-[3px] border-[#6b4a2b] pb-0"
      style={{ gridTemplateColumns: skeletonWidths }}
      role="status"
      aria-busy="true"
      aria-label="Ikinakarga ang panahon ng mais..."
    >
      {skeletonHeights.map((h, i) => (
        <div
          key={i}
          className="rounded-t-[16px] rounded-b-[4px] bg-slate-100 animate-pulse"
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  );
};

/**
 * PanahonNgMaisCard — Compact data-driven crop stage card for TarabayMais Dashboard
 */
export const PanahonNgMaisCard: React.FC<PanahonNgMaisCardProps> = ({
  stages,
  isLoading = false,
  error = null,
  className = "",
}) => {
  const totalHa = stages.reduce((sum, s) => sum + (Number(s.ha) || 0), 0);
  const maxHa = Math.max(...stages.map((s) => Number(s.ha) || 0), 0);

  // Column widths follow the hectares: Math.max(s.ha, totalHa * 0.087)fr
  const gridTemplateColumns = stages
    .map((s) => {
      const minFraction = totalHa > 0 ? totalHa * 0.087 : 1;
      const widthFr = Math.max(Number(s.ha) || 0, minFraction);
      return `${Math.round(widthFr * 100) / 100}fr`;
    })
    .join(" ");

  return (
    <section
      aria-label="Panahon ng Mais"
      className={`w-full rounded-[20px] bg-white border border-[#dde3d8] p-[18px_20px] shadow-2xs flex flex-col justify-between ${className}`}
      style={{ minHeight: "200px" }}
    >
      {/* HEADER ROW */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-extrabold text-slate-900 leading-none tracking-tight">
          Panahon ng Mais
        </h2>
        <div className="text-[13px] text-[#4b5563]">
          <strong className="font-extrabold text-slate-900">{totalHa} ha</strong> kabuuan
        </div>
      </div>

      {/* ERROR MESSAGE (one line inline inside card) */}
      {error && (
        <p className="mt-2 text-xs font-semibold text-rose-600 truncate" role="alert">
          {typeof error === "string" ? error : error?.message ?? "Hindi ma-load ang datos."}
        </p>
      )}

      {/* CONTENT AREA: SKELETON, EMPTY OR DATA-DRIVEN STRIP */}
      <div className="mt-3">
        {isLoading ? (
          <PanahonNgMaisSkeleton />
        ) : totalHa === 0 ? (
          <div className="h-[90px] flex items-center justify-center text-sm font-semibold text-slate-400 border-b-[3px] border-[#6b4a2b]">
            Wala pang aktibong taniman
          </div>
        ) : (
          <div
            className="grid gap-2 items-end border-b-[3px] border-[#6b4a2b] pb-0"
            style={{ gridTemplateColumns }}
          >
            {stages.map((stage) => {
              const ha = Number(stage.ha) || 0;
              const config = STAGE_CONFIGS[stage.key];
              const isFilled = ha > 0;
              const isLargest = isFilled && ha === maxHa && maxHa > 0;

              // Height calculation:
              // Filled: 60 + (ha / maxHa) * 52px (range 60px to 112px)
              // Empty: exactly 60px
              const blockHeight = isFilled && maxHa > 0
                ? Math.round(60 + (ha / maxHa) * 52)
                : 60;

              if (!isFilled) {
                // EMPTY BLOCK (ha = 0)
                return (
                  <div
                    key={stage.key}
                    style={{ height: "60px" }}
                    className="border-2 border-dashed border-[#b9c4ae] rounded-[12px] p-[6px_8px] bg-transparent flex flex-col justify-between"
                  >
                    <p
                      className="text-[10px] font-extrabold tracking-wide uppercase leading-tight truncate"
                      style={{ color: config.textColor }}
                    >
                      {config.number} · {config.label}
                    </p>
                    <p className="text-[12px] font-bold text-[#4b5563] leading-none">
                      — ha
                    </p>
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
                  className="rounded-t-[16px] rounded-b-[4px] p-[10px_14px] relative overflow-hidden flex flex-col justify-between shadow-2xs"
                >
                  {/* Stage Label */}
                  <p
                    className="text-[11px] font-extrabold tracking-[0.05em] uppercase leading-none truncate relative z-10"
                    style={{ color: config.textColor }}
                  >
                    {config.number} · {config.label}
                  </p>

                  {/* Hectare Value + Unit */}
                  <div className="flex items-baseline relative z-10 leading-none">
                    <span
                      className={`font-extrabold leading-none ${
                        isLargest ? "text-[52px]" : "text-[32px]"
                      }`}
                      style={{ color: config.textColor }}
                      aria-label={`${ha} ektarya sa ${config.label}`}
                    >
                      {ha}
                    </span>
                    <span
                      className={`font-extrabold ml-1 leading-none ${
                        isLargest ? "text-[16px]" : "text-[13px]"
                      }`}
                      style={{ color: config.textColor }}
                      aria-hidden="true"
                    >
                      ha
                    </span>
                  </div>

                  {/* Corn Illustration */}
                  <StageIllustration stageKey={stage.key} isLargest={isLargest} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
