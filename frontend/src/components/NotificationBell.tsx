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
  /** Stable ID composed from the case id + type so it never clashes. */
  id: string;
  type: NotifType;
  title: string;
  /** "{Farmer name} · {barangay}" */
  subline: string;
  createdAt: string;
  /** true when severity is HIGH or CRITICAL (expert cases only). */
  highPriority: boolean;
  /** The underlying case id for navigation. */
  caseId: string;
}

// ─── Read-tracking helpers ───────────────────────────────────────────────────

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
    // Storage quota or private-mode — ignore silently.
  }
}

export function clearReadNotifications(userId: string): void {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    // ignore
  }
}

// ─── Derive notifications from pipeline data ─────────────────────────────────

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

  // Newest first, cap at 8 in the dropdown
  items.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return items;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface NotificationBellProps {
  userId: string;
  expertCases: ExpertCase[];
  disasterCases: DisasterReport[];
  /** Called when the user clicks a notification row. */
  onOpenCase: (caseId: string, type: NotifType) => void;
  /** Called when footer "Tingnan lahat" is clicked (switches to Konsultasyon). */
  onViewAll: () => void;
}

const MAX_VISIBLE = 8;

export const NotificationBell: React.FC<NotificationBellProps> = ({
  userId,
  expertCases,
  disasterCases,
  onOpenCase,
  onViewAll,
}) => {
  const bellRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() =>
    loadReadIds(userId)
  );

  const bellId = useId();
  const panelId = useId();

  const allNotifs = React.useMemo(
    () => deriveNotifications(expertCases, disasterCases),
    [expertCases, disasterCases]
  );

  const visibleNotifs = allNotifs.slice(0, MAX_VISIBLE);
  const unreadCount = allNotifs.filter((n) => !readIds.has(n.id)).length;

  useEffect(() => {
    saveReadIds(userId, readIds);
  }, [userId, readIds]);

  useEffect(() => {
    setReadIds(loadReadIds(userId));
  }, [userId]);

  const openPanel = useCallback(() => setOpen(true), []);
  const closePanel = useCallback(() => {
    setOpen(false);
    setTimeout(() => bellRef.current?.focus(), 0);
  }, []);

  // Move focus into the panel when opened
  useEffect(() => {
    if (open) {
      const first = panelRef.current?.querySelector<HTMLElement>(
        "button, [href], input, [tabindex]:not([tabindex='-1'])"
      );
      first?.focus();
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, closePanel]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        closePanel();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, closePanel]);

  const markAllRead = () => {
    setReadIds(new Set(allNotifs.map((n) => n.id)));
  };

  const handleRowClick = (notif: DerivedNotification) => {
    setReadIds((prev) => new Set([...prev, notif.id]));
    closePanel();
    onOpenCase(notif.caseId, notif.type);
  };

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={bellRef}
        id={bellId}
        type="button"
        onClick={() => (open ? closePanel() : openPanel())}
        aria-label={`Mga abiso, ${unreadCount} bago`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        className="relative flex h-[52px] w-[52px] items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white active:scale-95"
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

      {/* Backdrop (mobile) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-hidden="true"
          onClick={closePanel}
        />
      )}

      {/* Dropdown panel */}
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
                  className="min-h-[48px] rounded-xl px-3 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
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

          {/* Notification list */}
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
                      onClick={() => handleRowClick(notif)}
                      className={[
                        "flex w-full min-h-[64px] items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 cursor-pointer",
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
                className="flex h-[52px] w-full items-center justify-center rounded-xl bg-[#1D4ED8] text-base font-bold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 active:scale-95"
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
