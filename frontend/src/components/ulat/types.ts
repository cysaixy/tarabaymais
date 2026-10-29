import type { ExportType, ExportFormat } from "../../services/analytics.service";
import type { BarangayDistribution } from "../../services/analytics.service";

export type { ExportType, ExportFormat };

export interface ReportTypeOption {
  id: ExportType;
  label: string;
  description: string;
}

export interface ReportScope {
  barangayLabel: string;
  rangeLabel: string;
  rowCount: number;
}

export interface UlatViewProps {
  // Report builder
  selectedReportType: ExportType;
  onSelectReportType: (type: ExportType) => void;
  scope: ReportScope;
  onDownload: (format: ExportFormat) => Promise<void>;
  isDownloading: boolean;
  downloadSuccess: boolean;
  downloadError: string | null;

  // Distribution panel
  municipality: string;
  barangays: BarangayDistribution[];
  barangaysLoading: boolean;
  barangaysError: string | null;

  isLoading?: boolean;
}

