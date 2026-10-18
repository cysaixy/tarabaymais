import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Bell, BellOff, X } from "lucide-react";
import { tagalogRelativeTime } from "../lib/relativeTime";
import type { ExpertCase, DisasterReport } from "../services/case.service";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotifType = "KONSULTASYON" | "DISASTER";

export interface DerivedNotification {
  id: string;
  type: NotifType;
  title: string;
  subline: string;
  createdAt: string;
  highPriority: boolean;
  caseId: string;
}

// ─── Read-tracking helpers ────────────────────────────────────────────────────

function storageKey(userId: string): string {
  return `tarabay_read_notifications:${userId}`;
}

function loadReadIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveReadIds(userId: string, ids: Set<string>): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}

export function clearReadNotifications(userId: string): void {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    // ignore
  }
}

// ─── Derive notifications ─────────────────────────────────────────────────────

function deriveNotifications(
  expertCases: ExpertCase[],
  disasterCases: DisasterReport[]
): DerivedNotification[] {
  const items: DerivedNotification[] = [];

  for (const ec of expertCases) {
    if (!["SUBMITTED", "UNDER_REVIEW", "INSPECTED"].includes(ec.status))
      continue;
    const farm = ec.observation?.cropCycle?.farm;
    const farmerName = farm?.name ?? "Hindi nakikilala";
    const barangay = farm?.barangay ?? "\u2014";
    const severity = ec.observation?.severity ?? "";
    items.push({
      id: `ec:${ec.id}`,
      type: "KONSULTASYON",
      title: `Bagong kaso: ${ec.observation?.title ?? "Obserbasyon"}`,
      subline: `${farmerName} \u00b7 ${barangay}`,
      createdAt: ec.createdAt ?? new Date(0).toISOString(),
      highPriority: severity === "HIGH" || severity === "CRITICAL",
      caseId: ec.id,
    });
  }

  for (const dr of disasterCases) {
    if (!["SUBMITTED", "UNDER_REVIEW"].includes(dr.status)) continue;
    const farmerName = dr.farm?.name ?? "Hindi nakikilala";
    const barangay = dr.farm?.barangay ?? "\u2014";
    items.push({
      id: `dr:${dr.id}`,
      type: "DISASTER",
      title: `Bagong claim: ${dr.disasterType}`,
      subline: `${farmerName} \u00b7 ${barangay}`,
      createdAt: dr.createdAt ?? new Date(0).toISOString(),
      highPriority: false,
      caseId: dr.id,
    });
  }

  items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return items;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getUnreadNotificationsCount(
  expertCases: ExpertCase[],
  disasterCases: DisasterReport[],
  userId: string
): number {
  const notifs = deriveNotifications(expertCases, disasterCases);
  const readIds = loadReadIds(userId);
  return notifs.filter((n) => !readIds.has(n.id)).length;
}

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

  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = isOpen !== undefined;
  const open = isControlled ? isOpen : internalOpen;

  // Stable ref so callbacks can always read the latest value without
  // being stale closures — critical for the row-click handler.
  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);

  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds(userId));

  const bellId = useId();
  const panelId = useId();

  const allNotifs = React.useMemo(
    () => deriveNotifications(expertCases, disasterCases),
    [expertCases, disasterCases]
  );

  const visibleNotifs = allNotifs.slice(0, MAX_VISIBLE);
  const unreadCount = allNotifs.filter((n) => !readIds.has(n.id)).length;

  useEffect(() => { saveReadIds(userId, readIds); }, [userId, readIds]);
  useEffect(() => { setReadIds(loadReadIds(userId)); }, [userId]);

  // ── Open / close ───────────────────────────────────────────────────────────

  const setPanelOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setTimeout(() => bellRef.current?.focus(), 50);
  }, [setPanelOpen]);

  // Escape key closes the panel
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, closePanel]);

  // Outside-click: only close if the click landed OUTSIDE both bell and panel.
  // Uses "click" (not "mousedown") so row buttons always fire their onClick first.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current?.contains(target) ||
        bellRef.current?.contains(target)
      ) {
        return; // click was inside — do nothing
      }
      closePanel();
    };
    // Capture phase so this runs after all bubbling handlers have fired
    document.addEventListener("click", handler, { capture: true });
    return () => document.removeEventListener("click", handler, { capture: true });
  }, [open, closePanel]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const markAllRead = () => {
    setReadIds(new Set(allNotifs.map((n) => n.id)));
  };

  // Capture the caseId/type into local variables BEFORE closing the panel so
  // there is no stale-closure risk at all.
  const handleRowClick = useCallback(
    (caseId: string, type: NotifType, notifId: string) => {
      // 1. Mark as read
      setReadIds((prev) => new Set([...prev, notifId]));
      // 2. Close the panel
      setPanelOpen(false);
      if (!isControlled) setInternalOpen(false);
      // 3. Open the modal in the next frame — panel is already gone from state
      requestAnimationFrame(() => {
        onOpenCase(caseId, type);
      });
    },
    [setPanelOpen, isControlled, onOpenCase]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={bellRef}
        id={bellId}
        type="button"
        onClick={() => setPanelOpen(!open)}
        aria-label={`Mga abiso, ${unreadCount} bago`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        className="relative flex h-[52px] w-[52px] items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white active:scale-95 cursor-pointer"
      >
        <Bell className="h-6 w-6" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#0F2A5C] bg-[#E11D48] text-[11px] font-bold text-white"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Backdrop — mobile only, purely visual; does NOT intercept clicks */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      {open && (
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
              <BellOff className="h-12 w-12 text-slate-300" aria-hidden="true" />
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
                        handleRowClick(notif.caseId, notif.type, notif.id)
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
