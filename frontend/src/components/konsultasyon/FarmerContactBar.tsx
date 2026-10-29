import React, { useState } from "react";
import { Phone, MessageSquare, Copy, Check } from "lucide-react";
import type { ConsultationItem } from "./types";
import {
  formatPhoneDisplay,
  toInternationalPhone,
  copyToClipboard,
} from "./phoneUtils";

export interface FarmerContactBarProps {
  consultation: ConsultationItem;
}

export const FarmerContactBar: React.FC<FarmerContactBarProps> = ({
  consultation,
}) => {
  const [copied, setCopied] = useState(false);

  const farmerInitial =
    consultation.farmerName.trim().charAt(0).toUpperCase() || "M";
  const displayPhone = formatPhoneDisplay(consultation.phone);
  const intlPhone = toInternationalPhone(consultation.phone);
  const hasValidPhone = Boolean(intlPhone);

  const handleCopy = async () => {
    if (!hasValidPhone) return;
    const ok = await copyToClipboard(displayPhone);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      aria-label="Impormasyon sa Pakikipag-ugnayan sa Magsasaka"
      className="bg-[#0a3d2e] text-white px-[18px] py-[10px] flex flex-col md:flex-row md:items-center justify-between gap-2.5 w-full shrink-0"
    >
      {/* Left side: Avatar + 2 lines */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          aria-hidden="true"
          className="w-9 h-9 rounded-full bg-[#f5c518] text-[#0a3d2e] font-extrabold text-[15px] flex items-center justify-center shrink-0"
        >
          {farmerInitial}
        </div>

        <div className="flex flex-col min-w-0">
          <p className="text-[16px] font-extrabold text-white leading-[1.2] truncate">
            {consultation.farmerName}
          </p>

          <p className="text-[12px] text-[#bfe8d3] flex items-center gap-1 truncate">
            <span>{consultation.barangay}</span>
            <span aria-hidden="true">·</span>
            {hasValidPhone ? (
              <a
                href={`tel:${intlPhone}`}
                aria-label={`Tawagan si ${consultation.farmerName} sa ${displayPhone}`}
                className="text-[14px] font-extrabold text-[#f5c518] hover:opacity-90 transition-opacity"
              >
                {displayPhone}
              </a>
            ) : (
              <span className="text-[13px] text-[#9ca3af]">
                {displayPhone}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Right side: 3 Contact Buttons */}
      <div className="flex items-center gap-1.5 w-full md:w-auto">
        {/* Tumawag */}
        {hasValidPhone ? (
          <a
            href={`tel:${intlPhone}`}
            aria-label={`Tumawag kay ${consultation.farmerName}`}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 rounded-[10px] bg-[#f5c518] text-[#0a3d2e] text-[13px] font-extrabold hover:bg-[#eab308] active:scale-[0.98] transition cursor-pointer"
          >
            <Phone className="w-4 h-4 shrink-0 stroke-[2.5]" aria-hidden="true" />
            <span>Tumawag</span>
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 rounded-[10px] bg-[#f5c518]/40 text-[#0a3d2e]/50 text-[13px] font-extrabold cursor-not-allowed"
          >
            <Phone className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Tumawag</span>
          </button>
        )}

        {/* Mag-SMS */}
        {hasValidPhone ? (
          <a
            href={`sms:${intlPhone}`}
            aria-label={`Mag-SMS kay ${consultation.farmerName}`}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 rounded-[10px] border-[1.5px] border-white text-white text-[13px] font-extrabold hover:bg-white/10 active:scale-[0.98] transition cursor-pointer"
          >
            <MessageSquare className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Mag-SMS</span>
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 rounded-[10px] border-[1.5px] border-white/40 text-white/40 text-[13px] font-extrabold cursor-not-allowed"
          >
            <MessageSquare className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Mag-SMS</span>
          </button>
        )}

        {/* Kopyahin */}
        <button
          type="button"
          disabled={!hasValidPhone}
          onClick={handleCopy}
          aria-label={
            copied
              ? "Nakopya ang numero ng telepono"
              : `Kopyahin ang numero ni ${consultation.farmerName}`
          }
          className={`flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-[10px] border-[1.5px] text-[12px] font-bold transition ${
            !hasValidPhone
              ? "border-[#5fa888]/40 text-[#dff5e9]/40 cursor-not-allowed"
              : copied
              ? "border-[#f5c518] text-[#f5c518] bg-white/10"
              : "border-[#5fa888] text-[#dff5e9] hover:bg-white/10 active:scale-[0.98] cursor-pointer"
          }`}
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 shrink-0 stroke-[3]" aria-hidden="true" />
          ) : (
            <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          )}
          <span aria-live="polite">{copied ? "Nakopya" : "Kopyahin"}</span>
        </button>
      </div>
    </div>
  );
};

