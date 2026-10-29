import React from "react";
import { Download, Loader2 } from "lucide-react";
import type { ExportFormat } from "../../services/analytics.service";

export interface DownloadButtonsProps {
  onDownload: (format: ExportFormat) => Promise<void>;
  isDownloading: boolean;
  downloadSuccess: boolean;
  downloadError: string | null;
  rowCount: number;
}

export const DownloadButtons: React.FC<DownloadButtonsProps> = ({
  onDownload,
  isDownloading,
  downloadSuccess,
  downloadError,
  rowCount,
}) => {
  const isEmpty = rowCount === 0;
  const isDisabled = isDownloading || isEmpty;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] font-extrabold text-[#14213d]">3 · Format</p>

      {/* Buttons row */}
      <div className="flex flex-col md:flex-row flex-wrap gap-3">
        {/* Excel */}
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => onDownload("xlsx")}
          aria-label="I-download ang ulat bilang Excel"
          className={`flex-[3] min-w-[200px] sm:min-w-[200px] min-h-[60px] rounded-[16px] flex items-center justify-center gap-2.5 text-[16px] font-extrabold transition select-none ${
            isDisabled
              ? "bg-[#e8ebe4] text-[#6b7280] cursor-not-allowed"
              : "bg-[#0a6b45] text-white hover:bg-[#085336] active:scale-[0.99] cursor-pointer shadow-xs"
          }`}
        >
          {isDownloading ? (
            <Loader2 className="w-[18px] h-[18px] animate-spin shrink-0" aria-hidden="true" />
          ) : (
            <Download className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
          )}
          <span>{isDownloading ? "Inihahanda..." : "Excel (.xlsx)"}</span>
        </button>

        {/* CSV */}
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => onDownload("csv")}
          aria-label="I-download ang ulat bilang CSV"
          className={`flex-[2] min-w-[160px] min-h-[60px] rounded-[16px] flex items-center justify-center gap-2.5 text-[16px] font-extrabold transition select-none border-2 ${
            isDisabled
              ? "border-[#c8d0c2] text-[#6b7280] bg-white cursor-not-allowed"
              : "border-[#0a6b45] text-[#0a6b45] bg-white hover:bg-[#e9f8ef] active:scale-[0.99] cursor-pointer"
          }`}
        >
          {isDownloading ? (
            <Loader2 className="w-[18px] h-[18px] animate-spin shrink-0" aria-hidden="true" />
          ) : (
            <Download className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
          )}
          <span>{isDownloading ? "Inihahanda..." : "CSV"}</span>
        </button>
      </div>

      {/* Status messages */}
      <div aria-live="polite" aria-atomic="true" className="min-h-[20px]">
        {isEmpty && !isDownloading && (
          <p className="text-[13px] font-semibold text-[#6b7280]">
            Walang laman ang ulat sa napiling filter.
          </p>
        )}
        {downloadSuccess && !isDownloading && (
          <p className="text-[13px] font-bold text-[#0a6b45]">
            Na-download na ang ulat
          </p>
        )}
        {downloadError && !isDownloading && (
          <p className="text-[13px] font-bold text-[#9b1c1c]">
            {downloadError}
          </p>
        )}
      </div>
    </div>
  );
};
