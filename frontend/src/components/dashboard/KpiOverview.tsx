import React from "react";

export type PeriodType = "7d" | "30d" | "season";

export interface DeltaData {
  value: number;
  percent: number;
}

export interface KpiOverviewProps {
  /** Total active corn farmland in hectares (e.g. 15) */
  activeHectares: number;
  /** Number of registered farms (e.g. 2) */
  farmCount: number;
  /** Delta for registered farms or active parcels */
  farmsDelta?: DeltaData;
  /** Average response time in hours (e.g. 68.0) */
  avgResponseHours: number;
  /** Delta for response time (e.g. +27.4, 100%) */
  responseDelta?: DeltaData;
  /** Count of damage / disaster reports (e.g. 5) */
  damageReports: number;
  /** Number of open / pending consultations (e.g. 0) */
  openConsultations: number;
  /** Active time period filter (defaults to "30d") */
  period?: PeriodType;
  /** Callback when user changes period via the top header pills */
  onPeriodChange?: (period: PeriodType) => void;
  /** Loading state flag */
  isLoading?: boolean;
  /** Error state message or object */
  error?: string | Error | null;
  /** Additional CSS classes for container */
  className?: string;
  /** Whether to show the top header title */
  showHeader?: boolean;
  /** Whether to show the period toggle buttons inside the section header (set false if top bar already has them) */
  showPeriodToggle?: boolean;
  /** Optional caption rendered beneath the grid */
  caption?: string;
}

/**
 * Returns Tagalog period label text based on selected period
 */
// eslint-disable-next-line react-refresh/only-export-components
export function getPeriodLabel(period: PeriodType = "30d"): string {
  switch (period) {
    case "7d":
      return "sa 7 araw";
    case "season":
      return "sa season";
    case "30d":
    default:
      return "sa 30 araw";
  }
}

/**
 * Returns header title in Tagalog based on period
 */
// eslint-disable-next-line react-refresh/only-export-components
export function getPeriodHeading(period: PeriodType = "30d"): string {
  switch (period) {
    case "7d":
      return "Buod ng Nakaraang 7 Araw";
    case "season":
      return "Buod ng Kasalukuyang Season";
    case "30d":
    default:
      return "Buod ng Nakaraang 30 Araw";
  }
}

export type DeltaDirection = "up" | "down" | "neutral";

/**
 * Outline SVG arrow for deltas to prevent OS emoji rendering
 */
export const DeltaTrendArrow: React.FC<{
  type: DeltaDirection;
  className?: string;
}> = ({ type, className = "w-3.5 h-3.5 shrink-0" }) => {
  if (type === "up") {
    return (
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <line x1="4" y1="12" x2="12" y2="4" />
        <polyline points="6 4 12 4 12 10" />
      </svg>
    );
  }
  if (type === "down") {
    return (
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <line x1="4" y1="4" x2="12" y2="12" />
        <polyline points="6 12 12 12 12 6" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="3" y1="8" x2="13" y2="8" />
    </svg>
  );
};

/**
 * Formats delta into arrow, sign (+ or -), value rounded to 1 decimal place, and percentage
 */
// eslint-disable-next-line react-refresh/only-export-components
export function formatDelta(
  delta?: DeltaData | null,
  periodSuffix?: string
): { type: DeltaDirection; arrow: string; text: string; full: string } | null {
  if (!delta) return null;
  const val = Number(delta.value);
  const pct = Number(delta.percent);

  let type: DeltaDirection = "neutral";
  let arrow = "—";
  let sign = "+";
  if (val > 0) {
    type = "up";
    arrow = "↗";
    sign = "+";
  } else if (val < 0) {
    type = "down";
    arrow = "↘";
    sign = "-";
  } else {
    type = "neutral";
    arrow = "—";
    sign = "+";
  }

  const absVal = Math.abs(val);
  const formattedVal =
    absVal % 1 === 0 ? absVal.toString() : (Math.round(absVal * 10) / 10).toFixed(1);
  const absPct = Math.abs(pct);
  const formattedPct =
    absPct % 1 === 0 ? absPct.toString() : (Math.round(absPct * 10) / 10).toFixed(1);

  const text = `${sign}${formattedVal} (${formattedPct}%)`;
  const full = periodSuffix ? `${arrow} ${text} ${periodSuffix}` : `${arrow} ${text}`;

  return { type, arrow, text, full };
}

/**
 * Formats hours with 1 decimal if needed (e.g. 68 -> "68.0", 70.45 stays "70.45")
 */
// eslint-disable-next-line react-refresh/only-export-components
export function formatHours(val: number): string {
  if (val === null || val === undefined || isNaN(val)) return "0.0";
  if (Number.isInteger(val)) {
    return `${val}.0`;
  }
  return `${val}`;
}

/**
 * Decorative SVG representing cornfield aerial parcels and diagonal rows
 */
const CornfieldIllustration: React.FC = () => (
  <svg
    viewBox="0 0 340 300"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full object-contain"
    aria-hidden="true"
  >
    {/* Diagonal row lines (#1f6b4d) */}
    <g stroke="#1f6b4d" strokeWidth="2.5" strokeLinecap="round" opacity="0.9">
      <line x1="30" y1="280" x2="160" y2="30" />
      <line x1="60" y1="290" x2="190" y2="40" />
      <line x1="90" y1="300" x2="220" y2="50" />
      <line x1="120" y1="310" x2="250" y2="60" />
      <line x1="150" y1="310" x2="280" y2="70" />
      <line x1="180" y1="310" x2="310" y2="80" />
      <line x1="210" y1="310" x2="330" y2="95" />
      <line x1="240" y1="310" x2="340" y2="125" />
      <line x1="0" y1="270" x2="130" y2="20" />
      <line x1="-30" y1="260" x2="100" y2="10" />
    </g>

    {/* Yellow parcel polygon (#f5c518) on lower-left flank */}
    <polygon
      points="55,160 80,160 85,225 55,225"
      fill="#f5c518"
      stroke="#e0b014"
      strokeWidth="1.5"
    />

    {/* Main Green parcel polygon: Green (#2f9e6a) at 55% opacity with bright border */}
    <polygon
      points="85,75 285,45 330,210 135,255"
      fill="#2f9e6a"
      fillOpacity="0.55"
      stroke="#5cd499"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Large thin minimalist clock SVG in #f5c518
 */
const ClockIllustration: React.FC = () => (
  <svg
    viewBox="0 0 68 68"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-12 h-12 sm:w-14 sm:h-14 shrink-0"
    aria-hidden="true"
  >
    {/* Outer circle */}
    <circle cx="34" cy="34" r="28" stroke="#f5c518" strokeWidth="4" />
    {/* Clock hands */}
    <line
      x1="34"
      y1="34"
      x2="21"
      y2="38"
      stroke="#f5c518"
      strokeWidth="3.5"
      strokeLinecap="round"
    />
    <line
      x1="34"
      y1="34"
      x2="34"
      y2="18"
      stroke="#f5c518"
      strokeWidth="3.5"
      strokeLinecap="round"
    />
    {/* Pivot center dot */}
    <circle cx="34" cy="34" r="2" fill="#f5c518" />
  </svg>
);

/**
 * Rising vertical report bars for Ulat ng Pinsala
 */
const DamageReportBars: React.FC<{ count: number }> = ({ count }) => {
  const barCount = Math.min(Math.max(count, 0), 5);
  if (barCount === 0) return null;

  // Rising heights for up to 5 bars
  const heights = [10, 16, 22, 28, 34];

  return (
    <div
      className="flex items-end gap-1 sm:gap-1.5 h-9 shrink-0 self-end mb-0.5"
      aria-hidden="true"
    >
      {Array.from({ length: barCount }).map((_, index) => (
        <span
          key={index}
          className="w-1.5 sm:w-2 bg-[#9b1c1c] rounded-t-sm transition-all"
          style={{ height: `${heights[index] ?? 10}px` }}
        />
      ))}
    </div>
  );
};

/**
 * Skeleton placeholder for KpiOverview that matches exact uneven layout and radii
 */
export const KpiOverviewSkeleton: React.FC<{ className?: string }> = ({
  className = "",
}) => {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-[2fr_1.5fr_1fr] lg:grid-cols-12 lg:grid-rows-[144px_100px] gap-3.5 ${className}`}
      role="status"
      aria-busy="true"
      aria-label="Ikinakarga ang mga datos ng dashboard..."
    >
      {/* 1. HERO SKELETON */}
      <div
        className="order-1 md:order-none md:col-span-3 lg:col-span-7 lg:row-span-2 min-h-[220px] lg:min-h-0 bg-[#0a3d2e] p-5 sm:p-6 rounded-tl-[24px] rounded-tr-[24px] rounded-br-[24px] rounded-bl-[68px] flex flex-col justify-between relative overflow-hidden"
      >
        <div className="space-y-3">
          <div className="h-3 w-36 bg-[#1f6b4d]/70 rounded-full animate-pulse" />
          <div className="h-14 w-28 bg-[#1f6b4d]/60 rounded-xl animate-pulse" />
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <div className="h-7 w-36 bg-[#f5c518]/30 rounded-full animate-pulse" />
          <div className="h-7 w-28 bg-[#1f6b4d]/60 rounded-full animate-pulse" />
        </div>
      </div>

      {/* 2. PINSALA SKELETON */}
      <div
        className="order-2 md:order-none md:col-start-2 md:row-start-2 lg:col-span-3 lg:col-start-8 lg:row-start-2 min-h-[100px] bg-[#fde8e8] border border-[#f0b4b4] p-4 rounded-[18px] flex items-center justify-between"
      >
        <div className="space-y-1.5">
          <div className="h-2.5 w-24 bg-red-200 rounded animate-pulse" />
          <div className="h-8 w-12 bg-red-300/80 rounded animate-pulse" />
        </div>
        <div className="flex items-end gap-1 h-8">
          <div className="w-1.5 h-3 bg-red-300 rounded animate-pulse" />
          <div className="w-1.5 h-5 bg-red-300 rounded animate-pulse" />
          <div className="w-1.5 h-7 bg-red-300 rounded animate-pulse" />
        </div>
      </div>

      {/* 3. ORAS NG TUGON SKELETON */}
      <div
        className="order-3 md:order-none md:col-start-1 md:row-start-2 lg:col-span-5 lg:col-start-8 lg:row-start-1 min-h-[144px] lg:min-h-0 bg-white border border-[#dde3d8] p-5 rounded-tl-[24px] rounded-tr-[24px] rounded-br-[68px] rounded-bl-[24px] flex items-center justify-between"
      >
        <div className="space-y-2.5">
          <div className="h-2.5 w-24 bg-slate-200 rounded animate-pulse" />
          <div className="h-9 w-24 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-2.5 w-20 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="w-12 h-12 rounded-full border-4 border-amber-200/60 animate-pulse" />
      </div>

      {/* 4. KONSULTASYON SKELETON */}
      <div
        className="order-4 md:order-none md:col-start-3 md:row-start-2 lg:col-span-2 lg:col-start-11 lg:row-start-2 min-h-[100px] border-2 border-dashed border-[#8fd3b0] p-3 rounded-tl-[999px] rounded-tr-[999px] rounded-br-[999px] rounded-bl-[18px] flex flex-col items-center justify-center space-y-1.5"
      >
        <div className="h-7 w-7 bg-emerald-100 rounded-full animate-pulse" />
        <div className="h-2.5 w-16 bg-emerald-100 rounded animate-pulse" />
      </div>
    </div>
  );
};

/**
 * KpiOverview Component for TarabayMais Dashboard
 * Implements the uneven, asymmetric grid layout matching DA Region II guidelines.
 * Compact and well-proportioned for dashboard usability.
 */
export const KpiOverview: React.FC<KpiOverviewProps> = ({
  activeHectares,
  farmCount,
  farmsDelta,
  avgResponseHours,
  responseDelta,
  damageReports,
  openConsultations,
  period = "30d",
  onPeriodChange,
  isLoading = false,
  error = null,
  className = "",
  showHeader = true,
  showPeriodToggle = false,
  caption = "Mga numero mula sa kasalukuyang dashboard ninyo. Ang hugis ng bukid ay pang-dekorasyon lang.",
}) => {
  const periodLabel = getPeriodLabel(period);
  const headingText = getPeriodHeading(period);

  const formattedFarmsDelta = formatDelta(farmsDelta, periodLabel);
  const formattedResponseDelta = formatDelta(responseDelta);

  const hoursDisplay = formatHours(avgResponseHours);

  return (
    <section
      aria-label="Pangunahing bilang"
      className={`w-full ${className}`}
    >
      {/* SECTION HEADER (Clean & compact) */}
      {showHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5 sm:mb-3">
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
            {headingText}
          </h2>

          {showPeriodToggle && (
            <nav
              aria-label="Piliin ang panahon ng estadistika"
              className="flex items-center gap-1 bg-white border border-slate-200/90 rounded-full p-0.5 shadow-2xs self-start sm:self-auto"
            >
              {(["7d", "30d", "season"] as const).map((p) => {
                const isActive = period === p;
                const buttonText =
                  p === "7d" ? "7 araw" : p === "30d" ? "30 araw" : "Season";
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onPeriodChange?.(p)}
                    className={`px-3 py-0.5 text-xs font-bold rounded-full transition-colors cursor-pointer ${
                      isActive
                        ? "bg-[#d1fae5] text-[#064e3b] shadow-2xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                    aria-pressed={isActive}
                  >
                    {buttonText}
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      )}

      {/* Visually hidden heading for screen readers if visible header is hidden */}
      {!showHeader && (
        <h2 className="sr-only">Pangunahing bilang at estadistika</h2>
      )}

      {/* INLINE ERROR ALERT (accessible, non-intrusive) */}
      {error && (
        <div
          role="alert"
          className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm font-semibold flex items-center gap-2"
        >
          <span className="font-bold text-amber-700">Pansin:</span>
          <span>
            {typeof error === "string"
              ? error
              : error?.message ?? "Hindi ma-load ang ilang datos ng dashboard."}
          </span>
        </div>
      )}

      {/* SKELETON STATE */}
      {isLoading ? (
        <KpiOverviewSkeleton />
      ) : (
        /* ASYMMETRIC GRID (Compact, balanced proportions) */
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1.5fr_1fr] lg:grid-cols-12 lg:grid-rows-[144px_100px] gap-3.5">
          {/* ═════════════════════════════════════════════════════════════════
              1. HERO: AKTIBONG TANIMAN NG MAIS
              Desktop: Columns 1-7, Rows 1-2 (Spans both rows: ~258px height)
              Mobile: order-1
          ═════════════════════════════════════════════════════════════════ */}
          <article
            className="order-1 md:order-none md:col-span-3 lg:col-span-7 lg:row-span-2 min-h-[220px] lg:min-h-0 bg-[#0a3d2e] text-white p-5 sm:p-6 rounded-tl-[24px] rounded-tr-[24px] rounded-br-[24px] rounded-bl-[68px] relative overflow-hidden flex flex-col justify-between shadow-xs select-none"
          >
            {/* Right side decorative cornfield SVG */}
            <div
              className="absolute right-[-8px] top-[-8px] bottom-[-8px] w-[50%] max-w-[340px] pointer-events-none select-none flex items-center justify-end"
              aria-hidden="true"
            >
              <CornfieldIllustration />
            </div>

            {/* Top label */}
            <div className="relative z-10">
              <p className="text-xs font-bold tracking-[0.08em] uppercase text-[#bfe8d3]">
                Aktibong Taniman ng Mais
              </p>

              {/* Giant number */}
              <div className="mt-2 sm:mt-2.5 flex items-baseline">
                <span
                  className="text-[54px] sm:text-[64px] lg:text-[76px] font-extrabold leading-[0.88] tracking-tight text-white drop-shadow-xs"
                  aria-label={`${activeHectares} ektarya ng aktibong taniman`}
                >
                  {activeHectares}
                </span>
                <span
                  className="text-2xl lg:text-[26px] font-bold text-[#f5c518] ml-1.5 leading-none"
                  aria-hidden="true"
                >
                  ha
                </span>
              </div>
            </div>

            {/* Bottom pills */}
            <div className="relative z-10 flex flex-wrap items-center gap-2 pt-2">
              {/* Solid yellow pill */}
              <span className="inline-flex items-center px-3 py-1 rounded-full font-bold text-xs bg-[#f5c518] text-[#0a3d2e] shadow-2xs">
                {farmCount} rehistradong sakahan
              </span>

              {/* Outlined delta pill with outline SVG arrow */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold text-xs border border-white/40 text-white backdrop-blur-[2px]">
                <DeltaTrendArrow
                  type={formattedFarmsDelta?.type ?? "neutral"}
                  className="w-3.5 h-3.5 shrink-0 stroke-current"
                />
                <span>
                  {formattedFarmsDelta
                    ? `${formattedFarmsDelta.text} ${periodLabel}`
                    : `+0 (0%) ${periodLabel}`}
                </span>
              </span>
            </div>
          </article>

          {/* ═════════════════════════════════════════════════════════════════
              2. ULAT NG PINSALA
              Desktop: Columns 8-10, Row 2 (Height 100px)
              Tablet: Column 2 in row 2 (width 1.5fr)
              Mobile: order-2 (directly under hero)
          ═════════════════════════════════════════════════════════════════ */}
          <article
            className="order-2 md:order-none md:col-start-2 md:row-start-2 lg:col-span-3 lg:col-start-8 lg:row-start-2 min-h-[100px] bg-[#fde8e8] border border-[#f0b4b4] p-3.5 sm:p-4 rounded-[18px] flex items-center justify-between shadow-2xs"
          >
            <div className="flex flex-col justify-between h-full py-0.5">
              <p className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-[#9b1c1c]/90">
                Ulat ng Pinsala
              </p>
              <div
                className="text-3xl sm:text-[38px] font-black leading-none text-[#9b1c1c] tracking-tight mt-0.5"
                aria-label={`${damageReports} ulat ng pinsala`}
              >
                {damageReports}
              </div>
            </div>

            {/* N small vertical rising bars */}
            <DamageReportBars count={damageReports} />
          </article>

          {/* ═════════════════════════════════════════════════════════════════
              3. ORAS NG TUGON
              Desktop: Columns 8-12, Row 1 (Height 144px)
              Tablet: Column 1 in row 2 (width 2fr)
              Mobile: order-3
          ═════════════════════════════════════════════════════════════════ */}
          <article
            className="order-3 md:order-none md:col-start-1 md:row-start-2 lg:col-span-5 lg:col-start-8 lg:row-start-1 min-h-[144px] lg:min-h-0 bg-white border border-[#dde3d8] p-4 sm:p-5 rounded-tl-[24px] rounded-tr-[24px] rounded-br-[68px] rounded-bl-[24px] flex items-center justify-between shadow-2xs"
          >
            <div className="flex flex-col justify-between h-full py-0.5">
              <div>
                <p className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Oras ng Tugon
                </p>
                <div className="flex items-baseline mt-1.5">
                  <span
                    className="text-3xl sm:text-[44px] font-black text-slate-900 leading-none tracking-tight"
                    aria-label={`${hoursDisplay} oras na karaniwang tugon`}
                  >
                    {hoursDisplay}
                  </span>
                  <span className="text-base sm:text-lg font-bold text-slate-500 ml-1.5 leading-none">
                    oras
                  </span>
                </div>
              </div>

              {/* Delta in orange (#b45309) with outline SVG arrow */}
              <div className="mt-1 text-xs sm:text-[13px] font-bold text-[#b45309] flex items-center gap-1.5">
                <DeltaTrendArrow
                  type={formattedResponseDelta?.type ?? "up"}
                  className="w-3.5 h-3.5 shrink-0 stroke-current"
                />
                <span>
                  {formattedResponseDelta?.text ?? "+27.4 (100%)"}
                </span>
              </div>
            </div>

            {/* Right side thin clock illustration */}
            <div className="pl-3">
              <ClockIllustration />
            </div>
          </article>

          {/* ═════════════════════════════════════════════════════════════════
              4. KONSULTASYON
              Desktop: Columns 11-12, Row 2 (Height 100px)
              Tablet: Column 3 in row 2 (width 1fr)
              Mobile: order-4
          ═════════════════════════════════════════════════════════════════ */}
          <article
            className={`order-4 md:order-none md:col-start-3 md:row-start-2 lg:col-span-2 lg:col-start-11 lg:row-start-2 min-h-[100px] p-3 rounded-tl-[999px] rounded-tr-[999px] rounded-br-[999px] rounded-bl-[18px] flex flex-col items-center justify-center text-center transition-colors shadow-2xs ${
              openConsultations > 0
                ? "bg-[#fdeccd] border-2 border-amber-300 text-[#7a3a04]"
                : "bg-transparent border-2 border-dashed border-[#8fd3b0] text-[#0a6b45]"
            }`}
          >
            <div
              className={`font-black leading-none tracking-tight ${
                openConsultations > 0
                  ? "text-3xl sm:text-4xl text-[#7a3a04]"
                  : "text-2xl sm:text-3xl text-[#0a6b45]"
              }`}
              aria-label={`${openConsultations} bukas na konsultasyon`}
            >
              {openConsultations}
            </div>
            <p
              className={`text-[11px] sm:text-xs font-bold mt-1 tracking-wide ${
                openConsultations > 0 ? "text-[#7a3a04]" : "text-[#0a6b45]"
              }`}
            >
              konsultasyon
            </p>
          </article>
        </div>
      )}

      {/* FOOTER CAPTION */}
      {caption && (
        <p className="mt-2 text-[11px] sm:text-xs text-slate-400 font-medium">
          {caption}
        </p>
      )}
    </section>
  );
};
