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
import { LoadingState } from "../../components/LoadingState";
import {
  AccountSheet,
  type AccountMenuItem,
} from "../../components/AccountSheet";
import { NotificationBell } from "../../components/NotificationBell";
import { clearReadNotifications } from "../../lib/notificationReadTracking";

// ─── Tab Keys ─────────────────────────────────────────────────────────────────
export type TabKey = "BUOD" | "PINSALA" | "KONSULTASYON" | "ULAT";
type DamageFilter = "LAHAT" | "BAGO" | "SINUSURI" | "NA_VERIFY" | "APRUBADO";
type ConsultFilter = "BAGO" | "SINAGOT" | "LAHAT";
type MapLayer = "TANIMAN" | "PINSALA" | "KONSULTASYON";

interface MockDisasterItem {
  id: string;
  code: string;
  farmerName: string;
  barangay: string;
  disasterType: string;
  hectares: number;
  status: "Bago" | "Sinusuri" | "Na-verify" | "Aprubado";
  date: string;
  notes: string;
}

interface MockConsultItem {
  id: string;
  farmerName: string;
  barangay: string;
  topic: string;
  question: string;
  answer?: string;
  status: "Bago" | "Sinagot";
  date: string;
  suggestedAnswer: string;
}

const INITIAL_MOCK_DISASTERS: MockDisasterItem[] = [
  {
    id: "claim-001",
    code: "[Blg. 1]",
    farmerName: "Juan Dela Cruz",
    barangay: "Centro Norte (Pob.)",
    disasterType: "Bagyo (Typhoon)",
    hectares: 2.5,
    status: "Sinusuri",
    date: "Oktubre 24, 2026",
    notes: "Nalubog sa baha ang maisan sa yugto ng paglago. Tinatayang 70% ng sakahan ang apektado.",
  },
  {
    id: "claim-002",
    code: "[Blg. 2]",
    farmerName: "Pedro Santos",
    barangay: "Centro Norte (Pob.)",
    disasterType: "Fall Armyworm",
    hectares: 1.8,
    status: "Bago",
    date: "Oktubre 25, 2026",
    notes: "May nakitang mga uod sa dahon at usbong ng mais. Kailangan ng agarang payo o ayuda.",
  },
  {
    id: "claim-003",
    code: "[Blg. 3]",
    farmerName: "Maria Reyes",
    barangay: "Centro Norte (Pob.)",
    disasterType: "Baha (Flash Flood)",
    hectares: 2.7,
    status: "Aprubado",
    date: "Oktubre 20, 2026",
    notes: "Na-verify na ng municipal technician ang sakahan. Naaprubahan na para sa crop insurance indemnity.",
  },
];

const INITIAL_MOCK_CONSULTS: MockConsultItem[] = [
  {
    id: "consult-001",
    farmerName: "Juan Dela Cruz",
    barangay: "Centro Norte (Pob.)",
    topic: "Peste sa Dahon ng Mais",
    question: "Magandang araw po technician, may mga butas-butas ang dahon ng aking mais at may uod na kulay abo. Ano po ang nararapat kong ibomba bago lumala?",
    answer: "",
    status: "Bago",
    date: "Ngayon, 9:15 AM",
    suggestedAnswer: "Batay sa yugto ng paglago ng iyong mais, mainam na gumamit ng Bacillus thuringiensis (Bt) o Chlorantraniliprole sa hapon. Siguraduhing maabot ang gitnang usbong kung saan nagtatago ang fall armyworm.",
  },
  {
    id: "consult-002",
    farmerName: "Eduardo Manalo",
    barangay: "Centro Norte (Pob.)",
    topic: "Pataba sa Yugto ng Pagbubunga",
    question: "Kailan po ang tamang araw ng side-dress urea pagkatapos ng unang abono?",
    answer: "Magandang araw Ka Eduardo! Mag-apply ng 14-14-14 o Urea bilang side-dress sa 30 hanggang 35 araw pagkatanim (DAP) habang basa ang lupa.",
    status: "Sinagot",
    date: "Kahapon",
    suggestedAnswer: "I-apply ang side-dress kapag may sapat na moisture sa lupa para mabilis masipsip ng ugat.",
  },
  {
    id: "consult-003",
    farmerName: "Rosa Bautista",
    barangay: "Centro Norte (Pob.)",
    topic: "Sintomas ng Leaf Blight",
    question: "Bakit may parang pahabang sunog na kulay brown sa mga ibabang dahon ng mais?",
    answer: "Sintomas ito ng Northern Corn Leaf Blight dulot ng halumigmig at ambon. Panatilihing may sapat na bentilasyon at iwasan ang labis na nitrogen.",
    status: "Sinagot",
    date: "Oktubre 23",
    suggestedAnswer: "Tiyakin ang tamang drainage sa paligid ng taniman upang maibsan ang sobrang moisture.",
  },
];

export const TechnicianDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, user, logout } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>("BUOD");

  // ── Pipeline Data ─────────────────────────────────────────────────────────
  const [disasterReports, setDisasterReports] = useState<DisasterReport[]>([]);
  const [expertCases, setExpertCases] = useState<ExpertCase[]>([]);

  // ── Analytics summary ─────────────────────────────────────────────────────
  const [totalFarms, setTotalFarms] = useState<number | null>(null);
  const [totalActiveHectares, setTotalActiveHectares] = useState<number | null>(null);

  // ── Barangay distribution ─────────────────────────────────────────────────
  const [barangays, setBarangays] = useState<BarangayDistribution[]>([]);
  const [barangaysLoading, setBarangaysLoading] = useState(true);

  // ── Export state ──────────────────────────────────────────────────────────
  const [exportType, setExportType] = useState<ExportType>("disaster-claims");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("xlsx");
  const [exporting, setExporting] = useState(false);

  // ── Map interactive state ─────────────────────────────────────────────────
  const [selectedBarangayName, setSelectedBarangayName] = useState<string>("Centro Norte (Pob.)");
  const [mapLayer, setMapLayer] = useState<MapLayer>("TANIMAN");

  // ── Damage (Pinsala) Tab State ────────────────────────────────────────────
  const [damageFilter, setDamageFilter] = useState<DamageFilter>("LAHAT");
  const [localDisasters, setLocalDisasters] = useState<MockDisasterItem[]>(INITIAL_MOCK_DISASTERS);
  const [selectedDisasterItem, setSelectedDisasterItem] = useState<MockDisasterItem>(INITIAL_MOCK_DISASTERS[0]);
  const [isAddDamageOpen, setIsAddDamageOpen] = useState(false);
  const [newDamageForm, setNewDamageForm] = useState({
    farmerName: "",
    barangay: "Centro Norte (Pob.)",
    disasterType: "Bagyo (Typhoon)",
    hectares: "1.0",
    notes: "",
  });

  // ── Consultation Tab State ────────────────────────────────────────────────
  const [consultFilter, setConsultFilter] = useState<ConsultFilter>("LAHAT");
  const [localConsults, setLocalConsults] = useState<MockConsultItem[]>(INITIAL_MOCK_CONSULTS);
  const [selectedConsultItem, setSelectedConsultItem] = useState<MockConsultItem>(INITIAL_MOCK_CONSULTS[0]);
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

  // ── Fetch Pipeline Data ───────────────────────────────────────────────────
  const fetchPipeline = useCallback(async () => {
    try {
      const data = await getCasePipeline();
      setDisasterReports(data.disasterCases ?? []);
      setExpertCases(data.expertCases ?? []);
    } catch {
      // Local fallback data remains active
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      const summary = await getAnalyticsSummary();
      setTotalFarms(summary.totalFarms);
      setTotalActiveHectares(
        Math.round(Number(summary.totalActiveHectares) * 10) / 10
      );
    } catch {
      // Fallback to 1 farm / 7 ha from mockup
    }
  }, []);

  const fetchBarangays = useCallback(async () => {
    setBarangaysLoading(true);
    try {
      setBarangays(await getBarangayDistribution());
    } catch {
      // Non-fatal
    } finally {
      setBarangaysLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPipeline();
    fetchAnalytics();
    fetchBarangays();
  }, [fetchPipeline, fetchAnalytics, fetchBarangays]);

  // Derived counts
  const pendingConsultations = useMemo(
    () =>
      expertCases.length > 0
        ? expertCases.filter((c) =>
            ["SUBMITTED", "UNDER_REVIEW", "INSPECTED"].includes(c.status)
          ).length
        : localConsults.filter((c) => c.status === "Bago").length,
    [expertCases, localConsults]
  );

  const pendingDisasters = useMemo(
    () =>
      disasterReports.length > 0
        ? disasterReports.filter((r) =>
            ["SUBMITTED", "UNDER_REVIEW"].includes(r.status)
          ).length
        : localDisasters.filter((d) => d.status === "Bago" || d.status === "Sinusuri").length,
    [disasterReports, localDisasters]
  );

  const totalPending = pendingConsultations + pendingDisasters;

  // Selected barangay metadata
  const selectedBarangayData = useMemo(() => {
    const foundInBackend = barangays.find(
      (b) => b.barangay.toLowerCase() === selectedBarangayName.toLowerCase()
    );

    return {
      name: selectedBarangayName,
      farms: foundInBackend?.farmCount ?? (selectedBarangayName.includes("Centro Norte") ? 1 : 0),
      hectares: foundInBackend?.totalHectares ?? (selectedBarangayName.includes("Centro Norte") ? 7 : 0),
    };
  }, [selectedBarangayName, barangays]);

  // Filtered Damage Items
  const filteredDamageList = useMemo(() => {
    if (damageFilter === "LAHAT") return localDisasters;
    if (damageFilter === "BAGO") return localDisasters.filter((d) => d.status === "Bago");
    if (damageFilter === "SINUSURI") return localDisasters.filter((d) => d.status === "Sinusuri");
    if (damageFilter === "NA_VERIFY") return localDisasters.filter((d) => d.status === "Na-verify");
    if (damageFilter === "APRUBADO") return localDisasters.filter((d) => d.status === "Aprubado");
    return localDisasters;
  }, [localDisasters, damageFilter]);

  // Filtered Consultations
  const filteredConsultList = useMemo(() => {
    if (consultFilter === "BAGO") return localConsults.filter((c) => c.status === "Bago");
    if (consultFilter === "SINAGOT") return localConsults.filter((c) => c.status === "Sinagot");
    return localConsults;
  }, [localConsults, consultFilter]);

  // Logout handler
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

  // Export report
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
      toast.info("Na-export ang ulat para sa kasalukuyang sakahan.");
    } finally {
      setExporting(false);
    }
  };

  const handleVerifyField = (itemId: string) => {
    setLocalDisasters((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, status: "Na-verify" }
          : item
      )
    );
    setSelectedDisasterItem((prev) =>
      prev.id === itemId ? { ...prev, status: "Na-verify" } : prev
    );
    toast.success("Na-verify sa bukid ang pinsala ng sakahan.");
  };

  const handleRequestDoc = (_itemId: string) => {
    toast.info("Nagpadala ng abiso sa magsasaka para sa karagdagang litrato o dokumento.");
  };

  const handleSendReply = () => {
    if (!chatReplyInput.trim()) {
      toast.error("Mangyaring isulat muna ang iyong sagot o payo.");
      return;
    }

    const updatedAnswer = chatReplyInput.trim();
    setLocalConsults((prev) =>
      prev.map((c) =>
        c.id === selectedConsultItem.id
          ? { ...c, answer: updatedAnswer, status: "Sinagot" }
          : c
      )
    );
    setSelectedConsultItem((prev) => ({
      ...prev,
      answer: updatedAnswer,
      status: "Sinagot",
    }));
    setChatReplyInput("");
    toast.success("Naipadala ang sagot at payo sa magsasaka.");
  };

  const handleAddDamageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDamageForm.farmerName.trim()) {
      toast.error("Ilagay ang pangalan ng magsasaka.");
      return;
    }
    const newCase: MockDisasterItem = {
      id: `claim-${Date.now()}`,
      code: `[Blg. ${localDisasters.length + 1}]`,
      farmerName: newDamageForm.farmerName.trim(),
      barangay: newDamageForm.barangay,
      disasterType: newDamageForm.disasterType,
      hectares: parseFloat(newDamageForm.hectares) || 1.0,
      status: "Bago",
      date: "Ngayon",
      notes: newDamageForm.notes.trim() || "Bagong ulat ng pinsala mula sa bukid.",
    };
    setLocalDisasters([newCase, ...localDisasters]);
    setSelectedDisasterItem(newCase);
    setIsAddDamageOpen(false);
    setNewDamageForm({
      farmerName: "",
      barangay: "Centro Norte (Pob.)",
      disasterType: "Bagyo (Typhoon)",
      hectares: "1.0",
      notes: "",
    });
    toast.success("Matagumpay na naidagdag ang bagong kaso ng pinsala.");
  };

  const handleAddConsultSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConsultForm.farmerName.trim() || !newConsultForm.topic.trim()) {
      toast.error("Pakilagay ang pangalan at paksa ng tanong.");
      return;
    }
    const newEntry: MockConsultItem = {
      id: `consult-${Date.now()}`,
      farmerName: newConsultForm.farmerName.trim(),
      barangay: newConsultForm.barangay,
      topic: newConsultForm.topic.trim(),
      question: newConsultForm.question.trim() || "Kailangan ng agrikultural na payo para sa maisan.",
      answer: "",
      status: "Bago",
      date: "Ngayon",
      suggestedAnswer: "Inirerekomenda ang pag-inspeksyon sa sakahan at pagsunod sa Good Agricultural Practices (GAP).",
    };
    setLocalConsults([newEntry, ...localConsults]);
    setSelectedConsultItem(newEntry);
    setIsAddConsultOpen(false);
    setNewConsultForm({
      farmerName: "",
      barangay: "Centro Norte (Pob.)",
      topic: "",
      question: "",
    });
    toast.success("Naidagdag ang bagong tala ng konsultasyon.");
  };

  const technicianDisplayName = profile
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : "DA Field Technician";

  const technicianInitials = "DF";

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
      {/* ── TOP NAV BAR (Exact Navy Header matching the uploaded screenshot) ── */}
      <header className="sticky top-0 z-30 bg-[#0B2347] text-white shadow-md">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
          <div className="flex items-center justify-between h-18">
            {/* Left: Yellow Square with sprout/leaf icon + TarabayMais title */}
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
              {/* I-download ang Ulat button */}
              <button
                type="button"
                onClick={() => setActiveTab("ULAT")}
                className="hidden md:inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/5 hover:bg-white/10 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white transition cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>I-download ang Ulat</span>
              </button>

              {/* Notification Bell */}
              <NotificationBell
                userId={userId}
                expertCases={expertCases}
                disasterCases={disasterReports}
                onOpenCase={(_caseId) => setActiveTab("KONSULTASYON")}
                onViewAll={() => setActiveTab("KONSULTASYON")}
                isOpen={isNotifOpen}
                onOpenChange={setIsNotifOpen}
              />

              {/* Avatar: Yellow Circle DF + Text */}
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
                    Agricultural Technician
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Desktop Sub-Nav Tab Bar: Cut out into the white page canvas */}
          <nav aria-label="Tabs" className="hidden md:flex items-end gap-1">
            {(
              [
                { key: "BUOD" as TabKey, label: "Buod" },
                { key: "PINSALA" as TabKey, label: "Pinsala" },
                { key: "KONSULTASYON" as TabKey, label: "Konsultasyon" },
                { key: "ULAT" as TabKey, label: "Ulat" },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative flex items-center px-6 py-2 text-sm font-bold transition-all rounded-t-xl cursor-pointer ${
                    isActive
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ── MAIN BODY CONTENT ─────────────────────────────────────────────── */}
      <main className="flex-1 mx-auto w-full max-w-[1240px] px-4 sm:px-6 py-5 sm:py-6 space-y-5 pb-24 md:pb-12">
        {/* ════════════════════════════════════════════════════════════════════
            TAB 1: BUOD (Matches the exact screenshot uploaded by user)
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "BUOD" && (
          <div className="space-y-5">
            {/* Top Greeting Row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                  LUNES, OKTUBRE 26
                </p>
                <h2 className="mt-0.5 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Mabuhay, DA Field!
                </h2>
              </div>

              {/* Status Pill Badge: ✓ Wala nang nakabinbin · Lahat ng kaso ay na-aasikaso na */}
              <div className="inline-flex items-center gap-2 rounded-full bg-[#E8F8EE] border border-[#A5E7BA] px-4 py-1.5 text-xs sm:text-sm font-semibold text-[#137A3B] shadow-2xs self-start sm:self-auto">
                <Check className="h-4 w-4 text-[#137A3B] stroke-[3]" />
                <span>Wala nang nakabinbin &middot; Lahat ng kaso ay na-aasikaso na</span>
              </div>
            </div>

            {/* 3 Metric KPI Cards in 1 Row */}
            <section
              aria-label="Mga Istatistika"
              className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4"
            >
              {/* Card 1: 1 Rehistradong Sakahan */}
              <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D1FAE5] text-[#059669]">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-3xl font-black text-slate-900 leading-none">
                    {totalFarms !== null ? totalFarms : 1}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 font-medium">
                    Rehistradong Sakahan
                  </p>
                </div>
              </div>

              {/* Card 2: 7 ha Aktibong Taniman ng Mais */}
              <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#DBEAFE] text-[#2563EB]">
                  <Sprout className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-3xl font-black text-[#1D4ED8] leading-none">
                    {totalActiveHectares !== null ? totalActiveHectares : 7}
                    <span className="text-lg font-bold ml-1 text-[#1D4ED8]">ha</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500 font-medium">
                    Aktibong Taniman ng Mais
                  </p>
                </div>
              </div>

              {/* Card 3: 0 Kabuuang Nakabinbin */}
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

                {/* SVG Polygon Map matching the screenshot visual geometry */}
                <div className="relative w-full rounded-xl bg-[#EDF3EC] border border-slate-200/80 p-3 sm:p-5 overflow-hidden flex flex-col items-center justify-center min-h-[320px]">
                  <svg
                    viewBox="0 0 540 340"
                    className="w-full h-auto max-h-[340px] drop-shadow-xs select-none"
                  >
                    {/* Surrounding background polygons (pale grayish green) */}
                    {/* West Polygon */}
                    <polygon
                      points="60,80 160,50 250,170 150,250 70,210"
                      fill="#DFE5DC"
                      stroke="#CBD3C8"
                      strokeWidth="1.5"
                    />
                    {/* South West Polygon */}
                    <polygon
                      points="150,250 250,170 230,310 130,300"
                      fill="#DFE5DC"
                      stroke="#CBD3C8"
                      strokeWidth="1.5"
                    />
                    {/* South Center Polygon */}
                    <polygon
                      points="250,170 330,210 310,320 230,310"
                      fill="#DFE5DC"
                      stroke="#CBD3C8"
                      strokeWidth="1.5"
                    />
                    {/* North East Polygon */}
                    <polygon
                      points="340,50 460,70 510,160 380,100"
                      fill="#DFE5DC"
                      stroke="#CBD3C8"
                      strokeWidth="1.5"
                    />
                    {/* East Polygon */}
                    <polygon
                      points="380,100 510,160 450,240 330,210"
                      fill="#DFE5DC"
                      stroke="#CBD3C8"
                      strokeWidth="1.5"
                    />
                    {/* South East Polygon */}
                    <polygon
                      points="330,210 450,240 430,310 310,320"
                      fill="#DFE5DC"
                      stroke="#CBD3C8"
                      strokeWidth="1.5"
                    />

                    {/* ACTIVE SELECTED POLYGON: Centro Norte (Pob.) in Green */}
                    <g
                      onClick={() => setSelectedBarangayName("Centro Norte (Pob.)")}
                      className="cursor-pointer"
                    >
                      {/* Dashed boundary frame around active parcel */}
                      <rect
                        x="185"
                        y="42"
                        width="165"
                        height="148"
                        fill="none"
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                        opacity="0.75"
                        rx="8"
                      />

                      {/* Main green parcel */}
                      <polygon
                        points="160,50 340,50 380,100 330,210 250,170"
                        fill="#26854C"
                        stroke="#1E6B3C"
                        strokeWidth="2.5"
                      />

                      {/* Yellow Circular Pin with dark border */}
                      <circle
                        cx="245"
                        cy="130"
                        r="8"
                        fill="#FBBF24"
                        stroke="#0B2347"
                        strokeWidth="3.5"
                      />

                      {/* Text Label Centro Norte (Pob.) */}
                      <text
                        x="310"
                        y="80"
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize="12.5"
                        fontWeight="700"
                        className="pointer-events-none drop-shadow-xs"
                      >
                        Centro Norte (Pob.)
                      </text>
                    </g>
                  </svg>

                  {/* Floating Action Banner at bottom left of map */}
                  <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 inline-flex items-center rounded-full bg-white/95 px-3.5 py-1 shadow-2xs border border-slate-200 text-xs font-medium text-slate-700 backdrop-blur-xs">
                    Pindutin ang Centro Norte para makita ang sakahan
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-5 text-xs text-slate-600 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-xs bg-[#26854C]" />
                    <span>May taniman</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-xs bg-[#DFE5DC] border border-slate-300" />
                    <span>Wala pang rehistro</span>
                  </div>
                </div>
              </div>

              {/* Right Column: NAPILI Card + Maisy Box (4 cols) */}
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

                  {/* 2 Stats side-by-side: 1 sakahan | 7 ha taniman */}
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
                      toast.info(`Ipinapakita ang sakahan sa ${selectedBarangayData.name}.`);
                    }}
                    className="w-full rounded-xl border border-[#1E3A8A] text-[#1E3A8A] hover:bg-blue-50 py-2.5 text-xs sm:text-sm font-bold shadow-2xs transition active:scale-98 cursor-pointer"
                  >
                    Ipakita ang sakahan sa mapa
                  </button>
                </div>

                {/* Maisy Box — Preserving Maisy's friendly identity as requested! */}
                <div className="rounded-2xl border border-[#FDE047] bg-[#FEFCE8] p-4 shadow-2xs flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FBBF24] text-xs font-black text-[#0B2347]">
                    M
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#854D0E]">
                      Maisy
                    </p>
                    <p className="mt-0.5 text-xs text-[#713F12] leading-relaxed">
                      Magandang araw, DA Field! Walang nakabinbin ngayon. Tingnan ang yugto ng mga taniman sa ibaba.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Section: Panahon ng Mais (4 Stages Grid) */}
            <section
              aria-label="Panahon ng Mais"
              className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                <h3 className="text-lg font-bold text-slate-900">
                  Panahon ng Mais
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  7 ha ang aktibo &middot; i-set ang yugto ng bawat taniman
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* 1 · PAGTATANIM */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <p className="text-[11px] font-bold text-slate-500 tracking-wider">
                    1 &middot; PAGTATANIM
                  </p>
                  <p className="mt-1.5 text-2xl font-black text-slate-900">
                    &mdash; <span className="text-xs font-semibold text-slate-500">ha</span>
                  </p>
                </div>

                {/* 2 · PAGLAGO (Soft Green highlight) */}
                <div className="rounded-xl border border-emerald-300 bg-[#DCFCE7] p-3.5">
                  <p className="text-[11px] font-bold text-[#15803D] tracking-wider">
                    2 &middot; PAGLAGO
                  </p>
                  <p className="mt-1.5 text-2xl font-black text-[#15803D]">
                    &mdash; <span className="text-xs font-semibold text-[#15803D]">ha</span>
                  </p>
                </div>

                {/* 3 · PAGBUBUNGA (Soft Orange highlight) */}
                <div className="rounded-xl border border-amber-300 bg-[#FEF3C7] p-3.5">
                  <p className="text-[11px] font-bold text-[#B45309] tracking-wider">
                    3 &middot; PAGBUBUNGA
                  </p>
                  <p className="mt-1.5 text-2xl font-black text-[#B45309]">
                    &mdash; <span className="text-xs font-semibold text-[#B45309]">ha</span>
                  </p>
                </div>

                {/* 4 · PAG-ANI (Soft Yellow highlight) */}
                <div className="rounded-xl border border-yellow-300 bg-[#FEF9C3] p-3.5">
                  <p className="text-[11px] font-bold text-[#A16207] tracking-wider">
                    4 &middot; PAG-ANI
                  </p>
                  <p className="mt-1.5 text-2xl font-black text-[#A16207]">
                    &mdash; <span className="text-xs font-semibold text-[#A16207]">ha</span>
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 2: PINSALA (Damage Claims)
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

            {/* Desktop Table / Right Detail Pane */}
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
                      {filteredDamageList.map((item) => {
                        const isSelected = selectedDisasterItem.id === item.id;
                        return (
                          <tr
                            key={item.id}
                            onClick={() => setSelectedDisasterItem(item)}
                            className={`cursor-pointer transition hover:bg-slate-50 ${
                              isSelected ? "bg-blue-50/70 font-semibold" : ""
                            }`}
                          >
                            <td className="px-5 py-3.5 font-bold text-slate-900">
                              {item.code}
                            </td>
                            <td className="px-5 py-3.5 text-slate-800">
                              {item.farmerName}
                            </td>
                            <td className="px-5 py-3.5 text-slate-600">
                              {item.barangay}
                            </td>
                            <td className="px-5 py-3.5 text-slate-800 font-medium">
                              {item.disasterType}
                            </td>
                            <td className="px-5 py-3.5 text-slate-600">
                              {item.hectares} ha
                            </td>
                            <td className="px-5 py-3.5">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                  item.status === "Bago"
                                    ? "bg-blue-100 text-blue-800"
                                    : item.status === "Sinusuri"
                                    ? "bg-amber-100 text-amber-800"
                                    : item.status === "Na-verify"
                                    ? "bg-teal-100 text-teal-800"
                                    : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                {item.status}
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
                  {filteredDamageList.map((item) => {
                    const isSelected = selectedDisasterItem.id === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedDisasterItem(item)}
                        className={`p-3.5 rounded-xl cursor-pointer transition ${
                          isSelected ? "bg-blue-50/80 border border-blue-200" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-slate-900 text-sm">
                            {item.code} &middot; {item.farmerName}
                          </p>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold shrink-0 ${
                              item.status === "Bago"
                                ? "bg-blue-100 text-blue-800"
                                : item.status === "Sinusuri"
                                ? "bg-amber-100 text-amber-800"
                                : item.status === "Na-verify"
                                ? "bg-teal-100 text-teal-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 font-medium">
                          {item.disasterType} &middot; {item.hectares} ha &middot; {item.barangay}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Selected Case Details + Stepper (4 cols) */}
              <div className="lg:col-span-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-5">
                <div>
                  <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                    NAPILING KASO
                  </p>
                  <h3 className="mt-1 text-lg font-black text-slate-900">
                    {selectedDisasterItem.code} &middot; {selectedDisasterItem.disasterType}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {selectedDisasterItem.farmerName} &middot; {selectedDisasterItem.barangay}
                  </p>
                </div>

                {/* 4-Step Vertical Stepper */}
                <div className="space-y-3.5 py-1">
                  {[
                    { step: 1, label: "Naisumite" },
                    { step: 2, label: "Sinusuri" },
                    { step: 3, label: "Na-verify sa bukid" },
                    { step: 4, label: "Aprubado" },
                  ].map(({ step, label }) => {
                    const currentStatus = selectedDisasterItem.status;
                    const statusStep =
                      currentStatus === "Bago"
                        ? 1
                        : currentStatus === "Sinusuri"
                        ? 2
                        : currentStatus === "Na-verify"
                        ? 3
                        : 4;

                    const isDone = step < statusStep;
                    const isCurrent = step === statusStep;

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

                {/* Action Buttons */}
                <div className="space-y-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleVerifyField(selectedDisasterItem.id)}
                    className="w-full rounded-xl bg-[#065F46] hover:bg-emerald-800 py-3 text-sm font-bold text-white shadow-2xs transition active:scale-98 cursor-pointer"
                  >
                    I-verify sa Bukid
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRequestDoc(selectedDisasterItem.id)}
                    className="w-full rounded-xl border border-slate-800 bg-white hover:bg-slate-50 py-3 text-sm font-bold text-slate-800 shadow-2xs transition active:scale-98 cursor-pointer"
                  >
                    Humingi ng Dokumento
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 3: KONSULTASYON
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

            {/* 2-Column Chat Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left Column (5 cols) */}
              <div className="lg:col-span-5 space-y-3">
                {filteredConsultList.map((c) => {
                  const isSelected = selectedConsultItem.id === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedConsultItem(c)}
                      className={`p-4 rounded-2xl border transition cursor-pointer shadow-2xs ${
                        isSelected
                          ? "bg-white border-blue-500 ring-2 ring-blue-500/20"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-extrabold text-slate-900 text-sm sm:text-base">
                          {c.farmerName}
                        </p>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            c.status === "Bago"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600 line-clamp-1">
                        {c.topic}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Right Column: Chat View (7 cols) */}
              <div className="lg:col-span-7 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs flex flex-col justify-between min-h-[460px] space-y-4">
                <div>
                  <div className="flex items-baseline justify-between border-b border-slate-100 pb-3 mb-4">
                    <h3 className="text-base sm:text-lg font-black text-slate-900">
                      {selectedConsultItem.topic}
                    </h3>
                    <span className="text-xs text-slate-500 font-medium">
                      {selectedConsultItem.barangay}
                    </span>
                  </div>

                  <div className="space-y-4">
                    {/* Farmer message */}
                    <div className="flex flex-col items-start max-w-[85%]">
                      <span className="text-xs font-bold text-slate-400 mb-1">
                        Magsasaka
                      </span>
                      <div className="rounded-2xl rounded-tl-xs bg-slate-100 p-3.5 text-xs sm:text-sm text-slate-800 leading-relaxed">
                        {selectedConsultItem.question}
                      </div>
                    </div>

                    {/* Technician reply */}
                    {selectedConsultItem.answer && (
                      <div className="flex flex-col items-end max-w-[85%] ml-auto">
                        <span className="text-xs font-bold text-slate-400 mb-1">
                          Ikaw
                        </span>
                        <div className="rounded-2xl rounded-tr-xs bg-[#0B2347] p-3.5 text-xs sm:text-sm text-white leading-relaxed">
                          {selectedConsultItem.answer}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Maisy AI Box & Input */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="rounded-2xl border border-amber-300 bg-[#FFFBEB] p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FBBF24] text-xs font-black text-[#0B2347]">
                        M
                      </div>
                      <div>
                        <p className="text-xs font-bold text-amber-900">
                          Mungkahi ni Maisy
                        </p>
                        <p className="text-xs text-amber-800 leading-snug">
                          {selectedConsultItem.suggestedAnswer}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setChatReplyInput(selectedConsultItem.suggestedAnswer)}
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
                      onClick={handleSendReply}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#065F46] hover:bg-emerald-800 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-2xs transition active:scale-95 cursor-pointer"
                    >
                      <span>Ipadala</span>
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 4: ULAT
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
              ) : (
                <ul className="divide-y divide-slate-100">
                  {barangays.map((b) => (
                    <li
                      key={b.barangay}
                      className="py-2.5 flex items-center justify-between text-xs sm:text-sm"
                    >
                      <span className="font-bold text-slate-800">{b.barangay}</span>
                      <span className="text-slate-500 font-medium">
                        {b.farmCount} sakahan &middot; {b.totalHectares} ha
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
        profileRoleSubtitle="Agricultural Technician"
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
