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
import {
  clearReadNotifications,
} from "../../lib/notificationReadTracking";

// ─── Tab Keys ─────────────────────────────────────────────────────────────────
export type TabKey = "BUOD" | "PINSALA" | "KONSULTASYON" | "ULAT";

// ─── Damage Filter Groups (Matching PDF Page 2 & 5) ───────────────────────────
type DamageFilter = "LAHAT" | "BAGO" | "SINUSURI" | "NA_VERIFY" | "APRUBADO";

// ─── Consultation Filter Groups (Matching PDF Page 3 & 6) ─────────────────────
type ConsultFilter = "BAGO" | "SINAGOT" | "LAHAT";

// ─── Map Layer Filter ─────────────────────────────────────────────────────────
type MapLayer = "TANIMAN" | "PINSALA" | "KONSULTASYON";

function formatHa(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

// ─── Cagayan/Solana Sample Data Fallbacks ──────────────────────────────────────
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
    code: "Blg. 1",
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
    code: "Blg. 2",
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
    code: "Blg. 3",
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
    suggestedAnswer: "Batay sa yugto ng paglago ng iyong mais, mainam na gumamit ng Bacillus thuringiensis (Bt) o Chlorantraniliprole sa hapon. Siguraduhing maabot ang gitnang usbong (whorl) kung saan nagtatago ang fall armyworm.",
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

// Solana barangay polygons for the interactive SVG map
interface BarangayPolygon {
  name: string;
  d: string;
  hasFarms: boolean;
  farmsCount: number;
  hectares: number;
  center: { x: number; y: number };
}

const SOLANA_BARANGAYS: BarangayPolygon[] = [
  {
    name: "Centro Norte (Pob.)",
    d: "M 130 50 L 210 50 L 250 100 L 220 170 L 140 160 L 110 90 Z",
    hasFarms: true,
    farmsCount: 1,
    hectares: 7.0,
    center: { x: 180, y: 105 },
  },
  {
    name: "Centro Sur (Pob.)",
    d: "M 140 160 L 220 170 L 200 235 L 120 225 L 105 180 Z",
    hasFarms: false,
    farmsCount: 0,
    hectares: 0,
    center: { x: 160, y: 195 },
  },
  {
    name: "Bangag",
    d: "M 40 60 L 110 90 L 140 160 L 105 180 L 30 140 Z",
    hasFarms: false,
    farmsCount: 0,
    hectares: 0,
    center: { x: 80, y: 125 },
  },
  {
    name: "Bauan East",
    d: "M 210 50 L 290 60 L 330 120 L 250 100 Z",
    hasFarms: false,
    farmsCount: 0,
    hectares: 0,
    center: { x: 270, y: 80 },
  },
  {
    name: "Bauan West",
    d: "M 250 100 L 330 120 L 320 200 L 220 170 Z",
    hasFarms: false,
    farmsCount: 0,
    hectares: 0,
    center: { x: 280, y: 150 },
  },
  {
    name: "Dassun",
    d: "M 120 225 L 200 235 L 180 290 L 90 280 Z",
    hasFarms: false,
    farmsCount: 0,
    hectares: 0,
    center: { x: 145, y: 260 },
  },
  {
    name: "Iraga",
    d: "M 200 235 L 320 200 L 290 285 L 180 290 Z",
    hasFarms: false,
    farmsCount: 0,
    hectares: 0,
    center: { x: 250, y: 250 },
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
      // Non-fatal, local fallback data remains available
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
      // Non-fatal, fallback to 1 farm / 7 ha from mockup
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
    const foundInPolygon = SOLANA_BARANGAYS.find(
      (b) => b.name.toLowerCase() === selectedBarangayName.toLowerCase()
    );
    const foundInBackend = barangays.find(
      (b) => b.barangay.toLowerCase() === selectedBarangayName.toLowerCase()
    );

    return {
      name: selectedBarangayName,
      farms: foundInBackend?.farmCount ?? foundInPolygon?.farmsCount ?? (selectedBarangayName.includes("Centro Norte") ? 1 : 0),
      hectares: foundInBackend?.totalHectares ?? foundInPolygon?.hectares ?? (selectedBarangayName.includes("Centro Norte") ? 7.0 : 0),
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

  // Update Damage Case Status
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

  // Send Consultation Reply
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

  // Add Damage Case
  const handleAddDamageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDamageForm.farmerName.trim()) {
      toast.error("Ilagay ang pangalan ng magsasaka.");
      return;
    }
    const newCase: MockDisasterItem = {
      id: `claim-${Date.now()}`,
      code: `Blg. ${localDisasters.length + 1}`,
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

  // Add Consultation
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
      return "LUNES, OKTUBRE 26";
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
      {/* ── TOP HEADER (Dark Navy matching PDF Page 1) ─────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#0B2545] text-white shadow-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 pt-1">
            {/* Left: Yellow Brand Icon + TarabayMais title + subtext */}
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-[#FBBF24] shadow-sm">
                <Sprout className="h-6 w-6 text-[#0B2545]" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    TarabayMais
                  </h1>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 font-medium tracking-wide">
                  DA Region II &middot; Cagayan Valley
                </p>
              </div>
            </div>

            {/* Right: I-download ang Ulat + Bell + Avatar */}
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Desktop Download Button */}
              <button
                type="button"
                onClick={() => setActiveTab("ULAT")}
                className="hidden md:inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 px-4 py-2 text-sm font-semibold text-white transition active:scale-95 cursor-pointer"
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

              {/* Profile Avatar Pill */}
              <button
                ref={profileTriggerRef}
                type="button"
                onClick={() => {
                  activeTriggerRef.current = profileTriggerRef.current;
                  setIsAccountOpen(true);
                }}
                className="flex items-center gap-2.5 p-1 rounded-full hover:bg-white/10 transition cursor-pointer"
              >
                <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-[#FBBF24] text-base font-extrabold text-[#0B2545] shadow-sm">
                  {technicianInitials}
                </div>
                <div className="hidden lg:block text-left pr-2">
                  <p className="text-sm font-bold text-white leading-tight">
                    {technicianDisplayName}
                  </p>
                  <p className="text-xs text-slate-300">
                    Agricultural Technician
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Desktop Sub-Nav Tabs: Connected directly into the page canvas */}
          <nav aria-label="Tabs" className="hidden md:flex items-end gap-1 pt-2">
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
                  className={`relative flex items-center gap-2 px-6 py-2.5 text-sm md:text-base font-bold transition-all rounded-t-xl cursor-pointer ${
                    isActive
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-200 hover:text-white hover:bg-white/10"
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

      {/* ── MAIN CONTENT CONTAINER ────────────────────────────────────────── */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-28 md:pb-12">
        {/* ════════════════════════════════════════════════════════════════════
            TAB 1: BUOD (Summary) - Matches PDF Page 1 & Page 4
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "BUOD" && (
          <div className="space-y-6">
            {/* Top Greeting Row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-widest text-slate-500 uppercase">
                  {formattedDate}
                </p>
                <h2 className="mt-1 text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
                  Mabuhay, DA Field!
                </h2>
              </div>

              {/* Status Pill matching mockup: "✓ Wala nang nakabinbin · Lahat ng kaso ay na-aasikaso na" */}
              {totalPending === 0 ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-[#ECFDF5] border border-emerald-300 px-4 py-2 text-xs sm:text-sm font-semibold text-[#065F46] shadow-xs self-start sm:self-auto">
                  <Check className="h-4 w-4 text-emerald-600 stroke-[3]" />
                  <span>Wala nang nakabinbin &middot; Lahat ng kaso ay na-aasikaso na</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full bg-[#FFFBEB] border border-amber-300 px-4 py-2 text-xs sm:text-sm font-semibold text-[#92400E] shadow-xs self-start sm:self-auto">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <span>
                    May {totalPending} nakabinbin &middot; Nangangailangan ng aksyon
                  </span>
                </div>
              )}
            </div>

            {/* 3 KPI Metric Cards in 1 Row */}
            <section
              aria-label="Buod ng Sakahan at Kaso"
              className="grid grid-cols-3 gap-3 sm:gap-5"
            >
              {/* Card 1: Rehistradong Sakahan */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
                <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <MapPin className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div className="mt-4">
                  <p className="text-2xl sm:text-4xl font-black text-emerald-700 leading-none">
                    {totalFarms !== null ? totalFarms : 1}
                  </p>
                  <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600">
                    Rehistradong Sakahan
                  </p>
                </div>
              </div>

              {/* Card 2: Aktibong Taniman ng Mais */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
                <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <Sprout className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div className="mt-4">
                  <p className="text-2xl sm:text-4xl font-black text-blue-700 leading-none">
                    {totalActiveHectares !== null ? formatHa(totalActiveHectares) : "7"}
                    <span className="text-base sm:text-xl font-bold ml-1">ha</span>
                  </p>
                  <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600">
                    Aktibong Taniman ng Mais
                  </p>
                </div>
              </div>

              {/* Card 3: Kabuuang Nakabinbin */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
                <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                  <Clock className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div className="mt-4">
                  <p className="text-2xl sm:text-4xl font-black text-amber-700 leading-none">
                    {totalPending}
                  </p>
                  <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600">
                    Kabuuang Nakabinbin
                  </p>
                </div>
              </div>
            </section>

            {/* Middle Section: 2 Columns (Map on Left, Info + Maisy on Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Mapa ng mga Barangay (7 cols) */}
              <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                    Mapa ng mga Barangay
                  </h3>

                  {/* Segmented control: Taniman | Pinsala | Konsultasyon */}
                  <div className="inline-flex rounded-xl bg-slate-100 p-1 self-start sm:self-auto">
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
                          className={`px-3 py-1.5 text-xs sm:text-sm font-bold rounded-lg transition cursor-pointer ${
                            isActive
                              ? "bg-[#0B2545] text-white shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* SVG Polygon Map of Solana Barangays */}
                <div className="relative w-full rounded-xl bg-[#F4F1EA] border border-stone-200 p-4 sm:p-6 overflow-hidden flex flex-col items-center justify-center min-h-[300px]">
                  <svg
                    viewBox="0 0 360 320"
                    className="w-full h-auto max-h-[340px] drop-shadow-sm"
                  >
                    {/* Render barangay polygons */}
                    {SOLANA_BARANGAYS.map((b) => {
                      const isSelected =
                        b.name.toLowerCase() === selectedBarangayName.toLowerCase();
                      const isCentroNorte = b.name.includes("Centro Norte");

                      return (
                        <g
                          key={b.name}
                          onClick={() => setSelectedBarangayName(b.name)}
                          className="cursor-pointer transition hover:opacity-90 group"
                        >
                          <path
                            d={b.d}
                            fill={
                              isSelected
                                ? "#059669" // Vibrant emerald green for selected
                                : isCentroNorte
                                ? "#10B981"
                                : "#EAE6DF" // Light stone/tan for unselected
                            }
                            stroke={isSelected ? "#047857" : "#CBD5E1"}
                            strokeWidth={isSelected ? "2.5" : "1.5"}
                            strokeLinejoin="round"
                            className="transition-colors duration-200"
                          />

                          {/* Marker on Centro Norte */}
                          {isCentroNorte && (
                            <circle
                              cx={b.center.x}
                              cy={b.center.y}
                              r={8}
                              fill="#FBBF24"
                              stroke="#0B2545"
                              strokeWidth={3}
                            />
                          )}

                          {/* Barangay Label */}
                          <text
                            x={b.center.x}
                            y={isCentroNorte ? b.center.y - 14 : b.center.y}
                            textAnchor="middle"
                            fill={isSelected ? "#FFFFFF" : "#64748B"}
                            fontSize={isSelected ? "11" : "10"}
                            fontWeight={isSelected ? "800" : "600"}
                            className="pointer-events-none select-none"
                          >
                            {b.name}
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  {/* Floating Action Banner at bottom of map */}
                  <div className="mt-3 inline-flex items-center rounded-full bg-white/95 px-4 py-1.5 shadow-sm border border-stone-200 text-xs sm:text-sm font-medium text-slate-800 backdrop-blur-xs">
                    Pindutin ang {selectedBarangayName} para makita ang sakahan
                  </div>
                </div>

                {/* Legend below map */}
                <div className="mt-4 flex items-center gap-6 text-xs sm:text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-[#059669]" />
                    <span>May taniman</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-md bg-[#EAE6DF] border border-stone-300" />
                    <span>Wala pang rehistro</span>
                  </div>
                </div>
              </div>

              {/* Right Column: NAPILI Card + Maisy Assistant (4 cols) */}
              <div className="lg:col-span-4 space-y-5">
                {/* NAPILI Card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                  <div>
                    <p className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                      NAPILI
                    </p>
                    <h4 className="mt-0.5 text-xl font-extrabold text-slate-900">
                      {selectedBarangayData.name}
                    </h4>
                  </div>

                  {/* 2 Stats side-by-side: 1 sakahan | 7 ha taniman */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                      <p className="text-2xl font-black text-slate-900 leading-tight">
                        {selectedBarangayData.farms}
                      </p>
                      <p className="text-xs font-medium text-slate-500">sakahan</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                      <p className="text-2xl font-black text-blue-700 leading-tight">
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
                    className="w-full rounded-xl border border-slate-300 bg-white hover:bg-slate-50 py-3 text-sm font-bold text-slate-800 shadow-xs transition active:scale-98 cursor-pointer"
                  >
                    Ipakita ang sakahan sa mapa
                  </button>
                </div>

                {/* Maisy Assistant Card — Keeping Maisy's real mascot design as requested! */}
                <div className="flex w-full items-center gap-3.5 rounded-2xl bg-[#DBEAFE] p-4.5 shadow-xs border border-blue-200/60">
                  <img
                    src="/assets/mascot-maisy.png"
                    alt="Maisy, ang iyong DA farming assistant"
                    className="h-20 sm:h-22 w-auto shrink-0 object-contain drop-shadow-sm"
                    style={{ imageRendering: "pixelated" }}
                  />
                  <div className="relative min-w-0 flex-1 rounded-2xl bg-white p-3.5 text-slate-900 shadow-xs">
                    {/* Speech bubble tail */}
                    <span
                      aria-hidden="true"
                      className="absolute -left-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-45 bg-white"
                    />
                    <div className="relative">
                      <p className="text-sm font-extrabold leading-tight text-[#1D4ED8]">
                        Maisy
                      </p>
                      <p className="mt-1 text-xs sm:text-sm font-medium leading-relaxed text-slate-800">
                        {totalPending === 0
                          ? "Magandang araw, DA Field! Walang nakabinbin ngayon. Tingnan ang yugto ng mga taniman sa ibaba."
                          : `Magandang araw, DA Field! May ${totalPending} kasong nangangailangan ng iyong aksyon ngayon.`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Section: Panahon ng Mais (4 Stages Grid) */}
            <section
              aria-label="Panahon ng Mais"
              className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                <h3 className="text-xl font-bold text-slate-900">
                  Panahon ng Mais
                </h3>
                <p className="text-sm text-slate-500 font-medium">
                  7 ha ang aktibo &middot; i-set ang yugto ng bawat taniman
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* 1 · PAGTATANIM */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-500 tracking-wider">
                    1 &middot; PAGTATANIM
                  </p>
                  <p className="mt-2 text-2xl font-black text-slate-800">
                    &mdash; <span className="text-sm font-semibold text-slate-500">ha</span>
                  </p>
                </div>

                {/* 2 · PAGLAGO (Soft Green highlight matching mockup) */}
                <div className="rounded-xl border border-emerald-300 bg-[#ECFDF5] p-4">
                  <p className="text-xs font-bold text-emerald-800 tracking-wider">
                    2 &middot; PAGLAGO
                  </p>
                  <p className="mt-2 text-2xl font-black text-emerald-900">
                    &mdash; <span className="text-sm font-semibold text-emerald-700">ha</span>
                  </p>
                </div>

                {/* 3 · PAGBUBUNGA (Soft Orange highlight matching mockup) */}
                <div className="rounded-xl border border-amber-300 bg-[#FFFBEB] p-4">
                  <p className="text-xs font-bold text-amber-800 tracking-wider">
                    3 &middot; PAGBUBUNGA
                  </p>
                  <p className="mt-2 text-2xl font-black text-amber-900">
                    &mdash; <span className="text-sm font-semibold text-amber-700">ha</span>
                  </p>
                </div>

                {/* 4 · PAG-ANI (Soft Yellow highlight matching mockup) */}
                <div className="rounded-xl border border-yellow-300 bg-[#FEFCE8] p-4">
                  <p className="text-xs font-bold text-yellow-800 tracking-wider">
                    4 &middot; PAG-ANI
                  </p>
                  <p className="mt-2 text-2xl font-black text-yellow-900">
                    &mdash; <span className="text-sm font-semibold text-yellow-700">ha</span>
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 2: PINSALA (Damage Claims) - Matches PDF Page 2 & Page 5
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "PINSALA" && (
          <div className="space-y-5">
            {/* Header + Action Button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Mga Kaso ng Pinsala
              </h2>
              <button
                type="button"
                onClick={() => setIsAddDamageOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#065F46] hover:bg-emerald-800 px-5 py-2.5 text-sm sm:text-base font-bold text-white shadow-xs transition active:scale-95 cursor-pointer self-start sm:self-auto"
              >
                <Plus className="h-5 w-5" />
                <span>Magdagdag ng Kaso</span>
              </button>
            </div>

            {/* Filter Pills matching PDF: [Lahat] [Bago] [Sinusuri] [Na-verify] [Aprubado] */}
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
                    className={`rounded-full px-5 py-2 text-sm font-bold transition shrink-0 cursor-pointer ${
                      isActive
                        ? "bg-[#0B2545] text-white shadow-xs"
                        : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            {/* Desktop 2-Column Layout / Mobile Stacked Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Table of Cases (7 cols on desktop) */}
              <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-700">
                    <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3.5">Kaso</th>
                        <th className="px-5 py-3.5">Magsasaka</th>
                        <th className="px-5 py-3.5">Barangay</th>
                        <th className="px-5 py-3.5">Pinsala</th>
                        <th className="px-5 py-3.5">HA</th>
                        <th className="px-5 py-3.5">Katayuan</th>
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
                              isSelected ? "bg-blue-50/60 font-semibold" : ""
                            }`}
                          >
                            <td className="px-5 py-4 font-bold text-slate-900">
                              {item.code}
                            </td>
                            <td className="px-5 py-4 text-slate-800">
                              {item.farmerName}
                            </td>
                            <td className="px-5 py-4 text-slate-600">
                              {item.barangay}
                            </td>
                            <td className="px-5 py-4 text-slate-800 font-medium">
                              {item.disasterType}
                            </td>
                            <td className="px-5 py-4 text-slate-600">
                              {item.hectares} ha
                            </td>
                            <td className="px-5 py-4">
                              <span
                                className={`inline-flex rounded-full px-3 py-0.5 text-xs font-bold ${
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
                        className={`p-4 rounded-xl cursor-pointer transition ${
                          isSelected ? "bg-blue-50/80 border border-blue-200" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-slate-900 text-base">
                            {item.code} &middot; {item.farmerName}
                          </p>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold shrink-0 ${
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
              <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
                <div>
                  <p className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                    NAPILING KASO
                  </p>
                  <h3 className="mt-1 text-xl font-extrabold text-slate-900">
                    {selectedDisasterItem.code} &middot; {selectedDisasterItem.disasterType}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                    {selectedDisasterItem.farmerName} &middot; {selectedDisasterItem.barangay}
                  </p>
                </div>

                {/* 4-Step Vertical Stepper matching PDF Page 2 */}
                <div className="space-y-4 py-2">
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
                      <div key={step} className="flex items-center gap-3.5">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition ${
                            isDone
                              ? "bg-emerald-600 text-white"
                              : isCurrent
                              ? "bg-amber-500 text-white"
                              : "border-2 border-slate-300 text-slate-400 bg-white"
                          }`}
                        >
                          {isDone ? <Check className="h-4 w-4 stroke-[3]" /> : step}
                        </div>
                        <span
                          className={`text-sm font-bold ${
                            isCurrent
                              ? "text-slate-900 font-extrabold"
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

                {/* Case Notes / Summary */}
                {selectedDisasterItem.notes && (
                  <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100 text-xs sm:text-sm text-slate-700 leading-relaxed">
                    <p className="font-bold text-slate-900 mb-1">Tala sa Sakahan:</p>
                    {selectedDisasterItem.notes}
                  </div>
                )}

                {/* Action Buttons: I-verify sa Bukid & Humingi ng Dokumento */}
                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleVerifyField(selectedDisasterItem.id)}
                    className="w-full rounded-xl bg-[#065F46] hover:bg-emerald-800 py-3 text-sm sm:text-base font-bold text-white shadow-xs transition active:scale-98 cursor-pointer"
                  >
                    I-verify sa Bukid
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRequestDoc(selectedDisasterItem.id)}
                    className="w-full rounded-xl border border-slate-800 bg-white hover:bg-slate-50 py-3 text-sm sm:text-base font-bold text-slate-800 shadow-xs transition active:scale-98 cursor-pointer"
                  >
                    Humingi ng Dokumento
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 3: KONSULTASYON (Consultations) - Matches PDF Page 3 & Page 6
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "KONSULTASYON" && (
          <div className="space-y-5">
            {/* Header + Action Button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Mga Konsultasyon
              </h2>
              <button
                type="button"
                onClick={() => setIsAddConsultOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#065F46] hover:bg-emerald-800 px-5 py-2.5 text-sm sm:text-base font-bold text-white shadow-xs transition active:scale-95 cursor-pointer self-start sm:self-auto"
              >
                <Plus className="h-5 w-5" />
                <span>Bagong Tala</span>
              </button>
            </div>

            {/* Filter Pills matching PDF: [Bago] [Sinagot] [Lahat] */}
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
                    className={`rounded-full px-5 py-2 text-sm font-bold transition cursor-pointer ${
                      isActive
                        ? "bg-[#0B2545] text-white shadow-xs"
                        : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            {/* Desktop 2-Column Chat Layout / Mobile List & Chat */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Consultation Cards List (5 cols) */}
              <div className="lg:col-span-5 space-y-3">
                {filteredConsultList.map((c) => {
                  const isSelected = selectedConsultItem.id === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedConsultItem(c)}
                      className={`p-4 rounded-2xl border transition cursor-pointer shadow-xs ${
                        isSelected
                          ? "bg-white border-blue-500 ring-2 ring-blue-500/20"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-extrabold text-slate-900 text-base">
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
                      <p className="mt-1 text-sm font-medium text-slate-600 line-clamp-1">
                        {c.topic}
                      </p>
                      <p className="mt-2 text-xs text-slate-400 font-medium">
                        {c.date}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Right Column: Active Conversation Pane (7 cols) */}
              <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between min-h-[460px] space-y-5">
                <div>
                  {/* Chat Header: Topic | Barangay */}
                  <div className="flex items-baseline justify-between border-b border-slate-100 pb-3 mb-4">
                    <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">
                      {selectedConsultItem.topic}
                    </h3>
                    <span className="text-xs sm:text-sm text-slate-500 font-medium">
                      {selectedConsultItem.barangay}
                    </span>
                  </div>

                  {/* Message Bubbles */}
                  <div className="space-y-4">
                    {/* Farmer Inquiry Bubble (Left, gray) */}
                    <div className="flex flex-col items-start max-w-[85%]">
                      <span className="text-xs font-bold text-slate-400 mb-1">
                        {selectedConsultItem.farmerName}
                      </span>
                      <div className="rounded-2xl rounded-tl-xs bg-slate-100 p-4 text-sm sm:text-base text-slate-800 leading-relaxed">
                        {selectedConsultItem.question}
                      </div>
                    </div>

                    {/* Technician Answer Bubble (Right, navy) */}
                    {selectedConsultItem.answer && (
                      <div className="flex flex-col items-end max-w-[85%] ml-auto">
                        <span className="text-xs font-bold text-slate-400 mb-1">
                          Ikaw (Technician)
                        </span>
                        <div className="rounded-2xl rounded-tr-xs bg-[#0B2545] p-4 text-sm sm:text-base text-white leading-relaxed">
                          {selectedConsultItem.answer}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Maisy AI Recommendation Box & Reply Input */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  {/* Mungkahi ni Maisy Card — Preserving real Maisy mascot design as requested! */}
                  <div className="rounded-2xl border border-amber-300 bg-[#FFFBEB] p-4 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <img
                        src="/assets/mascot-maisy.png"
                        alt="Maisy mascot"
                        className="h-10 w-auto shrink-0 object-contain drop-shadow-xs"
                      />
                      <div>
                        <p className="text-xs sm:text-sm font-extrabold text-amber-900">
                          Mungkahi ni Maisy
                        </p>
                        <p className="mt-0.5 text-xs sm:text-sm text-amber-800 leading-snug">
                          {selectedConsultItem.suggestedAnswer}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setChatReplyInput(selectedConsultItem.suggestedAnswer)}
                      className="rounded-xl border border-amber-400 bg-white hover:bg-amber-50 px-4 py-2 text-xs sm:text-sm font-bold text-amber-900 shadow-xs transition active:scale-95 shrink-0 self-start sm:self-auto cursor-pointer"
                    >
                      Gamitin
                    </button>
                  </div>

                  {/* Input Box + Ipadala Button */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={chatReplyInput}
                      onChange={(e) => setChatReplyInput(e.target.value)}
                      placeholder="Isulat ang sagot..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSendReply();
                      }}
                      className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={handleSendReply}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#065F46] hover:bg-emerald-800 px-6 py-3 text-sm sm:text-base font-bold text-white shadow-xs transition active:scale-95 cursor-pointer"
                    >
                      <span>Ipadala</span>
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 4: ULAT (Reports Export)
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "ULAT" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Download Export Panel (6 cols) */}
            <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="h-6 w-6 text-slate-600" />
                <h3 className="text-xl font-bold text-slate-900">
                  I-download ang Ulat
                </h3>
              </div>
              <p className="text-sm text-slate-500">
                Pumili ng uri ng ulat para sa disaster claims o buod ng mga sakahan ng Cagayan Valley.
              </p>

              <div className="space-y-2">
                <label
                  htmlFor="report-type"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Uri ng Ulat
                </label>
                <select
                  id="report-type"
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value as ExportType)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-600"
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
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#065F46] hover:bg-emerald-800 py-3.5 text-sm sm:text-base font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-60 cursor-pointer"
                >
                  {exporting && exportFormat === "xlsx" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Download className="h-5 w-5" />
                  )}
                  Excel (.xlsx)
                </button>

                <button
                  type="button"
                  onClick={() => handleExport("csv")}
                  disabled={exporting}
                  className="flex items-center justify-center gap-2 rounded-xl border-2 border-[#065F46] hover:bg-emerald-50 py-3.5 text-sm sm:text-base font-bold text-[#065F46] shadow-xs transition active:scale-95 disabled:opacity-60 cursor-pointer"
                >
                  {exporting && exportFormat === "csv" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Download className="h-5 w-5" />
                  )}
                  CSV
                </button>
              </div>
            </div>

            {/* Barangay Distribution Summary (6 cols) */}
            <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5">
                <BarChart3 className="h-6 w-6 text-slate-600" />
                <h3 className="text-xl font-bold text-slate-900">
                  Distribusyon ng Sakahan sa Solana
                </h3>
              </div>

              {barangaysLoading ? (
                <LoadingState label="Kinukuha ang tala ng mga barangay..." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {SOLANA_BARANGAYS.map((b) => (
                    <li
                      key={b.name}
                      className="py-3 flex items-center justify-between text-sm"
                    >
                      <span className="font-bold text-slate-800">{b.name}</span>
                      <span className="text-slate-500 font-medium">
                        {b.farmsCount} sakahan &middot; {b.hectares} ha
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
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg"
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
                  isActive ? "text-[#0B2545]" : "text-slate-500"
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 inset-x-4 h-1 rounded-b-full bg-[#0B2545]" />
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
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
                className="h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddDamageSubmit} className="space-y-4">
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
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Barangay
                  </label>
                  <select
                    value={newDamageForm.barangay}
                    onChange={(e) =>
                      setNewDamageForm({ ...newDamageForm, barangay: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  >
                    {SOLANA_BARANGAYS.map((b) => (
                      <option key={b.name} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
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
                    className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  >
                    <option value="Bagyo (Typhoon)">Bagyo (Typhoon)</option>
                    <option value="Baha (Flash Flood)">Baha (Flash Flood)</option>
                    <option value="Fall Armyworm">Fall Armyworm</option>
                    <option value="Tagtuyot (Drought)">Tagtuyot (Drought)</option>
                    <option value="Corn Borer">Corn Borer</option>
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
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
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
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddDamageOpen(false)}
                  className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Kanselahin
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-[#065F46] hover:bg-emerald-800 py-3 text-sm font-bold text-white transition cursor-pointer"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
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
                className="h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddConsultSubmit} className="space-y-4">
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
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Barangay
                </label>
                <select
                  value={newConsultForm.barangay}
                  onChange={(e) =>
                    setNewConsultForm({
                      ...newConsultForm,
                      barangay: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                >
                  {SOLANA_BARANGAYS.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
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
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
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
                  placeholder="Ilagay ang katanungan o obserbasyon ng magsasaka..."
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddConsultOpen(false)}
                  className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Kanselahin
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-[#065F46] hover:bg-emerald-800 py-3 text-sm font-bold text-white transition cursor-pointer"
                >
                  I-tala ang Konsultasyon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ACCOUNT DRAWER / SHEET ─────────────────────────────────────────── */}
      <AccountSheet
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        profileName={technicianDisplayName}
        profileRoleSubtitle="Agricultural Technician"
        profileInitials={technicianInitials}
        menuItems={accountMenuItems}
        triggerRef={activeTriggerRef}
      />

      {/* ── LOGOUT CONFIRMATION MODAL ──────────────────────────────────────── */}
      {confirmLogout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-xl font-bold text-slate-900">
              Sigurado ka bang nais mong mag-logout?
            </h3>
            <p className="text-sm text-slate-500">
              Kakailanganin mong mag-login muli gamit ang iyong municipal account.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmLogout(false)}
                className="rounded-xl border border-slate-300 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Bumalik
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="rounded-xl bg-red-600 hover:bg-red-700 py-3 text-sm font-bold text-white transition disabled:opacity-60 flex items-center justify-center gap-1.5"
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
