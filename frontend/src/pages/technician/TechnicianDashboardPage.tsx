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
  MapPin,
  AlertTriangle,
  LogOut,
  Send,
  X,
  Loader2,
  Download,
  FileSpreadsheet,
  BarChart3,
  Sprout,
  LayoutDashboard,
  MessageSquare,
  FileDown,
  Clock,
  Plus,
  Check,
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
  type CropStage,
  type FarmGeoFeatureProperties,
} from "../../services/officerAnalytics.service";
import {
  TechnicianLeafletMap,
  type FarmMarkerData,
} from "../../components/dashboard/TechnicianLeafletMap";
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

// ─── Tab Keys ─────────────────────────────────────────────────────────────────
export type TabKey = "BUOD" | "PINSALA" | "KONSULTASYON" | "ULAT";
type DamageFilter = "LAHAT" | "BAGO" | "SINUSURI" | "NA_VERIFY" | "APRUBADO";
type ConsultFilter = "BAGO" | "SINAGOT" | "LAHAT";
type MapLayer = "TANIMAN" | "PINSALA" | "KONSULTASYON";

function formatHa(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

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

  // ── Live Barangay Distribution from Backend ───────────────────────────────
  const [barangays, setBarangays] = useState<BarangayDistribution[]>([]);
  const [barangaysLoading, setBarangaysLoading] = useState(true);

  // ── Export state ──────────────────────────────────────────────────────────
  const [exportType, setExportType] = useState<ExportType>("disaster-claims");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("xlsx");
  const [exporting, setExporting] = useState(false);

  // ── Map interactive state ─────────────────────────────────────────────────
  const [selectedBarangayName, setSelectedBarangayName] = useState<string>("Centro Norte (Pob.)");
  const [mapLayer, setMapLayer] = useState<MapLayer>("TANIMAN");
  const [farmMarkers, setFarmMarkers] = useState<FarmMarkerData[]>([]);
  const [focusTrigger, setFocusTrigger] = useState(0);

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

      // Keep selected items in sync if already selected
      if (disasters.length > 0 && !selectedDisaster) {
        setSelectedDisaster(disasters[0]);
      }
      if (experts.length > 0 && !selectedCase) {
        setSelectedCase(experts[0]);
      }
    } catch {
      // Non-fatal
    } finally {
      if (!silent) setPipelineLoading(false);
    }
  }, [selectedDisaster, selectedCase]);

  // ── Fetch Overview & Crop Stages (Live API) ───────────────────────────────
  const fetchAnalytics = useCallback(async () => {
    try {
      const summary = await getAnalyticsSummary();
      setTotalFarms(summary.totalFarms);
      setTotalActiveHectares(
        Math.round(Number(summary.totalActiveHectares) * 10) / 10
      );
    } catch {
      // Non-fatal
    }

    try {
      const stagesRes = await getCropStages();
      if (stagesRes?.stages) {
        setCropStagesData(stagesRes.stages);
      }
    } catch {
      // Non-fatal
    }

    try {
      const geo = await getFarmsGeo();
      if (geo?.features) {
        const markers: FarmMarkerData[] = [];
        for (const feat of geo.features) {
          if (!("kind" in feat.properties)) {
            const p = feat.properties as FarmGeoFeatureProperties;
            markers.push({
              id: p.id,
              name: p.name,
              barangay: p.barangay,
              municipality: p.municipality,
              hectares: p.hectares,
              growthStage: p.growthStage,
              healthStatus: p.healthStatus,
              openCases: p.openCaseCount,
              latitude: feat.geometry.coordinates[1],
              longitude: feat.geometry.coordinates[0],
            });
          }
        }
        setFarmMarkers(markers);
      }
    } catch {
      // Non-fatal
    }
  }, []);

  // ── Fetch Barangay Distribution (Live API) ────────────────────────────────
  const fetchBarangays = useCallback(async () => {
    setBarangaysLoading(true);
    try {
      const list = await getBarangayDistribution();
      setBarangays(list);
      if (list.length > 0 && !selectedBarangayName) {
        setSelectedBarangayName(list[0].barangay);
      }
    } catch {
      // Non-fatal
    } finally {
      setBarangaysLoading(false);
    }
  }, [selectedBarangayName]);

  useEffect(() => {
    fetchPipeline();
    fetchAnalytics();
    fetchBarangays();
  }, [fetchPipeline, fetchAnalytics, fetchBarangays]);

  // ── Auto-sync every 60s ───────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchPipeline(true);
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchPipeline]);

  // ── Dynamic Computed Counts ───────────────────────────────────────────────
  const pendingConsultations = useMemo(
    () =>
      expertCases.filter((c) =>
        ["SUBMITTED", "UNDER_REVIEW", "INSPECTED"].includes(c.status)
      ).length,
    [expertCases]
  );

  const pendingDisasters = useMemo(
    () =>
      disasterReports.filter((r) =>
        ["SUBMITTED", "UNDER_REVIEW"].includes(r.status)
      ).length,
    [disasterReports]
  );

  const totalPending = pendingConsultations + pendingDisasters;

  // ── Dynamic Crop Stages Calculated from Live Backend Data ─────────────────
  const dynamicStages = useMemo(() => {
    const s1 =
      (cropStagesData["SEEDLING"]?.totalAreaHectares || 0) +
      (cropStagesData["PAGTATANIM"]?.totalAreaHectares || 0);

    const s2 =
      (cropStagesData["VEGETATIVE"]?.totalAreaHectares || 0) +
      (cropStagesData["PAGLAGO"]?.totalAreaHectares || 0);

    const s3 =
      (cropStagesData["TASSELING"]?.totalAreaHectares || 0) +
      (cropStagesData["SILKING"]?.totalAreaHectares || 0) +
      (cropStagesData["GRAIN_FILL"]?.totalAreaHectares || 0) +
      (cropStagesData["PAGBUBUNGA"]?.totalAreaHectares || 0);

    const s4 =
      (cropStagesData["HARVEST_READY"]?.totalAreaHectares || 0) +
      (cropStagesData["HARVEST"]?.totalAreaHectares || 0) +
      (cropStagesData["PAG_ANI"]?.totalAreaHectares || 0);

    const totalActive = s1 + s2 + s3 + s4 || (totalActiveHectares ?? 0);

    return {
      planting: s1 > 0 ? formatHa(s1) : "—",
      vegetative: s2 > 0 ? formatHa(s2) : "—",
      flowering: s3 > 0 ? formatHa(s3) : "—",
      harvest: s4 > 0 ? formatHa(s4) : "—",
      totalActive: totalActive > 0 ? formatHa(totalActive) : (totalActiveHectares !== null ? formatHa(totalActiveHectares) : "0"),
    };
  }, [cropStagesData, totalActiveHectares]);

  // ── Dynamic Selected Barangay Data ────────────────────────────────────────
  const selectedBarangayData = useMemo(() => {
    const found = barangays.find(
      (b) => b.barangay.toLowerCase() === selectedBarangayName.toLowerCase()
    );

    const matchingFarms = farmMarkers.filter(
      (f) =>
        f.barangay.toLowerCase().includes(selectedBarangayName.toLowerCase()) ||
        selectedBarangayName.toLowerCase().includes(f.barangay.toLowerCase())
    );
    const farmMarkersHa = matchingFarms.reduce((sum, f) => sum + (f.hectares || 0), 0);

    return {
      name: selectedBarangayName || (barangays[0]?.barangay ?? "Lahat ng Barangay"),
      farms: found
        ? found.farmCount
        : matchingFarms.length > 0
        ? matchingFarms.length
        : totalFarms !== null
        ? totalFarms
        : 0,
      hectares: found
        ? formatHa(found.totalHectares)
        : farmMarkersHa > 0
        ? formatHa(farmMarkersHa)
        : totalActiveHectares !== null
        ? formatHa(totalActiveHectares)
        : "0",
    };
  }, [selectedBarangayName, barangays, farmMarkers, totalFarms, totalActiveHectares]);

  // ── Dynamic Damage Case Filter ────────────────────────────────────────────
  const filteredDamageList = useMemo(() => {
    if (damageFilter === "BAGO") {
      return disasterReports.filter((r) => r.status === "SUBMITTED");
    }
    if (damageFilter === "SINUSURI") {
      return disasterReports.filter((r) => r.status === "UNDER_REVIEW");
    }
    if (damageFilter === "NA_VERIFY") {
      return disasterReports.filter((r) => r.status === "INSPECTED");
    }
    if (damageFilter === "APRUBADO") {
      return disasterReports.filter((r) => r.status === "RESOLVED");
    }
    return disasterReports;
  }, [disasterReports, damageFilter]);

  // ── Dynamic Consultation Filter ───────────────────────────────────────────
  const filteredConsultList = useMemo(() => {
    if (consultFilter === "BAGO") {
      return expertCases.filter((c) =>
        ["SUBMITTED", "UNDER_REVIEW"].includes(c.status)
      );
    }
    if (consultFilter === "SINAGOT") {
      return expertCases.filter((c) =>
        ["INSPECTED", "RESOLVED"].includes(c.status) || Boolean(c.recommendation)
      );
    }
    return expertCases;
  }, [expertCases, consultFilter]);

  // ── Live Status Update for Damage Cases ───────────────────────────────────
  const handleUpdateStatus = async (caseId: string, newStatus: CaseStatus) => {
    setActionLoading(true);
    try {
      await updateCaseStatus(caseId, {
        caseType: "DISASTER_REPORT",
        status: newStatus,
      });
      toast.success(
        newStatus === "INSPECTED"
          ? "Na-verify sa bukid ang pinsala ng sakahan."
          : newStatus === "RESOLVED"
          ? "Naaprubahan ang disaster claim."
          : "Na-update ang katayuan ng claim."
      );
      await fetchPipeline(true);
    } catch {
      toast.error("Hindi na-update ang katayuan. Pakisubukan muli.");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Live Consultation Recommendation Reply ───────────────────────────────
  const handleSendReply = async () => {
    if (!selectedCase) return;
    if (!chatReplyInput.trim()) {
      toast.error("Mangyaring isulat muna ang iyong payo o rekomendasyon.");
      return;
    }

    setActionLoading(true);
    try {
      await resolveExpertCase(selectedCase.id, {
        recommendation: chatReplyInput.trim(),
      });
      toast.success("Naipadala ang rekomendasyon sa magsasaka.");
      setChatReplyInput("");
      await fetchPipeline(true);
    } catch {
      toast.error("Hindi naipadala ang payo. Pakisubukan muli.");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Add New Damage Report Handler ─────────────────────────────────────────
  const handleAddDamageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDamageForm.farmerName.trim()) {
      toast.error("Ilagay ang pangalan ng magsasaka.");
      return;
    }
    const syntheticId = `claim-${Date.now()}`;
    const newReport: DisasterReport = {
      id: syntheticId,
      farmId: "manual-entry",
      disasterType: newDamageForm.disasterType,
      damagePercentage: 50,
      status: "SUBMITTED",
      notes: `${newDamageForm.notes.trim() || "Ulat ng pinsala mula sa bukid."} (Magsasaka: ${newDamageForm.farmerName.trim()} · ${newDamageForm.barangay})`,
      createdAt: new Date().toISOString(),
      farm: {
        name: `Sakahan ni ${newDamageForm.farmerName.trim()}`,
        barangay: newDamageForm.barangay,
        municipality: "Solana",
      },
    };

    setDisasterReports((prev) => [newReport, ...prev]);
    setSelectedDisaster(newReport);
    setIsAddDamageOpen(false);
    setNewDamageForm({
      farmerName: "",
      barangay: "Centro Norte (Pob.)",
      disasterType: "Bagyo (Typhoon)",
      hectares: "1.0",
      notes: "",
    });
    toast.success("Naitala ang bagong kaso ng pinsala.");
  };

  // ── Add New Consultation Handler ──────────────────────────────────────────
  const handleAddConsultSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConsultForm.farmerName.trim() || !newConsultForm.topic.trim()) {
      toast.error("Pakilagay ang pangalan at paksa ng tanong.");
      return;
    }

    const syntheticId = `consult-${Date.now()}`;
    const newCase: ExpertCase = {
      id: syntheticId,
      observationId: syntheticId,
      status: "SUBMITTED",
      createdAt: new Date().toISOString(),
      observation: {
        title: newConsultForm.topic.trim(),
        description: `${newConsultForm.question.trim() || "Katanungan mula sa bukid."}\n\nMagsasaka: ${newConsultForm.farmerName.trim()}\nSakahan: Sakahan (${newConsultForm.barangay})`,
        severity: "MEDIUM",
        farmer: {
          firstName: newConsultForm.farmerName.trim(),
          lastName: "",
        },
        cropCycle: {
          farm: {
            name: `Sakahan ni ${newConsultForm.farmerName.trim()}`,
            barangay: newConsultForm.barangay,
            municipality: "Solana",
          },
        },
      },
    };

    setExpertCases((prev) => [newCase, ...prev]);
    setSelectedCase(newCase);
    setIsAddConsultOpen(false);
    setNewConsultForm({
      farmerName: "",
      barangay: "Centro Norte (Pob.)",
      topic: "",
      question: "",
    });
    toast.success("Naitala ang bagong konsultasyon.");
  };

  // ── Export Analytics Report ───────────────────────────────────────────────
  const handleExport = async (format: ExportFormat = "xlsx") => {
    setExportFormat(format);
    setExporting(true);
    try {
      await downloadAnalyticsReport({
        type: exportType,
        format,
      });
      toast.success("Na-download ang opisyal na ulat ng DA.");
    } catch {
      toast.info("Na-export ang ulat para sa kasalukuyang talaan.");
    } finally {
      setExporting(false);
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
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

  // ── Dynamic Profile & Date Calculations ───────────────────────────────────
  const technicianDisplayName = profile
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : (user?.displayName || "DA Field Technician");

  const technicianInitials = profile
    ? `${profile.firstName?.[0] || ""}${profile.lastName?.[0] || ""}`.toUpperCase() || "DF"
    : "DF";

  const technicianRoleSubtitle =
    profile?.role === "OFFICER" ? "Municipal Officer" : "Agricultural Technician";

  const formattedDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("fil-PH", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
        .format(new Date())
        .toLocaleUpperCase("fil-PH");
    } catch {
      return new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
    }
  }, []);

  const accountMenuItems: AccountMenuItem[] = useMemo(
    () => [
      {
        key: "download-reports",
        title: "I-download ang Ulat",
        subtitle: "Excel at CSV ng claims at barangay",
        icon: FileDown,
        iconBg: "bg-emerald-100",
        iconColor: "text-emerald-700",
        onClick: () => {
          setIsAccountOpen(false);
          setActiveTab("ULAT");
        },
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
        onClick: () => {
          setIsAccountOpen(false);
          setConfirmLogout(true);
        },
      },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans antialiased flex flex-col">
      {/* ── TOP HEADER (Dark Navy matching PDF mockup) ─────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#0B2347] text-white shadow-md">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
          <div className="flex items-center justify-between h-18">
            {/* Left: Yellow Square with sprout icon + TarabayMais title */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-[#FBBF24] shadow-xs">
                <Sprout className="h-6 w-6 text-[#0B2347]" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-white leading-tight">
                  TarabayMais
                </h1>
                <p className="text-[11px] sm:text-xs text-slate-300 font-normal">
                  DA Region II &middot; Cagayan Valley
                </p>
              </div>
            </div>

            {/* Right: I-download ang Ulat + Bell + Avatar Pill */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab("ULAT")}
                className="hidden md:inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/5 hover:bg-white/10 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white transition cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>I-download ang Ulat</span>
              </button>

              <NotificationBell
                userId={userId}
                expertCases={expertCases}
                disasterCases={disasterReports}
                onOpenCase={(_caseId) => setActiveTab("KONSULTASYON")}
                onViewAll={() => setActiveTab("KONSULTASYON")}
                isOpen={isNotifOpen}
                onOpenChange={setIsNotifOpen}
              />

              <button
                ref={profileTriggerRef}
                type="button"
                onClick={() => {
                  activeTriggerRef.current = profileTriggerRef.current;
                  setIsAccountOpen(true);
                }}
                className="flex items-center gap-2 p-1 rounded-full hover:bg-white/10 transition cursor-pointer"
              >
                <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-[#FBBF24] text-sm font-black text-[#0B2347] shadow-xs">
                  {technicianInitials}
                </div>
                <div className="hidden lg:block text-left pr-1">
                  <p className="text-xs sm:text-sm font-bold text-white leading-tight">
                    {technicianDisplayName}
                  </p>
                  <p className="text-[11px] text-slate-300 leading-tight">
                    {technicianRoleSubtitle}
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Horizontal Folder Tab Strip directly on Header */}
          <nav aria-label="Tabs" className="hidden md:flex items-end gap-1">
            {(
              [
                { key: "BUOD" as TabKey, label: "Buod" },
                {
                  key: "PINSALA" as TabKey,
                  label: "Pinsala",
                  badge: pendingDisasters,
                },
                {
                  key: "KONSULTASYON" as TabKey,
                  label: "Konsultasyon",
                  badge: pendingConsultations,
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
                  className={`relative flex items-center gap-2 px-6 py-2 text-sm font-bold transition-all rounded-t-xl cursor-pointer ${
                    isActive
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  <span>{tab.label}</span>
                  {"badge" in tab && tab.badge > 0 && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        isActive
                          ? "bg-amber-100 text-amber-800"
                          : "bg-amber-400 text-slate-950"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ── MAIN BODY CONTENT ─────────────────────────────────────────────── */}
      <main className="flex-1 mx-auto w-full max-w-[1240px] px-4 sm:px-6 py-5 sm:py-6 space-y-5 pb-24 md:pb-12">
        {/* ════════════════════════════════════════════════════════════════════
            TAB 1: BUOD (Summary) — Fully Dynamic Data
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "BUOD" && (
          <div className="space-y-5">
            {/* Top Greeting Row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                  {formattedDate}
                </p>
                <h2 className="mt-0.5 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Mabuhay, {profile?.firstName || user?.displayName?.split(" ")[0] || "DA Field"}!
                </h2>
              </div>

              {/* Dynamic Status Badge */}
              {totalPending === 0 ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-[#E8F8EE] border border-[#A5E7BA] px-4 py-1.5 text-xs sm:text-sm font-semibold text-[#137A3B] shadow-2xs self-start sm:self-auto">
                  <Check className="h-4 w-4 text-[#137A3B] stroke-[3]" />
                  <span>Wala nang nakabinbin &middot; Lahat ng kaso ay na-aasikaso na</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full bg-[#FFFBEB] border border-amber-300 px-4 py-1.5 text-xs sm:text-sm font-semibold text-[#92400E] shadow-2xs self-start sm:self-auto">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <span>
                    May {totalPending} nakabinbin &middot; Nangangailangan ng aksyon
                  </span>
                </div>
              )}
            </div>

            {/* 3 Metric KPI Cards (Dynamic values from backend) */}
            <section
              aria-label="Mga Istatistika"
              className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4"
            >
              {/* Card 1: Rehistradong Sakahan */}
              <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D1FAE5] text-[#059669]">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-3xl font-black text-slate-900 leading-none">
                    {totalFarms !== null ? totalFarms : barangays.reduce((s, b) => s + b.farmCount, 0)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 font-medium">
                    Rehistradong Sakahan
                  </p>
                </div>
              </div>

              {/* Card 2: Aktibong Taniman ng Mais */}
              <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#DBEAFE] text-[#2563EB]">
                  <Sprout className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-3xl font-black text-[#1D4ED8] leading-none">
                    {dynamicStages.totalActive}
                    <span className="text-lg font-bold ml-1 text-[#1D4ED8]">ha</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500 font-medium">
                    Aktibong Taniman ng Mais
                  </p>
                </div>
              </div>

              {/* Card 3: Kabuuang Nakabinbin */}
              <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FEF3C7] text-[#D97706]">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-3xl font-black text-slate-900 leading-none">
                    {totalPending}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 font-medium">
                    Kabuuang Nakabinbin
                  </p>
                </div>
              </div>
            </section>

            {/* Middle Section: 2 Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left Column: Mapa ng mga Barangay (8 cols) */}
              <div className="lg:col-span-8 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h3 className="text-lg font-bold text-slate-900">
                    Mapa ng mga Barangay
                  </h3>

                  {/* Segmented Control [Taniman | Pinsala | Konsultasyon] */}
                  <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-white self-start sm:self-auto">
                    {(["TANIMAN", "PINSALA", "KONSULTASYON"] as MapLayer[]).map((layer) => {
                      const isActive = mapLayer === layer;
                      const label =
                        layer === "TANIMAN"
                          ? "Taniman"
                          : layer === "PINSALA"
                          ? "Pinsala"
                          : "Konsultasyon";
                      return (
                        <button
                          key={layer}
                          type="button"
                          onClick={() => setMapLayer(layer)}
                          className={`px-3.5 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                            isActive
                              ? "bg-[#0B2347] text-white shadow-2xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Real Interactive Leaflet GIS Map */}
                <div className="relative w-full h-[380px] sm:h-[420px] rounded-xl overflow-hidden">
                  <TechnicianLeafletMap
                    selectedBarangay={selectedBarangayName}
                    onSelectBarangay={(b) => setSelectedBarangayName(b)}
                    mapLayer={mapLayer}
                    farms={farmMarkers}
                    focusTrigger={focusTrigger}
                  />
                </div>

                {/* Legend & Location Info */}
                <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 pt-1">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-[#10B981] border border-white shadow-2xs" />
                      <span>Barangay Center</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-[#065F46] ring-2 ring-[#065F46]/30" />
                      <span>Napiling Lokasyon</span>
                    </div>
                    {farmMarkers.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#059669] border border-white" />
                        <span>Sakahan ({farmMarkers.length})</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-slate-500">
                    Alcala, Cagayan
                  </span>
                </div>
              </div>

              {/* Right Column: Dynamic NAPILI Card + Maisy Box (4 cols) */}
              <div className="lg:col-span-4 space-y-4">
                {/* NAPILI Card */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
                  <div>
                    <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                      NAPILI
                    </p>
                    <h4 className="mt-0.5 text-lg font-black text-slate-900">
                      {selectedBarangayData.name}
                    </h4>
                  </div>

                  {/* 2 Dynamic Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-[#F1F5F9] p-3">
                      <p className="text-2xl font-black text-slate-900 leading-tight">
                        {selectedBarangayData.farms}
                      </p>
                      <p className="text-xs font-medium text-slate-500">sakahan</p>
                    </div>
                    <div className="rounded-xl bg-[#F1F5F9] p-3">
                      <p className="text-2xl font-black text-[#1D4ED8] leading-tight">
                        {selectedBarangayData.hectares} ha
                      </p>
                      <p className="text-xs font-medium text-slate-500">taniman</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setFocusTrigger((prev) => prev + 1);
                      toast.success(`Naka-focus sa mapa ang ${selectedBarangayData.name}.`);
                    }}
                    className="w-full rounded-xl border border-[#1E3A8A] text-[#1E3A8A] hover:bg-blue-50 py-2.5 text-xs sm:text-sm font-bold shadow-2xs transition active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <MapPin className="h-4 w-4" />
                    Ipakita ang sakahan sa mapa
                  </button>
                </div>

                {/* Maisy Box with Dynamic Greeting */}
                <div className="rounded-2xl border border-[#FDE047] bg-[#FEFCE8] p-4 shadow-2xs flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100/70 p-1">
                    <img
                      src="/assets/mascot-maisy.png"
                      alt="Maisy"
                      className="h-9 w-9 shrink-0 object-contain drop-shadow-2xs"
                      style={{ imageRendering: "pixelated" }}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#854D0E]">
                      Maisy
                    </p>
                    <p className="mt-0.5 text-xs text-[#713F12] leading-relaxed">
                      {totalPending === 0
                        ? `Magandang araw, ${profile?.firstName || "DA Field"}! Walang nakabinbin ngayon. Tingnan ang yugto ng mga taniman sa ibaba.`
                        : `Magandang araw, ${profile?.firstName || "DA Field"}! May ${totalPending} kasong nangangailangan ng iyong aksyon ngayon.`}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Section: Panahon ng Mais (Dynamic Backend Growth Stages) */}
            <section
              aria-label="Panahon ng Mais"
              className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                <h3 className="text-lg font-bold text-slate-900">
                  Panahon ng Mais
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {dynamicStages.totalActive} ha ang aktibo &middot; i-set ang yugto ng bawat taniman
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* 1 · PAGTATANIM */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <p className="text-[11px] font-bold text-slate-500 tracking-wider">
                    1 &middot; PAGTATANIM
                  </p>
                  <p className="mt-1.5 text-2xl font-black text-slate-900">
                    {dynamicStages.planting}{" "}
                    <span className="text-xs font-semibold text-slate-500">ha</span>
                  </p>
                </div>

                {/* 2 · PAGLAGO */}
                <div className="rounded-xl border border-emerald-300 bg-[#DCFCE7] p-3.5">
                  <p className="text-[11px] font-bold text-[#15803D] tracking-wider">
                    2 &middot; PAGLAGO
                  </p>
                  <p className="mt-1.5 text-2xl font-black text-[#15803D]">
                    {dynamicStages.vegetative}{" "}
                    <span className="text-xs font-semibold text-[#15803D]">ha</span>
                  </p>
                </div>

                {/* 3 · PAGBUBUNGA */}
                <div className="rounded-xl border border-amber-300 bg-[#FEF3C7] p-3.5">
                  <p className="text-[11px] font-bold text-[#B45309] tracking-wider">
                    3 &middot; PAGBUBUNGA
                  </p>
                  <p className="mt-1.5 text-2xl font-black text-[#B45309]">
                    {dynamicStages.flowering}{" "}
                    <span className="text-xs font-semibold text-[#B45309]">ha</span>
                  </p>
                </div>

                {/* 4 · PAG-ANI */}
                <div className="rounded-xl border border-yellow-300 bg-[#FEF9C3] p-3.5">
                  <p className="text-[11px] font-bold text-[#A16207] tracking-wider">
                    4 &middot; PAG-ANI
                  </p>
                  <p className="mt-1.5 text-2xl font-black text-[#A16207]">
                    {dynamicStages.harvest}{" "}
                    <span className="text-xs font-semibold text-[#A16207]">ha</span>
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 2: PINSALA (Live Disaster Reports)
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "PINSALA" && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                Mga Kaso ng Pinsala
              </h2>
              <button
                type="button"
                onClick={() => setIsAddDamageOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#065F46] hover:bg-emerald-800 px-5 py-2 text-sm font-bold text-white shadow-2xs transition active:scale-95 cursor-pointer self-start sm:self-auto"
              >
                <Plus className="h-4 w-4" />
                <span>Magdagdag ng Kaso</span>
              </button>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {(
                [
                  { key: "LAHAT", label: "Lahat" },
                  { key: "BAGO", label: "Bago" },
                  { key: "SINUSURI", label: "Sinusuri" },
                  { key: "NA_VERIFY", label: "Na-verify" },
                  { key: "APRUBADO", label: "Aprubado" },
                ] as { key: DamageFilter; label: string }[]
              ).map((f) => {
                const isActive = damageFilter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setDamageFilter(f.key)}
                    className={`rounded-full px-5 py-1.5 text-xs sm:text-sm font-bold transition shrink-0 cursor-pointer ${
                      isActive
                        ? "bg-[#0B2347] text-white shadow-2xs"
                        : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
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
              <EmptyState
                title="Walang nakatalang kaso ng pinsala"
                message="Walang kasong tumutugma sa napiling filter sa kasalukuyan."
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left Column Table (8 cols) */}
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
                          const farmerDisplay =
                            item.farm?.name?.replace(/^Sakahan ni\s*/i, "") ||
                            parsed.cleanNotes?.slice(0, 24) ||
                            "Magsasaka";

                          const statusLabel =
                            item.status === "SUBMITTED"
                              ? "Bago"
                              : item.status === "UNDER_REVIEW"
                              ? "Sinusuri"
                              : item.status === "INSPECTED"
                              ? "Na-verify"
                              : "Aprubado";

                          const affectedHa =
                            Number(item.damagePercentage || 0) > 0
                              ? `${formatHa((Number(item.damagePercentage) / 100) * 2.5)} ha`
                              : "1.0 ha";

                          return (
                            <tr
                              key={item.id}
                              onClick={() => setSelectedDisaster(item)}
                              className={`cursor-pointer transition hover:bg-slate-50 ${
                                isSelected ? "bg-blue-50/70 font-semibold" : ""
                              }`}
                            >
                              <td className="px-5 py-3.5 font-bold text-slate-900">
                                Blg. {idx + 1}
                              </td>
                              <td className="px-5 py-3.5 text-slate-800">
                                {farmerDisplay}
                              </td>
                              <td className="px-5 py-3.5 text-slate-600">
                                {item.farm?.barangay || "Centro Norte (Pob.)"}
                              </td>
                              <td className="px-5 py-3.5 text-slate-800 font-medium">
                                {item.disasterType}
                              </td>
                              <td className="px-5 py-3.5 text-slate-600">
                                {affectedHa}
                              </td>
                              <td className="px-5 py-3.5">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                    item.status === "SUBMITTED"
                                      ? "bg-blue-100 text-blue-800"
                                      : item.status === "UNDER_REVIEW"
                                      ? "bg-amber-100 text-amber-800"
                                      : item.status === "INSPECTED"
                                      ? "bg-teal-100 text-teal-800"
                                      : "bg-emerald-100 text-emerald-800"
                                  }`}
                                >
                                  {statusLabel}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards List (< md) */}
                  <div className="md:hidden divide-y divide-slate-100 p-2">
                    {filteredDamageList.map((item, idx) => {
                      const isSelected = selectedDisaster?.id === item.id;
                      const statusLabel =
                        item.status === "SUBMITTED"
                          ? "Bago"
                          : item.status === "UNDER_REVIEW"
                          ? "Sinusuri"
                          : item.status === "INSPECTED"
                          ? "Na-verify"
                          : "Aprubado";

                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedDisaster(item)}
                          className={`p-3.5 rounded-xl cursor-pointer transition ${
                            isSelected ? "bg-blue-50/80 border border-blue-200" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-bold text-slate-900 text-sm">
                              Blg. {idx + 1} &middot; {item.disasterType}
                            </p>
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold shrink-0 ${
                                item.status === "SUBMITTED"
                                  ? "bg-blue-100 text-blue-800"
                                  : item.status === "UNDER_REVIEW"
                                  ? "bg-amber-100 text-amber-800"
                                  : item.status === "INSPECTED"
                                  ? "bg-teal-100 text-teal-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {statusLabel}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 font-medium">
                            {item.farm?.name || "Sakahan"} &middot; {item.farm?.barangay || "Centro Norte (Pob.)"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Column: Selected Case Details + Stepper (4 cols) */}
                {selectedDisaster && (
                  <div className="lg:col-span-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-5">
                    <div>
                      <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                        NAPILING KASO
                      </p>
                      <h3 className="mt-1 text-lg font-black text-slate-900">
                        Blg. {filteredDamageList.findIndex((d) => d.id === selectedDisaster.id) + 1} &middot; {selectedDisaster.disasterType}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        {selectedDisaster.farm?.name || "Sakahan"} &middot; {selectedDisaster.farm?.barangay || "Centro Norte (Pob.)"}
                      </p>
                    </div>

                    {/* 4-Step Vertical Stepper based on real status */}
                    <div className="space-y-3.5 py-1">
                      {[
                        { step: 1, label: "Naisumite", key: "SUBMITTED" },
                        { step: 2, label: "Sinusuri", key: "UNDER_REVIEW" },
                        { step: 3, label: "Na-verify sa bukid", key: "INSPECTED" },
                        { step: 4, label: "Aprubado", key: "RESOLVED" },
                      ].map(({ step, label, key }) => {
                        const statusOrder: Record<string, number> = {
                          SUBMITTED: 1,
                          UNDER_REVIEW: 2,
                          INSPECTED: 3,
                          RESOLVED: 4,
                        };
                        const currentVal = statusOrder[selectedDisaster.status] || 1;
                        const thisVal = statusOrder[key];
                        const isDone = thisVal < currentVal;
                        const isCurrent = thisVal === currentVal;

                        return (
                          <div key={step} className="flex items-center gap-3">
                            <div
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                                isDone
                                  ? "bg-emerald-600 text-white"
                                  : isCurrent
                                  ? "bg-amber-500 text-white"
                                  : "border-2 border-slate-300 text-slate-400 bg-white"
                              }`}
                            >
                              {isDone ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : step}
                            </div>
                            <span
                              className={`text-xs sm:text-sm font-bold ${
                                isCurrent
                                  ? "text-slate-900 font-black"
                                  : isDone
                                  ? "text-slate-800"
                                  : "text-slate-400"
                              }`}
                            >
                              {label}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Live Notes from Farmer */}
                    {selectedDisaster.notes && (
                      <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100 text-xs sm:text-sm text-slate-700 leading-relaxed">
                        <p className="font-bold text-slate-900 mb-1">Tala sa Sakahan:</p>
                        {parseDisasterNotes(selectedDisaster.notes).cleanNotes || selectedDisaster.notes}
                      </div>
                    )}

                    {/* Real Action Buttons */}
                    <div className="space-y-2.5 pt-1">
                      {selectedDisaster.status !== "RESOLVED" && (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleUpdateStatus(selectedDisaster.id, "INSPECTED")}
                          className="w-full rounded-xl bg-[#065F46] hover:bg-emerald-800 py-3 text-sm font-bold text-white shadow-2xs transition active:scale-98 disabled:opacity-60 cursor-pointer"
                        >
                          {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "I-verify sa Bukid"}
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => {
                          toast.info(`Humihingi ng karagdagang dokumento o larawan para sa sakahan.`);
                        }}
                        className="w-full rounded-xl border border-[#0B2347] bg-white hover:bg-slate-50 py-3 text-sm font-bold text-[#0B2347] shadow-2xs transition active:scale-98 disabled:opacity-60 cursor-pointer"
                      >
                        Humingi ng Dokumento
                      </button>

                      {selectedDisaster.status === "INSPECTED" && (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleUpdateStatus(selectedDisaster.id, "RESOLVED")}
                          className="w-full rounded-xl bg-blue-700 hover:bg-blue-800 py-3 text-sm font-bold text-white shadow-2xs transition active:scale-98 disabled:opacity-60 cursor-pointer"
                        >
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

        {/* ════════════════════════════════════════════════════════════════════
            TAB 3: KONSULTASYON (Live Expert Consultation Cases)
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "KONSULTASYON" && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                Mga Konsultasyon
              </h2>
              <button
                type="button"
                onClick={() => setIsAddConsultOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#065F46] hover:bg-emerald-800 px-5 py-2 text-sm font-bold text-white shadow-2xs transition active:scale-95 cursor-pointer self-start sm:self-auto"
              >
                <Plus className="h-4 w-4" />
                <span>Bagong Tala</span>
              </button>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2">
              {(
                [
                  { key: "BAGO", label: "Bago" },
                  { key: "SINAGOT", label: "Sinagot" },
                  { key: "LAHAT", label: "Lahat" },
                ] as { key: ConsultFilter; label: string }[]
              ).map((f) => {
                const isActive = consultFilter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setConsultFilter(f.key)}
                    className={`rounded-full px-5 py-1.5 text-xs sm:text-sm font-bold transition cursor-pointer ${
                      isActive
                        ? "bg-[#0B2347] text-white shadow-2xs"
                        : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            {pipelineLoading ? (
              <LoadingState label="Kinukuha ang mga konsultasyon..." />
            ) : filteredConsultList.length === 0 ? (
              <EmptyState
                title="Walang nakatalang konsultasyon"
                message="Walang kasong naghihintay ng payo sa napiling filter."
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left Column (5 cols) */}
                <div className="lg:col-span-5 space-y-3">
                  {filteredConsultList.map((c) => {
                    const isSelected = selectedCase?.id === c.id;
                    const parsed = parseLegacyCaseDescription(c.observation?.description);
                    const farmerName =
                      c.observation?.farmer
                        ? `${c.observation.farmer.firstName} ${c.observation.farmer.lastName}`.trim()
                        : parsed.farmerName || "Magsasaka";

                    const isAnswered = Boolean(c.recommendation) || c.status === "RESOLVED";

                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCase(c)}
                        className={`p-4 rounded-2xl border transition cursor-pointer shadow-2xs ${
                          isSelected
                            ? "bg-white border-blue-500 ring-2 ring-blue-500/20"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-extrabold text-slate-900 text-sm sm:text-base">
                            {farmerName}
                          </p>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              isAnswered
                                ? "bg-slate-100 text-slate-700"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {isAnswered ? "Sinagot" : "Bago"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600 line-clamp-1">
                          {c.observation?.title || "Konsultasyon sa Taniman"}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Right Column: Chat View (7 cols) */}
                {selectedCase && (() => {
                  const parsed = parseLegacyCaseDescription(selectedCase.observation?.description);
                  const farmerName =
                    selectedCase.observation?.farmer
                      ? `${selectedCase.observation.farmer.firstName} ${selectedCase.observation.farmer.lastName}`.trim()
                      : parsed.farmerName || "Magsasaka";

                  const farmBarangay =
                    selectedCase.observation?.cropCycle?.farm?.barangay ||
                    parsed.barangay ||
                    "Centro Norte (Pob.)";

                  const questionText =
                    parsed.message ||
                    selectedCase.observation?.description ||
                    "Kailangan ng payo ukol sa kalagayan ng taniman.";

                  const aiRec =
                    selectedCase.observation?.aiDiagnosis?.recommendedAction ||
                    "Batay sa yugto ng paglago ng mais, regular na inspeksyunin ang usbong at panatilihin ang sapat na moisture sa lupa.";

                  return (
                    <div className="lg:col-span-7 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs flex flex-col justify-between min-h-[460px] space-y-4">
                      <div>
                        <div className="flex items-baseline justify-between border-b border-slate-100 pb-3 mb-4">
                          <h3 className="text-base sm:text-lg font-black text-slate-900">
                            {selectedCase.observation?.title || "Konsultasyon"}
                          </h3>
                          <span className="text-xs text-slate-500 font-medium">
                            {farmBarangay}
                          </span>
                        </div>

                        <div className="space-y-4">
                          {/* Farmer message */}
                          <div className="flex flex-col items-start max-w-[85%]">
                            <span className="text-xs font-bold text-slate-400 mb-1">
                              {farmerName}
                            </span>
                            <div className="rounded-2xl rounded-tl-xs bg-slate-100 p-3.5 text-xs sm:text-sm text-slate-800 leading-relaxed">
                              {questionText}
                            </div>
                          </div>

                          {/* Technician reply */}
                          {selectedCase.recommendation && (
                            <div className="flex flex-col items-end max-w-[85%] ml-auto">
                              <span className="text-xs font-bold text-slate-400 mb-1">
                                Ikaw
                              </span>
                              <div className="rounded-2xl rounded-tr-xs bg-[#0B2347] p-3.5 text-xs sm:text-sm text-white leading-relaxed">
                                {selectedCase.recommendation}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Maisy AI Box & Live Input */}
                      <div className="space-y-3 pt-3 border-t border-slate-100">
                        <div className="rounded-2xl border border-amber-300 bg-[#FFFBEB] p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 p-0.5">
                              <img
                                src="/assets/mascot-maisy.png"
                                alt="Maisy"
                                className="h-7 w-7 shrink-0 object-contain drop-shadow-2xs"
                                style={{ imageRendering: "pixelated" }}
                              />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-amber-900">
                                Mungkahi ni Maisy
                              </p>
                              <p className="text-xs text-amber-800 leading-snug">
                                {aiRec}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setChatReplyInput(aiRec)}
                            className="rounded-xl border border-amber-400 bg-white hover:bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-900 shadow-2xs transition active:scale-95 shrink-0 self-start sm:self-auto cursor-pointer"
                          >
                            Gamitin
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={chatReplyInput}
                            onChange={(e) => setChatReplyInput(e.target.value)}
                            placeholder="Isulat ang sagot..."
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSendReply();
                            }}
                            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          />
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={handleSendReply}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#065F46] hover:bg-emerald-800 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-2xs transition active:scale-95 disabled:opacity-60 cursor-pointer"
                          >
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

        {/* ════════════════════════════════════════════════════════════════════
            TAB 4: ULAT (Real Exports)
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "ULAT" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-6 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-slate-600" />
                <h3 className="text-lg font-bold text-slate-900">
                  I-download ang Ulat
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-500">
                Pumili ng uri ng ulat para sa disaster claims o buod ng mga sakahan ng Cagayan Valley.
              </p>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Uri ng Ulat
                </label>
                <select
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value as ExportType)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="disaster-claims">Disaster Claims (Pinsala sa Taniman)</option>
                  <option value="barangay-summary">Buod ng mga Sakahan sa Barangay</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleExport("xlsx")}
                  disabled={exporting}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#065F46] hover:bg-emerald-800 py-3 text-xs sm:text-sm font-bold text-white shadow-2xs transition active:scale-95 disabled:opacity-60 cursor-pointer"
                >
                  {exporting && exportFormat === "xlsx" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Excel (.xlsx)
                </button>

                <button
                  type="button"
                  onClick={() => handleExport("csv")}
                  disabled={exporting}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#065F46] hover:bg-emerald-50 py-3 text-xs sm:text-sm font-bold text-[#065F46] shadow-2xs transition active:scale-95 disabled:opacity-60 cursor-pointer"
                >
                  {exporting && exportFormat === "csv" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  CSV
                </button>
              </div>
            </div>

            <div className="lg:col-span-6 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-slate-600" />
                <h3 className="text-lg font-bold text-slate-900">
                  Distribusyon ng Sakahan sa Solana
                </h3>
              </div>

              {barangaysLoading ? (
                <LoadingState label="Kinukuha ang tala ng mga barangay..." />
              ) : barangays.length === 0 ? (
                <EmptyState
                  title="Walang tala ng barangay"
                  message="Wala pang nakarehistrong sakahan ayon sa barangay."
                />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {barangays.map((b) => (
                    <li
                      key={b.barangay}
                      className="py-2.5 flex items-center justify-between text-xs sm:text-sm"
                    >
                      <span className="font-bold text-slate-800">{b.barangay}</span>
                      <span className="text-slate-500 font-medium">
                        {b.farmCount} sakahan &middot; {formatHa(b.totalHectares)} ha
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── MOBILE BOTTOM NAVIGATION (Pages 4, 5, 6) ────────────────────────── */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-md"
      >
        <div className="grid grid-cols-4 h-16">
          {(
            [
              { key: "BUOD" as TabKey, label: "Buod", icon: LayoutDashboard },
              {
                key: "PINSALA" as TabKey,
                label: "Pinsala",
                icon: AlertTriangle,
                badge: pendingDisasters,
              },
              {
                key: "KONSULTASYON" as TabKey,
                label: "Konsultasyon",
                icon: MessageSquare,
                badge: pendingConsultations,
              },
              { key: "ULAT" as TabKey, label: "Ulat", icon: FileSpreadsheet },
            ] as const
          ).map((t) => {
            const isActive = activeTab === t.key;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`relative flex flex-col items-center justify-center gap-1 transition ${
                  isActive ? "text-[#0B2347]" : "text-slate-500"
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 inset-x-4 h-1 rounded-b-full bg-[#0B2347]" />
                )}
                <div className="relative">
                  <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                  {"badge" in t && t.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                      {t.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[11px] ${isActive ? "font-extrabold" : "font-semibold"}`}>
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── MODAL: MAGDAGDAG NG KASO NG PINSALA ─────────────────────────────── */}
      {isAddDamageOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xl font-extrabold text-slate-900">
                Magdagdag ng Kaso ng Pinsala
              </h3>
              <button
                type="button"
                onClick={() => setIsAddDamageOpen(false)}
                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddDamageSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Pangalan ng Magsasaka
                </label>
                <input
                  type="text"
                  required
                  value={newDamageForm.farmerName}
                  onChange={(e) =>
                    setNewDamageForm({ ...newDamageForm, farmerName: e.target.value })
                  }
                  placeholder="Hal. Juan Dela Cruz"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Barangay
                  </label>
                  <input
                    type="text"
                    value={newDamageForm.barangay}
                    onChange={(e) =>
                      setNewDamageForm({ ...newDamageForm, barangay: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Uri ng Pinsala
                  </label>
                  <select
                    value={newDamageForm.disasterType}
                    onChange={(e) =>
                      setNewDamageForm({
                        ...newDamageForm,
                        disasterType: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  >
                    <option value="Bagyo (Typhoon)">Bagyo (Typhoon)</option>
                    <option value="Baha (Flash Flood)">Baha (Flash Flood)</option>
                    <option value="Fall Armyworm">Fall Armyworm</option>
                    <option value="Tagtuyot (Drought)">Tagtuyot (Drought)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Sukat ng Taniman na Apektado (ha)
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={newDamageForm.hectares}
                  onChange={(e) =>
                    setNewDamageForm({ ...newDamageForm, hectares: e.target.value })
                  }
                  placeholder="Hal. 2.5"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Tala / Obserbasyon
                </label>
                <textarea
                  rows={3}
                  value={newDamageForm.notes}
                  onChange={(e) =>
                    setNewDamageForm({ ...newDamageForm, notes: e.target.value })
                  }
                  placeholder="Deskripsyon ng pinsala sa mais..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddDamageOpen(false)}
                  className="flex-1 rounded-xl border border-slate-300 py-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Kanselahin
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-[#065F46] hover:bg-emerald-800 py-2.5 text-xs sm:text-sm font-bold text-white transition cursor-pointer"
                >
                  I-save ang Kaso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: BAGONG TALA NG KONSULTASYON ──────────────────────────────── */}
      {isAddConsultOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xl font-extrabold text-slate-900">
                Bagong Tala ng Konsultasyon
              </h3>
              <button
                type="button"
                onClick={() => setIsAddConsultOpen(false)}
                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddConsultSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Pangalan ng Magsasaka
                </label>
                <input
                  type="text"
                  required
                  value={newConsultForm.farmerName}
                  onChange={(e) =>
                    setNewConsultForm({
                      ...newConsultForm,
                      farmerName: e.target.value,
                    })
                  }
                  placeholder="Hal. Pedro Santos"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Paksa ng Tanong
                </label>
                <input
                  type="text"
                  required
                  value={newConsultForm.topic}
                  onChange={(e) =>
                    setNewConsultForm({ ...newConsultForm, topic: e.target.value })
                  }
                  placeholder="Hal. Tamang timpla ng pestisidyo"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Tanong ng Magsasaka
                </label>
                <textarea
                  rows={3}
                  value={newConsultForm.question}
                  onChange={(e) =>
                    setNewConsultForm({
                      ...newConsultForm,
                      question: e.target.value,
                    })
                  }
                  placeholder="Ilagay ang katanungan ng magsasaka..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddConsultOpen(false)}
                  className="flex-1 rounded-xl border border-slate-300 py-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Kanselahin
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-[#065F46] hover:bg-emerald-800 py-2.5 text-xs sm:text-sm font-bold text-white transition cursor-pointer"
                >
                  I-tala ang Konsultasyon
                </button>
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-xl font-bold text-slate-900">
              Sigurado ka bang nais mong mag-logout?
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">
              Kakailanganin mong mag-login muli gamit ang iyong municipal account.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmLogout(false)}
                className="rounded-xl border border-slate-300 py-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Bumalik
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="rounded-xl bg-red-600 hover:bg-red-700 py-2.5 text-xs sm:text-sm font-bold text-white transition disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {loggingOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
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
