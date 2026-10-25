/**
 * TopIssuesChart — top pests/diseases horizontal bar chart.
 * Color-blind-safe, Tagalog labels.
 */

import React from "react";
interface TopIssue {
  diagnosis: string;
  count: number;
  avgSeverity: number;
}

interface TopIssuesChartProps {
  data: TopIssue[];
}

export const TopIssuesChart: React.FC<TopIssuesChartProps> = ({ data }) => {
  const sorted = [...data]
    .filter((issue) => issue.diagnosis.trim() && Number.isFinite(issue.count))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const maxCount = Math.max(...sorted.map((issue) => issue.count), 1);

  if (sorted.length === 0) {
    return (
      <div className="flex min-h-75 flex-col items-center justify-center">
        <p className="text-slate-500">Wala pang talaan ng pinsala o sakit.</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-75 space-y-3"
      role="list"
      aria-label="Mga pinsala o sakit sa pananim"
    >
      {sorted.map((issue) => {
        const barWidth = Math.max((issue.count / maxCount) * 100, 4);
        return (
          <div
            key={issue.diagnosis}
            role="listitem"
            className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2"
          >
            <p
              className="truncate text-xs font-semibold text-slate-700"
              title={issue.diagnosis}
            >
              {issue.diagnosis}
            </p>
            <div
              className="h-7 overflow-hidden rounded-md bg-slate-100"
              title={`${issue.count} kaso`}
            >
              <div
                className="flex h-full items-center rounded-md bg-emerald-600 px-2 text-xs font-bold text-white transition-[width]"
                style={{ width: `${barWidth}%`, minWidth: "2rem" }}
              >
                {issue.count}
              </div>
            </div>
            <span className="w-8 text-right text-xs font-bold tabular-nums text-slate-700">
              {issue.count}
            </span>
          </div>
        );
      })}
    </div>
  );
};
