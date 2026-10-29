/**
 * Formats a phone number for display (e.g. 0917 123 4567).
 * If missing or invalid, returns "Walang numero".
 */
export function formatPhoneDisplay(raw?: string | null): string {
  if (!raw || !raw.trim()) return "Walang numero";
  const trimmed = raw.trim();

  // Handle +63 format
  let standard = trimmed;
  if (standard.startsWith("+63")) {
    standard = "0" + standard.slice(3);
  }

  // Check if 11 standard Philippine mobile digits: 09XXXXXXXXX
  const digits = standard.replace(/\s+/g, "");
  if (/^09\d{9}$/.test(digits)) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }

  // If already formatted or masked like 09XX XXX XXXX
  return trimmed;
}

/**
 * Converts a phone number to international format:
 * Replaces leading "0" with "+63", strips spaces and dashes.
 * Returns null if the phone is missing or contains placeholder letters.
 */
export function toInternationalPhone(raw?: string | null): string | null {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();

  // If it's a masked or placeholder phone like "09XX...", it cannot be dialed
  if (/[a-zA-Z]/.test(trimmed)) {
    return null;
  }

  let clean = trimmed.replace(/[\s\-()]/g, "");
  if (!clean) return null;

  if (clean.startsWith("0")) {
    clean = "+63" + clean.slice(1);
  } else if (clean.startsWith("9") && clean.length === 10) {
    clean = "+63" + clean;
  } else if (!clean.startsWith("+")) {
    clean = "+" + clean;
  }

  // Must have at least 10 digits after +
  if (!/^\+\d{10,15}$/.test(clean)) {
    return null;
  }

  return clean;
}

/**
 * Copies text to clipboard with fallback.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text || text === "Walang numero") return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }

  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}
