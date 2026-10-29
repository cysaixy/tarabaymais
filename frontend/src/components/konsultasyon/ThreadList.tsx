import React from "react";
import { Phone } from "lucide-react";
import type { ConsultationItem } from "./types";
import { formatPhoneDisplay, toInternationalPhone } from "./phoneUtils";

export interface ThreadListProps {
  threads: ConsultationItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const ThreadList: React.FC<ThreadListProps> = ({
  threads,
  selectedId,
  onSelect,
}) => {
  return (
    <div
      role="list"
      aria-label="Mga thread ng konsultasyon"
      className="flex flex-row lg:flex-col gap-2.5 overflow-x-auto lg:overflow-visible no-scrollbar w-full pb-2 lg:pb-0"
    >
      {threads.map((item) => {
        const isSelected = item.id === selectedId;
        const farmerInitial = item.farmerName.trim().charAt(0).toUpperCase() || "M";
        const phoneFormatted = formatPhoneDisplay(item.phone);
        const intlPhone = toInternationalPhone(item.phone);
        const hasValidPhone = Boolean(intlPhone);

        const statusBg = item.status === "Sinagot" ? "#e8ebe4" : "#dde8ff";
        const statusText = item.status === "Sinagot" ? "#3d4653" : "#1b3f9a";

        if (isSelected) {
          return (
            <div
              key={item.id}
              role="listitem"
              onClick={() => onSelect(item.id)}
              className="bg-white border border-[#dde3d8] border-l-[6px] border-l-[#0a6b45] rounded-[24px_24px_24px_56px] p-[18px_20px] flex flex-col gap-2.5 shadow-xs cursor-pointer min-w-[280px] sm:min-w-[320px] lg:min-w-0 w-full transition-shadow shrink-0 lg:shrink select-none"
            >
              {/* Row 1: Avatar + Name + Status chip */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    aria-hidden="true"
                    className="w-10 h-10 rounded-full bg-[#d9f3e5] text-[#0a6b45] font-extrabold text-[16px] flex items-center justify-center shrink-0"
                  >
                    {farmerInitial}
                  </div>
                  <span className="text-[17px] font-extrabold text-[#14213d] truncate">
                    {item.farmerName}
                  </span>
                </div>
                <span
                  style={{ backgroundColor: statusBg, color: statusText }}
                  className="px-2.5 py-0.5 rounded-full text-[12px] font-extrabold shrink-0"
                >
                  {item.status}
                </span>
              </div>

              {/* Row 2: Phone number link */}
              <div>
                {hasValidPhone ? (
                  <a
                    href={`tel:${intlPhone}`}
                    aria-label={`Tawagan si ${item.farmerName} sa ${phoneFormatted}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 text-[18px] font-extrabold text-[#0a6b45] min-h-[44px] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0a6b45] rounded-md"
                  >
                    <Phone className="w-4 h-4 shrink-0 stroke-[2.5]" aria-hidden="true" />
                    <span>{phoneFormatted}</span>
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[16px] font-semibold text-[#6b7280] min-h-[44px]">
                    <Phone className="w-4 h-4 shrink-0 text-[#9ca3af]" aria-hidden="true" />
                    <span>{phoneFormatted}</span>
                  </span>
                )}
              </div>

              {/* Row 3: Subject */}
              <div className="text-[15px] font-semibold text-[#14213d] leading-snug">
                <p className="line-clamp-2">{item.subject}</p>
                {item.hasTechnicianRequest && (
                  <p className="text-[12px] font-bold text-[#b45309] mt-0.5">
                    hinihingi ang tulong ng LGU Technician
                  </p>
                )}
              </div>

              {/* Row 4: Barangay */}
              <p className="text-[13px] text-[#4b5563]">{item.barangay}</p>
            </div>
          );
        }

        // Other threads (compact)
        return (
          <div
            key={item.id}
            role="listitem"
            onClick={() => onSelect(item.id)}
            className="bg-white border border-[#dde3d8] rounded-[16px] p-[12px_16px] flex flex-col gap-1 shadow-2xs hover:bg-[#fafbf9] cursor-pointer min-w-[260px] sm:min-w-[280px] lg:min-w-0 w-full transition-colors shrink-0 lg:shrink select-none"
          >
            {/* Top: Name + status */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[15px] font-extrabold text-[#14213d] truncate">
                {item.farmerName}
              </span>
              <span
                style={{ backgroundColor: statusBg, color: statusText }}
                className="px-2.5 py-0.5 rounded-full text-[12px] font-extrabold shrink-0"
              >
                {item.status}
              </span>
            </div>

            {/* Phone link */}
            <div>
              {hasValidPhone ? (
                <a
                  href={`tel:${intlPhone}`}
                  aria-label={`Tawagan si ${item.farmerName} sa ${phoneFormatted}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 text-[15px] font-bold text-[#0a6b45] min-h-[44px] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0a6b45] rounded-md"
                >
                  <Phone className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" aria-hidden="true" />
                  <span>{phoneFormatted}</span>
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#6b7280] min-h-[44px]">
                  <Phone className="w-3.5 h-3.5 shrink-0 text-[#9ca3af]" aria-hidden="true" />
                  <span>{phoneFormatted}</span>
                </span>
              )}
            </div>

            {/* Subject one-line */}
            <p className="text-[13px] text-[#4b5563] truncate">
              {item.hasTechnicianRequest
                ? `Advice · hinihingi ang tulong ng LGU Technician`
                : item.subject}
            </p>
          </div>
        );
      })}
    </div>
  );
};

