import React, { useCallback, useRef, useState } from "react";
import type { FC } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  accent?: "emerald" | "blue";
  ariaLabel?: string;
}

// ─── Static class lookups (no dynamic Tailwind class construction) ────────────

const ACCENT_STYLES = {
  emerald: {
    // Filled box border + background
    filledBorder: "border-emerald-300",
    filledBg: "bg-emerald-50/60",
    // Active (focused cursor) box
    activeBorder: "border-emerald-600",
    activeBg: "bg-white",
    activeRing: "ring-4 ring-emerald-500/20",
    // Caret blink
    caretBg: "bg-emerald-400",
  },
  blue: {
    filledBorder: "border-blue-300",
    filledBg: "bg-blue-50/60",
    activeBorder: "border-blue-600",
    activeBg: "bg-white",
    activeRing: "ring-4 ring-blue-500/20",
    caretBg: "bg-blue-400",
  },
} as const;

// ─── Component ────────────────────────────────────────────────────────────────

export const OtpInput: FC<OtpInputProps> = ({
  value,
  onChange,
  length = 6,
  disabled = false,
  autoFocus = false,
  accent = "emerald",
  ariaLabel = "OTP code",
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  const styles = ACCENT_STYLES[accent];

  // The index of the "active" box: the next empty slot, clamped to the last box.
  const activeIndex = Math.min(value.length, length - 1);

  // Focus the hidden input when clicking anywhere on the wrapper.
  const handleWrapperClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const cleaned = e.target.value.replace(/\D/g, "").slice(0, length);
      onChange(cleaned);
    },
    [onChange, length],
  );

  // Always keep caret at end so tapping a middle box never inserts mid-string.
  const handleSelect = useCallback(
    (e: React.SyntheticEvent<HTMLInputElement>) => {
      const el = e.currentTarget;
      const end = el.value.length;
      el.setSelectionRange(end, end);
    },
    [],
  );

  const handleFocus = useCallback(() => setFocused(true), []);
  const handleBlur = useCallback(() => setFocused(false), []);

  return (
    // Relative wrapper so the invisible <input> can be absolutely positioned.
    <div
      className="relative w-full cursor-text"
      onClick={handleWrapperClick}
      role="presentation"
    >
      {/* ── Visual digit boxes (aria-hidden; the real input is the a11y surface) */}
      <div
        className="grid gap-2 sm:gap-3"
        style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
        aria-hidden="true"
      >
        {Array.from({ length }, (_, i) => {
          const digit = value[i] ?? "";
          const isActive = focused && i === activeIndex;
          const isFilled = digit !== "";

          let boxClass =
            "h-14 sm:h-16 rounded-xl sm:rounded-2xl border-2 flex items-center justify-center text-2xl sm:text-3xl font-black leading-none text-slate-900 transition-all select-none";

          if (isActive) {
            boxClass += ` ${styles.activeBorder} ${styles.activeBg} ${styles.activeRing}`;
          } else if (isFilled) {
            boxClass += ` ${styles.filledBorder} ${styles.filledBg}`;
          } else {
            // Empty, not active
            boxClass += " border-slate-200 bg-slate-50/80";
          }

          return (
            <div key={i} className={boxClass}>
              {isFilled ? (
                <span>{digit}</span>
              ) : isActive ? (
                // Blinking caret for the active empty box
                <span
                  className={`h-7 w-0.5 animate-pulse rounded-full ${styles.caretBg}`}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* ── Real hidden <input> — the only interactive element ────────────────
          Absolutely positioned over the full grid so every tap/click on any
          box naturally focuses this input. Fully transparent so the visual
          boxes above are what the user sees.                                  */}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        aria-label={ariaLabel}
        value={value}
        onChange={handleChange}
        onSelect={handleSelect}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        autoFocus={autoFocus}
        className="absolute inset-0 w-full h-full opacity-0 bg-transparent text-transparent caret-transparent outline-none cursor-text"
      />
    </div>
  );
};

export default OtpInput;
