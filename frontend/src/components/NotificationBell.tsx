import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { tagalogRelativeTime } from "../lib/relativeTime";
import {
  deriveNotifications,
  loadReadNotificationIds,
  saveReadIds,
  type DerivedNotification,
  type NotifType,
} from "../lib/notificationReadTracking";
import type { ExpertCase, DisasterReport } from "../services/case.service";

// ─── Component ────────────────────────────────────────────────────────────────

interface NotificationBellProps {
  userId: string;
  expertCases: ExpertCase[];
  disasterCases: DisasterReport[];
  onOpenCase: (caseId: string, type: NotifType) => void;
  onViewAll: () => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const MAX_VISIBLE = 8;

export const NotificationBell: React.FC<NotificationBellProps> = ({
  userId,
  expertCases,
  disasterCases,
  onOpenCase,
  onViewAll,
  isOpen,
  onOpenChange,
}) => {
  const bellRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() =>
    loadReadNotificationIds(userId),
  );

  const isControlled = isOpen !== undefined;
  const panelOpen = isOpen ?? open;
  const bellId = useId();
  const panelId = useId();

  const allNotifs = React.useMemo(
    () => deriveNotifications(expertCases, disasterCases),
    [expertCases, disasterCases],
  );

  const visibleNotifs = allNotifs.slice(0, MAX_VISIBLE);
  const unreadCount = allNotifs.filter((n) => !readIds.has(n.id)).length;

  useEffect(() => { saveReadIds(userId, readIds); }, [userId, readIds]);
  useEffect(() => {
    setReadIds(loadReadNotificationIds(userId));
  }, [userId]);

  // ── Open / close ───────────────────────────────────────────────────────────

  const setPanelOpen = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) setOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  const openPanel = useCallback(() => setPanelOpen(true), [setPanelOpen]);
  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setTimeout(() => bellRef.current?.focus(), 0);
  }, [setPanelOpen]);

  // Move focus into the panel when opened
  useEffect(() => {
    if (panelOpen) {
      const first = panelRef.current?.querySelector<HTMLElement>(
        "button, [href], input, [tabindex]:not([tabindex='-1'])",
      );
      first?.focus();
    }
  }, [panelOpen]);

  // Escape key closes the panel
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [panelOpen, closePanel]);

  // Outside-click: only close if the click landed OUTSIDE both bell and panel.
  // Uses "click" (not "mousedown") so row buttons always fire their onClick first.
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: MouseEvent) => {
      const bell = bellRef.current;
      if (!bell || bell.getClientRects().length === 0) return;

      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !bell.contains(e.target as Node)
      ) {
        closePanel();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [panelOpen, closePanel]);

  const markAllRead = () => {
    setReadIds(new Set(allNotifs.map((n) => n.id)));
  };

  const handleRowClick = useCallback(
    (notif: DerivedNotification) => {
      setReadIds((prev) => new Set([...prev, notif.id]));
      closePanel();
      requestAnimationFrame(() => {
        onOpenCase(notif.caseId, notif.type);
      });
    },
    [closePanel, onOpenCase],
  );

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={bellRef}
        id={bellId}
        type="button"
        onClick={() => (panelOpen ? closePanel() : openPanel())}
        aria-label={`Mga abiso, ${unreadCount} bago`}
        aria-haspopup="true"
        aria-expanded={panelOpen}
        aria-controls={panelId}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 active:scale-95 cursor-pointer shadow-2xs"
      >
        <Bell className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-rose-600 text-[10px] font-bold text-white shadow-xs"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Backdrop (mobile) */}
      {panelOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* Dropdown panel */}
      {panelOpen && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Mga Abiso"
          className="fixed bottom-0 left-0 right-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl md:absolute md:bottom-auto md:left-auto md:right-0 md:top-full md:mt-2 md:max-h-[70vh] md:w-[400px] md:rounded-2xl"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
            <h2 className="text-lg font-bold text-slate-900">Mga Abiso</h2>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="min-h-[48px] rounded-xl px-3 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 cursor-pointer"
                >
                  Markahan lahat bilang nabasa
                </button>
              )}
              <button
                type="button"
                onClick={closePanel}
                aria-label="Isara ang mga abiso"
                className="flex h-12 w-12 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 cursor-pointer"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* List */}
          {visibleNotifs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <BellOff
                className="h-12 w-12 text-slate-300"
                aria-hidden="true"
              />
              <p className="text-base font-semibold text-slate-500">
                Wala pang bagong abiso
              </p>
            </div>
          ) : (
            <ul role="list" className="divide-y divide-slate-100">
              {visibleNotifs.map((notif) => {
                const isUnread = !readIds.has(notif.id);
                return (
                  <li key={notif.id}>
                    <button
                      type="button"
                      onClick={() =>
                        handleRowClick(notif)
                      }
                      className={[
                        "flex w-full min-h-[64px] items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-100 active:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 cursor-pointer",
                        isUnread ? "bg-blue-50" : "bg-white",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
                          notif.type === "KONSULTASYON"
                            ? "bg-rose-500"
                            : "bg-orange-500",
                        ].join(" ")}
                        aria-hidden="true"
                      >
                        {notif.type === "KONSULTASYON" ? "K" : "D"}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2 flex-wrap">
                          <p className="text-base font-semibold text-slate-900 leading-snug">
                            {notif.title}
                          </p>
                          {notif.highPriority && (
                            <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-0.5 text-sm font-bold text-red-700">
                              Mataas na Priyoridad
                            </span>
                          )}
                          {isUnread && (
                            <span
                              className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500"
                              aria-label="Hindi pa nabasa"
                            />
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-slate-500 leading-snug">
                          {notif.subline}
                        </p>
                        <p className="mt-0.5 text-sm text-slate-500">
                          {tagalogRelativeTime(notif.createdAt)}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Footer */}
          {visibleNotifs.length > 0 && (
            <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  closePanel();
                  onViewAll();
                }}
                className="flex h-[52px] w-full items-center justify-center rounded-xl bg-[#1D4ED8] text-base font-bold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 active:scale-95 cursor-pointer"
              >
                Tingnan lahat ng kaso
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
