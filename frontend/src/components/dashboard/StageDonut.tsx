/**
 * StageDonut — crop stage distribution donut chart.
 * Color-blind-safe palette, Tagalog stage labels.
 */

import React from "react";
import {
  PieChart,
  Pie,
  Tooltip,
  Cell,
  ResponsiveContainer,
  type PieLabelRenderProps,
  type TooltipContentProps,
} from "recharts";
import {
  GROWTH_STAGE_TAGALOG,
  GROWTH_STAGE_COLORS,
} from "../../lib/growthStageLabels";

interface StageDonutProps {
  stages: Record<string, { farmCount: number; totalAreaHectares: number }>;
}

const STAGE_ORDER = [
  "SEEDLING",
  "VEGETATIVE",
  "TASSELING",
  "SILKING",
  "GRAIN_FILL",
  "HARVEST_READY",
] as const;

export const StageDonut: React.FC<StageDonutProps> = ({ stages }) => {
  const data = STAGE_ORDER.map((stage) => ({
    name: GROWTH_STAGE_TAGALOG[stage],
    value: stages[stage]?.farmCount ?? 0,
  }));

  const total = data.reduce((s, d) => s + d.value, 0);
  const CUSTOM_COLORS = STAGE_ORDER.map((s) => GROWTH_STAGE_COLORS[s]);

  const tooltipContent = ({ active, payload }: TooltipContentProps) => {
    const entry = payload?.[0]?.payload;

    if (
      active &&
      typeof entry === "object" &&
      entry !== null &&
      typeof entry.name === "string" &&
      typeof entry.value === "number"
    ) {
      const pct = total > 0 ? ((entry.value / total) * 100).toFixed(0) : "0";
      return (
        <div className="p-2 text-sm">
          <p className="font-bold">{entry.name}</p>
          <p>
            {entry.value} sakahan ({pct}%)
          </p>
        </div>
      );
    }

    return null;
  };

  if (total === 0) {
    return (
      <div className="h-75 flex flex-col items-center justify-center">
        <p className="text-slate-500">Wala pang datos ng yugto ng taniman.</p>
      </div>
    );
  }

  return (
    <div className="h-75 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={90}
            labelLine={false}
            label={({ name, percent }: PieLabelRenderProps) => {
              const pct = total > 0 ? Math.round((percent ?? 0) * 100) : 0;
              return typeof name === "string" && pct > 5
                ? `${name} ${pct}%`
                : null;
            }}
          >
            {data.map((_entry, _index) => (
              <Cell key={`cell-${_index}`} fill={CUSTOM_COLORS[_index]} />
            ))}
          </Pie>
          <Tooltip content={tooltipContent} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 flex justify-center gap-3 text-[12px]">
        {data.map((d) => (
          <span
            key={d.name}
            className="flex items-center gap-1.5 whitespace-nowrap"
          >
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor:
                  GROWTH_STAGE_COLORS[STAGE_ORDER[data.indexOf(d)]],
              }}
            />
            <span className="text-slate-600 font-medium">
              {d.name} ({d.value})
            </span>
          </span>
        ))}
      </div>
    </div>
  );
};
