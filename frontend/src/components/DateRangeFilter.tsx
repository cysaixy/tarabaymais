/**
 * DateRangeFilter — Reusable date filter for history pages
 * Options: Last 30 days / This Season / All Time / Custom
 */

import React, { useState } from "react";
import { Calendar, ChevronDown, X } from "lucide-react";

export type DateRangePreset = "30d" | "season" | "all" | "custom";

export interface DateRangeFilterProps {
  value: DateRangePreset;
  onChange: (value: DateRangePreset) => void;
  customRange?: { from: Date; to: Date } | null;
  onCustomChange?: (range: { from: Date; to: Date } | null) => void;
  className?: string;
}

const PRESETS: {
  value: DateRangePreset;
  label: string;
  description: string;
}[] = [
  {
    value: "30d",
    label: "Huling 30 Araw",
    description: "Kamakailang mga rekord",
  },
  {
    value: "season",
    label: "Itong Season",
    description: "Mula sa planting date ng napiling pananim",
  },
  { value: "all", label: "Lahat ng Panahon", description: "Buong kasaysayan" },
  { value: "custom", label: "Custom Range", description: "Piliin ang petsa" },
];

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  value,
  onChange,
  customRange,
  onCustomChange,
  className = "",
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [tempFrom, setTempFrom] = useState<string>("");
  const [tempTo, setTempTo] = useState<string>("");

  const currentPreset = PRESETS.find((p) => p.value === value) ?? PRESETS[2];

  const handlePresetClick = (preset: DateRangePreset) => {
    onChange(preset);
    setShowDropdown(false);
    if (preset !== "custom") {
      onCustomChange?.(null);
    } else {
      setShowCustomPicker(true);
    }
  };

  const handleCustomSubmit = () => {
    if (tempFrom && tempTo) {
      const from = new Date(tempFrom);
      const to = new Date(tempTo);
      to.setHours(23, 59, 59, 999);
      onCustomChange?.({ from, to });
      setShowCustomPicker(false);
      setShowDropdown(false);
    }
  };

  const handleCustomCancel = () => {
    onChange("all");
    onCustomChange?.(null);
    setShowCustomPicker(false);
    setShowDropdown(false);
    setTempFrom("");
    setTempTo("");
  };

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".date-range-filter")) {
        setShowDropdown(false);
        setShowCustomPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (showCustomPicker) {
    return (
      <div className={`relative inline-block date-range-filter ${className}`}>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-lg min-w-70 animate-fade-in z-10">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-slate-900">Piliin ang Petsa</h4>
            <button
              onClick={handleCustomCancel}
              className="p-1 text-slate-400 hover:text-slate-600"
              aria-label="Kanselahin"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mula
              </label>
              <input
                type="date"
                value={tempFrom}
                onChange={(e) => setTempFrom(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                max={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Hanggang
              </label>
              <input
                type="date"
                value={tempTo}
                onChange={(e) => setTempTo(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                max={new Date().toISOString().split("T")[0]}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCustomCancel}
              className="flex-1 py-2 rounded-xl border border-slate-200 bg-white font-bold text-sm text-slate-700 hover:bg-slate-50"
            >
              Kanselahin
            </button>
            <button
              onClick={handleCustomSubmit}
              className="flex-1 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700"
            >
              Gamitin
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative inline-block date-range-filter ${className}`}>
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown)}
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
          value === "all"
            ? "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
            : "bg-emerald-600 text-white shadow-sm"
        }`}
        aria-haspopup="listbox"
        aria-expanded={showDropdown}
      >
        <Calendar className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{currentPreset.label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 ${showDropdown ? "rotate-180" : ""}`}
        />
      </button>

      {showDropdown && (
        <div className="absolute right-0 top-full mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-lg py-1 min-w-50 animate-fade-in z-10">
          {PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => handlePresetClick(preset.value)}
              className={`w-full px-4 py-2.5 text-left text-xs font-medium transition ${
                value === preset.value
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
              role="option"
              aria-selected={value === preset.value}
            >
              <div className="font-bold">{preset.label}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {preset.description}
              </div>
            </button>
          ))}
        </div>
      )}

      {customRange && (
        <button
          type="button"
          onClick={() => onCustomChange?.(null)}
          className="ml-1.5 p-1.5 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 transition"
          aria-label="Alisin ang custom range"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

/**
 * Filter records by date range
 */
// This utility is intentionally co-located with the filter component.
// eslint-disable-next-line react-refresh/only-export-components
export function filterByDateRange<T extends { date: string }>(
  records: T[],
  preset: DateRangePreset,
  customRange?: { from: Date; to: Date } | null,
  plantingDate?: string,
): T[] {
  if (preset === "all" || !customRange) return records;

  const now = new Date();
  let from: Date;
  let to = new Date();
  to.setHours(23, 59, 59, 999);

  switch (preset) {
    case "30d":
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "season":
      if (plantingDate) {
        from = new Date(plantingDate);
      } else {
        from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // fallback 1 year
      }
      break;
    case "custom":
      from = customRange.from;
      to = customRange.to;
      break;
    default:
      return records;
  }

  return records.filter((record) => {
    const recordDate = new Date(record.date);
    return recordDate >= from && recordDate <= to;
  });
}
