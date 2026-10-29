import React from "react";
import { Loader2 } from "lucide-react";

export interface ReplyBoxProps {
  value: string;
  onChange: (val: string) => void;
  onSend: () => void;
  isSending?: boolean;
}

export const ReplyBox: React.FC<ReplyBoxProps> = ({
  value,
  onChange,
  onSend,
  isSending = false,
}) => {
  const isInputEmpty = !value.trim();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isInputEmpty && !isSending) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
      <input
        type="text"
        aria-label="Isulat ang sagot"
        placeholder="Isulat ang sagot..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className="flex-1 min-h-[52px] px-[18px] rounded-[14px] border border-[#c8d0c2] bg-white text-[15px] text-[#14213d] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#0a6b45]"
      />

      <button
        type="button"
        disabled={isInputEmpty || isSending}
        onClick={onSend}
        className={`min-h-[52px] px-[26px] rounded-[14px] text-[15px] font-extrabold flex items-center justify-center gap-2 transition select-none ${
          isInputEmpty || isSending
            ? "bg-[#0a6b45]/50 text-white cursor-not-allowed"
            : "bg-[#0a6b45] hover:bg-[#085336] active:scale-[0.99] text-white cursor-pointer shadow-xs"
        }`}
      >
        {isSending ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : null}
        <span>Ipadala →</span>
      </button>
    </div>
  );
};

