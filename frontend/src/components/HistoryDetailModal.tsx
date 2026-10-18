/**
 * HistoryDetailModal — Base modal for viewing full record details
 * Supports tabs: Details | Photos | Timeline
 * Mobile-first bottom sheet on mobile, centered modal on desktop
 */

import React, { useState } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Send,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

export interface DetailTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
}

interface HistoryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  category: "activity" | "observation" | "disaster" | "expert";
  status: "Synced" | "Pending" | "Under Review" | "Resolved" | "Rejected";
  tabs: DetailTab[];
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    variant?: "primary" | "danger" | "secondary";
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  loading?: boolean;
  children?: React.ReactNode;
}

const STATUS_CONFIG: Record<
  HistoryDetailModalProps["status"],
  { bg: string; text: string; border: string }
> = {
  Synced: {
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    border: "border-emerald-300/60",
  },
  Pending: {
    bg: "bg-amber-100",
    text: "text-amber-900",
    border: "border-amber-300/60",
  },
  "Under Review": {
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-300/60",
  },
  Resolved: {
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    border: "border-emerald-300/60",
  },
  Rejected: {
    bg: "bg-rose-100",
    text: "text-rose-800",
    border: "border-rose-300/60",
  },
};

const CATEGORY_ICONS: Record<
  HistoryDetailModalProps["category"],
  React.ReactNode
> = {
  activity: <Send className="w-5 h-5 stroke-[2.2]" />,
  observation: <AlertTriangle className="w-5 h-5 stroke-[2.2]" />,
  disaster: <AlertTriangle className="w-5 h-5 stroke-[2.2]" />,
  expert: <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />,
};

const CATEGORY_COLORS: Record<HistoryDetailModalProps["category"], string> = {
  activity: "bg-blue-100 text-blue-700",
  observation: "bg-amber-100 text-amber-700",
  disaster: "bg-rose-100 text-rose-700",
  expert: "bg-emerald-100 text-emerald-700",
};

export const HistoryDetailModal: React.FC<HistoryDetailModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  category,
  status,
  tabs,
  primaryAction,
  secondaryAction,
  loading = false,
  children,
}) => {
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);

  const statusConfig = STATUS_CONFIG[status];

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowRight" && imageIndex < 0)
      setImageIndex((i) => Math.min(i + 1, 0));
    if (e.key === "ArrowLeft" && imageIndex > 0)
      setImageIndex((i) => Math.max(i - 1, 0));
  };

  React.useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="w-full max-w-md sm:max-w-lg bg-white rounded-t-4xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start border-b pb-4 px-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${CATEGORY_COLORS[category]}`}
            >
              {CATEGORY_ICONS[category]}
            </div>
            <div>
              <h2
                id="modal-title"
                className="font-extrabold text-base sm:text-lg text-slate-900 truncate"
              >
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
            >
              {status}
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"
              aria-label="Isara"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        {tabs.length > 1 && (
          <div className="border-b border-slate-100 px-5 sm:px-6">
            <nav className="flex overflow-x-auto -mb-px" role="tablist">
              {tabs.map((tab, index) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={index === activeTabIndex}
                  aria-controls={`panel-${tab.id}`}
                  id={`tab-${tab.id}`}
                  onClick={() => !tab.disabled && setActiveTabIndex(index)}
                  disabled={tab.disabled}
                  className={`shrink-0 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    index === activeTabIndex
                      ? "border-emerald-600 text-emerald-700"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  } ${tab.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span className="flex items-center gap-1.5">
                    {tab.icon} {tab.label}
                  </span>
                </button>
              ))}
            </nav>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {tabs.length > 0 ? (
            <div
              role="tabpanel"
              id={`panel-${tabs[activeTabIndex]?.id}`}
              aria-labelledby={`tab-${tabs[activeTabIndex]?.id}`}
            >
              {tabs[activeTabIndex]?.content}
            </div>
          ) : (
            children
          )}
        </div>

        {/* Actions */}
        {(primaryAction || secondaryAction) && (
          <div className="border-t border-slate-100 p-4 sm:p-6 space-y-2">
            {secondaryAction && (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                disabled={loading}
                className="w-full sm:w-auto px-4 py-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-sm text-slate-700 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {secondaryAction.icon}
                {secondaryAction.label}
              </button>
            )}
            {primaryAction && (
              <button
                type="button"
                onClick={primaryAction.onClick}
                disabled={loading}
                className={`w-full sm:w-auto px-4 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 ${
                  primaryAction.variant === "danger"
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : primaryAction.variant === "secondary"
                      ? "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                }`}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {primaryAction.icon}
                {primaryAction.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * ImageViewer — Full-screen pinch-zoom image gallery
 */
export interface ImageViewerProps {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
  alt?: string;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  images,
  initialIndex = 0,
  onClose,
  alt = "Image",
}) => {
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.min(Math.max(s - e.deltaY * 0.001, 1), 5));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - translate.x, y: e.clientY - translate.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    setTranslate({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (scale <= 1) return;
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({
      x: touch.clientX - translate.x,
      y: touch.clientY - translate.y,
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || scale <= 1) return;
    const touch = e.touches[0];
    setTranslate({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => setIsDragging(false);

  const next = () => setIndex((i) => Math.min(i + 1, images.length - 1));
  const prev = () => setIndex((i) => Math.max(i - 1, 0));
  const resetZoom = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      onClick={onClose}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      role="dialog"
      aria-modal="true"
      aria-label={`Litrato ${index + 1} ng ${images.length}`}
    >
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="fixed left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition"
            aria-label="Nakaraan"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="fixed right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition"
            aria-label="Susunod"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      <div
        className="relative max-w-full max-h-full"
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transformOrigin: "center center",
          transition: scale > 1 ? "none" : "transform 0.2s ease-out",
        }}
      >
        <img
          src={images[index]}
          alt={`${alt} ${index + 1}`}
          className="max-w-[90vw] max-h-[85vh] object-contain"
        />
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 text-white text-sm">
        <span>
          {index + 1} / {images.length}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            resetZoom();
          }}
          className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition"
        >
          Reset Zoom
        </button>
      </div>

      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-10 w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition"
        aria-label="Isara"
      >
        <X className="w-6 h-6" />
      </button>
    </div>
  );
};
