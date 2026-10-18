import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Building2,
  ShieldCheck,
  TrendingUp,
  BarChart3,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  LogOut,
  RefreshCw,
  Eye,
  Send,
  Map as MapIcon,
  X,
  Sprout,
  Loader2,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { useAuth } from "../../context/authContext";
import {
  getCasePipeline,
  updateCaseStatus,
  resolveExpertCase,
  type DisasterReport,
  type ExpertCase,
} from "../../services/case.service";
import {
  getAnalyticsSummary,
  getBarangayDistribution,
  downloadAnalyticsReport,
  type BarangayDistribution,
  type ExportType,
  type ExportFormat,
} from "../../services/analytics.service";
import { ApiError } from "../../lib/api";
import { caseStatusDisplay } from "../../lib/caseStatus";

export const TechnicianDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<
    "OVERVIEW" | "DAMAGE_REPORTS" | "ASSISTANCE_CASES" | "MAP"
  >("OVERVIEW");

  const [loading, setLoading] = useState(false);
  const [disasterReports, setDisasterReports] = useState<DisasterReport[]>([]);
  const [expertCases, setExpertCases] = useState<ExpertCase[]>([]);

  // KPI state — populated from API
  const [kpi, setKpi] = useState<{
    totalFarms: number | null;
    activeHectares: number | null;
    pendingExpertCases: number | null;
  }>({ totalFarms: null, activeHectares: null, pendingExpertCases: null });
  const [kpiLoading, setKpiLoading] = useState(true);

  // Per-barangay distribution (Overview tab)
  const [barangays, setBarangays] = useState<BarangayDistribution[]>([]);
  const [barangaysLoading, setBarangaysLoading] = useState(true);

  // Export control state
  const [exportType, setExportType] = useState<ExportType>("disaster-claims");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("xlsx");
  const [exporting, setExporting] = useState(false);

  // Modal state
  const [selectedDisaster, setSelectedDisaster] = useState<DisasterReport | null>(null);
  const [selectedCase, setSelectedCase] = useState<ExpertCase | null>(null);
  const [advisoryInput, setAdvisoryInput] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  // ── Fetch pipeline (cases) ─────────────────────────────────────────────
  const fetchPipeline = async () => {
    setLoading(true);
    try {
      const data = await getCasePipeline();
      setDisasterReports(data.disasterCases ?? []);
      setExpertCases(data.expertCases ?? []);
    } catch {
      toast.error("Hindi makuha ang mga kaso.", {
        description: "Subukan muli o i-check ang koneksyon.",
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Fetch analytics summary (KPIs) via the service layer ─────────────
  const fetchAnalytics = async () => {
    setKpiLoading(true);
    try {
      const summary = await getAnalyticsSummary();
      setKpi({
        totalFarms: summary.totalFarms,
        // Round hectares for a clean KPI display (Decimal → number).
        activeHectares: Math.round(summary.totalActiveHectares * 100) / 100,
        pendingExpertCases: summary.pendingExpertCases,
      });
    } catch {
      // KPI cards will show a dash instead of crashing
    } finally {
      setKpiLoading(false);
    }
  };

  // ── Fetch per-barangay distribution ──────────────────────────────────
  const fetchBarangays = async () => {
    setBarangaysLoading(true);
    try {
      setBarangays(await getBarangayDistribution());
    } catch {
      setBarangays([]);
    } finally {
      setBarangaysLoading(false);
    }
  };

  // ── Export report (xlsx/csv) ──────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await downloadAnalyticsReport({
        type: exportType,
        format: exportFormat,
      });
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
    } catch (err) {
      const description =
        err instanceof ApiError
          ? err.message
          : "Hindi na-generate ang report. Pakisubukan muli.";
      toast.error("Hindi na-download ang report", { description });
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    fetchPipeline();
    fetchAnalytics();
    fetchBarangays();
  }, []);

  const officerName = profile
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : user?.displayName || "";

  // ── Status update (disaster reports) ─────────────────────────────────
  const handleStatusUpdate = async (
    disasterId: string,
    newStatus: DisasterReport["status"]
  ) => {
    setSubmittingAction(true);
    try {
      await updateCaseStatus(disasterId, { caseType: "DISASTER_REPORT", status: newStatus });
      setDisasterReports((prev) =>
        prev.map((d) => (d.id === disasterId ? { ...d, status: newStatus } : d))
      );
      toast.success("Nai-update ang Status ng Ulat!", {
        description: `Ang claim ay opisyal nang minarkahan bilang ${newStatus}.`,
      });
      setSelectedDisaster(null);
    } catch {
      toast.error("Hindi nai-update ang status.", {
        description: "Subukan muli o i-check ang koneksyon.",
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  // ── Resolve expert case ───────────────────────────────────────────────
  const handleResolveCase = async (caseId: string) => {
    if (!advisoryInput.trim()) {
      toast.error("Kulang ang Rekomendasyon", {
        description:
          "Mangyaring maglagay ng payo o agronomic prescription para sa magsasaka.",
      });
      return;
    }

    setSubmittingAction(true);
    try {
      await resolveExpertCase(caseId, { recommendation: advisoryInput.trim() });
      setExpertCases((prev) =>
        prev.map((c) =>
          c.id === caseId
            ? { ...c, status: "RESOLVED", recommendation: advisoryInput.trim() }
            : c
        )
      );
      toast.success("Naipadala ang Opisyal na Payo sa Magsasaka!", {
        description:
          "Nakatanggap ang magsasaka ng abiso sa kanyang Tarabay-Mais app.",
      });
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

  const handleLogout = async () => {
    await logout();
    toast.info("Naka-logout sa Portal", {
      description: "Bumalik sa authentication screen.",
    });
    navigate("/officer/login");
  };

  const pendingDisastersCount = disasterReports.filter(
    (d) => d.status === "SUBMITTED" || d.status === "UNDER_REVIEW"
  ).length;

  const pendingCasesCount = expertCases.filter(
    (c) => c.status === "SUBMITTED"
  ).length;

  // ── KPI display helper ────────────────────────────────────────────────
  const KpiValue = ({
    value,
    loading: isLoading,
    className = "",
  }: {
    value: number | null;
    loading: boolean;
    className?: string;
  }) => {
    if (isLoading) return <Loader2 className="w-7 h-7 animate-spin text-slate-400" />;
    if (value === null) return <span className={className}>—</span>;
    return <span className={className}>{value.toLocaleString()}</span>;
  };

  return (
    <div className="min-h-screen w-full bg-[#061325] text-white font-sans selection:bg-blue-500/30 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── HEADER ───────────────────────────────────────────────────────── */}
        <header className="w-full bg-linear-to-r from-[#1e3a8a] via-[#1d4ed8] to-[#1e40af] text-white rounded-3xl border border-blue-900/30 p-5 sm:p-6 shadow-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center gap-4 z-10">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-linear-to-br from-amber-400 to-amber-500 flex items-center justify-center text-amber-950 shadow-md shrink-0">
              <Building2 className="w-8 h-8 sm:w-9 sm:h-9 stroke-[2.2]" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">
                  Department of Agriculture — Region II
                </h1>
                <span className="bg-amber-400/20 border border-amber-300/40 text-amber-200 font-bold text-[11px] px-3 py-0.5 rounded-full shadow-inner">
                  Authorized Officer Portal
                </span>
              </div>
              <p className="text-xs sm:text-sm text-blue-100/90 font-medium">
                Cagayan Valley Regional Corn Operations & Disaster Monitoring Center
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 z-10 self-start lg:self-auto">
            <div className="rounded-2xl border border-blue-300/30 bg-blue-950/50 backdrop-blur-md px-4 py-2.5 flex items-center gap-3 shadow-inner">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
                <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="text-left">
                <p className="text-[10px] text-blue-200 font-semibold uppercase tracking-wider">
                  Officer On Duty:
                </p>
                <p className="text-xs sm:text-sm font-extrabold text-white">
                  {officerName || "—"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="w-11 h-11 rounded-2xl bg-blue-950/60 hover:bg-blue-900/80 border border-blue-300/30 flex items-center justify-center text-blue-100 hover:text-white transition active:scale-95 cursor-pointer shadow-sm"
              title="Mag-logout sa Officer Portal"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ── KPI CARDS ─────────────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Kabuuang Rehistradong Sakahan */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-lg space-y-2">
            <p className="text-xs font-black text-black tracking-wide uppercase">
              Kabuuang Rehistradong Sakahan
            </p>
            <div className="text-3xl sm:text-4xl font-black text-black tracking-tight min-h-10 flex items-center">
              <KpiValue value={kpi.totalFarms} loading={kpiLoading} />
            </div>
            <div className="inline-flex items-center gap-1.5 text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-300 text-xs font-bold">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Rehistrado sa Sistema</span>
            </div>
          </div>

          {/* Aktibong Luwang ng Mais */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-lg space-y-2">
            <p className="text-xs font-black text-black tracking-wide uppercase">
              Aktibong Luwang ng Mais (Corn Ha)
            </p>
            <div className="text-3xl sm:text-4xl font-black text-emerald-600 tracking-tight min-h-10 flex items-center gap-1">
              <KpiValue value={kpi.activeHectares} loading={kpiLoading} className="text-emerald-600" />
              {!kpiLoading && kpi.activeHectares !== null && (
                <span className="text-2xl"> ha</span>
              )}
            </div>
            <p className="text-xs text-black font-semibold">Cagayan River Basin Scope</p>
          </div>

          {/* Pending Disaster Claims */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-lg space-y-2">
            <p className="text-xs font-black text-black tracking-wide uppercase">
              Pending Disaster Claims (Bagyo/Baha)
            </p>
            <p className="text-3xl sm:text-4xl font-black text-amber-600 tracking-tight">
              {pendingDisastersCount}
            </p>
            <p className="text-xs text-amber-800 font-extrabold">Kailangang Repasuhin</p>
          </div>

          {/* Pending Expert Cases */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-lg space-y-2">
            <p className="text-xs font-black text-black tracking-wide uppercase">
              Pending Consultation Cases
            </p>
            <p className="text-3xl sm:text-4xl font-black text-rose-600 tracking-tight">
              {pendingCasesCount}
            </p>
            <p className="text-xs text-rose-800 font-bold">Naghihintay ng Payo</p>
          </div>
        </section>

        {/* ── TAB NAV ───────────────────────────────────────────────────────── */}
        <nav className="flex items-center gap-6 sm:gap-8 border-b-2 border-white px-2 overflow-x-auto scrollbar-none">
          {(
            [
              { key: "OVERVIEW", label: "Regional Overview" },
              {
                key: "DAMAGE_REPORTS",
                label: "Damage Reports",
                badge: pendingDisastersCount,
                badgeColor: "bg-amber-400",
              },
              {
                key: "ASSISTANCE_CASES",
                label: "Assistance Cases",
                badge: pendingCasesCount,
                badgeColor: "bg-blue-400",
              },
              { key: "MAP", label: "Cagayan Farm & Incident Map", icon: <MapIcon className="w-3.5 h-3.5" /> },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`pb-3.5 text-xs sm:text-sm font-extrabold transition cursor-pointer whitespace-nowrap relative flex items-center gap-1.5 ${
                activeTab === tab.key ? "text-white" : "text-white/80 hover:text-white"
              }`}
            >
              {"icon" in tab && tab.icon}
              <span>{tab.label}</span>
              {"badge" in tab && tab.badge > 0 && (
                <span className={`${tab.badgeColor} text-black text-[10px] font-black px-2 py-0.5 rounded-full border border-white/20`}>
                  {tab.badge}
                </span>
              )}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-1 bg-white rounded-full shadow-sm" />
              )}
            </button>
          ))}
        </nav>

        {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
        {activeTab === "OVERVIEW" && (
          <div className="space-y-5">
            {/* Per-barangay distribution */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-white" />
                <h2 className="text-sm font-extrabold text-white tracking-wide">
                  Cagayan Barangay Breakdown (Rehistradong Sakahan)
                </h2>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-lg">
                {barangaysLoading ? (
                  <div className="flex items-center justify-center py-12 gap-3 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-sm">Kinukuha ang datos ng barangay...</span>
                  </div>
                ) : barangays.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm">
                    Wala pang rehistradong sakahan kada barangay.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-700 text-xs uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Barangay</th>
                          <th className="py-3 px-4 text-right">Bilang ng Sakahan</th>
                          <th className="py-3 px-4 text-right">Kabuuang Ektarya</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {barangays.map((b) => (
                          <tr key={b.barangay} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-4 font-bold text-slate-900">{b.barangay}</td>
                            <td className="py-3 px-4 text-right font-bold text-blue-700">
                              {b.farmCount.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-700">
                              {b.totalHectares.toLocaleString(undefined, { maximumFractionDigits: 2 })} ha
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-slate-200 bg-slate-50/60">
                        <tr>
                          <td className="py-3 px-4 font-black text-slate-900">Kabuuan</td>
                          <td className="py-3 px-4 text-right font-black text-blue-800">
                            {barangays.reduce((s, b) => s + b.farmCount, 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-emerald-800">
                            {barangays
                              .reduce((s, b) => s + b.totalHectares, 0)
                              .toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                            ha
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Export panel */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-white" />
                <h2 className="text-sm font-extrabold text-white tracking-wide">
                  Mag-export ng Ulat (DA / PCIC Reporting)
                </h2>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-lg space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Uri ng Ulat
                    </label>
                    <select
                      value={exportType}
                      onChange={(e) => setExportType(e.target.value as ExportType)}
                      className="w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none"
                    >
                      <option value="disaster-claims">Disaster Claims (detalyado)</option>
                      <option value="barangay-summary">Barangay Summary (buod)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Format
                    </label>
                    <select
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                      className="w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none"
                    >
                      <option value="xlsx">Excel (.xlsx)</option>
                      <option value="csv">CSV (.csv)</option>
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exporting}
                  className="w-full min-h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-sm disabled:opacity-60"
                >
                  {exporting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Ginagawa ang report...</>
                  ) : (
                    <><Download className="w-4 h-4" /> I-download ang Report</>
                  )}
                </button>
                <p className="text-xs text-slate-500 text-center">
                  Ang report ay base sa lahat ng naitalang disaster claims sa sistema.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── DAMAGE REPORTS TAB ───────────────────────────────────────────── */}
        {activeTab === "DAMAGE_REPORTS" && (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <span>Ulat ng Pinsala mula sa mga Magsasaka (Disaster Claims)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Repasuhin at beripikahin ang claims para sa indemnification payout ng DA at PCIC.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchPipeline}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-white bg-blue-50 hover:bg-blue-600 border border-blue-200 px-3 py-1.5 rounded-xl cursor-pointer transition active:scale-95 shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>

            {loading ? (
              <div className="py-12 flex items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Kinukuha ang mga ulat...</span>
              </div>
            ) : disasterReports.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                Walang pending disaster claims sa kasalukuyan.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-700 text-xs uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Uri ng Sakuna</th>
                      <th className="py-3 px-4">Sakahan / ID</th>
                      <th className="py-3 px-4">Porsyento ng Pinsala</th>
                      <th className="py-3 px-4">Tinatayang Lugi</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Aksyon</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {disasterReports.map((report) => (
                      <tr key={report.id} className="hover:bg-slate-50 transition">
                        <td className="py-3.5 px-4 font-bold text-slate-900">{report.disasterType}</td>
                        <td className="py-3.5 px-4 text-xs font-mono text-slate-500">{report.farmId}</td>
                        <td className="py-3.5 px-4 text-xs font-bold text-rose-600">{report.damagePercentage}%</td>
                        <td className="py-3.5 px-4 text-xs font-bold text-emerald-700">
                          ₱{Number(report.estimatedLoss || 0).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${caseStatusDisplay(report.status).badge}`}
                          >
                            {caseStatusDisplay(report.status).label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedDisaster(report)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl cursor-pointer transition active:scale-95 shadow-xs inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Suriin</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── ASSISTANCE CASES TAB ─────────────────────────────────────────── */}
        {activeTab === "ASSISTANCE_CASES" && (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sprout className="w-5 h-5 text-emerald-600" />
                  <span>Kaso ng Peste at Sakit (Farmer Consultation Queue)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Magbigay ng opisyal na rekomendasyon ayon sa DA Region II Corn Techno-Guide.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchPipeline}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-white bg-blue-50 hover:bg-blue-600 border border-blue-200 px-3 py-1.5 rounded-xl cursor-pointer transition active:scale-95 shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>

            {loading ? (
              <div className="py-12 flex items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Kinukuha ang mga kaso...</span>
              </div>
            ) : expertCases.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                Walang pending expert consultation cases.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {expertCases.map((ec) => (
                  <div
                    key={ec.id}
                    className="bg-slate-50/80 rounded-2xl border border-slate-200 p-4 space-y-3 flex flex-col justify-between hover:bg-white hover:shadow-xs transition"
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="text-sm font-bold text-slate-900 leading-snug">
                          {ec.observation?.title || "Obserbasyon sa Sakahan"}
                        </h3>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full border shrink-0 ${caseStatusDisplay(ec.status).badge}`}
                        >
                          {caseStatusDisplay(ec.status).label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {ec.observation?.description}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[11px] text-slate-500">Severity:</span>
                        <span className="text-[11px] font-bold text-rose-600">
                          {ec.observation?.severity || "—"}
                        </span>
                      </div>
                      {ec.recommendation && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mt-2">
                          <p className="text-[11px] font-bold text-emerald-900">Naipadalang Rekomendasyon:</p>
                          <p className="text-xs text-emerald-800 mt-0.5">{ec.recommendation}</p>
                        </div>
                      )}
                    </div>
                    {ec.status !== "RESOLVED" && (
                      <button
                        type="button"
                        onClick={() => setSelectedCase(ec)}
                        className="w-full mt-2 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Magbigay ng Opisyal na Payo</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── MAP TAB ───────────────────────────────────────────────────────── */}
        {activeTab === "MAP" && (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  <span>Cagayan River Basin Corn Distribution & Incident Map</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rehiyon II Geo-monitoring para sa mga aktibong pananim at alert zones.
                </p>
              </div>
            </div>

            {/* Map placeholder — real map integration pending */}
            <div className="w-full h-96 bg-[#040e1c] rounded-2xl border border-slate-200 relative overflow-hidden flex flex-col items-center justify-center gap-4 p-6 shadow-inner">
              <div
                className="absolute inset-0 opacity-15"
                style={{
                  backgroundImage:
                    "linear-gradient(#2563eb 1px, transparent 1px), linear-gradient(to right, #2563eb 1px, transparent 1px)",
                  backgroundSize: "32px 32px",
                }}
              />
              <MapPin className="w-12 h-12 text-blue-400/60 relative z-10" />
              <div className="text-center relative z-10 space-y-1">
                <p className="text-sm font-bold text-white/80">
                  Mapa ay hindi pa available
                </p>
                <p className="text-xs text-white/50">
                  Ang interactive farm map ay ilalagay dito kapag naikonekta na ang GIS integration.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── DISASTER INSPECTION MODAL ────────────────────────────────────── */}
      {selectedDisaster && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5 text-slate-900">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span>Pagsusuri sa Disaster Claim</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedDisaster(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div>
                  <p className="text-slate-500">Uri ng Sakuna:</p>
                  <p className="font-bold text-slate-900 text-sm">{selectedDisaster.disasterType}</p>
                </div>
                <div>
                  <p className="text-slate-500">Porsyento ng Pinsala:</p>
                  <p className="font-black text-rose-600 text-sm">{selectedDisaster.damagePercentage}%</p>
                </div>
                <div>
                  <p className="text-slate-500">Tinatayang Halaga ng Lugi:</p>
                  <p className="font-black text-emerald-700 text-sm">
                    ₱{Number(selectedDisaster.estimatedLoss || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Kasalukuyang Status:</p>
                  <p className="font-bold text-amber-600 text-sm">
                    {caseStatusDisplay(selectedDisaster.status).label}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-slate-700 font-bold mb-1">Ulat at Paliwanag ng Magsasaka:</p>
                <p className="bg-slate-50 p-3.5 rounded-2xl text-slate-700 border border-slate-200 leading-relaxed">
                  {selectedDisaster.notes || "Walang karagdagang tala."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleStatusUpdate(selectedDisaster.id, "INSPECTED")}
                disabled={submittingAction}
                className="h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs disabled:opacity-60"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Markahan bilang Na-inspeksyon</span>
              </button>
              <button
                type="button"
                onClick={() => handleStatusUpdate(selectedDisaster.id, "RESOLVED")}
                disabled={submittingAction}
                className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs disabled:opacity-60"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Aprubahan ang Claim</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EXPERT ADVISORY MODAL ─────────────────────────────────────────── */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5 text-slate-900">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <Sprout className="w-5 h-5 text-emerald-600" />
                <span>Pagbibigay ng Opisyal na Payo sa Magsasaka</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedCase(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1">
                <p className="font-bold text-slate-900 text-sm">
                  {selectedCase.observation?.title}
                </p>
                <p className="text-slate-600">{selectedCase.observation?.description}</p>
                <p className="text-rose-600 font-bold pt-1">
                  Severity: {selectedCase.observation?.severity}
                </p>
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">
                  Agronomic Advisory / Rekomendasyon ng Technician:
                </label>
                <textarea
                  rows={4}
                  value={advisoryInput}
                  onChange={(e) => setAdvisoryInput(e.target.value)}
                  placeholder="Hal. Mag-apply ng biopesticide o Neem extract sa hapon. Iwasan ang labis na nitrogen kung may pag-uulan."
                  className="w-full rounded-2xl border border-slate-300 bg-white p-3 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleResolveCase(selectedCase.id)}
              disabled={submittingAction}
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-md disabled:opacity-60"
            >
              {submittingAction ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Ipinapadala...</>
              ) : (
                <><Send className="w-4 h-4" /> Ipadala ang Opisyal na Rekomendasyon</>
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default TechnicianDashboardPage;
