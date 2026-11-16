import prisma from "../config/prisma";

/** Accounts with no activity for this many months are marked inactive. */
export const INACTIVITY_MONTHS = 6;

/** Only write lastActiveAt once per hour per user to avoid a DB write on every request. */
const ACTIVITY_TOUCH_INTERVAL_MS = 60 * 60 * 1000;

const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function inactivityCutoff(now = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - INACTIVITY_MONTHS);
  return cutoff;
}

/**
 * Records that a user just used the system. An inactive account becomes
 * active again as soon as its owner signs in and makes a request.
 * Returns the values to merge into the in-memory user, or null if unchanged.
 */
export async function touchUserActivity(user: {
  id: string;
  isActive: boolean;
  lastActiveAt: Date;
}): Promise<{ isActive: true; lastActiveAt: Date } | null> {
  const now = new Date();
  const stale =
    now.getTime() - user.lastActiveAt.getTime() > ACTIVITY_TOUCH_INTERVAL_MS;
  if (user.isActive && !stale) return null;

  await prisma.user.updateMany({
    where: { id: user.id },
    data: { isActive: true, lastActiveAt: now },
  });
  return { isActive: true, lastActiveAt: now };
}

/** Marks every account idle past the cutoff as inactive. Returns how many changed. */
export async function runInactivitySweep(): Promise<number> {
  const { count } = await prisma.user.updateMany({
    where: { isActive: true, lastActiveAt: { lt: inactivityCutoff() } },
    data: { isActive: false },
  });
  if (count > 0) {
    console.info(`[Inactivity] Marked ${count} account(s) inactive.`);
  }
  return count;
}

/** Runs the sweep shortly after startup and then once a day. */
export function startInactivitySweep(): void {
  const run = () =>
    runInactivitySweep().catch((error: unknown) =>
      console.error("[Inactivity] Sweep failed:", error),
    );
  setTimeout(run, 30_000).unref();
  setInterval(run, SWEEP_INTERVAL_MS).unref();
}
