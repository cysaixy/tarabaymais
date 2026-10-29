export interface ParsedFarmerMessage {
  cleanText: string;
  tag: string | null;
}

export interface ParsedSubject {
  cleanSubject: string;
  hasTechnicianRequest: boolean;
}

const DAMAGE_TAG_REGEX = /\[(?:Tantiya(?:\s+na)?\s+Naapektuhan|Naapektuhan|Tantiya):\s*([^\]]+)\]/i;
const TECH_HELP_PREFIX = "[Hinihinging Tulong sa LGU Technician]";

/**
 * Parses bracket tags like "[Tantiya na Naapektuhan: 100% ng Sakahan]" from farmer message.
 */
export function parseFarmerMessage(text?: string | null): ParsedFarmerMessage {
  if (!text) return { cleanText: "", tag: null };

  let clean = text;
  let tag: string | null = null;

  const match = DAMAGE_TAG_REGEX.exec(clean);
  if (match) {
    clean = clean.replace(match[0], "").trim();
    const rawVal = match[1]?.trim() || "";
    // Format tag as "Tantiya: 100% ng sakahan ang naapektuhan"
    if (rawVal.toLowerCase().includes("naapektuhan")) {
      tag = `Tantiya: ${rawVal}`;
    } else {
      tag = `Tantiya: ${rawVal.toLowerCase()} ang naapektuhan`;
    }
  }

  // Also clean any leftover blank lines
  clean = clean.replace(/\n{3,}/g, "\n\n").trim();

  return {
    cleanText: clean,
    tag,
  };
}

/**
 * Parses subject to remove "[Hinihinging Tulong sa LGU Technician]" marker.
 */
export function parseSubject(subject?: string | null): ParsedSubject {
  if (!subject) return { cleanSubject: "Konsultasyon sa Taniman", hasTechnicianRequest: false };

  let text = subject.trim();
  let hasTechnicianRequest = false;

  if (text.includes(TECH_HELP_PREFIX)) {
    hasTechnicianRequest = true;
    text = text.replace(TECH_HELP_PREFIX, "").trim();
  }

  // If text starts or ends with dashes or colons after stripping
  text = text.replace(/^[-:\s]+|[-:\s]+$/g, "").trim();

  return {
    cleanSubject: text || "Konsultasyon sa Taniman",
    hasTechnicianRequest,
  };
}

