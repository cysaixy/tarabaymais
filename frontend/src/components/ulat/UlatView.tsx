import React from "react";
import type { UlatViewProps } from "./types";
import { ReportTypePicker } from "./ReportTypePicker";
import { ReportScopeChips } from "./ReportScopeChips";
import { DownloadButtons } from "./DownloadButtons";
import { FarmDistributionPanel } from "./FarmDistributionPanel";
import { UlatViewSkeleton } from "./UlatSkeletons";

export type { UlatViewProps };

export const UlatView: React.FC<UlatViewProps> = ({
  selectedReportType,
  onSelectReportType,
  scope,
  onDownload,
  isDownloading,
  downloadSuccess,
  downloadError,
  municipality,
  barangays,
  barangaysLoading,
  barangaysError,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div
        style={{
          backgroundColor: "#f4f6f2",
          fontFamily:
            "Figtree, Atkinson Hyperlegible, Inter, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
        className="min-h-full w-full p-6 text-[#14213d]"
      >
        <div className="mx-auto max-w-[1152px] w-full flex flex-col gap-4">
          <h1 className="text-[28px] font-extrabold text-[#14213d] tracking-tight leading-none">
            Ulat
          </h1>
          <UlatViewSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "#f4f6f2",
        fontFamily:
          "Figtree, Atkinson Hyperlegible, Inter, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
      className="min-h-full w-full p-6 text-[#14213d]"
    >
      <div className="mx-auto max-w-[1152px] w-full flex flex-col gap-4">
        {/* Header */}
        <header>
          <h1 className="text-[28px] font-extrabold text-[#14213d] tracking-tight leading-none">
            Ulat
          </h1>
        </header>

        {/* Main 12-col grid */}
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 items-start w-full">
          {/* ── LEFT: Report Builder (cols 1-7) ── */}
          <article
            aria-label="Tagagawa ng Ulat"
            className="w-full lg:col-span-7 bg-white border border-[#dde3d8] rounded-[28px_28px_28px_72px] p-[26px_30px] flex flex-col gap-5 shadow-xs"
          >
            {/* Top label + title */}
            <div className="flex flex-col gap-1">
              <p className="text-[12px] font-bold tracking-[0.1em] text-[#4b5563] uppercase">
                I-DOWNLOAD ANG ULAT
              </p>
              <h2 className="text-[22px] font-extrabold text-[#14213d] leading-snug">
                Pumili ng ulat para sa Cagayan
              </h2>
            </div>

            {/* Step 1: Report type */}
            <ReportTypePicker
              selected={selectedReportType}
              onChange={onSelectReportType}
            />

            {/* Divider */}
            <div className="border-t border-[#eef3e8]" aria-hidden="true" />

            {/* Step 2: Scope chips */}
            <ReportScopeChips
              scope={scope}
              selectedReportType={selectedReportType}
            />

            {/* Divider */}
            <div className="border-t border-[#eef3e8]" aria-hidden="true" />

            {/* Step 3: Download buttons */}
            <DownloadButtons
              onDownload={onDownload}
              isDownloading={isDownloading}
              downloadSuccess={downloadSuccess}
              downloadError={downloadError}
              rowCount={scope.rowCount}
            />
          </article>

          {/* ── RIGHT: Distribution Panel (cols 8-12) ── */}
          <div className="w-full lg:col-span-5">
            <FarmDistributionPanel
              municipality={municipality}
              barangays={barangays}
              isLoading={barangaysLoading}
              error={barangaysError}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
