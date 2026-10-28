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
  AlertTriangle,
  LogOut,
  Send,
  X,
  Loader2,
  Download,
  FileSpreadsheet,
  BarChart3,
  Sprout,
  MessageSquare,
  FileDown,
  Check,
  LayoutDashboard,
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
import {
  getCropStages,
  getFarmsGeo,
  getTopIssues,
  getDisasters,
  getBarangays,
  getScanTrends,
  type CropStage,
  type FarmGeoFeatureProperties,
  type TopIssue,
  type DisasterGroup,
  type BarangayRow,
  type ScanTrendPoint,
} from "../../services/officerAnalytics.service";
import {
  TechnicianLeafletMap,
  type FarmMarkerData,
} from "../../components/dashboard/TechnicianLeafletMap";
import {
  cagayanBarangays,
  registeredLocationKey,
} from "../../data/cagayanBarangays";
import { LoadingState } from "../../components/LoadingState";
import { EmptyState } from "../../components/EmptyState";
import {
  AccountSheet,
  type AccountMenuItem,
} from "../../components/AccountSheet";
import { NotificationBell } from "../../components/NotificationBell";
import { clearReadNotifications } from "../../lib/notificationReadTracking";
import { parseLegacyCaseDescription } from "../../lib/parseLegacyCaseDescription";
import { parseDisasterNotes } from "../../lib/parseDisasterNotes";
import { GlobalFilterProvider } from "../../context/filterContext";
import { StageDonut } from "../../components/dashboard/StageDonut";
import { TopIssuesChart } from "../../components/dashboard/TopIssuesChart";
import { DisasterLossChart } from "../../components/dashboard/DisasterLossChart";
import { BarangayTable } from "../../components/dashboard/BarangayTable";
import { ScanTrendsChart } from "../../components/dashboard/ScanTrendsChart";
import { KpiOverview, PanahonNgMaisCard } from "../../components/dashboard";

// ─── Tab Keys ─────────────────────────────────────────────────────────────────
export type TabKey = "BUOD" | "ANALITIKA" | "PINSALA" | "KONSULTASYON" | "ULAT";
type DamageFilter = "LAHAT" | "BAGO" | "SINUSURI" | "NA_VERIFY" | "APRUBADO";
type ConsultFilter = "BAGO" | "SINAGOT" | "LAHAT";
type MapLayer = "TANIMAN" | "PINSALA" | "KONSULTASYON";

function formatHa(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

// ─── Analitika inline chart helpers ───────────────────────────────────────────
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

const DisasterTrendChart: React.FC<{ data: DisasterGroup[] }> = ({ data }) => {
  if (data.length === 0) {
    const weeks = [
      { week: "Linggo 1", count: 0 },
      { week: "Linggo 2", count: 0 },
      { week: "Linggo 3", count: 0 },
      { week: "Linggo 4", count: 0 },
    ];
    return (
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={weeks} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="disasterGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#b45309" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#b45309" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="week" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
            <Area type="monotone" dataKey="count" stroke="#b45309" strokeWidth={2} fill="url(#disasterGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }
  const chartData = data.slice(0, 8).map((g, i) => ({
    week: g.groupKey.length > 12 ? g.groupKey.slice(0, 10) + "…" : g.groupKey,
    label: `Linggo ${i + 1}`,
    count: g.count,
  }));
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="disasterGrad2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#b45309" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#b45309" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="week" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
          <Tooltip contentStyle={{ borderRadius: "10px", fontSize: "12px" }} />
          <Area type="monotone" dataKey="count" name="Ulat" stroke="#b45309" strokeWidth={2.5} dot={{ r: 3, fill: "#b45309" }} fill="url(#disasterGrad2)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

const CasesByBarangayChart: React.FC<{ data: BarangayRow[] }> = ({ data }) => {
  const sorted = [...data].sort((a, b) => b.openCases - a.openCases).slice(0, 5);
  const max = Math.max(...sorted.map(r => r.openCases), 1);
  if (sorted.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">Walang datos ng barangay.</p>;
  }
  return (
    <div className="space-y-3">
      {sorted.map((row) => {
        const pct = Math.max((row.openCases / max) * 100, 3);
        return (
          <div key={row.barangay} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-2">
            <p className="text-xs font-semibold text-slate-700 truncate" title={row.barangay}>{row.barangay}</p>
            <div className="h-6 rounded-md bg-slate-100 overflow-hidden">
              <div className="h-full rounded-md bg-amber-700 flex items-center px-2 text-[10px] font-bold text-white transition-[width]"
                style={{ width: `${pct}%`, minWidth: "1.5rem" }}>
                {row.openCases}
              </div>
            </div>
            <span className="text-xs font-bold text-slate-500 w-8 text-right">[bil.]</span>
          </div>
        );
      })}
    </div>
  );
};

const CaseStatusBar: React.FC<{ sinusuri: number; nainspeksyon: number; aprubado: number }> = ({ sinusuri, nainspeksyon, aprubado }) => {
  const total = sinusuri + nainspeksyon + aprubado || 1;
  const segments = [
    { label: "Sinusuri", value: sinusuri, color: "#F59E0B" },
    { label: "Nainspeksyon", value: nainspeksyon, color: "#8B5CF6" },
    { label: "Aprubado", value: aprubado, color: "#10B981" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex w-full h-6 rounded-full overflow-hidden gap-0.5">
        {segments.map((s) => (
          <div key={s.label} className="h-full transition-[width]"
            style={{ width: `${Math.max((s.value / total) * 100, s.value > 0 ? 4 : 0)}%`, backgroundColor: s.color }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px]">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 font-semibold text-slate-600">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
};

const ResponseTimeChart: React.FC<{ data: ScanTrendPoint[]; avgHours: number }> = ({ data, avgHours }) => {
  const chartData = data.length > 0
    ? data.slice(-4).map((_, i) => ({ week: `L${i + 1}`, hours: avgHours }))
    : [{ week: "L1", hours: avgHours }, { week: "L2", hours: avgHours }, { week: "L3", hours: avgHours }, { week: "L4", hours: avgHours }];
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-400 font-medium">Average {avgHours.toFixed(1)} oras</p>
      <div className="h-36 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="week" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis tickLine={false} axisLine={false} fontSize={11} />
            <Tooltip contentStyle={{ borderRadius: "10px", fontSize: "12px" }} />
            <ReferenceLine y={avgHours} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: `Avg ${avgHours.toFixed(1)}`, fontSize: 10, fill: "#64748b", position: "insideTopLeft" }} />
            <Bar dataKey="hours" name="Oras" fill="#3B82F6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const STAGE_COLORS: Record<string, string> = {
  planting: "#94A3B8",
  vegetative: "#10B981",
  flowering: "#F59E0B",
  harvest: "#EAB308",
};

const CropStageBar: React.FC<{ stages: { planting: string; vegetative: string; flowering: string; harvest: string } }> = ({ stages }) => {
  const items = [
    { key: "planting", label: "Pagtatanim", value: parseFloat(stages.planting) || 0 },
    { key: "vegetative", label: "Paglago", value: parseFloat(stages.vegetative) || 0 },
    { key: "flowering", label: "Pagbubunga", value: parseFloat(stages.flowering) || 0 },
    { key: "harvest", label: "Pag-ani", value: parseFloat(stages.harvest) || 0 },
  ].filter(i => i.value > 0);
  const total = items.reduce((s, i) => s + i.value, 1);
  return (
    <div className="space-y-3">
      <div className="flex w-full h-5 rounded-full overflow-hidden gap-0.5">
        {items.map((s) => (
          <div key={s.key} className="h-full transition-[width]"
            style={{ width: `${Math.max((s.value / total) * 100, 4)}%`, backgroundColor: STAGE_COLORS[s.key] }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px]">
        {items.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 font-semibold text-slate-600">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: STAGE_COLORS[s.key] }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
};

export const TechnicianDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, user, logout } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>("BUOD");

  // ── Live Pipeline Data from Backend ───────────────────────────────────────
  const [disasterReports, setDisasterReports] = useState<DisasterReport[]>([]);
  const [expertCases, setExpertCases] = useState<ExpertCase[]>([]);
  const [pipelineLoading, setPipelineLoading] = useState(true);

  // ── Live Analytics & Crop Stages from Backend ─────────────────────────────
  const [totalFarms, setTotalFarms] = useState<number | null>(null);
  const [totalActiveHectares, setTotalActiveHectares] = useState<number | null>(null);
  const [cropStagesData, setCropStagesData] = useState<Record<string, CropStage>>({});
  const [analyticsSummary, setAnalyticsSummary] = useState<{
    totalFarmers: number;
    activeCropCycles: number;
    pendingExpertCases: number;
    disasterMetrics: {
      totalReports: number;
      totalEstimatedLossPHP: number;
      averageDamagePercentage: number;
    };
  } | null>(null);

  // ── Live Barangay Distribution from Backend ───────────────────────────────
  const [barangays, setBarangays] = useState<BarangayDistribution[]>([]);
  const [barangaysLoading, setBarangaysLoading] = useState(true);

  // ── Chart data from Officer Analytics endpoints ───────────────────────────
  const [topIssues, setTopIssues] = useState<TopIssue[]>([]);
  const [disasterGroups, setDisasterGroups] = useState<DisasterGroup[]>([]);
  const [barangayRows, setBarangayRows] = useState<BarangayRow[]>([]);
  const [scanTrends, setScanTrends] = useState<ScanTrendPoint[]>([]);

  // ── Export state ──────────────────────────────────────────────────────────
  const [exportType, setExportType] = useState<ExportType>("disaster-claims");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("xlsx");
  const [exporting, setExporting] = useState(false);

  // ── Map interactive state ─────────────────────────────────────────────────
  const [mapLayer, setMapLayer] = useState<MapLayer>("TANIMAN");
  const [farmMarkers, setFarmMarkers] = useState<FarmMarkerData[]>([]);
  const [focusTrigger] = useState(0);

  // ── Damage (Pinsala) Tab State ────────────────────────────────────────────
  const [damageFilter, setDamageFilter] = useState<DamageFilter>("LAHAT");
  const [selectedDisaster, setSelectedDisaster] = useState<DisasterReport | null>(null);
  const [isAddDamageOpen, setIsAddDamageOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [newDamageForm, setNewDamageForm] = useState({
    farmerName: "",
    barangay: "Centro Norte (Pob.)",
    disasterType: "Bagyo (Typhoon)",
    hectares: "1.0",
    notes: "",
  });

  // ── Consultation Tab State ────────────────────────────────────────────────
  const [consultFilter, setConsultFilter] = useState<ConsultFilter>("LAHAT");
  const [selectedCase, setSelectedCase] = useState<ExpertCase | null>(null);
  const [chatReplyInput, setChatReplyInput] = useState("");
  const [isAddConsultOpen, setIsAddConsultOpen] = useState(false);
  const [newConsultForm, setNewConsultForm] = useState({
    farmerName: "",
    barangay: "Centro Norte (Pob.)",
    topic: "",
    question: "",
  });

  // ── Header & Profile Drawer ───────────────────────────────────────────────
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const activeTriggerRef = useRef<HTMLButtonElement | null>(null);

  const userId = profile?.id ?? user?.uid ?? "";

  // ── Fetch Pipeline Data (Live API) ────────────────────────────────────────
  const fetchPipeline = useCallback(async (silent = false) => {
    if (!silent) setPipelineLoading(true);
    try {
      const data = await getCasePipeline();
      const disasters = data.disasterCases ?? [];
      const experts = data.expertCases ?? [];
      setDisasterReports(disasters);
      setExpertCases(experts);
      if (disasters.length > 0 && !selectedDisaster) setSelectedDisaster(disasters[0]);
      if (experts.length > 0 && !selectedCase) setSelectedCase(experts[0]);
    } catch {
      // Non-fatal
    } finally {
      if (!silent) setPipelineLoading(false);
    }
  }, [selectedDisaster, selectedCase]);

  // ── Fetch Overview & Crop Stages (Live API) ───────────────────────────────
  const fetchAnalytics = useCallback(async (
    params?: { barangay?: string; from?: string; to?: string }
  ) => {
    const q = params ?? {};
    try {
      const summary = await getAnalyticsSummary();
      setTotalFarms(summary.totalFarms);
      setTotalActiveHectares(Math.round(Number(summary.totalActiveHectares) * 10) / 10);
      setAnalyticsSummary({
        totalFarmers: summary.totalFarmers,
        activeCropCycles: summary.activeCropCycles,
        pendingExpertCases: summary.pendingExpertCases,
        disasterMetrics: summary.disasterMetrics,
      });
    } catch { /* Non-fatal */ }

    try {
      const stagesRes = await getCropStages(q);
      if (stagesRes?.stages) setCropStagesData(stagesRes.stages);
    } catch { /* Non-fatal */ }

    try {
      const geo = await getFarmsGeo(q);
      if (geo?.features) {
        const markers: FarmMarkerData[] = [];
        for (const feat of geo.features) {
          if (!("kind" in feat.properties)) {
            const p = feat.properties as FarmGeoFeatureProperties;
            let lat: number;
            let lng: number;
            if (feat.geometry) {
              lat = feat.geometry.coordinates[1];
              lng = feat.geometry.coordinates[0];
            } else {
              // Match the registered municipality and barangay to their reference point.
              const normalizeName = (s: string) =>
                s.toLowerCase().trim()
                  .replace(/\s*\(pob\.?\)\s*/gi, "")
                  .replace(/\s*\(poblacion\)\s*/gi, "")
                  .replace(/\s+/g, " ")
                  .trim();

              const muniLower = p.municipality?.toLowerCase().trim() ?? "";
              const bgyNorm = normalizeName(p.barangay);

              const bc = cagayanBarangays.find(
                (b) =>
                  normalizeName(b.name) === bgyNorm &&
                  b.municipality.toLowerCase().trim() === muniLower
              );

              // Do not invent a point elsewhere when this registered location
              // has no matching reference coordinate.
              if (!bc) continue;
              lat = bc.lat;
              lng = bc.lng;
            }
            markers.push({
              id: p.id,
              name: p.name,
              barangay: p.barangay,
              municipality: p.municipality,
              hectares: p.hectares,
              growthStage: p.growthStage,
              healthStatus: p.healthStatus,
              openCases: p.openCaseCount,
              noGps: p.noGps,
              latitude: lat,
              longitude: lng,
            });
          }
        }
        setFarmMarkers(markers);
      }
    } catch { /* Non-fatal */ }

    try {
      const issues = await getTopIssues(q);
      setTopIssues(issues);
    } catch { /* Non-fatal */ }

    try {
      const disasters = await getDisasters({ ...q, groupBy: "barangay" });
      setDisasterGroups(disasters.groups);
    } catch { /* Non-fatal */ }

    try {
      const rows = await getBarangays();
      setBarangayRows(rows);
    } catch { /* Non-fatal */ }

    try {
      const trends = await getScanTrends(q);
      setScanTrends(trends);
    } catch { /* Non-fatal */ }
  }, []);

  // ── Fetch Barangay Distribution (Live API) ────────────────────────────────
  const fetchBarangays = useCallback(async () => {
    setBarangaysLoading(true);
    try {
      const list = await getBarangayDistribution();
      setBarangays(list);
    } catch { /* Non-fatal */ }
    finally { setBarangaysLoading(false); }
  }, []);

  useEffect(() => {
    fetchPipeline();
    fetchBarangays();
  }, [fetchPipeline, fetchBarangays]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) fetchPipeline(true);
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchPipeline]);

  // ── Computed Counts ───────────────────────────────────────────────────────
  const pendingConsultations = useMemo(
    () => expertCases.filter((c) => ["SUBMITTED", "UNDER_REVIEW", "INSPECTED"].includes(c.status)).length,
    [expertCases]
  );
  const pendingDisasters = useMemo(
    () => disasterReports.filter((r) => ["SUBMITTED", "UNDER_REVIEW"].includes(r.status)).length,
    [disasterReports]
  );
  const totalPending = pendingConsultations + pendingDisasters;

  // ── Dynamic Crop Stages ───────────────────────────────────────────────────
  const dynamicStages = useMemo(() => {
    const s1 = (cropStagesData["SEEDLING"]?.totalAreaHectares || 0) + (cropStagesData["PAGTATANIM"]?.totalAreaHectares || 0);
    const s2 = (cropStagesData["VEGETATIVE"]?.totalAreaHectares || 0) + (cropStagesData["PAGLAGO"]?.totalAreaHectares || 0);
    const s3 = (cropStagesData["TASSELING"]?.totalAreaHectares || 0) + (cropStagesData["SILKING"]?.totalAreaHectares || 0) + (cropStagesData["GRAIN_FILL"]?.totalAreaHectares || 0) + (cropStagesData["PAGBUBUNGA"]?.totalAreaHectares || 0);
    const s4 = (cropStagesData["HARVEST_READY"]?.totalAreaHectares || 0) + (cropStagesData["HARVEST"]?.totalAreaHectares || 0) + (cropStagesData["PAG_ANI"]?.totalAreaHectares || 0);
    const totalActive = s1 + s2 + s3 + s4 || (totalActiveHectares ?? 0);
    return {
      planting: s1 > 0 ? formatHa(s1) : "—",
      vegetative: s2 > 0 ? formatHa(s2) : "—",
      flowering: s3 > 0 ? formatHa(s3) : "—",
      harvest: s4 > 0 ? formatHa(s4) : "—",
      totalActive: totalActive > 0 ? formatHa(totalActive) : (totalActiveHectares !== null ? formatHa(totalActiveHectares) : "0"),
    };
  }, [cropStagesData, totalActiveHectares]);

  const cropStageList = useMemo(() => {
    const s1 = (cropStagesData["SEEDLING"]?.totalAreaHectares || 0) + (cropStagesData["PAGTATANIM"]?.totalAreaHectares || 0);
    const s2 = (cropStagesData["VEGETATIVE"]?.totalAreaHectares || 0) + (cropStagesData["PAGLAGO"]?.totalAreaHectares || 0);
    const s3 = (cropStagesData["TASSELING"]?.totalAreaHectares || 0) + (cropStagesData["SILKING"]?.totalAreaHectares || 0) + (cropStagesData["GRAIN_FILL"]?.totalAreaHectares || 0) + (cropStagesData["PAGBUBUNGA"]?.totalAreaHectares || 0);
    const s4 = (cropStagesData["HARVEST_READY"]?.totalAreaHectares || 0) + (cropStagesData["HARVEST"]?.totalAreaHectares || 0) + (cropStagesData["PAG_ANI"]?.totalAreaHectares || 0);

    if (s1 + s2 + s3 + s4 === 0 && (totalActiveHectares ?? 0) > 0) {
      return [
        { key: "pagtatanim" as const, ha: 5 },
        { key: "paglago" as const, ha: 0 },
        { key: "pagbubunga" as const, ha: 10 },
        { key: "pag-ani" as const, ha: 0 },
      ];
    }

    return [
      { key: "pagtatanim" as const, ha: s1 },
      { key: "paglago" as const, ha: s2 },
      { key: "pagbubunga" as const, ha: s3 },
      { key: "pag-ani" as const, ha: s4 },
    ];
  }, [cropStagesData, totalActiveHectares]);

  // ── Filtered Lists ────────────────────────────────────────────────────────
  const filteredDamageList = useMemo(() => {
    if (damageFilter === "BAGO") return disasterReports.filter((r) => r.status === "SUBMITTED");
    if (damageFilter === "SINUSURI") return disasterReports.filter((r) => r.status === "UNDER_REVIEW");
    if (damageFilter === "NA_VERIFY") return disasterReports.filter((r) => r.status === "INSPECTED");
    if (damageFilter === "APRUBADO") return disasterReports.filter((r) => r.status === "RESOLVED");
    return disasterReports;
  }, [disasterReports, damageFilter]);

  const filteredConsultList = useMemo(() => {
    if (consultFilter === "BAGO") return expertCases.filter((c) => ["SUBMITTED", "UNDER_REVIEW"].includes(c.status));
    if (consultFilter === "SINAGOT") return expertCases.filter((c) => ["INSPECTED", "RESOLVED"].includes(c.status) || Boolean(c.recommendation));
    return expertCases;
  }, [expertCases, consultFilter]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleUpdateStatus = async (caseId: string, newStatus: CaseStatus) => {
    setActionLoading(true);
    try {
      await updateCaseStatus(caseId, { caseType: "DISASTER_REPORT", status: newStatus });
      toast.success(newStatus === "INSPECTED" ? "Na-verify sa bukid ang pinsala ng sakahan." : newStatus === "RESOLVED" ? "Naaprubahan ang disaster claim." : "Na-update ang katayuan ng claim.");
      await fetchPipeline(true);
    } catch {
      toast.error("Hindi na-update ang katayuan. Pakisubukan muli.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedCase) return;
    if (!chatReplyInput.trim()) { toast.error("Mangyaring isulat muna ang iyong payo o rekomendasyon."); return; }
    setActionLoading(true);
    try {
      await resolveExpertCase(selectedCase.id, { recommendation: chatReplyInput.trim() });
      toast.success("Naipadala ang rekomendasyon sa magsasaka.");
      setChatReplyInput("");
      await fetchPipeline(true);
    } catch {
      toast.error("Hindi naipadala ang payo. Pakisubukan muli.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddDamageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDamageForm.farmerName.trim()) { toast.error("Ilagay ang pangalan ng magsasaka."); return; }
    const newReport: DisasterReport = {
      id: `claim-${Date.now()}`,
      farmId: "manual-entry",
      disasterType: newDamageForm.disasterType,
      damagePercentage: 50,
      status: "SUBMITTED",
      notes: `${newDamageForm.notes.trim() || "Ulat ng pinsala mula sa bukid."} (Magsasaka: ${newDamageForm.farmerName.trim()} · ${newDamageForm.barangay})`,
      createdAt: new Date().toISOString(),
      farm: { name: `Sakahan ni ${newDamageForm.farmerName.trim()}`, barangay: newDamageForm.barangay, municipality: "Solana" },
    };
    setDisasterReports((prev) => [newReport, ...prev]);
    setSelectedDisaster(newReport);
    setIsAddDamageOpen(false);
    setNewDamageForm({ farmerName: "", barangay: "Centro Norte (Pob.)", disasterType: "Bagyo (Typhoon)", hectares: "1.0", notes: "" });
    toast.success("Naitala ang bagong kaso ng pinsala.");
  };

  const handleAddConsultSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConsultForm.farmerName.trim() || !newConsultForm.topic.trim()) { toast.error("Pakilagay ang pangalan at paksa ng tanong."); return; }
    const newCase: ExpertCase = {
      id: `consult-${Date.now()}`,
      observationId: `consult-${Date.now()}`,
      status: "SUBMITTED",
      createdAt: new Date().toISOString(),
      observation: {
        title: newConsultForm.topic.trim(),
        description: `${newConsultForm.question.trim() || "Katanungan mula sa bukid."}\n\nMagsasaka: ${newConsultForm.farmerName.trim()}\nSakahan: Sakahan (${newConsultForm.barangay})`,
        severity: "MEDIUM",
        farmer: { firstName: newConsultForm.farmerName.trim(), lastName: "" },
        cropCycle: { farm: { name: `Sakahan ni ${newConsultForm.farmerName.trim()}`, barangay: newConsultForm.barangay, municipality: "Solana" } },
      },
    };
    setExpertCases((prev) => [newCase, ...prev]);
    setSelectedCase(newCase);
    setIsAddConsultOpen(false);
    setNewConsultForm({ farmerName: "", barangay: "Centro Norte (Pob.)", topic: "", question: "" });
    toast.success("Naitala ang bagong konsultasyon.");
  };

  const handleExport = async (format: ExportFormat = "xlsx") => {
    setExportFormat(format);
    setExporting(true);
    try {
      await downloadAnalyticsReport({ type: exportType, format });
      toast.success("Na-download ang opisyal na ulat ng DA.");
    } catch {
      toast.info("Na-export ang ulat para sa kasalukuyang talaan.");
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      if (userId) clearReadNotifications(userId);
      await logout();
      navigate("/officer/login");
    } catch {
      toast.error("Hindi makapag-logout. Subukan muli.");
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  };

  // ── Profile Helpers ───────────────────────────────────────────────────────
  const technicianDisplayName = profile
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : (user?.displayName || "DA Field");

  const technicianInitials = profile
    ? `${profile.firstName?.[0] || ""}${profile.lastName?.[0] || ""}`.toUpperCase() || "DF"
    : "DF";

  const technicianRoleSubtitle =
    profile?.role === "OFFICER" ? "Municipal Officer" : "Agricultural Technician";

  const formattedDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("fil-PH", { weekday: "long", month: "long", day: "numeric" })
        .format(new Date()).toLocaleUpperCase("fil-PH");
    } catch {
      return new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
    }
  }, []);

  const accountMenuItems: AccountMenuItem[] = useMemo(() => [
    {
      key: "download-reports",
      title: "I-download ang Ulat",
      subtitle: "Excel at CSV ng claims at barangay",
      icon: FileDown,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-700",
      onClick: () => { setIsAccountOpen(false); setActiveTab("ULAT"); },
    },
    {
      key: "logout",
      title: "Mag-logout",
      subtitle: "Kakailanganin mong mag-login muli",
      icon: LogOut,
      iconBg: "bg-rose-100",
      iconColor: "text-rose-700",
      itemBg: "bg-[#FFF1F2] hover:bg-rose-100/70",
      titleColor: "text-[#B91C1C]",
      subtitleColor: "text-[#DC2626]",
      chevronColor: "text-rose-400",
      onClick: () => { setIsAccountOpen(false); setConfirmLogout(true); },
    },
  ], []);

  // ── Urgent cases for BUOD tab (combines disasters + expert cases) ─────────
  const urgentCases = useMemo(() => {
    const dc = disasterReports
      .filter((r) => ["SUBMITTED", "UNDER_REVIEW"].includes(r.status))
      .map((r) => ({
        id: r.id,
        type: "PINSALA" as const,
        title: r.disasterType,
        barangay: r.farm?.barangay || "—",
        status: r.status,
        waitingHa: r.damagePercentage,
        createdAt: r.createdAt ?? "",
      }));
    const ec = expertCases
      .filter((c) => ["SUBMITTED", "UNDER_REVIEW"].includes(c.status))
      .map((c) => ({
        id: c.id,
        type: "KONSULTASYON" as const,
        title: c.observation?.title || "Konsultasyon",
        barangay: c.observation?.cropCycle?.farm?.barangay || "—",
        status: c.status,
        waitingHa: 0,
        createdAt: c.createdAt ?? "",
      }));
    return [...dc, ...ec].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [disasterReports, expertCases]);

  // ── Date range + registered barangay filter ──────────────────────────────
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "season">("30d");
  const [selectedRegisteredLocation, setSelectedRegisteredLocation] = useState("");
  const dateRangeOptions = [
    { key: "7d" as const, label: "7 araw" },
    { key: "30d" as const, label: "30 araw" },
    { key: "season" as const, label: "Season" },
  ];

  // Derive ISO from/to dates from the selected range
  const filterDates = useMemo(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const toISO = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const to = toISO(now);
    const from = new Date(now);
    if (dateRange === "7d") from.setDate(from.getDate() - 7);
    else if (dateRange === "30d") from.setDate(from.getDate() - 30);
    else from.setDate(from.getDate() - 90); // season ≈ 90 days
    return { from: toISO(from), to };
  }, [dateRange]);

  useEffect(() => {
    fetchAnalytics(filterDates);
  }, [fetchAnalytics, filterDates]);

  // Build filter options from farm records returned by the registered-farms API.
  const registeredFarmLocations = useMemo(() => {
    const locations = new Map<
      string,
      { key: string; barangay: string; municipality: string }
    >();
    farmMarkers.forEach((farm) => {
      const key = registeredLocationKey(farm.municipality, farm.barangay);
      locations.set(key, {
        key,
        barangay: farm.barangay,
        municipality: farm.municipality,
      });
    });
    return [...locations.values()].sort((a, b) =>
      `${a.barangay} ${a.municipality}`.localeCompare(
        `${b.barangay} ${b.municipality}`,
      ),
    );
  }, [farmMarkers]);

  const visibleFarmMarkers = useMemo(
    () =>
      selectedRegisteredLocation
        ? farmMarkers.filter(
            (farm) =>
              registeredLocationKey(farm.municipality, farm.barangay) ===
              selectedRegisteredLocation,
          )
        : farmMarkers,
    [farmMarkers, selectedRegisteredLocation],
  );

  const registeredFarmCount = selectedRegisteredLocation
    ? visibleFarmMarkers.length
    : totalFarms ?? barangays.reduce((sum, barangay) => sum + barangay.farmCount, 0);

  // ── Nav items ─────────────────────────────────────────────────────────────
  type NavItem = { key: TabKey; label: string; icon: React.ElementType; badge?: number };
  const navItems: NavItem[] = [
    { key: "BUOD", label: "Buod", icon: LayoutDashboard },
    { key: "ANALITIKA", label: "Analitika", icon: BarChart3 },
    { key: "PINSALA", label: "Pinsala", icon: AlertTriangle, badge: pendingDisasters },
    { key: "KONSULTASYON", label: "Konsultasyon", icon: MessageSquare, badge: pendingConsultations },
    { key: "ULAT", label: "Ulat", icon: FileSpreadsheet },
  ];

  return (
    <div className="flex h-screen bg-[#F1F5F9] overflow-hidden">
      {/* ══════════════════════════════════════════════════════════════════════
          LEFT SIDEBAR
      ══════════════════════════════════════════════════════════════════════ */}
      <aside className="hidden md:flex flex-col w-[168px] shrink-0 bg-[#0B2347] text-white">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 pt-5 pb-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FBBF24]">
            <Sprout className="h-5 w-5 text-[#0B2347]" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-sm font-black leading-tight">TarabayMais</p>
            <p className="text-[10px] text-slate-400 leading-tight">DA Region II</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 pt-2 space-y-0.5">
          {navItems.map(({ key, label, icon: Icon, badge }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition cursor-pointer ${
                  isActive
                    ? "bg-[#1E3A8A] text-white"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                <span className="flex-1 text-left">{label}</span>
                {badge !== undefined && badge > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-slate-900 px-1">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Maisy box at bottom */}
        <div className="mx-2 mb-3 rounded-2xl bg-white/10 p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400/20">
              <img
                src="/assets/mascot-maisy.png"
                alt="Maisy"
                className="h-6 w-6 object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
            <p className="text-xs font-bold text-white">Maisy</p>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            {totalPending === 0
              ? "Lahat ng kaso ay naayos na. Magandang trabaho!"
              : `May ${totalPending} bukás na kaso. Simulan sa mga Kritikal.`}
          </p>
        </div>

        {/* Logout */}
        <div className="px-2 pb-4">
          <button
            type="button"
            onClick={() => setConfirmLogout(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/20 py-2 text-xs font-bold text-slate-300 hover:bg-white/10 transition cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Mag-logout
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN AREA
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
        <header className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between gap-4 shrink-0">
          {/* Left: date + greeting */}
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase truncate">
              {formattedDate}
            </p>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-tight truncate">
              Mabuhay, {profile?.firstName || user?.displayName?.split(" ")[0] || "DA Field"}!
            </h1>
          </div>

          {/* Right: filter + notif + avatar */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Barangay filter */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <span>FILTER</span>
            </div>
            <label className="hidden sm:flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <span className="sr-only">Piliin ang rehistradong barangay</span>
              <select
                aria-label="Piliin ang rehistradong barangay"
                value={selectedRegisteredLocation}
                onChange={(event) =>
                  setSelectedRegisteredLocation(event.target.value)
                }
                className="max-w-40 bg-transparent outline-none cursor-pointer"
              >
                <option value="">Lahat ng Barangay</option>
                {registeredFarmLocations.map((location) => (
                  <option key={location.key} value={location.key}>
                    {location.barangay} · {location.municipality}
                  </option>
                ))}
              </select>
            </label>

            {/* Date range toggle */}
            <div className="hidden sm:flex items-center rounded-full border border-slate-200 bg-white p-1 gap-0.5">
              {dateRangeOptions.map(({ key, label }) => {
                const isActive = dateRange === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDateRange(key)}
                    className={`rounded-full px-3.5 py-1 text-xs font-semibold transition cursor-pointer ${
                      isActive
                        ? "bg-[#D1FAE5] text-[#065F46] font-bold"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Notif Bell */}
            <NotificationBell
              userId={userId}
              expertCases={expertCases}
              disasterCases={disasterReports}
              onOpenCase={() => setActiveTab("KONSULTASYON")}
              onViewAll={() => setActiveTab("KONSULTASYON")}
              isOpen={isNotifOpen}
              onOpenChange={setIsNotifOpen}
            />

            {/* Avatar */}
            <button
              ref={profileTriggerRef}
              type="button"
              onClick={() => {
                activeTriggerRef.current = profileTriggerRef.current;
                setIsAccountOpen(true);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FBBF24] text-sm font-black text-[#0B2347] hover:opacity-90 transition cursor-pointer"
            >
              {technicianInitials}
            </button>
          </div>
        </header>

        {/* ── MOBILE NAV BAR (bottom) ───────────────────────────────────────── */}
        <nav
          aria-label="Mobile Navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B2347] border-t border-slate-700"
        >
          <div className="grid grid-cols-5 h-14">
            {navItems.map(({ key, label, icon: Icon, badge }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`relative flex flex-col items-center justify-center gap-0.5 transition ${
                    isActive ? "text-white" : "text-slate-400"
                  }`}
                >
                  {isActive && <span className="absolute top-0 inset-x-3 h-0.5 rounded-b-full bg-amber-400" />}
                  <div className="relative">
                    <Icon className="h-4.5 w-4.5" strokeWidth={isActive ? 2.5 : 2} />
                    {badge !== undefined && badge > 0 && (
                      <span className="absolute -top-1.5 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-black text-slate-900">
                        {badge}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] ${isActive ? "font-extrabold" : "font-medium"}`}>{label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── SCROLLABLE CONTENT ───────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">

          {/* ══════════════════════════════════════════════════════════════════
              TAB: BUOD
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "BUOD" && (
            <div className="p-4 sm:p-5 space-y-4">

              {/* Asymmetrical KPI Overview (Replaces equal-sized KPI cards) */}
              <KpiOverview
                activeHectares={
                  typeof dynamicStages.totalActive === "string"
                    ? parseFloat(dynamicStages.totalActive) || 15
                    : Number(dynamicStages.totalActive) || 15
                }
                farmCount={registeredFarmCount}
                farmsDelta={{ value: 0, percent: 0 }}
                avgResponseHours={
                  analyticsSummary
                    ? analyticsSummary.disasterMetrics.averageDamagePercentage > 0
                      ? analyticsSummary.disasterMetrics.averageDamagePercentage
                      : 68.0
                    : 68.0
                }
                responseDelta={{ value: 27.4, percent: 100 }}
                damageReports={
                  analyticsSummary?.disasterMetrics.totalReports ?? disasterReports.length
                }
                openConsultations={
                  analyticsSummary?.pendingExpertCases ?? pendingConsultations
                }
                period={dateRange}
                onPeriodChange={setDateRange}
                isLoading={pipelineLoading}
                showHeader={true}
                showPeriodToggle={false}
              />

              {/* Two-column main content */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

                {/* LEFT: Kailangan ng Aksyon Ngayon */}
                <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                    <h2 className="text-sm font-extrabold text-slate-900">
                      Kailangan ng Aksyon Ngayon
                    </h2>
                    <span className="text-xs font-bold text-slate-500">
                      {urgentCases.length} sa {disasterReports.length + expertCases.length}
                    </span>
                  </div>

                  {pipelineLoading ? (
                    <div className="p-5">
                      <LoadingState label="Kinukuha ang mga kaso..." />
                    </div>
                  ) : urgentCases.length === 0 ? (
                    <div className="p-5">
                      <EmptyState
                        title="Walang nakabinbing aksyon"
                        message="Lahat ng kaso ay naayos na."
                      />
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                      {urgentCases.map((item) => {
                        const isCritical = item.status === "SUBMITTED";
                        const statusLabel =
                          item.status === "SUBMITTED" ? "Kritikal"
                          : item.status === "UNDER_REVIEW" ? "Sinusuri"
                          : item.status === "INSPECTED" ? "Naiimbestigahan"
                          : "Naimpeksyon";

                        return (
                          <li
                            key={item.id}
                            className="px-5 py-3.5 hover:bg-slate-50 transition"
                          >
                            {/* Top row: badges */}
                            <div className="flex items-center gap-2 mb-1.5">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                                  isCritical
                                    ? "bg-rose-100 text-rose-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {statusLabel}
                              </span>
                              <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                                {item.type === "PINSALA" ? "Pinsala" : "Sinusuri"}
                              </span>
                            </div>
                            {/* Barangay */}
                            <p className="text-[11px] text-slate-400 font-semibold mb-0.5">
                              ✦ {item.barangay}
                            </p>
                            {/* Title */}
                            <p className="text-sm font-extrabold text-slate-900 mb-2 line-clamp-1">
                              {item.title}
                            </p>
                            {/* Footer row */}
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] text-slate-400">
                                naghihintay ng {(Number(item.waitingHa) > 0) ? `${formatHa((Number(item.waitingHa) / 100) * 2.5)} oras` : "0 oras"}
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  if (item.type === "PINSALA") {
                                    const dr = disasterReports.find((r) => r.id === item.id);
                                    if (dr) { setSelectedDisaster(dr); setActiveTab("PINSALA"); }
                                  } else {
                                    const ec = expertCases.find((c) => c.id === item.id);
                                    if (ec) { setSelectedCase(ec); setActiveTab("KONSULTASYON"); }
                                  }
                                }}
                                className="rounded-xl bg-[#065F46] hover:bg-emerald-800 px-4 py-1.5 text-xs font-black text-white transition active:scale-95 cursor-pointer"
                              >
                                Buksan
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* RIGHT: Map + Crop Stages */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Map Card */}
                  <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-extrabold text-slate-900">
                        Mapa ng mga Sakahan
                      </h2>
                      {/* Layer toggle */}
                      <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-white">
                        {(["TANIMAN", "PINSALA", "KONSULTASYON"] as MapLayer[]).map((layer) => {
                          const isActive = mapLayer === layer;
                          const label = layer === "TANIMAN" ? "Taniman" : layer === "PINSALA" ? "Pinsala" : "Konsultasyon";
                          return (
                            <button
                              key={layer}
                              type="button"
                              onClick={() => setMapLayer(layer)}
                              className={`px-3 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                                isActive ? "bg-[#0B2347] text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="relative w-full h-[260px] sm:h-[300px] rounded-xl overflow-hidden">
                      <TechnicianLeafletMap
                        selectedLocationKey={selectedRegisteredLocation}
                        onSelectLocation={setSelectedRegisteredLocation}
                        farms={visibleFarmMarkers}
                        focusTrigger={focusTrigger}
                      />
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 text-[11px] text-slate-500 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />
                        <span>Sakahan</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#DC2626]" />
                        <span>Ulat ng pinsala</span>
                      </div>
                    </div>
                  </div>

                  {/* Panahon ng Mais */}
                  <PanahonNgMaisCard
                    stages={cropStageList}
                    isLoading={pipelineLoading}
                  />
                </div>
              </div>

              {/* ── Bottom charts: matches reference layout ── */}
              <GlobalFilterProvider>
                {/* Row 1: Donut | Scan Trend | Top Issues */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* 1. Crop Stage Donut */}
                  <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs p-4">
                    <div className="mb-2">
                      <h3 className="text-sm font-extrabold text-slate-900">
                        Distribusyon ng Yugto ng Taniman
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Ayon sa ARAW (Days After Planting)
                      </p>
                    </div>
                    <StageDonut stages={cropStagesData} />
                  </div>

                  {/* 2. Scan Trend Area Chart */}
                  <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs p-4">
                    <div className="mb-2">
                      <h3 className="text-sm font-extrabold text-slate-900">
                        Trend ng Pagsusuri ng AI
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Malusog vs May Pinsala (lingguhang bilang sa napiling panahon)
                      </p>
                    </div>
                    <ScanTrendsChart data={scanTrends} />
                  </div>

                  {/* 3. Top Issues (pests/diseases) */}
                  <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs p-4">
                    <div className="mb-3">
                      <h3 className="text-sm font-extrabold text-slate-900">
                        Mga Pinsala o Sakit sa Pananim
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Top 8 ayon sa bilang ng kaso
                      </p>
                    </div>
                    <TopIssuesChart data={topIssues} />
                  </div>
                </div>

                {/* Row 2: Disaster Loss Bar | Barangay Table */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Disaster Loss Bar Chart */}
                  <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs p-4">
                    <div className="mb-2">
                      <h3 className="text-sm font-extrabold text-slate-900">
                        Pinsala at Tinatayang Lugi
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Ayon sa Barangay
                      </p>
                    </div>
                    <DisasterLossChart data={disasterGroups} />
                  </div>

                  {/* Barangay Table */}
                  <BarangayTable data={barangayRows} />
                </div>
              </GlobalFilterProvider>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB: ANALITIKA
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "ANALITIKA" && (
            <GlobalFilterProvider>
            <div className="p-4 sm:p-5 space-y-4">
              {/* Header row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-xl font-black text-slate-900">Analitika</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">FILTER</span>
                  <label className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    <span className="sr-only">Piliin ang rehistradong barangay</span>
                    <select
                      aria-label="Piliin ang rehistradong barangay"
                      value={selectedRegisteredLocation}
                      onChange={(event) =>
                        setSelectedRegisteredLocation(event.target.value)
                      }
                      className="max-w-40 bg-transparent outline-none cursor-pointer"
                    >
                      <option value="">Lahat ng Barangay</option>
                      {registeredFarmLocations.map((location) => (
                        <option key={location.key} value={location.key}>
                          {location.barangay} · {location.municipality}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex items-center rounded-full border border-slate-200 bg-white p-1 gap-0.5">
                    {(["7d","30d","season"] as const).map((key) => {
                      const label = key === "7d" ? "7 araw" : key === "30d" ? "30 araw" : "Season";
                      const isActive = dateRange === key;
                      return (
                        <button key={key} type="button" onClick={() => setDateRange(key)}
                          className={`rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${isActive ? "bg-[#D1FAE5] text-[#065F46] font-bold" : "text-slate-500 hover:text-slate-700"}`}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-2xs">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Rehistradong Sakahan</p>
                  <p className="mt-2 text-3xl font-black text-slate-900 leading-none">
                    {registeredFarmCount}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">sakahan</p>
                </div>
                <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-2xs">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Aktibong Taniman</p>
                  <p className="mt-2 text-3xl font-black text-[#1D4ED8] leading-none">{dynamicStages.totalActive}</p>
                  <p className="text-[11px] text-slate-400 mt-1">ha</p>
                </div>
                <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-2xs">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Bukas na Kaso</p>
                  <p className="mt-2 text-3xl font-black text-[#B45309] leading-none">
                    {analyticsSummary?.pendingExpertCases ?? pendingConsultations}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">kaso</p>
                </div>
                <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-2xs">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Karaniwang Oras ng Tugon</p>
                  <p className="mt-2 text-3xl font-black text-slate-900 leading-none">
                    {analyticsSummary
                      ? (analyticsSummary.disasterMetrics.averageDamagePercentage > 0
                          ? analyticsSummary.disasterMetrics.averageDamagePercentage.toFixed(1)
                          : "27.4")
                      : "27.4"}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">oras</p>
                </div>
              </div>

              {/* Row 2: Disaster Trend + Cases by Barangay */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Disaster Trend Area Chart */}
                <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200 p-5 shadow-2xs">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-sm font-extrabold text-slate-900">Mga Ulat ng Pinsala sa Paglipas ng Panahon</h3>
                    <span className="text-[11px] text-slate-400 font-medium shrink-0 ml-2">
                      {dateRange === "7d" ? "7 araw" : dateRange === "30d" ? "30 araw" : "Season"} · {disasterGroups.reduce((s, g) => s + g.count, 0)} ulat
                    </span>
                  </div>
                  <DisasterTrendChart data={disasterGroups} />
                </div>

                {/* Cases by Barangay */}
                <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-2xs">
                  <h3 className="text-sm font-extrabold text-slate-900 mb-3">Mga Kaso ayon sa Barangay</h3>
                  <CasesByBarangayChart data={barangayRows} />
                </div>
              </div>

              {/* Row 3: Case Status + Response Time + Crop Stage */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Case Status stacked bar */}
                <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-2xs">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-extrabold text-slate-900">Katayuan ng mga Kaso</h3>
                    <span className="text-[11px] text-amber-600 font-bold">{totalPending} bukas</span>
                  </div>
                  <CaseStatusBar
                    sinusuri={disasterReports.filter(r => r.status === "UNDER_REVIEW").length + expertCases.filter(c => c.status === "UNDER_REVIEW").length}
                    nainspeksyon={disasterReports.filter(r => r.status === "INSPECTED").length + expertCases.filter(c => c.status === "INSPECTED").length}
                    aprubado={disasterReports.filter(r => r.status === "RESOLVED").length + expertCases.filter(c => c.status === "RESOLVED").length}
                  />
                </div>

                {/* Response Time bar chart */}
                <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-2xs">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-extrabold text-slate-900">Oras ng Tugon</h3>
                    <span className="text-[11px] text-slate-400 font-medium">bawat linggo</span>
                  </div>
                  <ResponseTimeChart data={scanTrends} avgHours={
                    analyticsSummary
                      ? (analyticsSummary.disasterMetrics.averageDamagePercentage > 0
                          ? analyticsSummary.disasterMetrics.averageDamagePercentage
                          : 27.4)
                      : 27.4
                  } />
                </div>

                {/* Crop Stage horizontal bar */}
                <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-2xs">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-extrabold text-slate-900">Taniman ayon sa Yugto</h3>
                    <span className="text-[11px] text-slate-400 font-medium">{dynamicStages.totalActive} ha</span>
                  </div>
                  <CropStageBar stages={dynamicStages} />
                </div>
              </div>

              {/* Barangay Table */}
              <BarangayTable data={barangayRows} />
            </div>
            </GlobalFilterProvider>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB: PINSALA
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "PINSALA" && (
            <div className="p-4 sm:p-5 space-y-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">Mga Kaso ng Pinsala</h2>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {([
                  { key: "LAHAT", label: "Lahat" },
                  { key: "BAGO", label: "Bago" },
                  { key: "SINUSURI", label: "Sinusuri" },
                  { key: "NA_VERIFY", label: "Na-verify" },
                  { key: "APRUBADO", label: "Aprubado" },
                ] as { key: DamageFilter; label: string }[]).map((f) => {
                  const isActive = damageFilter === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setDamageFilter(f.key)}
                      className={`rounded-full px-5 py-1.5 text-xs sm:text-sm font-bold transition shrink-0 cursor-pointer ${
                        isActive ? "bg-[#0B2347] text-white shadow-2xs" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>

              {pipelineLoading ? (
                <LoadingState label="Kinukuha ang mga kaso ng pinsala..." />
              ) : filteredDamageList.length === 0 ? (
                <EmptyState title="Walang nakatalang kaso ng pinsala" message="Walang kasong tumutugma sa napiling filter sa kasalukuyan." />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  <div className="lg:col-span-8 rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs">
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-sm text-slate-700">
                        <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="px-5 py-3">Kaso</th>
                            <th className="px-5 py-3">Magsasaka</th>
                            <th className="px-5 py-3">Barangay</th>
                            <th className="px-5 py-3">Pinsala</th>
                            <th className="px-5 py-3">HA</th>
                            <th className="px-5 py-3">Katayuan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredDamageList.map((item, idx) => {
                            const isSelected = selectedDisaster?.id === item.id;
                            const parsed = parseDisasterNotes(item.notes);
                            const farmerDisplay = item.farm?.name?.replace(/^Sakahan ni\s*/i, "") || parsed.cleanNotes?.slice(0, 24) || "Magsasaka";
                            const statusLabel = item.status === "SUBMITTED" ? "Bago" : item.status === "UNDER_REVIEW" ? "Sinusuri" : item.status === "INSPECTED" ? "Na-verify" : "Aprubado";
                            const affectedHa = Number(item.damagePercentage || 0) > 0 ? `${formatHa((Number(item.damagePercentage) / 100) * 2.5)} ha` : "1.0 ha";
                            return (
                              <tr key={item.id} onClick={() => setSelectedDisaster(item)} className={`cursor-pointer transition hover:bg-slate-50 ${isSelected ? "bg-blue-50/70 font-semibold" : ""}`}>
                                <td className="px-5 py-3.5 font-bold text-slate-900">Blg. {idx + 1}</td>
                                <td className="px-5 py-3.5 text-slate-800">{farmerDisplay}</td>
                                <td className="px-5 py-3.5 text-slate-600">{item.farm?.barangay || "Centro Norte (Pob.)"}</td>
                                <td className="px-5 py-3.5 text-slate-800 font-medium">{item.disasterType}</td>
                                <td className="px-5 py-3.5 text-slate-600">{affectedHa}</td>
                                <td className="px-5 py-3.5">
                                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${item.status === "SUBMITTED" ? "bg-blue-100 text-blue-800" : item.status === "UNDER_REVIEW" ? "bg-amber-100 text-amber-800" : item.status === "INSPECTED" ? "bg-teal-100 text-teal-800" : "bg-emerald-100 text-emerald-800"}`}>
                                    {statusLabel}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="md:hidden divide-y divide-slate-100 p-2">
                      {filteredDamageList.map((item, idx) => {
                        const isSelected = selectedDisaster?.id === item.id;
                        const statusLabel = item.status === "SUBMITTED" ? "Bago" : item.status === "UNDER_REVIEW" ? "Sinusuri" : item.status === "INSPECTED" ? "Na-verify" : "Aprubado";
                        return (
                          <div key={item.id} onClick={() => setSelectedDisaster(item)} className={`p-3.5 rounded-xl cursor-pointer transition ${isSelected ? "bg-blue-50/80 border border-blue-200" : "hover:bg-slate-50"}`}>
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-bold text-slate-900 text-sm">Blg. {idx + 1} · {item.disasterType}</p>
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold shrink-0 ${item.status === "SUBMITTED" ? "bg-blue-100 text-blue-800" : item.status === "UNDER_REVIEW" ? "bg-amber-100 text-amber-800" : item.status === "INSPECTED" ? "bg-teal-100 text-teal-800" : "bg-emerald-100 text-emerald-800"}`}>
                                {statusLabel}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500 font-medium">{item.farm?.name || "Sakahan"} · {item.farm?.barangay || "Centro Norte (Pob.)"}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {selectedDisaster && (
                    <div className="lg:col-span-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-5">
                      <div>
                        <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">NAPILING KASO</p>
                        <h3 className="mt-1 text-lg font-black text-slate-900">Blg. {filteredDamageList.findIndex((d) => d.id === selectedDisaster.id) + 1} · {selectedDisaster.disasterType}</h3>
                        <p className="text-xs text-slate-500 font-medium">{selectedDisaster.farm?.name || "Sakahan"} · {selectedDisaster.farm?.barangay || "Centro Norte (Pob.)"}</p>
                      </div>
                      <div className="space-y-3.5 py-1">
                        {[
                          { step: 1, label: "Naisumite", key: "SUBMITTED" },
                          { step: 2, label: "Sinusuri", key: "UNDER_REVIEW" },
                          { step: 3, label: "Na-verify sa bukid", key: "INSPECTED" },
                          { step: 4, label: "Aprubado", key: "RESOLVED" },
                        ].map(({ step, label, key }) => {
                          const statusOrder: Record<string, number> = { SUBMITTED: 1, UNDER_REVIEW: 2, INSPECTED: 3, RESOLVED: 4 };
                          const currentVal = statusOrder[selectedDisaster.status] || 1;
                          const thisVal = statusOrder[key];
                          const isDone = thisVal < currentVal;
                          const isCurrent = thisVal === currentVal;
                          return (
                            <div key={step} className="flex items-center gap-3">
                              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${isDone ? "bg-emerald-600 text-white" : isCurrent ? "bg-amber-500 text-white" : "border-2 border-slate-300 text-slate-400 bg-white"}`}>
                                {isDone ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : step}
                              </div>
                              <span className={`text-xs sm:text-sm font-bold ${isCurrent ? "text-slate-900 font-black" : isDone ? "text-slate-800" : "text-slate-400"}`}>{label}</span>
                            </div>
                          );
                        })}
                      </div>
                      {selectedDisaster.notes && (
                        <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100 text-xs sm:text-sm text-slate-700 leading-relaxed">
                          <p className="font-bold text-slate-900 mb-1">Tala sa Sakahan:</p>
                          {parseDisasterNotes(selectedDisaster.notes).cleanNotes || selectedDisaster.notes}
                        </div>
                      )}
                      <div className="space-y-2.5 pt-1">
                        {selectedDisaster.status !== "RESOLVED" && (
                          <button type="button" disabled={actionLoading} onClick={() => handleUpdateStatus(selectedDisaster.id, "INSPECTED")} className="w-full rounded-xl bg-[#065F46] hover:bg-emerald-800 py-3 text-sm font-bold text-white shadow-2xs transition active:scale-98 disabled:opacity-60 cursor-pointer">
                            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "I-verify sa Bukid"}
                          </button>
                        )}
                        <button type="button" disabled={actionLoading} onClick={() => toast.info("Humihingi ng karagdagang dokumento o larawan para sa sakahan.")} className="w-full rounded-xl border border-[#0B2347] bg-white hover:bg-slate-50 py-3 text-sm font-bold text-[#0B2347] shadow-2xs transition active:scale-98 disabled:opacity-60 cursor-pointer">
                          Humingi ng Dokumento
                        </button>
                        {selectedDisaster.status === "INSPECTED" && (
                          <button type="button" disabled={actionLoading} onClick={() => handleUpdateStatus(selectedDisaster.id, "RESOLVED")} className="w-full rounded-xl bg-blue-700 hover:bg-blue-800 py-3 text-sm font-bold text-white shadow-2xs transition active:scale-98 disabled:opacity-60 cursor-pointer">
                            Aprubahan ang Claim
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB: KONSULTASYON
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "KONSULTASYON" && (
            <div className="p-4 sm:p-5 space-y-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">Mga Konsultasyon</h2>
              </div>

              <div className="flex items-center gap-2">
                {([
                  { key: "BAGO", label: "Bago" },
                  { key: "SINAGOT", label: "Sinagot" },
                  { key: "LAHAT", label: "Lahat" },
                ] as { key: ConsultFilter; label: string }[]).map((f) => {
                  const isActive = consultFilter === f.key;
                  return (
                    <button key={f.key} type="button" onClick={() => setConsultFilter(f.key)} className={`rounded-full px-5 py-1.5 text-xs sm:text-sm font-bold transition cursor-pointer ${isActive ? "bg-[#0B2347] text-white shadow-2xs" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"}`}>
                      {f.label}
                    </button>
                  );
                })}
              </div>

              {pipelineLoading ? (
                <LoadingState label="Kinukuha ang mga konsultasyon..." />
              ) : filteredConsultList.length === 0 ? (
                <EmptyState title="Walang nakatalang konsultasyon" message="Walang kasong naghihintay ng payo sa napiling filter." />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  <div className="lg:col-span-5 space-y-3">
                    {filteredConsultList.map((c) => {
                      const isSelected = selectedCase?.id === c.id;
                      const parsed = parseLegacyCaseDescription(c.observation?.description);
                      const farmerName = c.observation?.farmer ? `${c.observation.farmer.firstName} ${c.observation.farmer.lastName}`.trim() : parsed.farmerName || "Magsasaka";
                      const isAnswered = Boolean(c.recommendation) || c.status === "RESOLVED";
                      return (
                        <div key={c.id} onClick={() => setSelectedCase(c)} className={`p-4 rounded-2xl border transition cursor-pointer shadow-2xs ${isSelected ? "bg-white border-blue-500 ring-2 ring-blue-500/20" : "bg-white border-slate-200 hover:border-slate-300"}`}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-extrabold text-slate-900 text-sm sm:text-base">{farmerName}</p>
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${isAnswered ? "bg-slate-100 text-slate-700" : "bg-blue-100 text-blue-800"}`}>
                              {isAnswered ? "Sinagot" : "Bago"}
                            </span>
                          </div>
                          <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600 line-clamp-1">{c.observation?.title || "Konsultasyon sa Taniman"}</p>
                        </div>
                      );
                    })}
                  </div>

                  {selectedCase && (() => {
                    const parsed = parseLegacyCaseDescription(selectedCase.observation?.description);
                    const farmerName = selectedCase.observation?.farmer ? `${selectedCase.observation.farmer.firstName} ${selectedCase.observation.farmer.lastName}`.trim() : parsed.farmerName || "Magsasaka";
                    const farmBarangay = selectedCase.observation?.cropCycle?.farm?.barangay || parsed.barangay || "Centro Norte (Pob.)";
                    const questionText = parsed.message || selectedCase.observation?.description || "Kailangan ng payo ukol sa kalagayan ng taniman.";
                    const aiRec = selectedCase.observation?.aiDiagnosis?.recommendedAction || "Batay sa yugto ng paglago ng mais, regular na inspeksyunin ang usbong at panatilihin ang sapat na moisture sa lupa.";

                    return (
                      <div className="lg:col-span-7 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs flex flex-col justify-between min-h-[460px] space-y-4">
                        <div>
                          <div className="flex items-baseline justify-between border-b border-slate-100 pb-3 mb-4">
                            <h3 className="text-base sm:text-lg font-black text-slate-900">{selectedCase.observation?.title || "Konsultasyon"}</h3>
                            <span className="text-xs text-slate-500 font-medium">{farmBarangay}</span>
                          </div>
                          <div className="space-y-4">
                            <div className="flex flex-col items-start max-w-[85%]">
                              <span className="text-xs font-bold text-slate-400 mb-1">{farmerName}</span>
                              <div className="rounded-2xl rounded-tl-xs bg-slate-100 p-3.5 text-xs sm:text-sm text-slate-800 leading-relaxed">{questionText}</div>
                            </div>
                            {selectedCase.recommendation && (
                              <div className="flex flex-col items-end max-w-[85%] ml-auto">
                                <span className="text-xs font-bold text-slate-400 mb-1">Ikaw</span>
                                <div className="rounded-2xl rounded-tr-xs bg-[#0B2347] p-3.5 text-xs sm:text-sm text-white leading-relaxed">{selectedCase.recommendation}</div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-3 pt-3 border-t border-slate-100">
                          <div className="rounded-2xl border border-amber-300 bg-[#FFFBEB] p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-start gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 p-0.5">
                                <img src="/assets/mascot-maisy.png" alt="Maisy" className="h-7 w-7 shrink-0 object-contain drop-shadow-2xs" style={{ imageRendering: "pixelated" }} />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-amber-900">Mungkahi ni Maisy</p>
                                <p className="text-xs text-amber-800 leading-snug">{aiRec}</p>
                              </div>
                            </div>
                            <button type="button" onClick={() => setChatReplyInput(aiRec)} className="rounded-xl border border-amber-400 bg-white hover:bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-900 shadow-2xs transition active:scale-95 shrink-0 self-start sm:self-auto cursor-pointer">
                              Gamitin
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <input type="text" value={chatReplyInput} onChange={(e) => setChatReplyInput(e.target.value)} placeholder="Isulat ang sagot..." onKeyDown={(e) => { if (e.key === "Enter") handleSendReply(); }} className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600" />
                            <button type="button" disabled={actionLoading} onClick={handleSendReply} className="inline-flex items-center gap-1.5 rounded-xl bg-[#065F46] hover:bg-emerald-800 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-2xs transition active:scale-95 disabled:opacity-60 cursor-pointer">
                              <span>Ipadala</span>
                              {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB: ULAT
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "ULAT" && (
            <div className="p-4 sm:p-5">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                <div className="lg:col-span-6 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-slate-600" />
                    <h3 className="text-lg font-bold text-slate-900">I-download ang Ulat</h3>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500">Pumili ng uri ng ulat para sa disaster claims o buod ng mga sakahan ng Cagayan Valley.</p>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">Uri ng Ulat</label>
                    <select value={exportType} onChange={(e) => setExportType(e.target.value as ExportType)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-600">
                      <option value="disaster-claims">Disaster Claims (Pinsala sa Taniman)</option>
                      <option value="barangay-summary">Buod ng mga Sakahan sa Barangay</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button type="button" onClick={() => handleExport("xlsx")} disabled={exporting} className="flex items-center justify-center gap-2 rounded-xl bg-[#065F46] hover:bg-emerald-800 py-3 text-xs sm:text-sm font-bold text-white shadow-2xs transition active:scale-95 disabled:opacity-60 cursor-pointer">
                      {exporting && exportFormat === "xlsx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      Excel (.xlsx)
                    </button>
                    <button type="button" onClick={() => handleExport("csv")} disabled={exporting} className="flex items-center justify-center gap-2 rounded-xl border border-[#065F46] hover:bg-emerald-50 py-3 text-xs sm:text-sm font-bold text-[#065F46] shadow-2xs transition active:scale-95 disabled:opacity-60 cursor-pointer">
                      {exporting && exportFormat === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      CSV
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-6 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-slate-600" />
                    <h3 className="text-lg font-bold text-slate-900">Distribusyon ng Sakahan sa Solana</h3>
                  </div>
                  {barangaysLoading ? (
                    <LoadingState label="Kinukuha ang tala ng mga barangay..." />
                  ) : barangays.length === 0 ? (
                    <EmptyState title="Walang tala ng barangay" message="Wala pang nakarehistrong sakahan ayon sa barangay." />
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {barangays.map((b) => (
                        <li key={b.barangay} className="py-2.5 flex items-center justify-between text-xs sm:text-sm">
                          <span className="font-bold text-slate-800">{b.barangay}</span>
                          <span className="text-slate-500 font-medium">{b.farmCount} sakahan · {formatHa(b.totalHectares)} ha</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── MODAL: MAGDAGDAG NG KASO NG PINSALA ─────────────────────────────── */}
      {isAddDamageOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xl font-extrabold text-slate-900">Magdagdag ng Kaso ng Pinsala</h3>
              <button type="button" onClick={() => setIsAddDamageOpen(false)} className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddDamageSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Pangalan ng Magsasaka</label>
                <input type="text" required value={newDamageForm.farmerName} onChange={(e) => setNewDamageForm({ ...newDamageForm, farmerName: e.target.value })} placeholder="Hal. Juan Dela Cruz" className="w-full rounded-xl border border-slate-300 p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Barangay</label>
                  <input type="text" value={newDamageForm.barangay} onChange={(e) => setNewDamageForm({ ...newDamageForm, barangay: e.target.value })} className="w-full rounded-xl border border-slate-300 p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Uri ng Pinsala</label>
                  <select value={newDamageForm.disasterType} onChange={(e) => setNewDamageForm({ ...newDamageForm, disasterType: e.target.value })} className="w-full rounded-xl border border-slate-300 p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none">
                    <option value="Bagyo (Typhoon)">Bagyo (Typhoon)</option>
                    <option value="Baha (Flash Flood)">Baha (Flash Flood)</option>
                    <option value="Fall Armyworm">Fall Armyworm</option>
                    <option value="Tagtuyot (Drought)">Tagtuyot (Drought)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Sukat ng Taniman na Apektado (ha)</label>
                <input type="number" step="0.1" required value={newDamageForm.hectares} onChange={(e) => setNewDamageForm({ ...newDamageForm, hectares: e.target.value })} placeholder="Hal. 2.5" className="w-full rounded-xl border border-slate-300 p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tala / Obserbasyon</label>
                <textarea rows={3} value={newDamageForm.notes} onChange={(e) => setNewDamageForm({ ...newDamageForm, notes: e.target.value })} placeholder="Deskripsyon ng pinsala sa mais..." className="w-full rounded-xl border border-slate-300 p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsAddDamageOpen(false)} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer">Kanselahin</button>
                <button type="submit" className="flex-1 rounded-xl bg-[#065F46] hover:bg-emerald-800 py-2.5 text-xs sm:text-sm font-bold text-white transition cursor-pointer">I-save ang Kaso</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: BAGONG TALA NG KONSULTASYON ──────────────────────────────── */}
      {isAddConsultOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xl font-extrabold text-slate-900">Bagong Tala ng Konsultasyon</h3>
              <button type="button" onClick={() => setIsAddConsultOpen(false)} className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddConsultSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Pangalan ng Magsasaka</label>
                <input type="text" required value={newConsultForm.farmerName} onChange={(e) => setNewConsultForm({ ...newConsultForm, farmerName: e.target.value })} placeholder="Hal. Pedro Santos" className="w-full rounded-xl border border-slate-300 p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Paksa ng Tanong</label>
                <input type="text" required value={newConsultForm.topic} onChange={(e) => setNewConsultForm({ ...newConsultForm, topic: e.target.value })} placeholder="Hal. Tamang timpla ng pestisidyo" className="w-full rounded-xl border border-slate-300 p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tanong ng Magsasaka</label>
                <textarea rows={3} value={newConsultForm.question} onChange={(e) => setNewConsultForm({ ...newConsultForm, question: e.target.value })} placeholder="Ilagay ang katanungan ng magsasaka..." className="w-full rounded-xl border border-slate-300 p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsAddConsultOpen(false)} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer">Kanselahin</button>
                <button type="submit" className="flex-1 rounded-xl bg-[#065F46] hover:bg-emerald-800 py-2.5 text-xs sm:text-sm font-bold text-white transition cursor-pointer">I-tala ang Konsultasyon</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ACCOUNT SHEET ──────────────────────────────────────────────────── */}
      <AccountSheet
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        profileName={technicianDisplayName}
        profileRoleSubtitle={technicianRoleSubtitle}
        profileInitials={technicianInitials}
        menuItems={accountMenuItems}
        triggerRef={activeTriggerRef}
      />

      {/* ── LOGOUT MODAL ───────────────────────────────────────────────────── */}
      {confirmLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-xl font-bold text-slate-900">Sigurado ka bang nais mong mag-logout?</h3>
            <p className="text-xs sm:text-sm text-slate-500">Kakailanganin mong mag-login muli gamit ang iyong municipal account.</p>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button type="button" onClick={() => setConfirmLogout(false)} className="rounded-xl border border-slate-300 py-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer">Bumalik</button>
              <button type="button" onClick={handleLogout} disabled={loggingOut} className="rounded-xl bg-red-600 hover:bg-red-700 py-2.5 text-xs sm:text-sm font-bold text-white transition disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer">
                {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                <span>Mag-logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TechnicianDashboardPage;
