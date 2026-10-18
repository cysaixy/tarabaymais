export interface ParsedCaseDescription {
  requestedTechnicianHelp: boolean;
  message: string;
  farmerName?: string;
  phone?: string;
  farmName?: string;
  barangay?: string;
  municipality?: string;
}

const TECH_HELP_PREFIX = "[Hinihinging Tulong sa LGU Technician]";

/**
 * Parses legacy case descriptions that had farmer and farm metadata concatenated
 * at the end of the text.
 *
 * Example legacy format:
 * "[Hinihinging Tulong sa LGU Technician]\nPaninilaw ng mga dahon...\n\nMagsasaka: Juan Dela Cruz (+639170000001)\nSakahan: Bukid 1 (Gammad, Iguig)"
 *
 * Structured fields should always take precedence over parsed values.
 * If parsing fails or finds no trailing metadata, the original text is preserved in message.
 */
export function parseLegacyCaseDescription(
  rawDescription?: string | null
): ParsedCaseDescription {
  if (!rawDescription || typeof rawDescription !== "string") {
    return {
      requestedTechnicianHelp: false,
      message: "",
    };
  }

  try {
    let text = rawDescription.trim();
    let requestedTechnicianHelp = false;

    // 1. Detect and strip leading LGU technician help marker
    if (text.startsWith(TECH_HELP_PREFIX)) {
      requestedTechnicianHelp = true;
      text = text.slice(TECH_HELP_PREFIX.length).trim();
    }

    let farmerName: string | undefined;
    let phone: string | undefined;
    let farmName: string | undefined;
    let barangay: string | undefined;
    let municipality: string | undefined;

    // 2. Try matching trailing "Magsasaka: ... Sakahan: ..." segment
    // Handles variations with newlines, spaces, phone in parens, and barangay/municipality in parens
    const combinedRegex =
      /(?:[\r\n\s]+|^)Magsasaka:\s*([^\r\n(]+?)(?:\s*\(([^)\r\n]+)\))?(?:[\r\n\s]+)Sakahan:\s*([^\r\n(]+?)(?:\s*\(([^,\r\n)]+)(?:,\s*([^\r\n)]+))?\))?\s*$/i;

    const combinedMatch = text.match(combinedRegex);
    if (combinedMatch && combinedMatch.index !== undefined) {
      farmerName = combinedMatch[1]?.trim() || undefined;
      phone = combinedMatch[2]?.trim() || undefined;
      farmName = combinedMatch[3]?.trim() || undefined;
      barangay = combinedMatch[4]?.trim() || undefined;
      municipality = combinedMatch[5]?.trim() || undefined;

      const remainingText = text.slice(0, combinedMatch.index).trim();
      text = remainingText || text; // Fall back to text if empty
    } else {
      // 3. Fallback: try stripping trailing Sakahan then trailing Magsasaka individually
      const sakahanRegex =
        /(?:[\r\n\s]+|^)Sakahan:\s*([^\r\n(]+?)(?:\s*\(([^,\r\n)]+)(?:,\s*([^\r\n)]+))?\))?\s*$/i;
      const sakahanMatch = text.match(sakahanRegex);
      if (sakahanMatch && sakahanMatch.index !== undefined) {
        farmName = sakahanMatch[1]?.trim() || undefined;
        barangay = sakahanMatch[2]?.trim() || undefined;
        municipality = sakahanMatch[3]?.trim() || undefined;
        text = text.slice(0, sakahanMatch.index).trim();
      }

      const magsasakaRegex =
        /(?:[\r\n\s]+|^)Magsasaka:\s*([^\r\n(]+?)(?:\s*\(([^)\r\n]+)\))?\s*$/i;
      const magsasakaMatch = text.match(magsasakaRegex);
      if (magsasakaMatch && magsasakaMatch.index !== undefined) {
        farmerName = magsasakaMatch[1]?.trim() || undefined;
        phone = magsasakaMatch[2]?.trim() || undefined;
        text = text.slice(0, magsasakaMatch.index).trim();
      }
    }

    // Clean any trailing whitespace or empty lines
    const finalMessage = text.trim() || rawDescription.trim();

    return {
      requestedTechnicianHelp,
      message: finalMessage,
      farmerName,
      phone,
      farmName,
      barangay,
      municipality,
    };
  } catch {
    // If parsing fails for any reason, return the full raw text unchanged
    return {
      requestedTechnicianHelp: false,
      message: rawDescription,
    };
  }
}
