/**
 * PlantScan verdict computation — single source of truth for "healthy vs flagged".
 *
 * Rule: a scan is HEALTHY when the AI found no disease (case-insensitive, trimmed),
 * otherwise FLAGGED. Null / empty / "none" / "no disease" / "healthy" / "no issue"
 * all count as healthy.
 *
 * The same rule must be applied wherever scans are aggregated:
 *   - /officer/analytics/scan-trends
 *   - /officer/analytics/top-issues
 *   - any frontend replication
 */

export type ScanVerdict = "HEALTHY" | "FLAGGED";

/**
 * Compute the verdict from a scan's diagnosis + severity.
 * Case-insensitive and trimmed.
 */
export function computeScanVerdict({
  diagnosis,
  severity,
}: {
  diagnosis: string | null | undefined;
  severity: string | null | undefined;
}): ScanVerdict {
  const d = (diagnosis ?? "").trim().toLowerCase();
  const HEALTHY_TOKENS = new Set(["none", "no disease", "healthy", "no issue", "n/a", "na"]);

  // Empty diagnosis: fall through to severity check (don't auto-healthy).
  if (d.length > 0) {
    if (HEALTHY_TOKENS.has(d)) return "HEALTHY";
    return "FLAGGED";
  }

  // Fall back to severity when diagnosis is empty/null.
  const s = (severity ?? "").trim().toLowerCase();
  if (s === "high" || s === "critical") return "FLAGGED";
  return "HEALTHY";
}

/**
 * SQL WHERE fragment that computes the verdict in PostgreSQL, mirroring
 * computeScanVerdict. Use as: `WHERE ps."verdict" = ${HEALTHY_SQL}` etc.
 * The backend already stores the computed verdict on insert; this fragment is
 * kept for query-time re-derivation if needed.
 */
export const SCAN_VERDICT_SQL_CASE = `
CASE
  WHEN lower(trim(COALESCE(ps."diagnosis", ''))) IN ('none', 'no disease', 'healthy', 'no issue', 'n/a', 'na')
       THEN 'healthy'
  WHEN lower(trim(COALESCE(ps."diagnosis", ''))) <> '' THEN 'flagged'
  WHEN lower(COALESCE(ps."severity", '')) IN ('high', 'critical') THEN 'flagged'
  ELSE 'healthy'
END
`.trim();
