import React from "react";
import type { FilterChipKey } from "./types";

export interface StatusChipsProps {
  selected: FilterChipKey;
  onSelect: (key: FilterChipKey) => void;
  counts: Record<FilterChipKey, number>;
}

const CHIP_KEYS: FilterChipKey[] = [
  "Lahat",
  "Bago",
  "Sinusuri",
  "Na-verify",
  "Aprubado",
];

export const StatusChips: React.FC<StatusChipsProps> = ({
  selected,
  onSelect,
  counts,
}) => {
  return (
    <div
      role="tablist"
      aria-label="Filter ayon sa katayuan ng kaso"
      className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar w-full"
    >
      {CHIP_KEYS.map((key) => {
        const isActive = selected === key;
        const count = counts[key] ?? 0;

        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(key)}
            className={`inline-flex items-center gap-1.5 shrink-0 min-h-[44px] px-4 rounded-full text-[14px] font-bold transition-colors cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f2a5c] focus-visible:ring-offset-2 ${
              isActive
                ? "bg-[#0f2a5c] text-white shadow-xs"
                : "bg-white text-[#14213d] border border-[#c8d0c2] hover:bg-slate-50"
            }`}
          >
            <span>{key}</span>
            <span
              className={`text-[14px] font-extrabold opacity-80 ${
                isActive ? "text-white" : "text-[#14213d]"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
};

