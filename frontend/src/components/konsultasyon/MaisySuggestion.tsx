import React from "react";

export interface MaisySuggestionProps {
  suggestion?: string | null;
  onUseSuggestion: (text: string) => void;
}

export const MaisySuggestion: React.FC<MaisySuggestionProps> = ({
  suggestion,
  onUseSuggestion,
}) => {
  if (!suggestion || !suggestion.trim()) return null;

  return (
    <div
      aria-label="Mungkahi ni Maisy"
      className="bg-[#fff6d6] border border-[#ecd27a] rounded-[16px] p-[14px_16px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
    >
      <div className="flex items-start gap-3 min-w-0">
        {/* 40px Maisy Circle / Mascot */}
        <div
          aria-hidden="true"
          className="w-10 h-10 rounded-full bg-[#f5c518] text-[#0a3d2e] font-extrabold text-[18px] flex items-center justify-center shrink-0 shadow-2xs overflow-hidden"
        >
          <img
            src="/assets/mascot-maisy.png"
            alt="Maisy"
            className="w-8 h-8 object-contain"
            onError={(e) => {
              // Fallback to "M" text
              e.currentTarget.style.display = "none";
            }}
          />
          <span className="hidden">M</span>
        </div>

        <div className="flex flex-col min-w-0">
          <p className="text-[13px] font-extrabold text-[#7a3a04]">
            Mungkahi ni Maisy
          </p>
          <p className="text-[14px] text-[#7a3a04]/90 leading-[1.5] mt-0.5">
            {suggestion}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onUseSuggestion(suggestion)}
        className="min-h-[44px] px-5 rounded-full bg-white border border-[#b45309] text-[#7a3a04] text-[14px] font-extrabold hover:bg-amber-50 active:scale-[0.98] transition cursor-pointer shrink-0 self-start sm:self-auto"
      >
        Gamitin
      </button>
    </div>
  );
};

