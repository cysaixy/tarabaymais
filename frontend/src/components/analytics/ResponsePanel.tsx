import React from "react";

export interface WeeklyResponsePoint {
  weekLabel: string; // e.g. "L1", "L2", "L3", "L4"
  hours: number;
}

export interface ResponsePanelProps {
  data: WeeklyResponsePoint[];
  avgResponseHours: number;
  isLoading?: boolean;
}

export const ResponsePanelSkeleton: React.FC = () => (
  <div
    className="w-full bg-[#fff6d6] border border-[#ecd27a] rounded-tl-[28px] rounded-tr-[28px] rounded-br-[88px] rounded-bl-[28px] p-6 min-h-[330px] flex flex-col justify-between"
    role="status"
    aria-busy="true"
    aria-label="Ikinakarga ang oras ng tugon..."
  >
    <div className="space-y-3">
      <div className="h-3 w-44 bg-amber-200/80 rounded-full animate-pulse" />
      <div className="h-12 w-32 bg-amber-200/70 rounded-xl animate-pulse" />
    </div>
    <div className="flex items-end justify-between gap-3 h-36 pt-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex-1 bg-amber-300/60 rounded-t-xl animate-pulse h-28" />
      ))}
    </div>
  </div>
);

/**
 * ResponsePanel — Oras ng Tugon bawat Linggo with 4 rounded bars & dashed avg line (Columns 9-12 of Row A)
 */
export const ResponsePanel: React.FC<ResponsePanelProps> = ({
  data,
  avgResponseHours,
  isLoading = false,
}) => {
  if (isLoading) return <ResponsePanelSkeleton />;

  const weeklyBars: WeeklyResponsePoint[] =
    data && data.length > 0
      ? data.slice(0, 4)
      : [
          { weekLabel: "L1", hours: avgResponseHours },
          { weekLabel: "L2", hours: avgResponseHours },
          { weekLabel: "L3", hours: avgResponseHours },
          { weekLabel: "L4", hours: avgResponseHours },
        ];

  // SVG Chart Dimensions
  const svgWidth = 260;
  const svgHeight = 120;
  const maxHours = Math.max(...weeklyBars.map((b) => b.hours), avgResponseHours, 10);
  const chartHeight = 85;

  const barWidth = 32;
  const gap = (svgWidth - barWidth * 4) / 5;

  // Average line position
  const avgLineY = chartHeight - (avgResponseHours / maxHours) * chartHeight;

  return (
    <article
      className="w-full bg-[#fff6d6] border border-[#ecd27a] rounded-tl-[28px] rounded-tr-[28px] rounded-br-[88px] rounded-bl-[28px] p-6 sm:p-7 flex flex-col justify-between shadow-2xs"
      style={{ minHeight: "330px" }}
    >
      {/* HEADER */}
      <div>
        <p className="text-[12px] font-bold tracking-[0.1em] uppercase text-[#6b5300]">
          Oras ng Tugon · Bawat Linggo
        </p>
        <div className="flex items-baseline mt-2">
          <span
            className="text-[44px] sm:text-[48px] font-black text-slate-900 leading-none tracking-tight"
            aria-label={`${avgResponseHours.toFixed(1)} oras karaniwang tugon`}
          >
            {avgResponseHours.toFixed(1)}
          </span>
          <span className="text-[16px] font-bold text-slate-600 ml-1.5 leading-none">
            oras avg
          </span>
        </div>
      </div>

      {/* WEEKLY BARS CHART WITH DASHED AVERAGE LINE */}
      <div className="w-full mt-4 flex items-center justify-center">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full max-w-[280px] h-[130px] overflow-visible"
          role="img"
          aria-label={`Oras ng tugon bawat linggo mula L1 hanggang L4 na may karaniwang ${avgResponseHours.toFixed(1)} oras`}
        >
          {/* Dashed Horizontal Average Line (#14213d, 2px, dashes 6 5) */}
          <line
            x1="0"
            y1={Math.max(avgLineY, 5)}
            x2={svgWidth}
            y2={Math.max(avgLineY, 5)}
            stroke="#14213d"
            strokeWidth="2"
            strokeDasharray="6 5"
          />

          {/* 4 Weekly Bars (#d99a1d, rx 8) */}
          {weeklyBars.map((bar, idx) => {
            const x = gap + idx * (barWidth + gap);
            const bHeight = Math.max(
              (bar.hours / maxHours) * chartHeight,
              12
            );
            const y = chartHeight - bHeight;

            return (
              <g key={bar.weekLabel}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={bHeight}
                  rx="8"
                  fill="#d99a1d"
                />
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + 20}
                  fill="#4b5563"
                  fontSize="12"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {bar.weekLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </article>
  );
};
