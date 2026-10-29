import React from "react";
import type { ExportType } from "../../services/analytics.service";
import type { ReportTypeOption } from "./types";

const REPORT_TYPES: ReportTypeOption[] = [
  {
    id: "disaster-claims",
    label: "Disaster Claims",
    description: "Pinsala sa Taniman · para sa mga kaso ng pinsala",
  },
  {
    id: "barangay-summary",
    label: "Buod ng Pinsala ayon sa Barangay",
    description: "Bilang ng mga ulat at tinatayang lugi kada barangay",
  },
];

export interface ReportTypePickerProps {
  selected: ExportType;
  onChange: (id: ExportType) => void;
}

export const ReportTypePicker: React.FC<ReportTypePickerProps> = ({
  selected,
  onChange,
}) => {
  return (
    <fieldset className="border-0 p-0 m-0 flex flex-col gap-3">
      <legend className="text-[14px] font-extrabold text-[#14213d] mb-2">
        1 · Uri ng Ulat
      </legend>

      {REPORT_TYPES.map((rt) => {
        const isSelected = rt.id === selected;
        return (
          <label
            key={rt.id}
            className={`flex items-center gap-4 cursor-pointer transition-all ${
              isSelected
                ? "min-h-[76px] px-5 py-[14px] border-2 border-[#0a6b45] rounded-[20px] bg-[#e9f8ef]"
                : "min-h-[56px] px-5 py-2 border border-[#c8d0c2] rounded-[14px] bg-white hover:bg-[#f4f6f2]"
            }`}
          >
            <input
              type="radio"
              name="reportType"
              value={rt.id}
              checked={isSelected}
              onChange={() => onChange(rt.id)}
              className="shrink-0 w-[22px] h-[22px] accent-[#0a6b45] cursor-pointer"
              aria-describedby={`desc-${rt.id}`}
            />
            <div className="flex flex-col min-w-0">
              <span
                className={`leading-snug ${
                  isSelected
                    ? "text-[17px] font-extrabold text-[#14213d]"
                    : "text-[15px] font-bold text-[#14213d]"
                }`}
              >
                {rt.label}
              </span>
              <span
                id={`desc-${rt.id}`}
                className="text-[13px] text-[#4b5563] leading-snug"
              >
                {rt.description}
              </span>
            </div>
          </label>
        );
      })}
    </fieldset>
  );
};
