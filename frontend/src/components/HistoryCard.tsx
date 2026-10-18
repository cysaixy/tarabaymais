/**
 * HistoryCard — Unified list item for all history types
 * Large tap target, consistent status/icon, expandable detail
 */

import React from "react";
import { Clock, ChevronDown, CheckCircle2, AlertTriangle, Send, Loader2 } from "lucide-react";

export type HistoryItemCategory =
  | "FERTILIZER"
  | "PEST_CONTROL"
  | "IRRIGATION"
  | "OBSERVATION"
  | "DISASTER"
  | "EXPERT"
  | "OTHER";

export interface HistoryCardProps {
  id: string;
  title: string;
  category: HistoryItemCategory;
  date: string; // YYYY-MM-DD
  description: string;
  detailHighlight?: string;
  status: "Synced" | "Pending" | "Under Review" | "Resolved" | "Rejected";
  iconType?: "activity" | "observation" | "disaster" | "expert" | "other";
  onClick?: () => void;
  expanded?: boolean;
  onExpand?: () => void;
  children?: React.ReactNode;
  loading?: boolean;
}

const CATEGORY_CONFIG: Record<HistoryItemCategory, { icon: React.ReactNode; bg: string; label: string }> = {
  FERTILIZER: { icon: <Send className="w-5 h-5 stroke-[2.2]" />, bg: "bg-blue-100 text-blue-700", label: "Pataba" },
  PEST_CONTROL: { icon: <AlertTriangle className="w-5 h-5 stroke-[2.2]" />, bg: "bg-red-100 text-red-700", label: "Peste Control" },
  IRRIGATION: { icon: <Loader2 className="w-5 h-5 stroke-[2.2]" />, bg: "bg-cyan-100 text-cyan-700", label: "Patubig" },
  OBSERVATION: { icon: <AlertTriangle className="w-5 h-5 stroke-[2.2]" />, bg: "bg-amber-100 text-amber-700", label: "Obserbasyon" },
  DISASTER: { icon: <AlertTriangle className="w-5 h-5 stroke-[2.2]" />, bg: "bg-rose-100 text-rose-700", label: "Kalamidad" },
  EXPERT: { icon: <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />, bg: "bg-emerald-100 text-emerald-700", label: "Eksperto" },
  OTHER: { icon: <Clock className="w-5 h-5 stroke-[2.2]" />, bg: "bg-slate-100 text-slate-700", label: "Iba pa" },
};

const STATUS_CONFIG: Record<HistoryCardProps["status"], { bg: string; text: string; border: string }> = {
  Synced: { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300/60" },
  Pending: { bg: "bg-amber-100", text: "text-amber-900", border: "border-amber-300/60" },
  "Under Review": { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300/60" },
  Resolved: { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300/60" },
  Rejected: { bg: "bg-rose-100", text: "text-rose-800", border: "border-rose-300/60" },
};

export const HistoryCard: React.FC<HistoryCardProps> = ({
  id,
  title,
  category,
  date,
  description,
  detailHighlight,
  status,
  onClick,
  expanded = false,
  onExpand,
  children,
  loading = false,
}) => {
  const catConfig = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.OTHER;
  const statusConfig = STATUS_CONFIG[status] ?? STATUS_CONFIG.Synced;

  const handleClick = (e: React.MouseEvent) => {
    if (onExpand) {
      e.stopPropagation();
      onExpand();
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <div
      key={id}
      className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-start gap-3.5 hover:border-slate-300 transition cursor-pointer"
      onClick={onClick}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${catConfig.bg}`}>
        {catConfig.icon}
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
              {title}
            </h4>
            <span className="text-[10px] text-slate-400 font-mono shrink-0">
              {date}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
            >
              {status}
            </span>
            {onExpand && (
              <button
                onClick={handleClick}
                className="p-1 text-slate-400 hover:text-slate-600 transition"
                aria-label={expanded ? "I-collapse" : "I-expand"}
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-snug line-clamp-2">
          {description}
        </p>

        {detailHighlight && (
          <p className="text-xs font-bold text-emerald-800 leading-snug pt-0.5">
            {detailHighlight}
          </p>
        )}

        {expanded && children && (
          <div className="pt-3 border-t border-slate-100 mt-2 animate-fade-in">
            {children}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            <span>Kinukuha ang detalye...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const HistoryCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs animate-pulse">
    <div className="flex items-start gap-3.5">
      <div className="w-12 h-12 rounded-xl bg-slate-100 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 bg-slate-100 rounded" />
        <div className="h-3 w-1/2 bg-slate-100 rounded" />
        <div className="h-3 w-full bg-slate-100 rounded" />
      </div>
    </div>
  </div>
);