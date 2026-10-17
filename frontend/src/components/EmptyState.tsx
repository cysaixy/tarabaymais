import React from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  /** Short headline, e.g. "Wala pang talaan". */
  title?: string;
  /** Supporting line explaining what the farmer can do next. */
  message?: string;
  /** Optional icon override (defaults to an inbox). */
  icon?: React.ReactNode;
  /** Optional action button (e.g. "Magdagdag"). */
  action?: React.ReactNode;
}

/**
 * Shared empty-state block for lists/tables with no records yet. High-contrast,
 * generous spacing, Tagalog defaults.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title = "Wala pang laman",
  message = "Wala pang talaan dito sa ngayon.",
  icon,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center">
      <div className="text-slate-400" aria-hidden="true">
        {icon ?? <Inbox className="h-12 w-12" />}
      </div>
      <h3 className="text-lg font-bold text-slate-700">{title}</h3>
      <p className="max-w-xs text-sm font-medium text-slate-500">{message}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
};

export default EmptyState;
