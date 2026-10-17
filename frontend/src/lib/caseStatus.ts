import type { CaseStatus } from "../services/case.service";

/**
 * Single source of truth for rendering a backend `CaseStatus` in the farmer UI.
 * The backend enum is: SUBMITTED, UNDER_REVIEW, INSPECTED, RESOLVED, REJECTED.
 * (There is no `IN_PROGRESS` — that was a UI invention and is removed.)
 */
export interface CaseStatusDisplay {
  /** Short Tagalog label for a badge. */
  label: string;
  /** Tailwind classes for the badge (bg + text + border). */
  badge: string;
  /** 0-based step index for an ordered progress timeline. */
  step: number;
}

const DISPLAY: Record<CaseStatus, CaseStatusDisplay> = {
  SUBMITTED: {
    label: "Naipasa (Waiting Review)",
    badge: "bg-blue-100 text-blue-800 border-blue-300",
    step: 0,
  },
  UNDER_REVIEW: {
    label: "Sinusuri ng Technician",
    badge: "bg-amber-100 text-amber-900 border-amber-300",
    step: 1,
  },
  INSPECTED: {
    label: "Nainspeksyon na sa Bukid",
    badge: "bg-purple-100 text-purple-800 border-purple-300",
    step: 2,
  },
  RESOLVED: {
    label: "Nalutas na",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-300",
    step: 3,
  },
  REJECTED: {
    label: "Hindi Naaprubahan",
    badge: "bg-rose-100 text-rose-800 border-rose-300",
    step: 3,
  },
};

const FALLBACK: CaseStatusDisplay = {
  label: "Hindi Alam",
  badge: "bg-slate-100 text-slate-600 border-slate-300",
  step: 0,
};

export const caseStatusDisplay = (status: string): CaseStatusDisplay =>
  DISPLAY[status as CaseStatus] ?? FALLBACK;

/** Ordered pipeline steps for a progress timeline (excludes REJECTED). */
export const CASE_STATUS_TIMELINE: {
  key: CaseStatus;
  label: string;
}[] = [
  { key: "SUBMITTED", label: "Naipasa" },
  { key: "UNDER_REVIEW", label: "Sinusuri" },
  { key: "INSPECTED", label: "Na-inspeksyon" },
  { key: "RESOLVED", label: "Nalutas" },
];
