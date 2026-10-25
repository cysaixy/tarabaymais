/**
 * DisasterLossChart — disaster reports & estimated loss bar chart.
 * groupBy toggle: barangay / buwan / uri.
 */

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipContentProps,
} from "recharts";

interface DisasterGroup {
  groupKey: string;
  count: number;
  totalEstimatedLoss: number;
}

interface DisasterLossChartProps {
  data: DisasterGroup[];
}

function isDisasterGroup(value: unknown): value is DisasterGroup {
  if (typeof value !== "object" || value === null) return false;

  const group = value as Partial<DisasterGroup>;
  return (
    typeof group.groupKey === "string" &&
    typeof group.count === "number" &&
    typeof group.totalEstimatedLoss === "number"
  );
}

const tooltipContent = ({ active, payload }: TooltipContentProps) => {
  const entry = payload?.[0]?.payload;

  if (active && isDisasterGroup(entry)) {
    return (
      <div className="p-2 text-sm">
        <p className="font-bold text-slate-900">{entry.groupKey}</p>
        <p>{entry.count} ulat</p>
        <p>
          &#8369;{" "}
          {entry.totalEstimatedLoss.toLocaleString(undefined, {
            maximumFractionDigits: 0,
          })}{" "}
          lugi
        </p>
      </div>
    );
  }

  return null;
};

export const DisasterLossChart: React.FC<DisasterLossChartProps> = ({
  data,
}) => {
  const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, 8);

  if (sorted.length === 0) {
    return (
      <div className="h-75 flex flex-col items-center justify-center">
        <p className="text-slate-500">Wala pang ulat ng pinsala.</p>
      </div>
    );
  }

  return (
    <div className="h-75 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sorted}
          margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e2e8f0"
            vertical={false}
          />
          <XAxis
            dataKey="groupKey"
            tickLine={false}
            axisLine={false}
            fontSize={11}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={11}
            tickFormatter={(v) => String(Math.round(Number(v)))}
          />
          <Tooltip content={tooltipContent} />
          <Bar dataKey="count" fill="#dc2626" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
