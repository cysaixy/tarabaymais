/**
 * CSV Export Utility — Convert activities to downloadable CSV
 * For farmer cost tracking and record keeping
 */

export interface ActivityForExport {
  id: string;
  activityType: string;
  description: string;
  costAmount: number | string | null;
  performedAt: string;
  createdAt: string;
  cropCycleId?: string;
  farmName?: string;
  variety?: string;
}

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fil-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function exportActivitiesToCSV(
  activities: ActivityForExport[],
  filename?: string
): void {
  const headers = [
    "Petsa ng Gawain",
    "Uri ng Gawain",
    "Paglalarawan",
    "Gastos (PHP)",
    "Petsa Nai-record",
    "Sakahan",
    "Variety ng Mais",
  ];

  const rows = activities.map(act => [
    formatDate(act.performedAt),
    act.activityType,
    act.description,
    act.costAmount ? Number(act.costAmount).toLocaleString("en-PH") : "0",
    formatDate(act.createdAt),
    act.farmName || "",
    act.variety || "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(escapeCSV).join(",")),
  ].join("\n");

  // Add BOM for proper Excel UTF-8 support
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `mga-gawain-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportObservationsToCSV(
  observations: Array<{
    id: string;
    title: string;
    description: string;
    severity: string;
    createdAt: string;
    imageUrl?: string | null;
    aiDiagnosis?: Record<string, unknown> | null;
    farmName?: string;
    variety?: string;
  }>,
  filename?: string
): void {
  const headers = [
    "Petsa",
    "Pamagat",
    "Paglalarawan",
    "Severity",
    "May Litrato",
    "AI Diagnosis",
    "Sakahan",
    "Variety",
  ];

  const rows = observations.map(obs => [
    formatDate(obs.createdAt),
    obs.title,
    obs.description,
    obs.severity,
    obs.imageUrl ? "Oo" : "Hindi",
    obs.aiDiagnosis?.condition || "Hindi na-scan",
    obs.farmName || "",
    obs.variety || "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(escapeCSV).join(",")),
  ].join("\n");

  const bom = "\uFEFF";
  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `mga-obserbasyon-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportDisastersToCSV(
  disasters: Array<{
    id: string;
    disasterType: string;
    damagePercentage: number | string;
    estimatedLoss?: number | string | null;
    status: string;
    notes?: string | null;
    createdAt: string;
    farmName?: string;
    barangay?: string;
    municipality?: string;
  }>,
  filename?: string
): void {
  const headers = [
    "Petsa",
    "Uri ng Kalamidad",
    "Pinsala (%)",
    "Tinatayang Loss (PHP)",
    "Status",
    "Mga Tala",
    "Sakahan",
    "Barangay",
    "Municipality",
  ];

  const rows = disasters.map(d => [
    formatDate(d.createdAt),
    d.disasterType,
    String(d.damagePercentage),
    d.estimatedLoss ? Number(d.estimatedLoss).toLocaleString("en-PH") : "0",
    d.status,
    d.notes || "",
    d.farmName || "",
    d.barangay || "",
    d.municipality || "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(escapeCSV).join(",")),
  ].join("\n");

  const bom = "\uFEFF";
  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `mga-ulat-kalamidad-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generic export hook for use in components
 */
export function useCSVExport() {
  const exportActivities = (activities: ActivityForExport[]) => {
    exportActivitiesToCSV(activities);
  };

  const exportObservations = (
    observations: Parameters<typeof exportObservationsToCSV>[0]
  ) => {
    exportObservationsToCSV(observations);
  };

  const exportDisasters = (
    disasters: Parameters<typeof exportDisastersToCSV>[0]
  ) => {
    exportDisastersToCSV(disasters);
  };

  return { exportActivities, exportObservations, exportDisasters };
}