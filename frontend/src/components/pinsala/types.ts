export type FilterChipKey =
  | "Lahat"
  | "Bago"
  | "Sinusuri"
  | "Na-verify"
  | "Aprubado";

export type CaseStatusTL = "Bago" | "Sinusuri" | "Na-verify" | "Aprubado";

export interface CaseItem {
  id: string;
  caseNo: number;
  farmerName: string;
  barangay: string;
  damageType: string;
  hectares: number;
  status: CaseStatusTL;
  farmNote: string;
  rawStatus?: string;
  createdAt?: string;
}

export interface DamageSummaryItem {
  damageType: string;
  hectares: number;
  fillColor: string;
}

export interface BarangayCaseCount {
  barangay: string;
  count: number;
}

