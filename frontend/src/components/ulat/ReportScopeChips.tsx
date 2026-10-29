import React from "react";
import type { ExportType } from "../../services/analytics.service";
import type { ReportScope } from "./types";

export interface ReportScopeChipsProps {
  scope: ReportScope;
  selectedReportType: ExportType;
}

export const ReportScopeChips: React.FC<ReportScopeChipsProps> = ({
  scope,
  selectedReportType,
}) => {
  const rowLabel =
    selectedReportType === "disaster-claims"
      ? `${scope.rowCount} kaso`
      : `${scope.rowCount} barangay`;

  const chips = [scope.barangayLabel, scope.rangeLabel, rowLabel];

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[14px] font-extrabold text-[#14213d]">
        2 · Sakop ng Ulat
      </p>
      <div
        aria-live="polite"
        aria-atomic="true"
        aria-label={`Sakop ng ulat: ${chips.join(", ")}`}
        className="flex flex-wrap gap-2"
      >
        {chips.map((chip) => (
          <span
            key={chip}
            className="inline-flex items-center px-[14px] py-[6px] rounded-full bg-[#eef3e8] text-[13px] font-bold text-[#14213d]"
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
};
