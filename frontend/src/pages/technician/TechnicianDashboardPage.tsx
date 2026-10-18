import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
} from "lucide-react";
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

type TabKey = "BUOD" | "PINSALA" | "KONSULTASYON" | "MAPA";

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

  // ── Tab state (lifted so bell can switch tab) ─────────────────────────────
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

  // ── Modal / sheet state (lifted so bell can open a case) ─────────────────
  const [selectedDisaster, setSelectedDisaster] = useState<DisasterReport | null>(null);
  const [selectedCase, setSelectedCase] = useState<ExpertCase | null>(null);
  const [advisoryInput, setAdvisoryInput] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);
  const [confirmReject, setConfirmReject] = useState<string | null>(null);

  // ── Case-list filters ─────────────────────────────────────────────────────
  const [disasterFilter, setDisasterFilter] = useState<FilterGroup>("LAHAT");
  const [expertFilter, setExpertFilter] = useState<FilterGroup>("LAHAT");

  // ── Auto-refresh (60s, pause when hidden) ────────────────────────────────
  const prevUnreadCountRef = useRef<number | null>(null);
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
    /* TODO: foreground FCM handler hook goes here.
     * When onMessage fires with data.type === "EXPERT_DISPATCH" or
     * "CASE_RESOLVED", call fetchPipeline(true) to refetch the pipeline. */
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
      disasterReports.filter((d) =>
        ["SUBMITTED", "UNDER_REVIEW"].includes(d.status)
      ).length,
    [disasterReports]
  );

  const totalPending = pendingConsultations + pendingDisasterClaims;

  // Derive unread count for toast detection (runs after pipeline updates)
  const allPendingIds = useMemo(() => {
    const ids: string[] = [];
    expertCases
      .filter((c) => ["SUBMITTED", "UNDER_REVIEW", "INSPECTED"].includes(c.status))
      .forEach((c) => ids.push(`ec:${c.id}`));
    disasterReports
      .filter((d) => ["SUBMITTED", "UNDER_REVIEW"].includes(d.status))
      .forEach((d) => ids.push(`dr:${d.id}`));
    return ids;
  }, [expertCases, disasterReports]);

  useEffect(() => {
    if (prevUnreadCountRef.current === null) {
      prevUnreadCountRef.current = allPendingIds.length;
      return;
    }
    if (allPendingIds.length > prevUnreadCountRef.current) {
      toast.info("May bagong kaso na kailangang suriin", {
        description: "Tingnan ang bell para sa mga detalye.",
      });
    }
    prevUnreadCountRef.current = allPendingIds.length;
  }, [allPendingIds]);

  // ─── Filtered case lists ──────────────────────────────────────────────────

  const filteredDisasters = useMemo(
    () =>
      disasterReports.filter((d) =>
        disasterFilterStatuses[disasterFilter].includes(d.status)
      ),
    [disasterReports, disasterFilter]
  );

  const filteredExperts = useMemo(
    () =>
      expertCases.filter((ec) =>
        expertFilterStatuses[expertFilter].includes(ec.status)
      ),
    [expertCases, expertFilter]
  );

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleStatusUpdate = async (
    disasterId: string,
    newStatus: DisasterReport["status"]
  ) => {
    setSubmittingAction(true);
    try {
      await updateCaseStatus(disasterId, {
        caseType: "DISASTER_REPORT",
        status: newStatus,
      });
      await fetchPipeline(true);
      toast.success("Nai-update ang Status!", {
        description: `Ang claim ay minarkahan bilang ${caseStatusDisplay(newStatus).label}.`,
      });
      setSelectedDisaster(null);
      setConfirmReject(null);
    } catch {
      toast.error("Hindi nai-update ang status.", {
        description: "Subukan muli o i-check ang koneksyon.",
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleResolveCase = async (caseId: string) => {
    if (!advisoryInput.trim()) {
      toast.error("Kulang ang Rekomendasyon", {
        description: "Mangyaring maglagay ng payo para sa magsasaka.",
      });
      return;
    }
    setSubmittingAction(true);
    try {
      await resolveExpertCase(caseId, { recommendation: advisoryInput.trim() });
      await fetchPipeline(true);
      toast.success("Naipadala ang Payo sa Magsasaka!");
      setSelectedCase(null);
      setAdvisoryInput("");
    } catch {
      toast.error("Hindi naipadala ang rekomendasyon.", {
        description: "Subukan muli o i-check ang koneksyon.",
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await downloadAnalyticsReport({
        type: exportType,
        format: exportFormat,
      });

      // Check if the backend returned a JSON error inside the blob
      if (blob.type === "application/json") {
        const text = await blob.text();
        try {
          const json = JSON.parse(text) as { error?: string };
          toast.error("Hindi na-generate ang report", {
            description: json.error ?? "Hindi kilalang error.",
          });
        } catch {
          toast.error("Hindi na-generate ang report");
        }
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `TarabayMais_${exportType}_${stamp}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Na-download ang report!", {
        description: `${exportType} (${exportFormat.toUpperCase()})`,
      });
    } catch {
      toast.error("Hindi na-download ang report", {
        description: "Pakisubukan muli.",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = async () => {
    if (userId) clearReadNotifications(userId);
    await logout();
    toast.info("Naka-logout sa Portal");
    navigate("/officer/login");
  };

  // ─── Bell callbacks ───────────────────────────────────────────────────────

  const handleBellOpenCase = useCallback(
    (caseId: string, type: NotifType) => {
      if (type === "KONSULTASYON") {
        setActiveTab("KONSULTASYON");
        const ec = expertCases.find((c) => c.id === caseId);
        if (ec) setSelectedCase(ec);
      } else {
        setActiveTab("PINSALA");
        const dr = disasterReports.find((d) => d.id === caseId);
        if (dr) setSelectedDisaster(dr);
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
              "min-h-[48px] rounded-xl px-4 text-base font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400",
              value === p.key
                ? "bg-[#1D4ED8] text-white"
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
    <div className="min-h-screen bg-slate-100 pb-24 md:pb-8">
      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header className="bg-[#0F2A5C] text-white">
        <div className="mx-auto max-w-[1184px] px-4 md:px-12">
          <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between md:py-5">
            {/* Left: logo + title */}
            <div className="flex items-center gap-3">
              <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-[#FBBF24]">
                <Building2 className="h-7 w-7 text-[#0F2A5C]" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[22px] font-bold leading-tight">
                  Officer Portal &middot; DA Region II
                </p>
                <p className="text-[15px] text-slate-300">
                  Cagayan Valley &middot; Mais at Pinsala ng Sakuna
                </p>
              </div>
            </div>

            {/* Right: name + bell + logout */}
            <div className="flex items-center gap-3 self-start md:self-auto">
              {/* Officer info */}
              <div className="hidden md:block text-right">
                <p className="text-base font-bold leading-tight">
                  {officerName || "\u2014"}
                </p>
                <p className="text-sm text-slate-300">{officerRole}</p>
              </div>

              {/* Bell */}
              <NotificationBell
                userId={userId}
                expertCases={expertCases}
                disasterCases={disasterReports}
                onOpenCase={handleBellOpenCase}
                onViewAll={handleBellViewAll}
              />

              {/* Logout */}
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-[52px] items-center gap-2 rounded-xl border border-blue-300/50 px-4 text-base font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white active:scale-95"
              >
                <LogOut className="h-5 w-5" aria-hidden="true" />
                <span>Mag-logout</span>
              </button>
            </div>

            {/* Mobile: name row */}
            <div className="flex items-center gap-2 md:hidden">
              <p className="text-base font-bold">{officerName || "\u2014"}</p>
              <span className="text-slate-400">&middot;</span>
              <p className="text-sm text-slate-300">{officerRole}</p>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-[1184px] px-4 py-6 md:px-12 space-y-6">

        {/* ── ACTION CARDS ──────────────────────────────────────────────────── */}
        <section aria-labelledby="action-heading">
          <h2
            id="action-heading"
            className="mb-4 text-2xl font-bold text-slate-900"
          >
            Kailangan ng Aksyon Ngayon
          </h2>

          {pendingConsultations === 0 && pendingDisasterClaims === 0 ? (
            <div className="rounded-[20px] border-2 border-emerald-300 bg-[#ECFDF5] p-6 text-center">
              <p className="text-xl font-bold text-[#065F46]">
                Wala nang nakabinbin ✓
              </p>
              <p className="mt-1 text-base text-emerald-700">
                Lahat ng kaso ay na-aasikaso na.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* Card A — Consultation */}
              <div className="rounded-[20px] border-2 border-[#FDA4AF] bg-[#FFF1F2] p-6 flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#BE123C]">
                  <span className="text-3xl font-bold text-white">
                    {pendingConsultations}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xl font-bold text-[#881337]">
                    Kaso ng Konsultasyon
                  </p>
                  <p className="mt-0.5 text-base text-[#9F1239]">
                    Naghihintay ng payo mula sa technician
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("KONSULTASYON")}
                    className="mt-3 flex h-[52px] items-center gap-2 rounded-xl bg-[#BE123C] px-5 text-base font-bold text-white transition hover:bg-rose-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400 active:scale-95"
                  >
                    Suriin ang Kaso &rarr;
                  </button>
                </div>
              </div>

              {/* Card B — Disaster */}
              <div className="rounded-[20px] border-2 border-[#FDBA74] bg-[#FFF7ED] p-6 flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#C2410C]">
                  <span className="text-3xl font-bold text-white">
                    {pendingDisasterClaims}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xl font-bold text-[#7C2D12]">
                    Disaster Claim (Bagyo/Baha)
                  </p>
                  <p className="mt-0.5 text-base text-[#9A3412]">
                    Kailangang repasuhin at aprubahan
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("PINSALA")}
                    className="mt-3 flex h-[52px] items-center gap-2 rounded-xl bg-[#C2410C] px-5 text-base font-bold text-white transition hover:bg-orange-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400 active:scale-95"
                  >
                    Suriin ang Claim &rarr;
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── STAT STRIP ────────────────────────────────────────────────────── */}
        <section
          aria-label="Mga istatistika"
          className="grid gap-4"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {/* Registered farms */}
          <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
            <p className="text-base font-semibold text-slate-600">
              Rehistradong Sakahan
            </p>
            <p className="mt-1 text-4xl font-bold text-[#047857]">
              {totalFarms !== null ? totalFarms.toLocaleString() : "\u2014"}
            </p>
          </div>

          {/* Active hectares */}
          <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
            <p className="text-base font-semibold text-slate-600">
              Aktibong Taniman ng Mais
            </p>
            <p className="mt-1 text-4xl font-bold text-[#1D4ED8]">
              {totalActiveHectares !== null
                ? `${formatHa(totalActiveHectares)} ha`
                : "\u2014"}
            </p>
          </div>

          {/* Total pending */}
          <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
            <p className="text-base font-semibold text-slate-600">
              Kabuuang Nakabinbin
            </p>
            <p className="mt-1 text-4xl font-bold text-[#B45309]">
              {totalPending}
            </p>
          </div>
        </section>

        {/* ── DESKTOP TAB NAV ───────────────────────────────────────────────── */}
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
                key: "MAPA" as TabKey,
                label: "Mapa \u00b7 Malapit na",
                disabled: true,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              disabled={"disabled" in tab && tab.disabled}
              onClick={() =>
                !("disabled" in tab && tab.disabled) &&
                setActiveTab(tab.key)
              }
              className={[
                "relative flex min-h-[52px] items-center gap-2 px-5 pb-3 pt-2 text-[17px] font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400",
                activeTab === tab.key
                  ? "text-[#1D4ED8]"
                  : "disabled" in tab && tab.disabled
                  ? "cursor-not-allowed text-slate-400"
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

        {/* ── TAB CONTENT ───────────────────────────────────────────────────── */}

        {/* BUOD TAB */}
        {activeTab === "BUOD" && (
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Mga Barangay */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
                  className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#047857] text-base font-bold text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 active:scale-95 disabled:opacity-60"
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
                  className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[#047857] text-base font-bold text-[#047857] transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 active:scale-95 disabled:opacity-60"
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

        {/* PINSALA TAB */}
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
                className="flex min-h-[48px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 active:scale-95 disabled:opacity-60"
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
              <LoadingState label="Kinukuha ang mga disaster claims..." />
            ) : pipelineError ? (
              <ErrorState
                title="Hindi makuha ang mga kaso"
                message="Subukan muli ang pagkuha ng pipeline."
                onRetry={() => fetchPipeline()}
              />
            ) : filteredDisasters.length === 0 ? (
              <EmptyState
                title="Walang kaso sa ngayon"
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
                        className="mt-auto flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#1D4ED8] text-base font-bold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 active:scale-95"
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

        {/* KONSULTASYON TAB */}
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
                className="flex min-h-[48px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 active:scale-95 disabled:opacity-60"
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
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                              {ec.observation.severity === "CRITICAL"
                                ? "Kritikal"
                                : "Mataas na Priyoridad"}
                            </span>
                          )}
                      </div>

                      <div>
                        <p className="text-lg font-bold text-slate-900">
                          {ec.observation?.title ?? "Obserbasyon sa Sakahan"}
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
                        className="mt-auto flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#1D4ED8] text-base font-bold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 active:scale-95"
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

        {/* MAPA TAB (placeholder) */}
        {activeTab === "MAPA" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <MapPin className="mx-auto mb-3 h-12 w-12 text-slate-300" aria-hidden="true" />
            <p className="text-xl font-bold text-slate-600">
              Mapa &middot; Malapit na
            </p>
            <p className="mt-1 text-base text-slate-400">
              Ang interactive farm map ay darating sa susunod na bersyon.
            </p>
          </div>
        )}
      </main>

      {/* ── MOBILE BOTTOM TAB BAR ─────────────────────────────────────────── */}
      <nav
        aria-label="Nabigasyon ng pahina"
        className="fixed bottom-0 left-0 right-0 z-30 flex h-16 border-t-2 border-slate-200 bg-white md:hidden"
      >
        {(
          [
            { key: "BUOD" as TabKey, label: "Buod" },
            {
              key: "PINSALA" as TabKey,
              label: "Pinsala",
              badge: pendingDisasterClaims,
            },
            {
              key: "KONSULTASYON" as TabKey,
              label: "Konsulta",
              badge: pendingConsultations,
            },
            { key: "MAPA" as TabKey, label: "Ulat" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={[
              "relative flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400",
              activeTab === tab.key
                ? "text-[#1D4ED8]"
                : "text-slate-500 hover:text-slate-800",
            ].join(" ")}
          >
            <span className="text-sm">{tab.label}</span>
            {"badge" in tab && tab.badge > 0 && (
              <span className="absolute right-3 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#BE123C] text-[10px] font-bold text-white">
                {tab.badge}
              </span>
            )}
            {activeTab === tab.key && (
              <span className="absolute top-0 left-3 right-3 h-0.5 rounded-b-full bg-[#1D4ED8]" />
            )}
          </button>
        ))}
      </nav>

      {/* ── DISASTER REVIEW MODAL ─────────────────────────────────────────── */}
      {selectedDisaster && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Pagsusuri sa Disaster Claim"
        >
          <div className="w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-2xl md:rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <AlertTriangle className="h-6 w-6 text-orange-500" aria-hidden="true" />
                Pagsusuri sa Disaster Claim
              </h3>
              <button
                type="button"
                onClick={() => setSelectedDisaster(null)}
                aria-label="Isara"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div>
                <p className="text-slate-500">Uri ng Sakuna</p>
                <p className="mt-0.5 text-base font-bold text-slate-900">
                  {selectedDisaster.disasterType}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Porsyento ng Pinsala</p>
                <p className="mt-0.5 text-base font-black text-rose-600">
                  {Number(selectedDisaster.damagePercentage).toFixed(0)}%
                </p>
              </div>
              <div>
                <p className="text-slate-500">Tinatayang Lugi</p>
                <p className="mt-0.5 text-base font-black text-emerald-700">
                  &#8369;
                  {Number(selectedDisaster.estimatedLoss ?? 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Kasalukuyang Status</p>
                <p className="mt-0.5 text-base font-bold text-amber-600">
                  {caseStatusDisplay(selectedDisaster.status).label}
                </p>
              </div>
              {selectedDisaster.farm && (
                <div className="col-span-2">
                  <p className="text-slate-500">Sakahan</p>
                  <p className="mt-0.5 text-base font-bold text-slate-900">
                    {selectedDisaster.farm.name} &middot;{" "}
                    {selectedDisaster.farm.barangay}
                  </p>
                </div>
              )}
            </div>

            {selectedDisaster.notes && (
              <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-1 text-base font-bold text-slate-700">
                  Tala ng Magsasaka
                </p>
                <p className="text-base text-slate-700 leading-relaxed">
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
                    className="flex h-[52px] items-center justify-center rounded-xl border border-slate-300 text-base font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
                  >
                    Hindi, bumalik
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleStatusUpdate(selectedDisaster.id, "REJECTED")
                    }
                    disabled={submittingAction}
                    className="flex h-[52px] items-center justify-center gap-2 rounded-xl bg-red-600 text-base font-bold text-white transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400 active:scale-95 disabled:opacity-60"
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
                  className="flex h-[52px] items-center justify-center gap-2 rounded-xl bg-blue-600 text-base font-bold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 active:scale-95 disabled:opacity-60"
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
                  className="flex h-[52px] items-center justify-center gap-2 rounded-xl bg-emerald-600 text-base font-bold text-white transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 active:scale-95 disabled:opacity-60"
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
                  className="col-span-2 sm:col-span-1 flex h-[52px] items-center justify-center gap-2 rounded-xl border-2 border-red-400 text-base font-bold text-red-600 transition hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400 active:scale-95 disabled:opacity-60"
                >
                  <XCircle className="h-5 w-5" />
                  I-reject
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── EXPERT ADVISORY MODAL ─────────────────────────────────────────── */}
      {selectedCase && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Rekomendasyon para sa Magsasaka"
        >
          <div className="w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-2xl md:rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">
                Rekomendasyon para sa Magsasaka
              </h3>
              <button
                type="button"
                onClick={() => {
                  setSelectedCase(null);
                  setAdvisoryInput("");
                }}
                aria-label="Isara"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Case info */}
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <p className="text-lg font-bold text-slate-900">
                {selectedCase.observation?.title ?? "Obserbasyon"}
              </p>
              {selectedCase.observation?.description && (
                <p className="text-base text-slate-600 leading-relaxed">
                  {selectedCase.observation.description}
                </p>
              )}
              {selectedCase.observation?.severity && (
                <p className="text-base font-semibold text-rose-600">
                  Severity: {selectedCase.observation.severity}
                </p>
              )}
              {selectedCase.observation?.cropCycle?.farm && (
                <p className="flex items-center gap-1 text-base text-slate-500">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {selectedCase.observation.cropCycle.farm.name} &middot;{" "}
                  {selectedCase.observation.cropCycle.farm.barangay}
                </p>
              )}
            </div>

            {/* Photo */}
            {selectedCase.observation?.imageUrl && (
              <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200">
                <img
                  src={selectedCase.observation.imageUrl}
                  alt="Larawan ng obserbasyon"
                  className="w-full object-cover max-h-48"
                />
              </div>
            )}

            {/* Recommendation input */}
            <div className="mb-4">
              <label
                htmlFor="advisory-input"
                className="mb-1.5 block text-base font-bold text-slate-700"
              >
                Rekomendasyon
              </label>
              <textarea
                id="advisory-input"
                rows={4}
                value={advisoryInput}
                onChange={(e) => setAdvisoryInput(e.target.value)}
                placeholder="Hal. Mag-apply ng biopesticide o Neem extract sa hapon..."
                className="w-full resize-none rounded-2xl border border-slate-300 bg-white p-3 text-base text-slate-900 outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            {selectedCase.status !== "RESOLVED" ? (
              <button
                type="button"
                onClick={() => handleResolveCase(selectedCase.id)}
                disabled={submittingAction}
                className="flex h-[56px] w-full items-center justify-center gap-2 rounded-xl bg-[#1D4ED8] text-base font-bold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 active:scale-95 disabled:opacity-60"
              >
                {submittingAction ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Ipinapadala...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Ipadala ang Payo
                  </>
                )}
              </button>
            ) : (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="flex items-center gap-2 text-base font-bold text-emerald-800">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  Nalutas na ang kasong ito
                </p>
                {selectedCase.recommendation && (
                  <p className="mt-1 text-base text-emerald-700 leading-relaxed">
                    {selectedCase.recommendation}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TechnicianDashboardPage;
