/**
 * ActionQueue — unified action queue widget for the Buod tab.
 * Shows open cases, observations without a case, and unreviewed disaster reports.
 * Each item: severity badge, farmer + barangay, summary, waiting hours,
 * "Buksan" button. Header shows "{shown} sa {total}". Empty state when total is 0.
 */

import React, { useCallback } from "react";
import {
  AlertTriangle,
  CloudLightning,
  MessageSquare,
  Clock,
  MapPin,
} from "lucide-react";
import { SeverityBadge } from "./SeverityBadge";
import { StatusPill } from "./StatusPill";

interface QueueItem {
  id: string;
  type: "case" | "observation" | "disaster";
  severity: string;
  farmerName: string;
  farmName: string;
  barangay: string;
  summary: string;
  createdAt: string;
  waitingHours: number;
  status: string;
}

interface ActionQueueProps {
  items: QueueItem[];
  total: number;
  limit?: number;
  offset?: number;
  onOpenItem?: (item: QueueItem) => void;
}

const TYPE_ICON: Record<string, React.FC<{ className?: string }>> = {
  case: AlertTriangle,
  observation: CloudLightning,
  disaster: MessageSquare,
};

export const ActionQueue: React.FC<ActionQueueProps> = ({
  items,
  total,
  limit = 5,
  offset = 0,
  onOpenItem,
}) => {
  const shown = items.length;
  const isEmpty = total === 0;
  const hasMore = offset + limit < total;

  const openItem = useCallback(
    (item: QueueItem) => {
      onOpenItem?.(item);
    },
    [onOpenItem],
  );

  const overdueThreshold = 48;

  if (isEmpty) {
    return (
      <div className="rounded-[20px] border-2 border-emerald-300 bg-[#ECFDF5] p-6 text-center">
        <AlertTriangle
          className="h-10 w-10 text-emerald-600 mx-auto mb-3"
          aria-hidden="true"
        />
        <p className="text-xl font-bold text-[#065F46]">
          Wala nang nakabinbin &#10003;
        </p>
        <p className="mt-1 text-base text-emerald-700">
          Lahat ng kaso ay na-aasikaso na.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm flex flex-col h-full">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">
          Kailangan ng Aksyon Ngayon
        </h3>
        <p className="text-sm text-slate-500">
          {shown} sa {total}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {items.map((item) => {
          const Icon = TYPE_ICON[item.type];
          const isOverdue = item.waitingHours > overdueThreshold;
          const waitingLabel = `naghihintay ng ${item.waitingHours} oras`;

          return (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-3 cursor-pointer hover:bg-slate-50 transition active:scale-[0.98]"
              onClick={() => openItem(item)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Icon
                    className="h-5 w-5 shrink-0 text-slate-500"
                    aria-hidden="true"
                  />
                  <SeverityBadge severity={item.severity} size="sm" />
                </div>
                <StatusPill status={item.status} size="sm" />
              </div>

              <div className="flex items-start gap-2">
                <MapPin
                  className="h-4 w-4 shrink-0 text-slate-400 mt-0.5"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {item.farmName}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {item.farmerName} &middot; {item.barangay}
                  </p>
                </div>
              </div>

              <p className="text-base font-semibold text-slate-800 leading-tight">
                {item.summary}
              </p>

              <div className="flex items-center justify-between mt-auto pt-3">
                <div
                  className={`flex items-center gap-1 text-xs font-bold ${
                    isOverdue ? "text-rose-600" : "text-amber-700"
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{waitingLabel}</span>
                  {isOverdue && (
                    <span className="ml-1 rounded-full bg-rose-100 px-1.5 py-0 text-[10px] font-bold text-rose-600">
                      Overdue
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openItem(item);
                  }}
                  className="min-h-12 rounded-xl bg-[#047857] px-4 text-sm font-bold text-white hover:bg-emerald-700 transition active:scale-95"
                >
                  Buksan
                </button>
              </div>
            </div>
          );
        })}

        {hasMore && (
          <div className="text-center py-3">
            <button
              type="button"
              className="text-sm font-bold text-[#1D4ED8] hover:underline"
            >
              Tingnan lahat ({total})
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
