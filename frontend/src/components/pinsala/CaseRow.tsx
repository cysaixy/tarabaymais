import React from "react";
import type { CaseItem } from "./types";
import { getDamageDotColor, getStatusChipStyle } from "./formatters";

export interface CaseRowProps {
  item: CaseItem;
  onSelect: (caseId: string) => void;
}

export const CaseRow: React.FC<CaseRowProps> = ({ item, onSelect }) => {
  const dotColor = getDamageDotColor(item.damageType);
  const chipStyle = getStatusChipStyle(item.status);

  return (
    <li role="listitem" className="list-none w-full">
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        aria-label={`Piliin ang Kaso Blg. ${item.caseNo}: ${item.damageType}, ${item.farmerName}`}
        className="w-full text-left bg-white border border-[#dde3d8] rounded-[16px] min-h-[60px] px-5 transition-colors hover:bg-[#fafbf9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f2a5c] focus-visible:ring-offset-2 cursor-pointer shadow-xs flex flex-col justify-center"
      >
        {/* Desktop View (>= 1024px) */}
        <div className="hidden lg:grid grid-cols-[70px_1fr_1.3fr_1.4fr_70px_96px] gap-3 items-center w-full text-[14px]">
          <span className="font-bold text-[#14213d]">Blg. {item.caseNo}</span>
          <span className="text-[#14213d] truncate font-medium">
            {item.farmerName}
          </span>
          <span className="text-[#4b5563] truncate">{item.barangay}</span>
          <div className="flex items-center gap-2 min-w-0">
            <span
              style={{ backgroundColor: dotColor }}
              className="w-2.5 h-2.5 rounded-full shrink-0"
              aria-hidden="true"
            />
            <span className="font-bold text-[#14213d] truncate">
              {item.damageType}
            </span>
          </div>
          <span className="font-bold text-[#14213d] whitespace-nowrap">
            {item.hectares} ha
          </span>
          <div className="flex justify-end">
            <span
              style={chipStyle}
              className="inline-flex items-center justify-center rounded-full px-3 py-1 text-[12px] font-extrabold leading-none select-none shrink-0"
            >
              {item.status}
            </span>
          </div>
        </div>

        {/* Mobile & Tablet View (< 1024px): 2-line layout */}
        <div className="flex lg:hidden flex-col justify-center gap-1.5 py-3 w-full">
          {/* Top line: Blg. + farmer + status chip */}
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-1.5 text-[14px] truncate min-w-0">
              <span className="font-bold text-[#14213d]">
                Blg. {item.caseNo}
              </span>
              <span className="text-[#4b5563]" aria-hidden="true">
                ·
              </span>
              <span className="font-bold text-[#14213d] truncate">
                {item.farmerName}
              </span>
            </div>
            <span
              style={chipStyle}
              className="inline-flex items-center justify-center rounded-full px-3 py-1 text-[12px] font-extrabold leading-none shrink-0 select-none"
            >
              {item.status}
            </span>
          </div>

          {/* Second line: barangay · damage · ha */}
          <div className="flex items-center gap-1.5 text-[13px] text-[#4b5563] truncate">
            <span className="truncate">{item.barangay}</span>
            <span aria-hidden="true">·</span>
            <span
              style={{ backgroundColor: dotColor }}
              className="w-2.5 h-2.5 rounded-full shrink-0"
              aria-hidden="true"
            />
            <span className="font-bold text-[#14213d] truncate">
              {item.damageType}
            </span>
            <span aria-hidden="true">·</span>
            <strong className="font-bold text-[#14213d] whitespace-nowrap">
              {item.hectares} ha
            </strong>
          </div>
        </div>
      </button>
    </li>
  );
};

