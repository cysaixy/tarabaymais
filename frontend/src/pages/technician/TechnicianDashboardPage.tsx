import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Building2,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  LogOut,
  RefreshCw,
  Eye,
  Send,
  X,
  Loader2,
  Download,
  FileSpreadsheet,
  BarChart3,
  ShieldCheck,
  XCircle,
  Calendar,
  Phone,
  User,
  Sprout,
  Sparkles,
  Maximize2,
} from "lucide-react";
import { parseLegacyCaseDescription } from "../../lib/parseLegacyCaseDescription";
import { useAuth } from "../../context/authContext";
import {
  getCasePipeline,
  updateCaseStatus,
  resolveExpertCase,
  type DisasterReport,
  type ExpertCase,
  type CaseStatus,
} from "../../services/case.service";
import {
  getAnalyticsSummary,
  getBarangayDistribution,
  downloadAnalyticsReport,
  type BarangayDistribution,
  type ExportType,
  type ExportFormat,
} from "../../services/analytics.service";
import { caseStatusDisplay } from "../../lib/caseStatus";
import { LoadingState } from "../../components/LoadingState";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import {
  NotificationBell,
  clearReadNotifications,
  type NotifType,
} from "../../components/NotificationBell";

// ─── Tab keys ─────────────────────────────────────────────────────────────────

type TabKey = "BUOD" | "PINSALA" | "KONSULTASYON" | "ULAT";

// ─── Status filter groups ─────────────────────────────────────────────────────

type FilterGroup = "LAHAT" | "BAGO" | "SINUSURI" | "TAPOS_NA";

const disasterFilterStatuses: Record<FilterGroup, CaseStatus[]> = {
  LAHAT: ["SUBMITTED", "UNDER_REVIEW", "INSPECTED", "RESOLVED", "REJECTED"],
  BAGO: ["SUBMITTED"],
  SINUSURI: ["UNDER_REVIEW", "INSPECTED"],
  TAPOS_NA: ["RESOLVED", "REJECTED"],
};

const expertFilterStatuses: Record<FilterGroup, CaseStatus[]> = {
  LAHAT: ["SUBMITTED", "UNDER_REVIEW", "INSPECTED", "RESOLVED", "REJECTED"],
  BAGO: ["SUBMITTED"],
  SINUSURI: ["UNDER_REVIEW", "INSPECTED"],
  TAPOS_NA: ["RESOLVED", "REJECTED"],
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatHa(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const TechnicianDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, user, logout } = useAuth();

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>("BUOD");

  // ── Pipeline data ─────────────────────────────────────────────────────────
  const [disasterReports, setDisasterReports] = useState<DisasterReport[]>([]);
  const [expertCases, setExpertCases] = useState<ExpertCase[]>([]);
  const [pipelineLoading, setPipelineLoading] = useState(true);
  const [pipelineError, setPipelineError] = useState(false);

  // ── Analytics summary ─────────────────────────────────────────────────────
  const [totalFarms, setTotalFarms] = useState<number | null>(null);
  const [totalActiveHectares, setTotalActiveHectares] = useState<number | null>(null);

  // ── Barangay distribution ─────────────────────────────────────────────────
  const [barangays, setBarangays] = useState<BarangayDistribution[]>([]);
  const [barangaysLoading, setBarangaysLoading] = useState(true);
  const [barangaysError, setBarangaysError] = useState(false);

  // ── Export ────────────────────────────────────────────────────────────────
  const [exportType, setExportType] = useState<ExportType>("disaster-claims");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("xlsx");
  const [exporting, setExporting] = useState(false);

  // ── Modal / sheet state ───────────────────────────────────────────────────
  const [selectedDisaster, setSelectedDisaster] = useState<DisasterReport | null>(null);
  const [selectedCase, setSelectedCase] = useState<ExpertCase | null>(null);
  const [advisoryInput, setAdvisoryInput] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);
  const [confirmReject, setConfirmReject] = useState<string | null>(null);
  const [enlargedPhotoUrl, setEnlargedPhotoUrl] = useState<string | null>(null);

  // ── Case-list filters ─────────────────────────────────────────────────────
  const [disasterFilter, setDisasterFilter] = useState<FilterGroup>("LAHAT");
  const [expertFilter, setExpertFilter] = useState<FilterGroup>("LAHAT");

  const userId = profile?.id ?? user?.uid ?? "";

  // ─── Fetch pipeline ───────────────────────────────────────────────────────

  const fetchPipeline = useCallback(async (silent = false) => {
    if (!silent) setPipelineLoading(true);
    setPipelineError(false);
    try {
      const data = await getCasePipeline();
      setDisasterReports(data.disasterCases ?? []);
      setExpertCases(data.expertCases ?? []);
    } catch {
      if (!silent) setPipelineError(true);
    } finally {
      if (!silent) setPipelineLoading(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      const summary = await getAnalyticsSummary();
      setTotalFarms(summary.totalFarms);
      setTotalActiveHectares(
        Math.round(Number(summary.totalActiveHectares) * 100) / 100
      );
    } catch {
      // KPIs show dash — non-fatal
    }
  }, []);

  const fetchBarangays = useCallback(async () => {
    setBarangaysLoading(true);
    setBarangaysError(false);
    try {
      setBarangays(await getBarangayDistribution());
    } catch {
      setBarangaysError(true);
    } finally {
      setBarangaysLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchPipeline();
    fetchAnalytics();
    fetchBarangays();
  }, [fetchPipeline, fetchAnalytics, fetchBarangays]);

  // Auto-refresh every 60s while tab is visible
  useEffect(() => {
    const tick = async () => {
      if (document.hidden) return;
      await fetchPipeline(true);
    };
    const id = setInterval(tick, 60_000);
    const onFocus = () => fetchPipeline(true);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchPipeline]);

  // ─── Computed counts ──────────────────────────────────────────────────────

  const pendingConsultations = useMemo(
    () =>
      expertCases.filter((c) =>
        ["SUBMITTED", "UNDER_REVIEW", "INSPECTED"].includes(c.status)
      ).length,
    [expertCases]
  );

  const pendingDisasterClaims = useMemo(
    () =>
      disasterReports.filter((r) =>
        ["SUBMITTED", "UNDER_REVIEW"].includes(r.status)
      ).length,
    [disasterReports]
  );

  const totalPending = pendingConsultations + pendingDisasterClaims;

  // ─── Filtered case lists ──────────────────────────────────────────────────

  const filteredDisasters = useMemo(() => {
    const allowed = disasterFilterStatuses[disasterFilter];
    return disasterReports.filter((r) => allowed.includes(r.status));
  }, [disasterReports, disasterFilter]);

  const filteredExperts = useMemo(() => {
    const allowed = expertFilterStatuses[expertFilter];
    return expertCases.filter((c) => allowed.includes(c.status));
  }, [expertCases, expertFilter]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    try {
      if (userId) clearReadNotifications(userId);
      await logout();
      navigate("/login");
    } catch {
      toast.error("Hindi makapag-logout. Subukan muli.");
    }
  };

  const handleStatusUpdate = async (
    caseId: string,
    newStatus: CaseStatus
  ) => {
    setSubmittingAction(true);
    try {
      await updateCaseStatus(caseId, {
        caseType: "DISASTER_REPORT",
        status: newStatus,
      });
      toast.success("Na-update ang status ng claim.");
      setSelectedDisaster(null);
      setConfirmReject(null);
      await fetchPipeline(true);
    } catch {
      toast.error("Nagkaroon ng problema. Hindi na-update ang status.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleResolveCase = async (caseId: string) => {
    if (!advisoryInput.trim()) {
      toast.error("Maglagay ng rekomendasyon bago ipadala.");
      return;
    }
    setSubmittingAction(true);
    try {
      await resolveExpertCase(caseId, { recommendation: advisoryInput.trim() });
      toast.success("Naipadala ang rekomendasyon sa magsasaka.");
      setSelectedCase(null);
      setAdvisoryInput("");
      await fetchPipeline(true);
    } catch {
      toast.error("Hindi naipadala ang rekomendasyon. Subukan muli.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadAnalyticsReport({
        type: exportType,
        format: exportFormat,
      });
      toast.success("Na-download ang ulat.");
    } catch {
      toast.error("Hindi ma-download ang ulat. Subukan muli.");
    } finally {
      setExporting(false);
    }
  };

  const handleBellOpenCase = useCallback(
    (caseId: string, type: NotifType) => {
      if (type === "KONSULTASYON") {
        const found = expertCases.find((c) => c.id === caseId);
        if (found) {
          setAdvisoryInput(found.recommendation ?? "");
          setSelectedCase(found);
          setActiveTab("KONSULTASYON");
        }
      } else {
        const found = disasterReports.find((d) => d.id === caseId);
        if (found) {
          setSelectedDisaster(found);
          setActiveTab("PINSALA");
        }
      }
    },
    [expertCases, disasterReports]
  );

  const handleBellViewAll = useCallback(() => {
    setActiveTab("KONSULTASYON");
  }, []);

  // ─── Derived helpers ──────────────────────────────────────────────────────

  const officerName = profile
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : user?.displayName ?? "";

  const officerRole =
    profile?.role === "OFFICER" ? "Municipal Officer" : "Agricultural Technician";

  const barangayTotalHa = useMemo(
    () => barangays.reduce((s, b) => s + b.totalHectares, 0),
    [barangays]
  );

  // ─── Filter pills component ───────────────────────────────────────────────

  const FilterPills: React.FC<{
    value: FilterGroup;
    onChange: (v: FilterGroup) => void;
  }> = ({ value, onChange }) => {
    const pills: { key: FilterGroup; label: string }[] = [
      { key: "LAHAT", label: "Lahat" },
      { key: "BAGO", label: "Bago" },
      { key: "SINUSURI", label: "Sinusuri" },
      { key: "TAPOS_NA", label: "Tapos na" },
    ];
    return (
      <div className="flex flex-wrap gap-2">
        {pills.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange(p.key)}
            className={[
              "min-h-[48px] rounded-xl px-4 text-base font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 cursor-pointer",
              value === p.key
                ? "bg-[#1D4ED8] text-white shadow-sm"
                : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50",
            ].join(" ")}
          >
            {p.label}
          </button>
        ))}
      </div>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* ── A. HEADER (Mobile ONE compact row ~72px, Desktop full) ──────────── */}
      <header className="sticky top-0 z-30 border-b border-blue-900/20 bg-[#0F2A5C] text-white shadow-md">
        <div className="mx-auto flex max-w-[1184px] items-center justify-between px-4 py-2.5 md:py-4 md:px-12 min-h-[72px]">
          {/* Left: icon (hidden on mobile) + Title & Officer Line */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden md:flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-[#FBBF24]">
              <Building2 className="h-7 w-7 text-[#0F2A5C]" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-[22px] font-bold leading-tight truncate text-white">
                Officer Portal &middot; DA Region II
              </h1>
              <p className="hidden md:block text-[15px] text-slate-300">
                Cagayan Valley &middot; Mais at Pinsala ng Sakuna
              </p>
              <p className="block md:hidden text-sm text-slate-300 truncate mt-0.5">
                {officerName || "Opisyal"} &middot; {officerRole}
              </p>
            </div>
          </div>

          {/* Right: Same row bell + logout (and desktop name) */}
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <div className="hidden md:block text-right">
              <p className="text-base font-bold leading-tight">
                {officerName || "\u2014"}
              </p>
              <p className="text-sm text-slate-300">{officerRole}</p>
            </div>

            {/* Bell button (>= 48px) */}
            <NotificationBell
              userId={userId}
              expertCases={expertCases}
              disasterCases={disasterReports}
              onOpenCase={handleBellOpenCase}
              onViewAll={handleBellViewAll}
            />

            {/* Logout button (>= 48px) */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-[48px] md:h-[52px] items-center gap-1.5 md:gap-2 rounded-xl border border-blue-300/50 px-3.5 md:px-4 text-sm md:text-base font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white active:scale-95 cursor-pointer"
            >
              <LogOut className="h-4 w-4 md:h-5 md:w-5" aria-hidden="true" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT (pb-24 so content never hides behind 64px bottom bar) ── */}
      <main className="mx-auto max-w-[1184px] px-4 py-6 md:px-12 space-y-6 pb-24">

        {/* ── KAILANGAN NG AKSYON NGAYON (Desktop: above tabs; Mobile: Buod only) ── */}
        <section
          aria-labelledby="action-heading"
          className={`${activeTab === "BUOD" ? "block" : "hidden"} md:block space-y-4`}
        >
          <h2
            id="action-heading"
            className="text-2xl font-bold text-slate-900"
          >
            Kailangan ng Aksyon Ngayon
          </h2>

          {pendingConsultations === 0 && pendingDisasterClaims === 0 ? (
            <div className="rounded-[20px] border-2 border-emerald-300 bg-[#ECFDF5] p-5 md:p-6 text-center">
              <p className="text-xl font-bold text-[#065F46]">
                Wala nang nakabinbin &#10003;
              </p>
              <p className="mt-1 text-base text-emerald-700">
                Lahat ng kaso ay na-aasikaso na.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:gap-5 md:grid-cols-2">
              {/* Card A — Consultation */}
              <div className="rounded-[20px] border-2 border-[#FDA4AF] bg-[#FFF1F2] p-5 md:p-6 flex items-center gap-4">
                <div className="flex h-14 w-14 md:h-16 md:w-16 shrink-0 items-center justify-center rounded-full bg-[#BE123C]">
                  <span className="text-2xl md:text-3xl font-bold text-white">
                    {pendingConsultations}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg md:text-xl font-bold text-[#881337]">
                    Kaso ng Konsultasyon
                  </p>
                  <p className="mt-0.5 text-sm md:text-base text-[#9F1239]">
                    Naghihintay ng payo mula sa technician
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("KONSULTASYON")}
                    className="mt-3 flex h-[52px] items-center gap-2 rounded-xl bg-[#BE123C] px-5 text-base font-bold text-white transition hover:bg-rose-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400 active:scale-95 cursor-pointer"
                  >
                    Suriin ang Kaso &rarr;
                  </button>
                </div>
              </div>

              {/* Card B — Disaster */}
              <div className="rounded-[20px] border-2 border-[#FDBA74] bg-[#FFF7ED] p-5 md:p-6 flex items-center gap-4">
                <div className="flex h-14 w-14 md:h-16 md:w-16 shrink-0 items-center justify-center rounded-full bg-[#C2410C]">
                  <span className="text-2xl md:text-3xl font-bold text-white">
                    {pendingDisasterClaims}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg md:text-xl font-bold text-[#7C2D12]">
                    Disaster Claim (Bagyo/Baha)
                  </p>
                  <p className="mt-0.5 text-sm md:text-base text-[#9A3412]">
                    Kailangang repasuhin at aprubahan
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("PINSALA")}
                    className="mt-3 flex h-[52px] items-center gap-2 rounded-xl bg-[#C2410C] px-5 text-base font-bold text-white transition hover:bg-orange-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400 active:scale-95 cursor-pointer"
                  >
                    Suriin ang Claim &rarr;
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── B. STAT CARDS (Desktop: above tabs; Mobile: Buod only, 1 row, 3 cols) ── */}
        <section
          aria-label="Mga istatistika"
          className={`${activeTab === "BUOD" ? "grid" : "hidden"} md:grid grid-cols-3 gap-2.5 md:gap-4`}
        >
          {/* Card 1: Registered farms */}
          <div className="rounded-2xl border border-slate-300 bg-white p-3 md:p-5 shadow-sm">
            <p className="text-[13px] md:text-base font-semibold text-slate-600 truncate">
              <span className="md:hidden">Sakahan</span>
              <span className="hidden md:inline">Rehistradong Sakahan</span>
            </p>
            <p className="mt-1 text-[26px] md:text-4xl font-bold text-[#047857] leading-none">
              {totalFarms !== null ? totalFarms.toLocaleString() : "\u2014"}
            </p>
          </div>

          {/* Card 2: Active hectares */}
          <div className="rounded-2xl border border-slate-300 bg-white p-3 md:p-5 shadow-sm">
            <p className="text-[13px] md:text-base font-semibold text-slate-600 truncate">
              <span className="md:hidden">Taniman</span>
              <span className="hidden md:inline">Aktibong Taniman ng Mais</span>
            </p>
            <p className="mt-1 text-[26px] md:text-4xl font-bold text-[#1D4ED8] leading-none">
              {totalActiveHectares !== null
                ? `${formatHa(totalActiveHectares)} ha`
                : "\u2014"}
            </p>
          </div>

          {/* Card 3: Total pending */}
          <div className="rounded-2xl border border-slate-300 bg-white p-3 md:p-5 shadow-sm">
            <p className="text-[13px] md:text-base font-semibold text-slate-600 truncate">
              <span className="md:hidden">Nakabinbin</span>
              <span className="hidden md:inline">Kabuuang Nakabinbin</span>
            </p>
            <p className="mt-1 text-[26px] md:text-4xl font-bold text-[#B45309] leading-none">
              {totalPending}
            </p>
          </div>
        </section>

        {/* ── C. DESKTOP TAB ROW ─────────────────────────────────────────────── */}
        <nav
          aria-label="Mga seksyon"
          className="hidden md:flex items-end gap-0 border-b-2 border-slate-300"
        >
          {(
            [
              { key: "BUOD" as TabKey, label: "Buod" },
              {
                key: "PINSALA" as TabKey,
                label: "Pinsala",
                badge: pendingDisasterClaims,
                badgeColor: "bg-[#C2410C]",
              },
              {
                key: "KONSULTASYON" as TabKey,
                label: "Konsultasyon",
                badge: pendingConsultations,
                badgeColor: "bg-[#BE123C]",
              },
              {
                key: "ULAT" as TabKey,
                label: "Ulat",
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={[
                "relative flex min-h-[52px] items-center gap-2 px-5 pb-3 pt-2 text-[17px] font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 cursor-pointer",
                activeTab === tab.key
                  ? "text-[#1D4ED8]"
                  : "text-slate-600 hover:text-slate-900",
              ].join(" ")}
            >
              {tab.label}
              {"badge" in tab && tab.badge > 0 && (
                <span
                  className={`${tab.badgeColor} rounded-full px-2 py-0.5 text-xs font-bold text-white`}
                >
                  {tab.badge}
                </span>
              )}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-1 rounded-t-full bg-[#1D4ED8]" />
              )}
            </button>
          ))}
        </nav>

        {/* ── C. TAB CONTENT (ONLY the active tab's content is rendered) ─────── */}

        {/* TAB 1: BUOD */}
        {activeTab === "BUOD" && (
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Mga Barangay */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-slate-500" aria-hidden="true" />
                <h3 className="text-xl font-bold text-slate-900">
                  Mga Barangay
                </h3>
              </div>
              {barangaysLoading ? (
                <LoadingState label="Kinukuha ang datos ng barangay..." />
              ) : barangaysError ? (
                <ErrorState
                  title="Hindi makuha ang datos"
                  message="Subukan muli ang pagkuha ng listahan ng barangay."
                  onRetry={fetchBarangays}
                />
              ) : barangays.length === 0 ? (
                <EmptyState
                  title="Walang barangay"
                  message="Wala pang rehistradong sakahan ayon sa barangay."
                />
              ) : (
                <ul className="space-y-3">
                  {barangays.map((b) => {
                    const pct =
                      barangayTotalHa > 0
                        ? (b.totalHectares / barangayTotalHa) * 100
                        : 0;
                    return (
                      <li key={b.barangay}>
                        <div className="flex items-baseline justify-between">
                          <span className="text-base font-bold text-slate-900">
                            {b.barangay}
                          </span>
                          <span className="text-base text-slate-600">
                            {b.farmCount} sakahan &middot;{" "}
                            {formatHa(b.totalHectares)} ha
                          </span>
                        </div>
                        <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-[#047857] transition-all"
                            style={{ width: `${pct.toFixed(1)}%` }}
                            aria-label={`${pct.toFixed(0)}% ng kabuuang ektarya`}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* I-download ang Ulat */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
              <div className="mb-1 flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-slate-500" aria-hidden="true" />
                <h3 className="text-xl font-bold text-slate-900">
                  I-download ang Ulat
                </h3>
              </div>
              <p className="mb-4 text-base text-slate-500">
                Para sa disaster claims at buod ng barangay
              </p>

              {/* Type selector */}
              <div className="mb-3">
                <label
                  htmlFor="export-type"
                  className="mb-1 block text-base font-semibold text-slate-700"
                >
                  Uri ng Ulat
                </label>
                <select
                  id="export-type"
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value as ExportType)}
                  className="w-full min-h-[48px] rounded-xl border border-slate-300 bg-white px-3 text-base font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="disaster-claims">Disaster Claims</option>
                  <option value="barangay-summary">Buod ng Barangay</option>
                </select>
              </div>

              {/* Format buttons */}
              <div className="mb-4 flex gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    setExportFormat("xlsx");
                    await handleExport();
                  }}
                  disabled={exporting}
                  className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#047857] text-base font-bold text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 active:scale-95 disabled:opacity-60 cursor-pointer"
                >
                  {exporting && exportFormat === "xlsx" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Download className="h-5 w-5" aria-hidden="true" />
                  )}
                  Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setExportFormat("csv");
                    await handleExport();
                  }}
                  disabled={exporting}
                  className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[#047857] text-base font-bold text-[#047857] transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 active:scale-95 disabled:opacity-60 cursor-pointer"
                >
                  {exporting && exportFormat === "csv" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Download className="h-5 w-5" aria-hidden="true" />
                  )}
                  CSV
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PINSALA */}
        {activeTab === "PINSALA" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-bold text-slate-900">
                Disaster Claim{" "}
                <span className="ml-1 rounded-full bg-[#C2410C] px-3 py-0.5 text-sm font-bold text-white">
                  {pendingDisasterClaims}
                </span>
              </h2>
              <button
                type="button"
                onClick={() => fetchPipeline()}
                disabled={pipelineLoading}
                className="flex min-h-[48px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 active:scale-95 disabled:opacity-60 cursor-pointer"
              >
                <RefreshCw
                  className={`h-5 w-5 ${pipelineLoading ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                I-refresh
              </button>
            </div>

            <FilterPills value={disasterFilter} onChange={setDisasterFilter} />

            {pipelineLoading ? (
              <LoadingState label="Kinukuha ang mga claim..." />
            ) : pipelineError ? (
              <ErrorState
                title="Hindi makuha ang mga claim"
                message="Subukan muli ang pagkuha ng pipeline."
                onRetry={() => fetchPipeline()}
              />
            ) : filteredDisasters.length === 0 ? (
              <EmptyState
                title="Walang claim sa ngayon"
                message="Walang disaster claim na tumutugma sa napiling filter."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredDisasters.map((report) => {
                  const sd = caseStatusDisplay(report.status);
                  return (
                    <div
                      key={report.id}
                      className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm space-y-3 flex flex-col"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`rounded-full border px-3 py-0.5 text-sm font-bold ${sd.badge}`}
                        >
                          {sd.label}
                        </span>
                        <AlertTriangle
                          className="h-5 w-5 shrink-0 text-orange-500 mt-0.5"
                          aria-hidden="true"
                        />
                      </div>

                      <div>
                        <p className="text-lg font-bold text-slate-900">
                          {report.disasterType}
                        </p>
                        {report.farm && (
                          <p className="mt-0.5 flex items-center gap-1 text-base text-slate-500">
                            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                            {report.farm.name} &middot; {report.farm.barangay}
                          </p>
                        )}
                      </div>

                      {Number(report.damagePercentage) > 0 && (
                        <p className="text-base font-semibold text-rose-600">
                          Pinsala: {Number(report.damagePercentage).toFixed(0)}%
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedDisaster(report)}
                        className="mt-auto flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#1D4ED8] text-base font-bold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 active:scale-95 cursor-pointer"
                      >
                        <Eye className="h-5 w-5" aria-hidden="true" />
                        Suriin / Sagutin
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: KONSULTASYON */}
        {activeTab === "KONSULTASYON" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-bold text-slate-900">
                Kaso ng Konsultasyon{" "}
                <span className="ml-1 rounded-full bg-[#BE123C] px-3 py-0.5 text-sm font-bold text-white">
                  {pendingConsultations}
                </span>
              </h2>
              <button
                type="button"
                onClick={() => fetchPipeline()}
                disabled={pipelineLoading}
                className="flex min-h-[48px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 active:scale-95 disabled:opacity-60 cursor-pointer"
              >
                <RefreshCw
                  className={`h-5 w-5 ${pipelineLoading ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                I-refresh
              </button>
            </div>

            <FilterPills value={expertFilter} onChange={setExpertFilter} />

            {pipelineLoading ? (
              <LoadingState label="Kinukuha ang mga kaso..." />
            ) : pipelineError ? (
              <ErrorState
                title="Hindi makuha ang mga kaso"
                message="Subukan muli ang pagkuha ng pipeline."
                onRetry={() => fetchPipeline()}
              />
            ) : filteredExperts.length === 0 ? (
              <EmptyState
                title="Walang kaso sa ngayon"
                message="Walang consultation case na tumutugma sa napiling filter."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredExperts.map((ec) => {
                  const sd = caseStatusDisplay(ec.status);
                  const farm = ec.observation?.cropCycle?.farm;
                  return (
                    <div
                      key={ec.id}
                      className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm space-y-3 flex flex-col"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`rounded-full border px-3 py-0.5 text-sm font-bold ${sd.badge}`}
                        >
                          {sd.label}
                        </span>
                        {ec.observation?.severity &&
                          ["HIGH", "CRITICAL"].includes(
                            ec.observation.severity
                          ) && (
                            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-sm font-bold text-red-700">
                              {ec.observation.severity === "CRITICAL"
                                ? "Kritikal"
                                : "Mataas na Priyoridad"}
                            </span>
                          )}
                      </div>

                      <div>
                        {ec.observation?.title?.includes("[Hinihinging Tulong sa LGU Technician]") && (
                          <span className="mb-1 inline-block rounded-md bg-blue-50 px-2.5 py-0.5 text-sm font-bold text-blue-700 border border-blue-200">
                            Humingi ng tulong sa LGU Technician
                          </span>
                        )}
                        <p className="text-lg font-bold text-slate-900">
                          {ec.observation?.title?.replace(/^\[Hinihinging Tulong sa LGU Technician\]\s*/, "") ?? "Obserbasyon sa Sakahan"}
                        </p>
                        {farm && (
                          <p className="mt-0.5 flex items-center gap-1 text-base text-slate-500">
                            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                            {farm.name} &middot; {farm.barangay}
                          </p>
                        )}
                      </div>

                      {ec.observation?.severity && (
                        <p className="text-base font-semibold text-rose-600">
                          Severity: {ec.observation.severity}
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setAdvisoryInput(ec.recommendation ?? "");
                          setSelectedCase(ec);
                        }}
                        className="mt-auto flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#1D4ED8] text-base font-bold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 active:scale-95 cursor-pointer"
                      >
                        <Send className="h-5 w-5" aria-hidden="true" />
                        Suriin / Sagutin
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ULAT */}
        {activeTab === "ULAT" && (
          <div className="grid gap-5 lg:grid-cols-2">
            {/* I-download ang Ulat */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
              <div className="mb-1 flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-slate-500" aria-hidden="true" />
                <h3 className="text-xl font-bold text-slate-900">
                  I-download ang Ulat
                </h3>
              </div>
              <p className="mb-4 text-base text-slate-500">
                Pumili ng uri ng ulat para sa disaster claims o buod ng mga sakahan
              </p>

              <div className="mb-3">
                <label
                  htmlFor="export-type-tab"
                  className="mb-1 block text-base font-semibold text-slate-700"
                >
                  Uri ng Ulat
                </label>
                <select
                  id="export-type-tab"
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value as ExportType)}
                  className="w-full min-h-[48px] rounded-xl border border-slate-300 bg-white px-3 text-base font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="disaster-claims">Disaster Claims</option>
                  <option value="barangay-summary">Buod ng Barangay</option>
                </select>
              </div>

              <div className="mb-4 flex gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    setExportFormat("xlsx");
                    await handleExport();
                  }}
                  disabled={exporting}
                  className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#047857] text-base font-bold text-white transition hover:bg-emerald-800 active:scale-95 disabled:opacity-60 cursor-pointer"
                >
                  {exporting && exportFormat === "xlsx" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Download className="h-5 w-5" aria-hidden="true" />
                  )}
                  Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setExportFormat("csv");
                    await handleExport();
                  }}
                  disabled={exporting}
                  className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[#047857] text-base font-bold text-[#047857] transition hover:bg-emerald-50 active:scale-95 disabled:opacity-60 cursor-pointer"
                >
                  {exporting && exportFormat === "csv" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Download className="h-5 w-5" aria-hidden="true" />
                  )}
                  CSV
                </button>
              </div>
            </div>

            {/* Buod ng Barangay Distribution */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-slate-500" aria-hidden="true" />
                <h3 className="text-xl font-bold text-slate-900">
                  Distribusyon ng Sakahan
                </h3>
              </div>
              {barangays.length === 0 ? (
                <EmptyState
                  title="Walang tala ng barangay"
                  message="Wala pang nakatalang datos para sa ulat."
                />
              ) : (
                <ul className="space-y-3">
                  {barangays.slice(0, 6).map((b) => (
                    <li key={b.barangay} className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-base font-bold text-slate-800">{b.barangay}</span>
                      <span className="text-sm font-semibold text-slate-600">{b.farmCount} sakahan &middot; {formatHa(b.totalHectares)} ha</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── D. MOBILE BOTTOM TAB BAR (fixed, 64px, 4 equal cols, 14px bold) ── */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 h-[64px] bg-white border-t-2 border-slate-300 md:hidden"
      >
        <div className="grid grid-cols-4 h-full">
          {(
            [
              { key: "BUOD" as TabKey, label: "Buod" },
              {
                key: "PINSALA" as TabKey,
                label: "Pinsala",
                badge: pendingDisasterClaims,
                badgeColor: "bg-[#C2410C]",
              },
              {
                key: "KONSULTASYON" as TabKey,
                label: "Konsulta",
                badge: pendingConsultations,
                badgeColor: "bg-[#BE123C]",
              },
              { key: "ULAT" as TabKey, label: "Ulat" },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex h-full items-center justify-center gap-1 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 cursor-pointer ${
                  isActive
                    ? "bg-[#EFF6FF] text-[#1D4ED8]"
                    : "text-[#334155] hover:bg-slate-50"
                }`}
              >
                <span>{tab.label}</span>
                {"badge" in tab && tab.badge > 0 && (
                  <span
                    className={`ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs font-bold text-white leading-none ${tab.badgeColor}`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── DISASTER REVIEW MODAL ─────────────────────────────────────────── */}
      {selectedDisaster && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm md:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Pagsusuri sa Disaster Claim"
        >
          <div className="w-full h-full md:h-auto md:max-h-[90vh] md:max-w-xl rounded-none md:rounded-3xl bg-white p-5 md:p-7 shadow-2xl overflow-y-auto space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h3 className="flex items-center gap-2 text-xl md:text-2xl font-bold text-slate-900">
                <AlertTriangle className="h-6 w-6 text-orange-500" aria-hidden="true" />
                Pagsusuri sa Disaster Claim
              </h3>
              <button
                type="button"
                onClick={() => setSelectedDisaster(null)}
                aria-label="Isara"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 cursor-pointer"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-sm font-medium text-slate-600">Uri ng Sakuna</p>
                <p className="mt-0.5 text-[18px] font-bold text-slate-900">
                  {selectedDisaster.disasterType}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Porsyento ng Pinsala</p>
                <p className="mt-0.5 text-[18px] font-black text-rose-600">
                  {Number(selectedDisaster.damagePercentage).toFixed(0)}%
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Tinatayang Lugi</p>
                <p className="mt-0.5 text-[18px] font-black text-emerald-700">
                  &#8369;
                  {Number(selectedDisaster.estimatedLoss ?? 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Kasalukuyang Status</p>
                <p className="mt-0.5 text-[18px] font-bold text-amber-600">
                  {caseStatusDisplay(selectedDisaster.status).label}
                </p>
              </div>
              {selectedDisaster.farm && (
                <div className="col-span-2 pt-2 border-t border-slate-200">
                  <p className="text-sm font-medium text-slate-600">Sakahan</p>
                  <p className="mt-0.5 text-[18px] font-bold text-slate-900">
                    {selectedDisaster.farm.name} &middot;{" "}
                    {selectedDisaster.farm.barangay}
                  </p>
                </div>
              )}
            </div>

            {selectedDisaster.notes && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-1 text-sm font-bold uppercase tracking-wider text-slate-700">
                  Tala ng Magsasaka
                </p>
                <p className="text-base text-slate-800 leading-relaxed">
                  {selectedDisaster.notes}
                </p>
              </div>
            )}

            {/* Reject confirm guard */}
            {confirmReject === selectedDisaster.id ? (
              <div className="space-y-3">
                <p className="text-base font-semibold text-red-700">
                  Sigurado ka bang i-reject ang claim na ito?
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmReject(null)}
                    className="flex h-[52px] items-center justify-center rounded-xl border border-slate-300 text-base font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 cursor-pointer"
                  >
                    Hindi, bumalik
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleStatusUpdate(selectedDisaster.id, "REJECTED")
                    }
                    disabled={submittingAction}
                    className="flex h-[52px] items-center justify-center gap-2 rounded-xl bg-red-600 text-base font-bold text-white transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400 active:scale-95 disabled:opacity-60 cursor-pointer"
                  >
                    {submittingAction ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <XCircle className="h-5 w-5" />
                    )}
                    Oo, i-reject
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() =>
                    handleStatusUpdate(selectedDisaster.id, "UNDER_REVIEW")
                  }
                  disabled={submittingAction}
                  className="flex h-[52px] items-center justify-center gap-2 rounded-xl bg-blue-600 text-base font-bold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 active:scale-95 disabled:opacity-60 cursor-pointer"
                >
                  {submittingAction ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                  Sinusuri
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleStatusUpdate(selectedDisaster.id, "RESOLVED")
                  }
                  disabled={submittingAction}
                  className="flex h-[52px] items-center justify-center gap-2 rounded-xl bg-emerald-600 text-base font-bold text-white transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 active:scale-95 disabled:opacity-60 cursor-pointer"
                >
                  {submittingAction ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-5 w-5" />
                  )}
                  Aprubahan
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReject(selectedDisaster.id)}
                  disabled={submittingAction}
                  className="col-span-2 sm:col-span-1 flex h-[52px] items-center justify-center gap-2 rounded-xl border-2 border-red-400 text-base font-bold text-red-600 transition hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400 active:scale-95 disabled:opacity-60 cursor-pointer"
                >
                  <XCircle className="h-5 w-5" />
                  I-reject
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── E. CASE DETAIL MODAL ("Detalye ng Kaso") ───────────────────────── */}
      {selectedCase && (() => {
        const parsed = parseLegacyCaseDescription(
          selectedCase.observation?.description
        );

        // Data source priority (a. Structured fields win over b. Parsed legacy values)
        const structuredFarmer = selectedCase.observation?.farmer;
        const structuredFarmerName = structuredFarmer
          ? `${structuredFarmer.firstName || ""} ${structuredFarmer.lastName || ""}`.trim()
          : undefined;
        const farmerName =
          structuredFarmerName || parsed.farmerName || "Hindi available";
        const farmerPhone = structuredFarmer?.phone || parsed.phone || null;

        const farmStruct = selectedCase.observation?.cropCycle?.farm;
        const farmName =
          farmStruct?.name || parsed.farmName || "Hindi available";
        const barangay =
          farmStruct?.barangay || parsed.barangay || "Hindi available";
        const municipality =
          farmStruct?.municipality || parsed.municipality || "Hindi available";
        const areaHectares =
          farmStruct?.areaHectares !== undefined && farmStruct?.areaHectares !== null
            ? `${farmStruct.areaHectares} ha`
            : "Hindi available";

        const cropVariety = selectedCase.observation?.cropCycle?.variety;
        const plantingDate = selectedCase.observation?.cropCycle?.plantingDate
          ? new Date(
              selectedCase.observation.cropCycle.plantingDate
            ).toLocaleDateString("fil-PH", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : null;

        const aiDiagnosis = selectedCase.observation?.aiDiagnosis;
        const statusInfo = caseStatusDisplay(selectedCase.status);
        const severityVal = (
          selectedCase.observation?.severity || "MEDIUM"
        ).toUpperCase();
        const isSevere = severityVal === "HIGH" || severityVal === "CRITICAL";

        const hasTechnicianHelpTag =
          parsed.requestedTechnicianHelp ||
          Boolean(
            selectedCase.observation?.title?.includes(
              "[Hinihinging Tulong sa LGU Technician]"
            )
          );

        const displayTitle = selectedCase.observation?.title
          ? selectedCase.observation.title.replace(
              /^\[Hinihinging Tulong sa LGU Technician\]\s*/,
              ""
            )
          : "Ulat mula sa Magsasaka";

        const submittedDateStr = selectedCase.createdAt
          ? new Date(selectedCase.createdAt).toLocaleDateString("fil-PH", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "Hindi available";

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm md:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Detalye ng Kaso"
          >
            {/* Desktop: max-w-[760px], p-7, rounded-3xl. Mobile: full-screen sheet */}
            <div className="w-full h-full md:h-auto md:max-h-[90vh] md:max-w-[760px] rounded-none md:rounded-3xl bg-white p-5 md:p-7 shadow-2xl overflow-y-auto space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-2xl md:text-3xl font-extrabold text-slate-900">
                    Detalye ng Kaso
                  </h3>
                  <p className="text-sm font-semibold text-slate-500 mt-1">
                    Kaso #{selectedCase.id.slice(0, 8)} &middot; Konsultasyon sa Taniman
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCase(null);
                    setAdvisoryInput("");
                  }}
                  aria-label="Isara"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 cursor-pointer"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* 1. TOP ROW: Severity tag, status badge, LGU help tag, date (all 14-15px bold pills) */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Severity Tag */}
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm md:text-[15px] font-bold tracking-wide border ${
                      isSevere
                        ? "bg-rose-50 text-rose-700 border-rose-300"
                        : "bg-amber-50 text-amber-700 border-amber-300"
                    }`}
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    SEVERITY: {severityVal}
                  </span>

                  {/* Status Badge */}
                  <span
                    className={`rounded-full px-3.5 py-1.5 text-sm md:text-[15px] font-bold border ${statusInfo.badge}`}
                  >
                    {statusInfo.label}
                  </span>

                  {/* LGU Technician Help Tag */}
                  {hasTechnicianHelpTag && (
                    <span className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm md:text-[15px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      Humingi ng tulong sa LGU Technician
                    </span>
                  )}
                </div>

                {/* Date Submitted */}
                <div className="text-sm md:text-[15px] font-semibold text-slate-600 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span>
                    Isinumite: <strong className="text-slate-800">{submittedDateStr}</strong>
                  </span>
                </div>
              </div>

              {/* 2 & 3. 2-COLUMN GRID ON md+ (Magsasaka and Sakahan cards) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 2. "MAGSASAKA" CARD */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <User className="h-4 w-4 text-emerald-600" />
                        Magsasaka
                      </span>
                      {!structuredFarmer && (
                        <span
                          className="text-sm font-medium text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md"
                          title="observation.farmer is missing from backend response"
                        >
                          {farmerName !== "Hindi available" ? "Nakuha sa Tala" : "Hindi available sa backend"}
                        </span>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-slate-600">Pangalan</p>
                        <p className="text-[18px] md:text-[19px] font-bold text-slate-900 mt-0.5">
                          {farmerName}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-slate-600">Telepono</p>
                        <p className="text-[18px] md:text-[19px] font-bold text-slate-900 mt-0.5">
                          {farmerPhone || "Hindi available"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* FULL-WIDTH 52px GREEN (#047857) CALL BUTTON */}
                  {farmerPhone ? (
                    <a
                      href={`tel:${farmerPhone}`}
                      className="mt-3 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#047857] hover:bg-emerald-800 active:scale-95 text-white text-base font-bold shadow-sm transition"
                    >
                      <Phone className="h-5 w-5" />
                      <span>Tawagan</span>
                    </a>
                  ) : (
                    <div className="mt-3 flex h-[52px] w-full items-center justify-center rounded-xl bg-slate-100 text-slate-400 text-sm font-medium">
                      Walang nakatalang numero
                    </div>
                  )}
                </div>

                {/* 3. "SAKAHAN" CARD */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <Sprout className="h-4 w-4 text-emerald-600" />
                      Sakahan
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Pangalan ng Sakahan</p>
                      <p className="text-[18px] md:text-[19px] font-bold text-slate-900 mt-0.5">
                        {farmName}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-600">Barangay at Munisipyo</p>
                        <p className="text-[18px] md:text-[19px] font-bold text-slate-900 mt-0.5">
                          {barangay}, {municipality}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-600">Sukat</p>
                        <p className="text-[18px] md:text-[19px] font-bold text-slate-900 mt-0.5">
                          {areaHectares}
                        </p>
                      </div>
                    </div>

                    {(cropVariety || plantingDate) && (
                      <div className="pt-3 border-t border-slate-200 flex flex-wrap gap-4 text-sm">
                        {cropVariety && (
                          <div>
                            <span className="text-slate-600 font-medium">Bariedad: </span>
                            <strong className="text-slate-900 font-bold">{cropVariety}</strong>
                          </div>
                        )}
                        {plantingDate && (
                          <div>
                            <span className="text-slate-600 font-medium">Araw ng Pagtatanim: </span>
                            <strong className="text-slate-900 font-bold">{plantingDate}</strong>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 4. "ULAT NG MAGSASAKA" CARD */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                <span className="text-sm font-bold uppercase tracking-wider text-slate-600">
                  Ulat ng Magsasaka
                </span>
                <p className="text-[18px] md:text-[19px] font-bold text-slate-900">
                  {displayTitle}
                </p>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                  <p
                    className="text-[17px] text-slate-800 whitespace-pre-line"
                    style={{ lineHeight: 1.5 }}
                  >
                    {parsed.message || "Walang nakalakip na karagdagang mensahe."}
                  </p>
                </div>
              </div>

              {/* CONDITIONAL: "RESULTA NG AI SCAN" CARD */}
              {aiDiagnosis && (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 shadow-sm space-y-3">
                  <div className="flex items-center gap-1.5 text-indigo-950 font-bold text-sm uppercase tracking-wider">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    Resulta ng AI Scan
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <p className="text-sm text-indigo-700 font-medium">Kondisyon / Sakit</p>
                      <p className="text-[18px] font-bold text-indigo-950">
                        {aiDiagnosis.condition || "Hindi natukoy"}
                      </p>
                    </div>
                    {aiDiagnosis.confidence !== undefined && (
                      <div>
                        <p className="text-sm text-indigo-700 font-medium">Antas ng Kumpiyansa</p>
                        <p className="text-[18px] font-bold text-indigo-950">
                          {typeof aiDiagnosis.confidence === "number"
                            ? `${Math.round(aiDiagnosis.confidence * 100)}%`
                            : String(aiDiagnosis.confidence)}
                        </p>
                      </div>
                    )}
                  </div>
                  {aiDiagnosis.recommendedAction && (
                    <div className="pt-2 border-t border-indigo-200/70">
                      <p className="text-sm text-indigo-700 font-medium">Mungkahing Aksyon ng AI</p>
                      <p className="text-base text-indigo-900 mt-1 leading-relaxed">
                        {aiDiagnosis.recommendedAction}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 5. PHOTO (observation.imageUrl) IF PRESENT, TAP TO ENLARGE */}
              {selectedCase.observation?.imageUrl && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold uppercase tracking-wider text-slate-600">
                      Larawan mula sa Sakahan
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setEnlargedPhotoUrl(
                          selectedCase.observation?.imageUrl ?? null
                        )
                      }
                      className="text-sm font-bold text-[#1D4ED8] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Maximize2 className="h-4 w-4" />
                      Palakihin
                    </button>
                  </div>
                  <div
                    onClick={() =>
                      setEnlargedPhotoUrl(
                        selectedCase.observation?.imageUrl ?? null
                      )
                    }
                    className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
                    title="I-tap upang palakihin"
                  >
                    <img
                      src={selectedCase.observation.imageUrl}
                      alt="Larawan ng obserbasyon"
                      className="w-full object-cover max-h-64 transition duration-200 group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <span className="bg-white/95 text-slate-900 text-sm font-bold px-4 py-2 rounded-full shadow-md flex items-center gap-2">
                        <Maximize2 className="h-4 w-4" />
                        I-tap upang palakihin
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 6. "REKOMENDASYON" TEXTAREA (min-h-[96px], 17px text) + 56px FULL-WIDTH BUTTON */}
              {selectedCase.status !== "RESOLVED" ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                  <label
                    htmlFor="advisory-input"
                    className="block text-sm font-bold uppercase tracking-wider text-slate-700"
                  >
                    Rekomendasyon
                  </label>
                  <textarea
                    id="advisory-input"
                    rows={4}
                    value={advisoryInput}
                    onChange={(e) => setAdvisoryInput(e.target.value)}
                    placeholder="Hal. Mag-apply ng biopesticide o Neem extract sa hapon..."
                    className="w-full min-h-[96px] resize-none rounded-2xl border border-slate-300 bg-white p-4 text-[17px] text-slate-900 outline-none focus:ring-2 focus:ring-blue-300 leading-relaxed"
                  />
                  <button
                    type="button"
                    onClick={() => handleResolveCase(selectedCase.id)}
                    disabled={submittingAction}
                    className="flex h-[56px] w-full items-center justify-center gap-2 rounded-xl bg-[#1D4ED8] text-base md:text-[17px] font-bold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 active:scale-95 disabled:opacity-60 cursor-pointer shadow-md"
                  >
                    {submittingAction ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Ipinapadala...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-5 w-5" />
                        <span>Ipadala ang Payo</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 space-y-2">
                  <p className="flex items-center gap-2 text-base md:text-lg font-bold text-emerald-900">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" aria-hidden="true" />
                    Nalutas na ang kasong ito
                  </p>
                  {selectedCase.recommendation && (
                    <p className="mt-2 text-base md:text-[17px] text-emerald-950 leading-relaxed whitespace-pre-line bg-white/90 p-4 rounded-xl border border-emerald-200">
                      {selectedCase.recommendation}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── PHOTO LIGHTBOX MODAL ─────────────────────────────────────────── */}
      {enlargedPhotoUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Pinalaking Larawan"
          onClick={() => setEnlargedPhotoUrl(null)}
        >
          <div
            className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setEnlargedPhotoUrl(null)}
              aria-label="Isara ang larawan"
              className="absolute -top-12 right-0 flex h-12 w-12 items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white transition cursor-pointer"
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={enlargedPhotoUrl}
              alt="Pinalaking larawan mula sa sakahan"
              className="max-h-[85vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TechnicianDashboardPage;
