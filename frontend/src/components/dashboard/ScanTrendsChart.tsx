/**
 * ScanTrendsChart — weekly healthy vs flagged scan trends.
 * Zero-filled weekly series (Monday, Asia/Manila). Area/line chart.
 */

import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  type TooltipContentProps,
} from "recharts";

interface ScanTrendPoint {
  weekStart: string;
  healthy: number;
  flagged: number;
}

interface ScanTrendsChartProps {
  data: ScanTrendPoint[];
}

function isScanTrendPoint(value: unknown): value is ScanTrendPoint {
  if (typeof value !== "object" || value === null) return false;

  const point = value as Partial<ScanTrendPoint>;
  return (
    typeof point.weekStart === "string" &&
    typeof point.healthy === "number" &&
    typeof point.flagged === "number"
  );
}

const tooltipContent = ({ active, payload }: TooltipContentProps) => {
  const entry = payload?.[0]?.payload;

  if (active && isScanTrendPoint(entry)) {
    return (
      <div className="p-2 text-sm">
        <p className="font-bold text-slate-900">{entry.weekStart}</p>
        <p className="text-emerald-600 font-semibold">
          Malusog: {entry.healthy}
        </p>
        <p className="text-rose-600 font-semibold">
          May Pinsala: {entry.flagged}
        </p>
      </div>
    );
  }

  return null;
};

export const ScanTrendsChart: React.FC<ScanTrendsChartProps> = ({ data }) => {
  const total = data.reduce((s, d) => s + d.healthy + d.flagged, 0);

  if (total === 0) {
    return (
      <div className="h-75 flex flex-col items-center justify-center">
        <p className="text-slate-500">Wala pang datos ng pagsusuri ng AI.</p>
      </div>
    );
  }

  return (
    <div className="h-75 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
        >
          <defs>
            <linearGradient id="colorHealthy" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#059669" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#059669" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorFlagged" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#dc2626" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e2e8f0"
            vertical={false}
          />
          <XAxis
            dataKey="weekStart"
            tickFormatter={(value) => String(value).slice(5)}
            tickLine={false}
            axisLine={false}
            fontSize={11}
            tickMargin={8}
            textAnchor="start"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={11}
            tickFormatter={(value) => String(Math.round(Number(value)))}
          />
          <Tooltip content={tooltipContent} />
          <Legend
            verticalAlign="top"
            align="right"
            height={36}
            formatter={(label: string) =>
              label === "healthy" ? "Malusog" : "May Pinsala"
            }
          />
          <Area
            type="monotone"
            dataKey="healthy"
            stroke="#059669"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorHealthy)"
            name="healthy"
          />
          <Area
            type="monotone"
            dataKey="flagged"
            stroke="#dc2626"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorFlagged)"
            name="flagged"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
