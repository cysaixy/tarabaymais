/**
 * Tagalog relative-time helper.
 * No external library — converts an ISO date string to a human-readable
 * Tagalog phrase like "5 minuto ang nakalipas", "2 oras", or "Kahapon".
 */
export function tagalogRelativeTime(isoDate: string | undefined): string {
  if (!isoDate) return "";
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "Ilang segundo lamang";
  if (diffMin < 60) {
    return diffMin === 1
      ? "1 minuto ang nakalipas"
      : `${diffMin} minuto ang nakalipas`;
  }
  if (diffHr < 24) {
    return diffHr === 1 ? "1 oras ang nakalipas" : `${diffHr} oras ang nakalipas`;
  }
  if (diffDay === 1) return "Kahapon";
  if (diffDay < 7) return `${diffDay} araw ang nakalipas`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek === 1) return "Isang linggo ang nakalipas";
  if (diffWeek < 4) return `${diffWeek} linggo ang nakalipas`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth === 1) return "Isang buwan ang nakalipas";
  return `${diffMonth} buwan ang nakalipas`;
}
