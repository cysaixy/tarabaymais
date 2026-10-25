/**
 * ChartCard — consistent wrapper for all dashboard charts.
 * Title, subtitle, skeleton while loading, empty state, error with retry.
 */

import React from "react";
import { Loader2 } from "lucide-react";
import { EmptyState } from "../EmptyState";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyMessage?: string;
  minHeight?: string;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  children,
  loading = false,
  error = false,
  onRetry,
  emptyTitle = "Walang datos",
  emptyMessage = "Wala pang talaan para sa napiling filter.",
  minHeight = "300px",
}) => {
  const cardStyle = { minHeight } as React.CSSProperties;

  if (loading) {
    return (
      <div
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col items-center justify-center"
        style={cardStyle}
      >
        <Loader2
          className="h-8 w-8 animate-spin text-emerald-600"
          aria-hidden="true"
        />
        <p className="mt-3 text-base font-semibold text-slate-600">
          Naglo-load...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-2xl border-2 border-red-100 bg-red-50/70 p-6 text-center"
        style={cardStyle}
      >
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="h-5 w-5 text-red-500" aria-hidden="true">
            !
          </span>
          <h3 className="text-lg font-bold text-red-700">
            May naganap na problema
          </h3>
        </div>
        <p className="text-sm text-red-600/80 mb-4">
          Hindi namin na-load ang datos. Pakisubukan muli.
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="min-h-12 rounded-xl bg-red-600 px-6 text-base font-bold text-white shadow-sm transition hover:bg-red-700"
          >
            <Loader2 className="h-5 w-5 mr-2" />
            Subukan muli
          </button>
        )}
      </div>
    );
  }

  if (!children) {
    return (
      <div
        className="rounded-2xlrder border-slate-200 bg-white p-5 shadow-sm flex flex-col items-center justify-center"
        style={cardStyle}
      >
        <EmptyState
          title={emptyTitle}
          message={emptyMessage}
          icon={<div className="h-10 w-10 text-slate-400" aria-hidden="true" />}
        />
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      style={cardStyle}
    >
      {subtitle && (
        <div className="mb-4 flex items-center gap-2">
          <p className="text-[13px] font-bold text-slate-600">{title}</p>
          <p className="text-[12px] text-slate-400">{subtitle}</p>
        </div>
      )}
      {!subtitle && (
        <h3 className="mb-4 text-lg font-bold text-slate-900">{title}</h3>
      )}
      <div className="flex-1">{children}</div>
    </div>
  );
};
