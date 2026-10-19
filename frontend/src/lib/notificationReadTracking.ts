import type { ExpertCase, DisasterReport } from "../services/case.service";

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

export function saveReadIds(userId: string, ids: Set<string>): void {
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

export function deriveNotifications(
  expertCases: ExpertCase[],
  disasterCases: DisasterReport[],
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
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return items;
}

export function getUnreadNotificationsCount(
  expertCases: ExpertCase[],
  disasterCases: DisasterReport[],
  userId: string,
): number {
  const notifications = deriveNotifications(expertCases, disasterCases);
  const readIds = loadReadIds(userId);
  return notifications.filter((notification) => !readIds.has(notification.id))
    .length;
}

export function loadReadNotificationIds(userId: string): Set<string> {
  return loadReadIds(userId);
}
