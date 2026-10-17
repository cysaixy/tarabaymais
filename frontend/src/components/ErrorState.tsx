import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  /** Short headline. Defaults to a Tagalog error label. */
  title?: string;
  /** Detail message. Pass the ApiError message for an honest reason. */
  message?: string;
  /** When provided, shows a large "Subukan muli" retry button. */
  onRetry?: () => void;
  /** Custom retry button label. */
  retryLabel?: string;
}

/**
 * Shared error block. Used in place of fabricated fallback data so failures are
 * honest. Big retry tap target (≥48px) for outdoor one-handed use.
 */
export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "May naganap na problema",
  message = "Hindi namin na-load ang datos. Pakisubukan muli.",
  onRetry,
  retryLabel = "Subukan muli",
}) => {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-red-100 bg-red-50/70 px-6 py-10 text-center"
    >
      <AlertTriangle className="h-12 w-12 text-red-500" aria-hidden="true" />
      <h3 className="text-lg font-bold text-red-700">{title}</h3>
      <p className="max-w-xs text-sm font-medium text-red-600/80">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-red-600 px-6 text-base font-bold text-white shadow-sm transition-colors hover:bg-red-700"
        >
          <RefreshCw className="h-5 w-5" aria-hidden="true" />
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
};

export default ErrorState;
