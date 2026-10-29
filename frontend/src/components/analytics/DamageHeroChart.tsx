import React from "react";

export interface DamageReportDatePoint {
  date: string;
  count: number;
}

export interface DamageHeroChartProps {
  data: DamageReportDatePoint[];
  totalReports: number;
  periodLabel?: string;
  isLoading?: boolean;
}

export const DamageHeroChartSkeleton: React.FC = () => (
  <div
    className="w-full bg-[#0a3d2e] rounded-tl-[28px] rounded-tr-[28px] rounded-br-[28px] rounded-bl-[88px] p-6 sm:p-7 min-h-[340px] flex flex-col justify-between"
    role="status"
    aria-busy="true"
    aria-label="Ikinakarga ang tsart ng pinsala..."
  >
    <div className="flex items-start justify-between">
      <div className="space-y-2">
        <div className="h-3 w-40 bg-[#1f6b4d]/70 rounded-full animate-pulse" />
        <div className="h-6 w-48 bg-[#1f6b4d]/60 rounded-xl animate-pulse" />
      </div>
      <div className="h-14 w-28 bg-[#1f6b4d]/60 rounded-2xl animate-pulse" />
    </div>
    <div className="h-48 w-full bg-[#1f6b4d]/40 rounded-xl animate-pulse mt-4" />
  </div>
);

/**
 * DamageHeroChart — Hero Area + Line Chart over Date timeline (Columns 1-8 of Row A)
 */
export const DamageHeroChart: React.FC<DamageHeroChartProps> = ({
  data,
  totalReports,
  periodLabel = "30 araw",
  isLoading = false,
}) => {
  if (isLoading) return <DamageHeroChartSkeleton />;

  const chartPoints: DamageReportDatePoint[] = data || [];
  const hasNoData = chartPoints.length === 0 || totalReports === 0;

  // Coordinate math for SVG Area Chart
  const svgWidth = 600;
  const svgHeight = 200;
  const padLeft = 40;
  const padRight = 30;
  const padTop = 20;
  const padBottom = 35;

  const innerWidth = svgWidth - padLeft - padRight;
  const innerHeight = svgHeight - padTop - padBottom;

  const maxVal = Math.max(...chartPoints.map((p) => p.count), 4);
  const yTicks = [0, Math.round(maxVal / 2), maxVal];

  const points = chartPoints.map((p, i) => {
    const x =
      padLeft +
      (chartPoints.length > 1
        ? (i / (chartPoints.length - 1)) * innerWidth
        : innerWidth / 2);
    const y =
      padTop + innerHeight - (maxVal > 0 ? (p.count / maxVal) * innerHeight : 0);
    return { x, y, date: p.date, count: p.count };
  });

  const lineD = points.reduce(
    (acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`,
    ""
  );

  const areaD =
    points.length > 0
      ? `${lineD} L ${points[points.length - 1].x} ${padTop + innerHeight} L ${
          points[0].x
        } ${padTop + innerHeight} Z`
      : "";

  return (
    <article
      className="w-full bg-[#0a3d2e] text-white rounded-tl-[28px] rounded-tr-[28px] rounded-br-[28px] rounded-bl-[88px] pt-6 px-6 sm:px-7 pb-5 shadow-xs flex flex-col justify-between"
      style={{ minHeight: "330px" }}
    >
      {/* HEADER ROW */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-[12px] font-bold tracking-[0.1em] uppercase text-[#bfe8d3]">
            Mga Ulat ng Pinsala · {periodLabel}
          </p>
          <h2 className="text-[18px] sm:text-[20px] font-extrabold text-white leading-tight mt-0.5">
            Paglipas ng Panahon
          </h2>
        </div>

        {/* BIG TOTAL PILL */}
        <div className="flex items-baseline self-start sm:self-auto shrink-0 leading-none">
          <span
            className="text-[52px] sm:text-[64px] font-black text-[#f5c518] leading-none tracking-tight"
            aria-label={`${totalReports} kabuuang ulat ng pinsala`}
          >
            {totalReports}
          </span>
          <span className="text-[16px] font-bold text-[#dff5e9] ml-1.5 leading-none">
            ulat
          </span>
        </div>
      </div>

      {/* CHART CONTAINER */}
      <div className="w-full h-[220px] relative mt-2 flex items-center justify-center">
        {hasNoData ? (
          <div className="text-center py-10">
            <p className="text-sm font-semibold text-[#bfe8d3]/80">
              Walang ulat sa panahong ito
            </p>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-full overflow-visible"
            role="img"
            aria-label={`Dayagram ng bilang ng ulat ng pinsala sa paglipas ng panahon mula ${chartPoints[0]?.date} hanggang ${chartPoints[chartPoints.length - 1]?.date}`}
          >
            <defs>
              <linearGradient id="damageHeroGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f5c518" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#f5c518" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines & Y-Axis Labels */}
            {yTicks.map((tickVal) => {
              const yPos =
                padTop +
                innerHeight -
                (maxVal > 0 ? (tickVal / maxVal) * innerHeight : 0);
              return (
                <g key={tickVal}>
                  <line
                    x1={padLeft}
                    y1={yPos}
                    x2={padLeft + innerWidth}
                    y2={yPos}
                    stroke="#2a6b53"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    opacity="0.8"
                  />
                  <text
                    x={padLeft - 12}
                    y={yPos + 4}
                    fill="#bfe8d3"
                    fontSize="12"
                    fontWeight="700"
                    textAnchor="end"
                  >
                    {tickVal}
                  </text>
                </g>
              );
            })}

            {/* Area Fill */}
            {areaD && <path d={areaD} fill="url(#damageHeroGrad)" />}

            {/* Line Curve */}
            {lineD && (
              <path
                d={lineD}
                fill="none"
                stroke="#f5c518"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Point Circles & X-Axis Labels */}
            {points.map((pt, idx) => (
              <g key={idx}>
                {/* Data Dot: r=6, fill #0a3d2e, stroke #f5c518 3px */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="6"
                  fill="#0a3d2e"
                  stroke="#f5c518"
                  strokeWidth="3"
                />

                {/* X-Axis Date Label */}
                <text
                  x={pt.x}
                  y={padTop + innerHeight + 22}
                  fill="#bfe8d3"
                  fontSize="12"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {pt.date}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>
    </article>
  );
};
