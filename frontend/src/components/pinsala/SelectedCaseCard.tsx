import React from "react";
import { Check, Loader2 } from "lucide-react";
import type { CaseItem } from "./types";
import { getStatusChipStyle } from "./formatters";

export interface SelectedCaseCardProps {
  selectedCase: CaseItem;
  onVerify: (caseId: string) => void;
  onApprove: (caseId: string) => void;
  onRequestDoc?: (selectedCase: CaseItem) => void;
  isVerifying?: boolean;
  isApproving?: boolean;
}

const STEPS = [
  { num: 1, label: "Naisumite", statusKey: "Bago" },
  { num: 2, label: "Sinusuri", statusKey: "Sinusuri" },
  { num: 3, label: "Na-verify sa bukid", statusKey: "Na-verify" },
  { num: 4, label: "Aprubado", statusKey: "Aprubado" },
] as const;

const STATUS_ORDER: Record<string, number> = {
  Bago: 1,
  Sinusuri: 2,
  "Na-verify": 3,
  Aprubado: 4,
};

export const SelectedCaseCard: React.FC<SelectedCaseCardProps> = ({
  selectedCase,
  onVerify,
  onApprove,
  isVerifying = false,
  isApproving = false,
}) => {
  const currentStepNum = STATUS_ORDER[selectedCase.status] || 1;
  const chipStyle = getStatusChipStyle(selectedCase.status);

  const isAlreadyVerified =
    selectedCase.status === "Na-verify" || selectedCase.status === "Aprubado";
  const isAlreadyApproved = selectedCase.status === "Aprubado";

  const isVerifyDisabled = isAlreadyVerified || isVerifying || isApproving;
  const isApproveDisabled = isAlreadyApproved || isApproving || isVerifying;

  const isAwaitingVerification = !isAlreadyVerified;
  const isAwaitingApproval =
    selectedCase.status === "Na-verify" && !isAlreadyApproved;

  return (
    <article
      aria-labelledby="selected-case-title"
      className="bg-white border border-[#dde3d8] border-t-[6px] border-t-[#f5c518] rounded-[28px_28px_28px_72px] p-6 sm:p-7 flex flex-col gap-4 shadow-xs"
    >
      {/* Top Row */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <p className="text-[12px] font-bold tracking-[0.1em] text-[#4b5563] uppercase">
            NAPILING KASO · BLG. {selectedCase.caseNo}
          </p>
          <h2
            id="selected-case-title"
            className="text-[26px] sm:text-[30px] font-extrabold text-[#14213d] leading-tight"
          >
            {selectedCase.damageType}
          </h2>
          <p className="text-[14px] text-[#4b5563]">
            <span>{selectedCase.farmerName}</span>
            <span className="mx-1.5" aria-hidden="true">
              ·
            </span>
            <span>{selectedCase.barangay}</span>
            <span className="mx-1.5" aria-hidden="true">
              ·
            </span>
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
        className="grid grid-cols-2 md:flex md:flex-wrap items-center gap-3 sm:gap-[22px] py-1"
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
                  <Check className="w-4 h-4 text-white stroke-[3]" />
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

      {/* Buttons row: I-verify sa Bukid & Aprubahan */}
      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <button
          type="button"
          disabled={isVerifyDisabled}
          onClick={() => onVerify(selectedCase.id)}
          aria-label={`I-verify sa bukid ang kaso blg. ${selectedCase.caseNo}`}
          className={`min-h-[52px] sm:flex-1 rounded-[14px] px-6 text-[15px] font-extrabold flex items-center justify-center gap-2 transition select-none ${
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
            <Check className="w-4 h-4 text-[#0a6b45] stroke-[3]" aria-hidden="true" />
          ) : null}
          <span>
            {isAlreadyVerified ? "Na-verify na sa Bukid" : "I-verify sa Bukid"}
          </span>
        </button>

        <button
          type="button"
          disabled={isApproveDisabled}
          onClick={() => onApprove(selectedCase.id)}
          aria-label={`Aprubahan ang kaso blg. ${selectedCase.caseNo}`}
          className={`min-h-[52px] sm:flex-1 rounded-[14px] px-6 text-[15px] font-extrabold flex items-center justify-center gap-2 transition select-none ${
            isApproveDisabled
              ? "bg-[#d9f3e5] text-[#0a6b45] border border-[#a3e2c3] cursor-not-allowed"
              : isAwaitingApproval
              ? "bg-[#0a6b45] text-white hover:bg-[#085336] active:scale-[0.99] cursor-pointer shadow-xs"
              : "bg-[#0f2a5c] text-white hover:bg-[#1b3f9a] active:scale-[0.99] cursor-pointer shadow-xs"
          }`}
        >
          {isApproving ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : isAlreadyApproved ? (
            <Check className="w-4 h-4 text-[#0a6b45] stroke-[3]" aria-hidden="true" />
          ) : null}
          <span>{isAlreadyApproved ? "Aprubado na" : "Aprubahan"}</span>
        </button>
      </div>
    </article>
  );
};
