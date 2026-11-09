import React, { useState } from "react";
import { Check, Loader2, Camera, ExternalLink } from "lucide-react";
import type { CaseItem } from "./types";
import { getStatusChipStyle } from "./formatters";
import { InspectionPhotoUpload } from "./InspectionPhotoUpload";
import { uploadDisasterPhotos } from "../../services/case.service";

export interface SelectedCaseCardProps {
  selectedCase: CaseItem;
  onVerify: (caseId: string) => void;
  /** Called when moving Na-verify -> Aksyon */
  onAction: (caseId: string) => void;
  /** Called when moving Aksyon -> Resolved */
  onResolve: (caseId: string) => void;
  /** @deprecated Legacy alias for onAction – kept for backward compat */
  onApprove?: (caseId: string) => void;
  isVerifying?: boolean;
  isApproving?: boolean;
}

const STEPS = [
  { num: 1, label: "Naisumite", statusKey: "Bago" },
  { num: 2, label: "Sinusuri", statusKey: "Sinusuri" },
  { num: 3, label: "Na-verify sa bukid", statusKey: "Na-verify" },
  { num: 4, label: "Aksyon", statusKey: "Aksyon" },
  { num: 5, label: "Resolved", statusKey: "Resolved" },
] as const;

const STATUS_ORDER: Record<string, number> = {
  Bago: 1,
  Sinusuri: 2,
  "Na-verify": 3,
  Aksyon: 4,
  Resolved: 5,
};

export const SelectedCaseCard: React.FC<SelectedCaseCardProps> = ({
  selectedCase,
  onVerify,
  onAction,
  onResolve,
  onApprove,
  isVerifying = false,
  isApproving = false,
}) => {
  const currentStepNum = STATUS_ORDER[selectedCase.status] || 1;
  const chipStyle = getStatusChipStyle(selectedCase.status);

  const isAlreadyVerified =
    selectedCase.status === "Na-verify" ||
    selectedCase.status === "Aksyon" ||
    selectedCase.status === "Resolved";
  const isAlreadyResolved = selectedCase.status === "Resolved";

  const isVerifyDisabled = isAlreadyVerified || isVerifying || isApproving;
  const isApproveDisabled = isAlreadyResolved || isApproving || isVerifying;

  const isAwaitingVerification = !isAlreadyVerified;
  const isAwaitingAction = selectedCase.status === "Na-verify";
  const isAwaitingResolve = selectedCase.status === "Aksyon";

  // -- Photo upload state (inspection proof) ---------------------------------
  const [inspectionFiles, setInspectionFiles] = useState<File[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const handlePrimaryAction = async () => {
    // Upload inspection photos first (non-fatal if it fails)
    if (inspectionFiles.length > 0) {
      setUploadingPhotos(true);
      try {
        await uploadDisasterPhotos(selectedCase.id, inspectionFiles);
      } catch {
        // Non-fatal: continue with status update
      } finally {
        setUploadingPhotos(false);
      }
    }

    // Route to correct handler based on current status
    if (isAwaitingResolve) {
      onResolve(selectedCase.id);
    } else {
      // isAwaitingAction or other: move to Aksyon
      const actionHandler = onAction || onApprove;
      if (actionHandler) actionHandler(selectedCase.id);
    }
  };

  const isActionBusy = isApproving || uploadingPhotos;

  return (
    <article
      aria-labelledby="selected-case-title"
      className="bg-white border border-[#dde3d8] border-t-[6px] border-t-[#f5c518] rounded-[28px_28px_28px_72px] p-6 sm:p-7 flex flex-col gap-4 shadow-xs"
    >
      {/* Top Row */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <p className="text-[12px] font-bold tracking-widest text-[#4b5563] uppercase">
            NAPILING KASO &middot; BLG. {selectedCase.caseNo}
          </p>
          <h2
            id="selected-case-title"
            className="text-[26px] sm:text-[30px] font-extrabold text-[#14213d] leading-tight"
          >
            {selectedCase.damageType}
          </h2>
          <p className="text-[14px] text-[#4b5563] flex items-center flex-wrap gap-1.5">
            <span>{selectedCase.farmerName}</span>
            <span aria-hidden="true">&middot;</span>
            <span>{selectedCase.barangay}</span>
            <span aria-hidden="true">&middot;</span>
            <strong className="font-bold text-[#14213d]">
              {selectedCase.hectares} ha
            </strong>
          </p>
        </div>

        {/* Status chip */}
        <div className="self-start sm:self-auto shrink-0">
          <span
            style={chipStyle}
            className="inline-flex items-center justify-center rounded-full px-4 py-1.5 text-[13px] font-extrabold leading-none select-none"
          >
            {selectedCase.status}
          </span>
        </div>
      </div>

      {/* Step Row */}
      <ol
        aria-label="Proseso ng Kaso"
        className="grid grid-cols-2 md:flex md:flex-wrap items-center gap-3 sm:gap-5.5 py-1"
      >
        {STEPS.map((step) => {
          const isDone = step.num < currentStepNum;
          const isCurrent = step.num === currentStepNum;

          return (
            <li key={step.num} className="flex items-center gap-2.5">
              <div
                aria-hidden="true"
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[13px] font-bold select-none transition-colors ${
                  isDone
                    ? "bg-[#0a6b45] text-white"
                    : isCurrent
                      ? "bg-[#f5c518] text-[#0f2a5c]"
                      : "bg-white text-[#4b5563] border-2 border-[#c8d0c2]"
                }`}
              >
                {isDone ? (
                  <Check className="w-4 h-4 text-white stroke-3" />
                ) : (
                  step.num
                )}
              </div>
              <span
                className={`text-[13px] sm:text-[14px] leading-snug ${
                  isCurrent
                    ? "font-extrabold text-[#14213d]"
                    : isDone
                      ? "font-semibold text-[#14213d]"
                      : "font-semibold text-[#4b5563]"
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Note box (hidden if no note) */}
      {selectedCase.farmNote ? (
        <div className="bg-[#f4f6f2] rounded-[14px] p-[12px_16px] text-left">
          <p className="text-[13px] font-extrabold text-[#14213d] mb-1">
            Tala sa Sakahan
          </p>
          <p className="text-[14px] text-[#4b5563] leading-relaxed whitespace-pre-wrap">
            {selectedCase.farmNote}
          </p>
        </div>
      ) : null}

      {/* Existing inspection / farmer photos */}
      {selectedCase.photoUrls && selectedCase.photoUrls.length > 0 && (
        <div className="bg-[#f8faf7] border border-[#dde3d8] rounded-[16px] p-4 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-extrabold text-[#14213d] flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-[#0a6b45]" aria-hidden="true" />
              <span>Mga Larawan ng Patunay mula sa Bukid</span>
              <span className="text-[12px] font-semibold text-[#0a6b45] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                {selectedCase.photoUrls.length} larawan
              </span>
            </p>
            <span className="text-[11px] text-[#6b7280]">I-click upang palakihin</span>
          </div>
          <div className="flex flex-wrap gap-2.5 pt-1">
            {selectedCase.photoUrls.map((url, idx) => (
              <a
                key={idx}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                title={`Buksan ang larawan blg. ${idx + 1}`}
                className="group relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-[#c8d0c2] hover:border-[#0a6b45] shadow-xs block transition-all hover:scale-105 active:scale-95"
              >
                <img
                  src={url}
                  alt={`Larawan ng pinsala ${idx + 1}`}
                  className="w-full h-full object-cover group-hover:brightness-95 transition"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                  <span className="text-white text-[11px] font-bold bg-black/70 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />
                    <span>Tingnan</span>
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Inspection photo upload: shown when status is Na-verify (Aksyon) or Aksyon (Resolved) */}
      {(isAwaitingAction || isAwaitingResolve) && (
        <div className="bg-[#f0fdf4] border border-[#a3e2c3] rounded-[14px] p-[14px_16px]">
          <InspectionPhotoUpload
            title="Larawan ng Inspeksyon sa Bukid"
            existingUrls={selectedCase.photoUrls ?? []}
            onFilesChange={setInspectionFiles}
            disabled={isActionBusy}
            maxPhotos={3}
          />
          <p className="text-[11px] text-[#4b5563] font-semibold mt-2 leading-snug">
            Magdagdag ng larawan bilang patunay ng inspeksyon sa bukid bago
            markahan bilang <strong>{isAwaitingResolve ? "Resolved" : "Aksyon"}</strong>.
          </p>
        </div>
      )}

      {/* Buttons row */}
      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <button
          type="button"
          disabled={isVerifyDisabled}
          onClick={() => onVerify(selectedCase.id)}
          aria-label={`I-verify sa bukid ang kaso blg. ${selectedCase.caseNo}`}
          className={`min-h-13 sm:flex-1 rounded-[14px] px-6 text-[15px] font-extrabold flex items-center justify-center gap-2 transition select-none ${
            isVerifyDisabled
              ? "bg-[#e8ebe4] text-[#6b7280] border border-[#c8d0c2] cursor-not-allowed"
              : isAwaitingVerification
                ? "bg-[#0a6b45] text-white hover:bg-[#085336] active:scale-[0.99] cursor-pointer shadow-xs"
                : "bg-white text-[#0a6b45] border border-[#0a6b45] hover:bg-emerald-50 active:scale-[0.99] cursor-pointer"
          }`}
        >
          {isVerifying ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : isAlreadyVerified ? (
            <Check
              className="w-4 h-4 text-[#0a6b45] stroke-3"
              aria-hidden="true"
            />
          ) : null}
          <span>
            {isAlreadyVerified ? "Na-verify na sa Bukid" : "I-verify sa Bukid"}
          </span>
        </button>

        <button
          type="button"
          disabled={isApproveDisabled || isActionBusy}
          onClick={handlePrimaryAction}
          aria-label={`Markahan ang kaso blg. ${selectedCase.caseNo}`}
          className={`min-h-13 sm:flex-1 rounded-[14px] px-6 text-[15px] font-extrabold flex items-center justify-center gap-2 transition select-none ${
            isApproveDisabled
              ? "bg-[#d9f3e5] text-[#0a6b45] border border-[#a3e2c3] cursor-not-allowed"
              : isAwaitingResolve
                ? "bg-[#0a6b45] text-white hover:bg-[#085336] active:scale-[0.99] cursor-pointer shadow-xs"
                : isAwaitingAction
                  ? "bg-[#d97706] text-white hover:bg-[#b45309] active:scale-[0.99] cursor-pointer shadow-xs"
                  : "bg-[#0f2a5c] text-white hover:bg-[#1b3f9a] active:scale-[0.99] cursor-pointer shadow-xs"
          }`}
        >
          {isActionBusy ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : isAlreadyResolved ? (
            <Check
              className="w-4 h-4 text-[#0a6b45] stroke-3"
              aria-hidden="true"
            />
          ) : null}
          <span>
            {isAlreadyResolved
              ? "Resolved na"
              : isActionBusy
                ? "Ini-upload ang larawan..."
                : isAwaitingResolve
                  ? "Markahan bilang Resolved"
                  : "Markahan bilang Aksyon"}
          </span>
        </button>
      </div>
    </article>
  );
};
