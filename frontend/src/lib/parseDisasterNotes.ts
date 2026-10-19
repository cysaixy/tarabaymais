/**
 * Parses bracket-tagged metadata that FarmerDisasterReportPage embeds in
 * the notes field while structured backend fields don't exist yet.
 *
 * Recognised tags (both are optional):
 *   [Petsa ng Kalamidad: YYYY-MM-DD]
 *   [Naapektuhan: X ha mula sa Y ha (Z%)]
 *
 * Returns the remaining free-text (stripped of tags) plus parsed values.
 * Safe on any failure — returns the original notes unchanged.
 */
export interface ParsedDisasterNotes {
  /** Free-text farmer message with bracket tags removed. */
  cleanNotes: string;
  /** Formatted date string e.g. "Okt 2, 2026", or null if not present/parseable. */
  disasterDateStr: string | null;
  /** Affected area string e.g. "1.5 ha mula sa 4.5 ha", or null if not present. */
  affectedAreaStr: string | null;
}

const DATE_TAG_RE = /\[Petsa ng Kalamidad:\s*(\d{4}-\d{2}-\d{2})\]/i;
const AREA_TAG_RE = /\[Naapektuhan:\s*([^\]]+)\]/i;

/** Short Tagalog month abbreviations matching the project locale. */
const MONTHS_TL = [
  "Ene", "Peb", "Mar", "Abr", "May", "Hun",
  "Hul", "Ago", "Set", "Okt", "Nob", "Dis",
] as const;

function formatDateTag(iso: string): string | null {
  try {
    // Parse as local date to avoid UTC-offset day-shift.
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return null;
    return `${MONTHS_TL[m - 1]} ${d}, ${y}`;
  } catch {
    return null;
  }
}

export function parseDisasterNotes(
  notes?: string | null,
): ParsedDisasterNotes {
  if (!notes || typeof notes !== "string") {
    return { cleanNotes: "", disasterDateStr: null, affectedAreaStr: null };
  }

  try {
    let text = notes;

    const dateMatch = DATE_TAG_RE.exec(text);
    const disasterDateStr = dateMatch ? formatDateTag(dateMatch[1]) : null;
    if (dateMatch) text = text.replace(dateMatch[0], "");

    const areaMatch = AREA_TAG_RE.exec(text);
    // Strip the percentage portion — we only want "X ha mula sa Y ha"
    const affectedAreaStr = areaMatch
      ? areaMatch[1].replace(/\s*\([^)]*%[^)]*\)/, "").trim()
      : null;
    if (areaMatch) text = text.replace(areaMatch[0], "");

    // Collapse consecutive blank lines produced by tag removal.
    const cleanNotes = text.replace(/\n{3,}/g, "\n\n").trim();

    return { cleanNotes, disasterDateStr, affectedAreaStr };
  } catch {
    return { cleanNotes: notes, disasterDateStr: null, affectedAreaStr: null };
  }
}
