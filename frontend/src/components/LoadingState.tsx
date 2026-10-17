import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  /** Message shown under the spinner. Defaults to a Tagalog loading label. */
  label?: string;
  /** Render full-height centered (page-level) vs inline (section-level). */
  fullScreen?: boolean;
}

/**
 * Shared loading indicator. Large, high-contrast spinner suited to outdoor
 * readability, with a Tagalog default label.
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  label = "Naglo-load...",
  fullScreen = false,
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 text-emerald-700 ${
        fullScreen ? "min-h-[60vh]" : "py-10"
      }`}
    >
      <Loader2 className="h-10 w-10 animate-spin" aria-hidden="true" />
      <p className="text-base font-semibold text-slate-600">{label}</p>
    </div>
  );
};

export default LoadingState;
