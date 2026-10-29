import type { CaseStatusTL } from "./types";
import { parseDisasterNotes } from "../../lib/parseDisasterNotes";

/**
 * Maps raw enum code or string to Filipino damage label:
 * PEST_OUTBREAK -> "Pagdami ng Peste"
 * TYPHOON -> "Bagyo"
 * FLOOD -> "Baha"
 * DROUGHT -> "Tagtuyot"
 * Any other code -> replace underscores with spaces and sentence case
 */
export function formatDamageType(raw?: string | null): string {
  if (!raw || typeof raw !== "string") return "Pinsala";

  const upper = raw.toUpperCase().trim();
  if (upper.includes("PEST") || upper.includes("PESTE")) {
    return "Pagdami ng Peste";
  }
  if (upper.includes("TYPHOON") || upper.includes("BAGYO")) {
    return "Bagyo";
  }
  if (upper.includes("FLOOD") || upper.includes("BAHA")) {
    return "Baha";
  }
  if (upper.includes("DROUGHT") || upper.includes("TAGTUYOT")) {
    return "Tagtuyot";
  }

  // Replace underscores with spaces and use sentence case
  const cleaned = raw.replace(/_/g, " ").trim().toLowerCase();
  if (!cleaned) return "Pinsala";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Maps backend CaseStatus enum to Filipino display status.
 */
export function mapCaseStatus(status?: string | null): CaseStatusTL {
  const upper = (status || "").toUpperCase().trim();
  if (upper === "SUBMITTED" || upper === "BAGO") return "Bago";
  if (upper === "UNDER_REVIEW" || upper === "SINUSURI") return "Sinusuri";
  if (upper === "INSPECTED" || upper === "NA_VERIFY" || upper === "NA-VERIFY") return "Na-verify";
  if (upper === "RESOLVED" || upper === "APRUBADO") return "Aprubado";
  return "Bago";
}

/**
 * Extracts affected hectares as a number rounded to 1 decimal place.
 */
export function extractHectares(
  reportNotes?: string | null,
  damagePercentage?: string | number | null,
  farmAreaHectares?: string | number | null
): number {
  if (reportNotes) {
    // 1. Tag [Naapektuhan: 1.5 ha ...]
    const areaTagMatch = /\[Naapektuhan:\s*(\d+(?:\.\d+)?)\s*ha/i.exec(reportNotes);
    if (areaTagMatch && areaTagMatch[1]) {
      const val = parseFloat(areaTagMatch[1]);
      if (!isNaN(val) && val > 0) return Math.round(val * 10) / 10;
    }

    // 2. Any "... X ha ..."
    const haMatch = /(\d+(?:\.\d+)?)\s*ha/i.exec(reportNotes);
    if (haMatch && haMatch[1]) {
      const val = parseFloat(haMatch[1]);
      if (!isNaN(val) && val > 0) return Math.round(val * 10) / 10;
    }
  }

  const farmHa = Number(farmAreaHectares);
  const pct = Number(damagePercentage);

  if (!isNaN(farmHa) && farmHa > 0 && !isNaN(pct) && pct > 0) {
    const calculated = (pct / 100) * farmHa;
    return Math.round(calculated * 10) / 10;
  }

  if (!isNaN(pct) && pct > 0) {
    const calculated = (pct / 100) * 2.5;
    return Math.round(calculated * 10) / 10;
  }

  return 1.0;
}

/**
 * Extracts farmer display name from notes or farm details.
 */
export function extractFarmerName(
  farmName?: string | null,
  notes?: string | null,
  verifiedFarmerName?: string | null
): string {
  if (verifiedFarmerName && verifiedFarmerName.trim()) {
    return verifiedFarmerName.trim();
  }

  if (notes) {
    const farmerTagMatch = /\(Magsasaka:\s*([^)]+)\)/i.exec(notes);
    if (farmerTagMatch && farmerTagMatch[1]?.trim()) {
      return farmerTagMatch[1].trim();
    }
  }

  if (farmName) {
    const cleaned = farmName.replace(/^Sakahan ni\s*/i, "").trim();
    if (cleaned) return cleaned;
  }

  const parsed = parseDisasterNotes(notes);
  if (parsed.cleanNotes) {
    const firstLine = parsed.cleanNotes.split("\n")[0]?.trim();
    if (
      firstLine &&
      firstLine.length > 0 &&
      firstLine.length < 25 &&
      !firstLine.toLowerCase().includes("ulat") &&
      !firstLine.toLowerCase().includes("pinsala")
    ) {
      return firstLine;
    }
  }

  return "Magsasaka";
}

/**
 * Extracts clean farm note for display.
 */
export function extractFarmNote(notes?: string | null): string {
  if (!notes) return "";
  const parsed = parseDisasterNotes(notes);
  let text = parsed.cleanNotes || notes;
  text = text.replace(/\(Magsasaka:\s*[^)]+\)/gi, "");
  text = text.replace(/\[Petsa ng Kalamidad:[^\]]+\]/gi, "");
  text = text.replace(/\[Naapektuhan:[^\]]+\]/gi, "");
  return text.trim();
}

/**
 * Damage dot colors:
 * Bagyo #1d4ed8, Baha #0e7490, Pagdami ng Peste #d99a1d, Tagtuyot #b45309
 */
export function getDamageDotColor(damageType: string): string {
  const norm = formatDamageType(damageType);
  switch (norm) {
    case "Bagyo":
      return "#1d4ed8";
    case "Baha":
      return "#0e7490";
    case "Pagdami ng Peste":
      return "#d99a1d";
    case "Tagtuyot":
      return "#b45309";
    default:
      return "#64748b";
  }
}

/**
 * Bar fill colors for dark summary panel:
 * Bagyo #f5c518, Baha #7dd3e8, Pagdami ng Peste #f0b45a, Tagtuyot #e8946b
 */
export function getDamageBarColor(damageType: string): string {
  const norm = formatDamageType(damageType);
  switch (norm) {
    case "Bagyo":
      return "#f5c518";
    case "Baha":
      return "#7dd3e8";
    case "Pagdami ng Peste":
      return "#f0b45a";
    case "Tagtuyot":
      return "#e8946b";
    default:
      return "#94a3b8";
  }
}

/**
 * Status chip color styling:
 * Bago bg #dde8ff text #1b3f9a
 * Sinusuri bg #fdeccd text #7a3a04
 * Na-verify bg #ede4ff text #5b21b6
 * Aprubado bg #d9f3e5 text #0a6b45
 */
export function getStatusChipStyle(status: CaseStatusTL): {
  backgroundColor: string;
  color: string;
} {
  switch (status) {
    case "Bago":
      return { backgroundColor: "#dde8ff", color: "#1b3f9a" };
    case "Sinusuri":
      return { backgroundColor: "#fdeccd", color: "#7a3a04" };
    case "Na-verify":
      return { backgroundColor: "#ede4ff", color: "#5b21b6" };
    case "Aprubado":
      return { backgroundColor: "#d9f3e5", color: "#0a6b45" };
    default:
      return { backgroundColor: "#dde8ff", color: "#1b3f9a" };
  }
}
