import React, { useMemo } from "react";
import type { CaseItem } from "./types";
import { getDamageBarColor, formatDamageType } from "./formatters";

export interface AffectedAreaPanelProps {
  cases: CaseItem[];
}

const DEFAULT_TYPES = [
  "Bagyo",
  "Baha",
  "Pagdami ng Peste",
  "Tagtuyot",
];

export const AffectedAreaPanel: React.FC<AffectedAreaPanelProps> = ({
  cases,
}) => {
  const { totalHectares, summaryList, maxHectares } = useMemo(() => {
    const total = cases.reduce((sum, c) => sum + (c.hectares || 0), 0);
    const roundedTotal = Math.round(total * 10) / 10;

    // Group hectares by mapped damage type
    const map = new Map<string, number>();

    // Initialize with default types if there are cases or if we want standard display
    DEFAULT_TYPES.forEach((t) => map.set(t, 0));

    cases.forEach((c) => {
      const type = formatDamageType(c.damageType);
      const curr = map.get(type) || 0;
      map.set(type, curr + (c.hectares || 0));
    });

    // Create summary list
    const list = Array.from(map.entries())
      .map(([damageType, ha]) => ({
        damageType,
        hectares: Math.round(ha * 10) / 10,
        fillColor: getDamageBarColor(damageType),
      }))
      // Filter out zero-hectare non-default types, or keep default types if cases exist
      .filter((item) => (cases.length > 0 ? item.hectares > 0 || DEFAULT_TYPES.includes(item.damageType) : true))
      .sort((a, b) => b.hectares - a.hectares);

    const max = Math.max(...list.map((item) => item.hectares), 0);

    return {
      totalHectares: roundedTotal,
      summaryList: list,
      maxHectares: max > 0 ? max : 1,
    };
  }, [cases]);

  return (
    <section
      aria-labelledby="affected-area-title"
      className="bg-[#0a3d2e] text-white rounded-[28px_28px_72px_28px] p-[24px_26px] flex flex-col gap-4 shadow-sm"
    >
      <div>
        <p
          id="affected-area-title"
          className="text-[12px] font-bold tracking-[0.1em] text-[#bfe8d3] uppercase"
        >
          APEKTADONG TANIMAN
        </p>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-[56px] sm:text-[64px] font-extrabold text-[#f5c518] leading-none">
            {totalHectares}
          </span>
          <span className="text-[18px] font-bold text-[#dff5e9]">ha</span>
        </div>
        <p className="text-[13px] text-[#bfe8d3] font-medium mt-1">
          sa {cases.length} kaso
        </p>
      </div>

      <div className="flex flex-col gap-3 pt-1">
        {summaryList.map((item) => {
          const widthPercent =
            totalHectares > 0 && maxHectares > 0
              ? Math.min(100, Math.max(0, (item.hectares / maxHectares) * 100))
              : 0;

          return (
            <div key={item.damageType} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[14px]">
                <span className="text-white font-medium">
                  {item.damageType}
                </span>
                <span className="text-white font-bold">
                  {item.hectares} ha
                </span>
              </div>
              {/* 10px tall track */}
              <div
                role="progressbar"
                aria-valuenow={item.hectares}
                aria-valuemin={0}
                aria-valuemax={maxHectares}
                aria-label={`${item.damageType}: ${item.hectares} ha`}
                className="h-[10px] w-full rounded-full bg-[#1d5a45] overflow-hidden"
              >
                <div
                  style={{
                    width: `${widthPercent}%`,
                    backgroundColor: item.fillColor,
                  }}
                  className="h-full rounded-full transition-all duration-300"
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

