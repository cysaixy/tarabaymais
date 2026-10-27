import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  RefreshCw,
  Scan,
  ClipboardCheck,
  Camera,
  Bot,
  UserCheck,
  AlertTriangle,
  ChevronRight,
  Clock,
  X,
  Send,
  Calendar,
  Loader2,
  Tractor,
  LogOut,
  Wifi,
  WifiOff,
  Sprout,
  Leaf,
  Wheat,
  Trophy,
  Droplets,
  Wind,
  MapPin,
  Image,
  Sun,
  CloudRain,
  Cloud,
  RefreshCw as RefreshCwIcon,
  Info,
  Package,
} from "lucide-react";
import { useWeather } from "../../hooks/useWeather";
import { useNotifications } from "../../hooks/useNotifications";
import { NotificationBell } from "../../components/NotificationBell";
import { BottomNav } from "../../components/BottomNav";
import {
  createActivity,
  type ActivityType,
} from "../../services/activity.service";
import {
  createObservation,
  type SeverityLevel,
} from "../../services/observation.service";
import {
  scanPlantHealth,
  sendRagChat,
  type ScanDiagnosisResult,
  type RagChatSource,
} from "../../services/ai.service";
import { createDisasterReport } from "../../services/case.service";
import {
  getOfflineQueue,
  queueOfflineAction,
  syncPendingOfflineActions,
  type SyncActionItem,
} from "../../services/sync.service";
import { useAuth } from "../../context/authContext";
import { useFarmSelection } from "../../context/farmSelectionContext";
import { QUEUE_UPDATED_EVENT } from "../../lib/offlineQueue";
import { FarmCycleSelector } from "../../components/FarmCycleSelector";
import { MaisyGreeting } from "../../components/MaisyGreeting";
import { ApiError } from "../../lib/api";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { useSyncQueue } from "../../hooks/useSyncQueue";

/** True only for genuine connectivity failures (safe to queue offline). */
const isOfflineError = (err: unknown): boolean =>
  (err instanceof ApiError && err.isNetworkError) || !navigator.onLine;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Computes Days After Planting from an ISO / YYYY-MM-DD planting date.
 * Returns null if the date is invalid.
 */
const computeDAP = (plantingDate: string): number | null => {
  const planted = new Date(plantingDate);
  if (isNaN(planted.getTime())) return null;
  const ms = Date.now() - planted.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
};

/**
 * Corn growth stages — each entry drives the visual lifecycle card.
 * harvestDap: total DAP at which the stage is considered complete.
 * icon: Lucide icon component for premium look (replaces emoji).
 */
const GROWTH_STAGES = [
  { tagalogLabel: "Binhi", icon: Sprout, minDap: 0, maxDap: 14, stageIndex: 0 },
  {
    tagalogLabel: "Paglaki",
    icon: Leaf,
    minDap: 15,
    maxDap: 45,
    stageIndex: 1,
  },
  {
    tagalogLabel: "Tasseling",
    icon: Wheat,
    minDap: 46,
    maxDap: 60,
    stageIndex: 2,
  },
  { tagalogLabel: "Butil", icon: Wheat, minDap: 61, maxDap: 90, stageIndex: 3 },
  {
    tagalogLabel: "Pag-ani",
    icon: Trophy,
    minDap: 91,
    maxDap: 110,
    stageIndex: 4,
  },
] as const;

/** Total DAP target for full harvest. */
const HARVEST_TARGET_DAP = 110;

/**
 * Maps a DAP value to a Tagalog growth-stage label, icon component, and 0-4 progress index.
 */
const resolveGrowthStage = (
  dap: number,
): {
  label: string;
  tagalogLabel: string;
  icon: typeof Sprout;
  stageIndex: number;
} => {
  if (dap < 15)
    return {
      label: "Seedling Stage (DAP 0-14)",
      tagalogLabel: "Binhi",
      icon: Sprout,
      stageIndex: 0,
    };
  if (dap < 46)
    return {
      label: "Vegetative Stage (V-Stage)",
      tagalogLabel: "Paglaki",
      icon: Leaf,
      stageIndex: 1,
    };
  if (dap < 61)
    return {
      label: "Tasseling / Silking Stage",
      tagalogLabel: "Tasseling",
      icon: Wheat,
      stageIndex: 2,
    };
  if (dap < 91)
    return {
      label: "Grain Filling Stage",
      tagalogLabel: "Butil",
      icon: Wheat,
      stageIndex: 3,
    };
  return {
    label: "Maturity / Harvest Stage",
    tagalogLabel: "Pag-ani",
    icon: Trophy,
    stageIndex: 4,
  };
};

const WeatherIcon: React.FC<{ name: string; className?: string }> = ({
  name,
  className,
}) => {
  switch (name) {
    case "Sun":
      return <Sun className={className} />;
    case "CloudSun":
      return <CloudRain className={className} />;
    case "Cloud":
      return <Cloud className={className} />;
    case "AlertTriangle":
      return <AlertTriangle className={className} />;
    case "CloudRain":
    default:
      return <CloudRain className={className} />;
  }
};

// ─── DA Advisory Parser & Renderer ────────────────────────────────────────────
interface AdvisoryItem {
  category: string;
  description: string;
  icon: React.ReactNode;
}

const getAdvisoryIcon = (category: string): React.ReactNode => {
  const cat = category.toLowerCase();
  if (cat.includes("maulap") || cat.includes("cloud") || cat.includes("overcast")) {
    return <Cloud className="w-4 h-4" />;
  }
  if (cat.includes("halumigmig") || cat.includes("humidity") || cat.includes("moist")) {
    return <Droplets className="w-4 h-4" />;
  }
  if (cat.includes("vegetative") || cat.includes("stage") || cat.includes("grow") || cat.includes("paglaki") || cat.includes("tanom")) {
    return <Sprout className="w-4 h-4" />;
  }
  if (cat.includes("rain") || cat.includes("ulan") || cat.includes("storm") || cat.includes("bagyo")) {
    return <CloudRain className="w-4 h-4" />;
  }
  if (cat.includes("wind") || cat.includes("hangin")) {
    return <Wind className="w-4 h-4" />;
  }
  if (cat.includes("heat") || cat.includes("init") || cat.includes("sun") || cat.includes("araw")) {
    return <Sun className="w-4 h-4" />;
  }
  if (cat.includes("fertilizer") || cat.includes("pataba") || cat.includes("nutrient")) {
    return <Package className="w-4 h-4" />;
  }
  if (cat.includes("disease") || cat.includes("fungal") || cat.includes("sakit") || cat.includes("peste")) {
    return <AlertTriangle className="w-4 h-4" />;
  }
  return <Info className="w-4 h-4" />;
};

const parseAdvisory = (text: string): AdvisoryItem[] => {
  if (!text) return [];
  
  const normalized = text.replace(/\s+/g, ' ').trim();
  const segments = normalized.split(
    /(?=💧|🌧️|🌿|🌞|🌱|🌾|🌽|🚜|⚠️|📋)/u,
  );
  
  const items: AdvisoryItem[] = [];
  
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    
    const dashIndex = trimmed.indexOf('—');
    const colonIndex = trimmed.indexOf(':');
    const separatorIndex = dashIndex !== -1 ? dashIndex : (colonIndex !== -1 ? colonIndex : -1);
    
    let category = '';
    let description = '';
    
    if (separatorIndex !== -1) {
      category = trimmed.substring(0, separatorIndex).trim();
      description = trimmed.substring(separatorIndex + 1).trim();
    } else {
      const words = trimmed.split(' ');
      if (words.length >= 2) {
        category = words.slice(0, 2).join(' ');
        description = words.slice(2).join(' ');
      } else {
        category = trimmed;
        description = '';
      }
    }
    
    category = category
      .replace(/^(?:💧|🌧️|🌿|🌞|🌱|🌾|🌽|🚜|⚠️|📋|\s)+/u, "")
      .trim();
    description = description
      .replace(/^(?:💧|🌧️|🌿|🌞|🌱|🌾|🌽|🚜|⚠️|📋|\s)+/u, "")
      .trim();
    
    if (category || description) {
      items.push({
        category: category || 'Payo',
        description: description || category,
        icon: getAdvisoryIcon(category),
      });
    }
  }
  
  if (items.length === 0 && text.trim()) {
    return [{
      category: 'Payo ng DA',
      description: text.trim(),
      icon: <Info className="w-4 h-4" />,
    }];
  }
  
  return items;
};

const DAAdvisoryList: React.FC<{ advisory: string }> = ({ advisory }) => {
  const items = parseAdvisory(advisory);
  
  if (items.length === 0) {
    return (
      <p className="text-sm text-white/90 leading-relaxed">
        {advisory}
      </p>
    );
  }
  
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-3 group">
          <div className="shrink-0 w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-amber-600">
            {item.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white/95 leading-snug">
              {item.category}
            </p>
            {item.description && (
              <p className="text-sm text-white/80 leading-relaxed mt-0.5">
                {item.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Dynamic Weather Card (uses Open-Meteo API) ──────────────────────────────

/**
 * DynamicWeatherCard — displays live weather for the selected farm location.
 * Uses Open-Meteo (free, no API key) with geocoding for municipality lookup.
 * Falls back gracefully: municipality → province → region → static default.
 * Card gradient changes based on current weather condition.
 */
const DynamicWeatherCard: React.FC<{
  municipality: string;
  province: string;
  cropStage?: string;
}> = ({ municipality, province = "Cagayan", cropStage }) => {
  const {
    weather,
    loading,
    error,
    gradientClass,
    iconName,
    refresh,
    isUsingFallback,
  } = useWeather({
    municipality,
    province,
    cropStage,
    autoRefresh: true,
    refreshIntervalMs: 30 * 60 * 1000, // 30 minutes
  });

  const [dateTime, setDateTime] = React.useState(() =>
    new Date().toLocaleString("fil-PH", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
  );

  // Update clock every minute
  React.useEffect(() => {
    const id = setInterval(
      () =>
        setDateTime(
          new Date().toLocaleString("fil-PH", {
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }),
        ),
      60_000,
    );
    return () => clearInterval(id);
  }, []);

  const gradient = weather
    ? gradientClass
    : "from-slate-400 via-slate-500 to-slate-600";

  // Loading skeleton
  if (loading && !weather) {
    return (
      <div className="w-full relative overflow-hidden rounded-3xl shadow-lg">
        <div className={`absolute inset-0 bg-linear-to-br ${gradient}`} />
        <div className="relative z-10 p-5 sm:p-6 space-y-4 animate-pulse">
          <div className="h-3 w-1/4 bg-white/20 rounded" />
          <div className="h-12 w-24 bg-white/20 rounded" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-12 bg-white/15 rounded-2xl" />
            <div className="h-12 bg-white/15 rounded-2xl" />
          </div>
          <div className="h-8 bg-white/15 rounded-2xl" />
        </div>
      </div>
    );
  }

  // Error state with fallback data
  if (error && !weather) {
    return (
      <div className="w-full relative overflow-hidden rounded-3xl shadow-lg bg-linear-to-br from-slate-400 via-slate-500 to-slate-600">
        <div className="relative z-10 p-5 sm:p-6 space-y-4 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-200 mx-auto" />
          <p className="text-sm font-bold text-white">
            Hindi nakakuha ng weather data
          </p>
          <p className="text-xs text-slate-200/80">{error}</p>
          <button
            onClick={refresh}
            className="mx-auto px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold text-white transition"
          >
            Subukan Muli
          </button>
        </div>
      </div>
    );
  }

  // No data yet
  if (!weather) {
    return (
      <div className="w-full relative overflow-hidden rounded-3xl shadow-lg bg-linear-to-br from-slate-400 via-slate-500 to-slate-600">
        <div className="relative z-10 p-5 sm:p-6 space-y-4 text-center animate-pulse">
          <div className="h-3 w-1/4 bg-white/20 rounded mx-auto" />
          <div className="h-12 w-24 bg-white/20 rounded mx-auto" />
        </div>
      </div>
    );
  }

  // Render with live data
  return (
    <div className="w-full relative overflow-hidden rounded-3xl shadow-lg">
      {/* Dynamic gradient background based on weather */}
      <div className={`absolute inset-0 bg-linear-to-br ${gradient}`} />

      {/* Decorative blobs */}
      <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/10" />
      <div className="absolute bottom-4 -left-8 w-24 h-24 rounded-full bg-white/8" />

      {/* Fallback indicator */}
      {isUsingFallback && (
        <div className="absolute top-2 right-2 z-10">
          <span className="bg-amber-500/90 text-amber-950 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
            <RefreshCwIcon className="w-2.5 h-2.5" /> Default Cagayan
          </span>
        </div>
      )}

      {/* Card content */}
      <div className="relative z-10 p-5 sm:p-6 space-y-4">
        {/* ── Top row: label + location ── */}
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] sm:text-[11px] font-black tracking-widest uppercase text-white/80">
              Panahon Ngayon
            </p>
            <p className="text-[11px] sm:text-xs text-white/70 mt-0.5 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> {weather.municipality},{" "}
              {weather.province}
            </p>
          </div>
          <span className="text-4xl leading-none drop-shadow-md select-none text-white">
            <WeatherIcon name={iconName} className="w-12 h-12" />
          </span>
        </div>

        {/* ── Temperature ── */}
        <div>
          <div className="flex items-end gap-1 leading-none">
            <span className="text-6xl font-black text-white tracking-tighter">
              {weather.temperatureCelsius}°
            </span>
            <span className="text-xl font-bold text-white/90 mb-2">C</span>
          </div>
          <p className="text-sm text-white/90 font-semibold mt-1">
            {weather.conditionLabel}
          </p>
          <p className="text-[11px] text-white/70 mt-0.5">
            Nararamdaman: {weather.feelsLikeCelsius}°C
          </p>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-3 py-2.5 flex items-center gap-2">
            <Droplets className="w-5 h-5 text-white" />
            <div>
              <p className="text-[9px] text-white/70 font-semibold uppercase tracking-wide">
                Halumigmig
              </p>
              <p className="text-xs font-black text-white">
                {weather.humidityPercent}%
              </p>
            </div>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-3 py-2.5 flex items-center gap-2">
            <Wind className="w-5 h-5 text-white" />
            <div>
              <p className="text-[9px] text-white/70 font-semibold uppercase tracking-wide">
                Hangin
              </p>
              <p className="text-xs font-black text-white">
                {weather.windKph} km/h
              </p>
            </div>
          </div>
        </div>

        {/* ── DA Advisory strip ── */}
        <div className="bg-amber-400/15 border border-amber-300/40 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider mb-3">
                Payo ng DA
              </p>
              <DAAdvisoryList advisory={weather.daAdvisory} />
            </div>
          </div>   
        </div>

        {/* ── Timestamp + Refresh ── */}
        <div className="flex justify-between items-center">
          <p className="text-[10px] text-white/60">{dateTime}</p>
          <button
            onClick={refresh}
            disabled={loading}
            className="text-[10px] text-white/70 hover:text-white font-medium flex items-center gap-1 transition disabled:opacity-50"
            title="I-refresh ang weather data"
          >
            <RefreshCwIcon
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Update
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Component ──────────────────────────────────────────────────────────────

export const FarmerDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const isOffline = useNetworkStatus();
  const { pendingCount } = useSyncQueue();
  const { profile, logout } = useAuth();
  useNotifications({ autoRegister: true, showForegroundToast: true });
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      toast.info("Naka-logout ka na", {
        description: "Salamat sa paggamit ng Tarabay-Mais.",
      });
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  };

  // ── Farm Context from the shared FarmSelection (single source of truth) ───
  const {
    selectedFarm,
    selectedCycle,
    loading: selectionLoading,
  } = useFarmSelection();

  const farmContextLoading = selectionLoading;
  const farmContext = React.useMemo(() => {
    if (!selectedFarm) return null;
    return {
      farmName: selectedFarm.name,
      municipality: selectedFarm.municipality,
      barangay: selectedFarm.barangay,
      variety: selectedCycle?.variety || selectedCycle?.cropType || "Mais",
      areaHectares: Number(selectedFarm.areaHectares),
      ownership: "",
      cropCycleId: selectedCycle?.id ?? "",
      farmId: selectedFarm.id,
      dap: selectedCycle ? computeDAP(selectedCycle.plantingDate) : null,
      plantingDate: selectedCycle?.plantingDate ?? "",
    };
  }, [selectedFarm, selectedCycle]);

  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [queue, setQueue] = useState<SyncActionItem[]>([]);

  // Keep the rendered queue list in sync with IndexedDB (writes, clears, and
  // cross-tab syncs dispatch QUEUE_UPDATED_EVENT via sync.service).
  useEffect(() => {
    const refresh = async () => {
      setQueue(await getOfflineQueue());
    };
    refresh();
    if (typeof window === "undefined") return;
    window.addEventListener(QUEUE_UPDATED_EVENT, refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.removeEventListener(QUEUE_UPDATED_EVENT, refresh);
      window.removeEventListener("online", refresh);
    };
  }, []);

  const [activeModal, setActiveModal] = useState<
    | "scanner"
    | "activity"
    | "observation"
    | "chat"
    | "expert"
    | "disaster"
    | "queue"
    | "profile"
    | null
  >(null);

  // Load offline queue count on mount.
  useEffect(() => {
    getOfflineQueue().then((q) => setQueueCount(q.length));
  }, []);

  // ── Farmer display name from auth context ────────────────────────────────
  const farmerName = profile
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : "";

  // ── Sync ─────────────────────────────────────────────────────────────────
  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const result = await syncPendingOfflineActions();
      if (result.total === 0) {
        toast.info("Walang nakapilang ulat.");
      } else if (result.failed > 0) {
        setQueueCount(result.failed);
        toast.warning("Bahagi lamang ng ulat ang na-sync.", {
          description: `${result.processed} naipadala; ${result.failed} mananatili sa queue para sa retry.`,
        });
      } else {
        setQueueCount(0);
        toast.success("Matagumpay na Na-sync!", {
          description:
            "Lahat ng nakatagong ulat ay naipadala na sa PostgreSQL database.",
        });
      }
    } catch {
      toast.error("Hindi natapos ang pag-sync.", {
        description: "Subukan muli kapag may koneksyon.",
      });
    } finally {
      setSyncing(false);
    }
  };

  // ── 1. Activity Modal ─────────────────────────────────────────────────────
  const [actType, setActType] = useState<ActivityType>("FERTILIZER");
  const [actDesc, setActDesc] = useState("");
  const [actCost, setActCost] = useState("");
  const [actLoading, setActLoading] = useState(false);

  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmContext) return;
    setActLoading(true);
    try {
      await createActivity(farmContext.cropCycleId, {
        activityType: actType,
        description: actDesc,
        costAmount: parseFloat(actCost) || 0,
        performedAt: new Date().toISOString().split("T")[0],
      });
      toast.success("Naitala ang Gawain!", {
        description: `${actDesc} ay naitala na sa talaan ng sakahan.`,
      });
      setActDesc("");
      setActCost("");
      setActiveModal(null);
    } catch (err) {
      if (!isOfflineError(err)) {
        const description =
          err instanceof ApiError
            ? err.message
            : "May problema sa server. Pakisubukan muli.";
        toast.error("Hindi Naitala ang Gawain", { description });
        return;
      }
      await queueOfflineAction({
        actionType: "CREATE_CROP_ACTIVITY",
        payload: {
          cropCycleId: farmContext.cropCycleId,
          activityType: actType,
          description: actDesc,
          costAmount: parseFloat(actCost) || 0,
        },
        displayTitle: `Gawain: ${actDesc}`,
      });
      setQueueCount((c) => c + 1);
      toast.info("Nai-save sa Offline Queue", {
        description: "Walang koneksyon. I-sync kapag nagkaroon ng signal.",
      });
      setActDesc("");
      setActCost("");
      setActiveModal(null);
    } finally {
      setActLoading(false);
    }
  };

  // ── 2. Observation Modal ──────────────────────────────────────────────────
  const [obsTitle, setObsTitle] = useState("");
  const [obsDesc, setObsDesc] = useState("");
  const [obsSeverity, setObsSeverity] = useState<SeverityLevel>("MEDIUM");
  const [obsFile, setObsFile] = useState<File | null>(null);
  const [obsLoading, setObsLoading] = useState(false);

  const handleSaveObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmContext) return;
    setObsLoading(true);
    try {
      const res = await createObservation({
        cropCycleId: farmContext.cropCycleId,
        title: obsTitle,
        description: obsDesc,
        severity: obsSeverity,
        image: obsFile,
      });

      if (res.autoEscalatedCase) {
        toast.warning("Auto-Escalated sa DA Technician!", {
          description:
            "Dahil sa HIGH/CRITICAL severity, agad itong naipadala sa Municipal Technician.",
        });
      } else {
        toast.success("Nai-record ang Obserbasyon!", {
          description: "Matagumpay na naitala ang kalagayan ng pananim.",
        });
      }
      setObsTitle("");
      setObsDesc("");
      setObsFile(null);
      setActiveModal(null);
    } catch (err) {
      if (!isOfflineError(err)) {
        const description =
          err instanceof ApiError
            ? err.message
            : "May problema sa server. Pakisubukan muli.";
        toast.error("Hindi Nai-record ang Obserbasyon", { description });
        return;
      }
      await queueOfflineAction({
        actionType: "CREATE_OBSERVATION",
        payload: {
          cropCycleId: farmContext.cropCycleId,
          title: obsTitle,
          description: obsDesc,
          severity: obsSeverity,
        },
        displayTitle: `Obserbasyon: ${obsTitle}`,
      });
      setQueueCount((c) => c + 1);
      toast.info("Nai-save sa Offline Queue", {
        description: "Walang koneksyon. I-sync kapag nagkaroon ng signal.",
      });
      setObsTitle("");
      setObsDesc("");
      setObsFile(null);
      setActiveModal(null);
    } finally {
      setObsLoading(false);
    }
  };

  // ── 3. AI Scanner Modal ───────────────────────────────────────────────────
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ScanDiagnosisResult | null>(
    null,
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setScanFile(file);
      setScanPreview(URL.createObjectURL(file));
      setScanResult(null);
    }
  };

  const handleRunScan = async () => {
    if (!scanFile) {
      toast.error("Walang Litrato", {
        description:
          "Mangyaring kumuha o pumili muna ng litrato ng dahon ng mais.",
      });
      return;
    }
    setScanLoading(true);
    try {
      const res = await scanPlantHealth(scanFile);
      setScanResult(res);
      toast.success("Natapos ang AI Diagnosis!", {
        description: res.diseaseDetected
          ? `Natukoy: ${res.diseaseDetected}`
          : "Maayos ang kalusugan ng pananim.",
      });
    } catch {
      toast.error("Hindi natapos ang pag-scan.", {
        description: "Subukan muli o i-check ang koneksyon sa server.",
      });
    } finally {
      setScanLoading(false);
    }
  };

  // ── 4. RAG Chat Modal ────────────────────────────────────────────────────
  const [chatPrompt, setChatPrompt] = useState("");
  const [chatMessages, setChatMessages] = useState<
    Array<{
      id: string;
      role: "user" | "assistant";
      text: string;
      sources?: RagChatSource[];
    }>
  >([
    {
      id: "msg-welcome",
      role: "assistant",
      text: "Magandang araw! Ako ang inyong Kaagapay AI Assistant. Nakakabit ako sa DA Region II Corn Guides. Ano ang maipaglilingkod ko ukol sa inyong mais?",
    },
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatPrompt.trim() || chatLoading) return;

    const userText = chatPrompt.trim();
    setChatPrompt("");
    setChatMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", text: userText },
    ]);
    setChatLoading(true);

    try {
      const res = await sendRagChat(
        userText,
        farmContext?.cropCycleId ?? undefined,
      );
      setChatMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          role: "assistant",
          text: res.answer,
          sources: res.sources,
        },
      ]);
    } catch {
      toast.error("Hindi natanggap ang sagot.", {
        description: "Subukan muli o i-check ang koneksyon.",
      });
    } finally {
      setChatLoading(false);
    }
  };

  // ── 5. Disaster Modal ─────────────────────────────────────────────────────
  const [disasterType, setDisasterType] = useState("TYPHOON");
  const [disasterDmg, setDisasterDmg] = useState("");
  const [disasterLoss, setDisasterLoss] = useState("");
  const [disasterNotes, setDisasterNotes] = useState("");
  const [disasterLoading, setDisasterLoading] = useState(false);

  const handleSaveDisaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmContext) return;
    setDisasterLoading(true);
    try {
      await createDisasterReport(farmContext.farmId, {
        disasterType,
        damagePercentage: parseFloat(disasterDmg) || 0,
        estimatedLoss: parseFloat(disasterLoss) || 0,
        notes: disasterNotes,
      });
      toast.success("Naisumite ang Ulat ng Pinsala!", {
        description:
          "Nakarating na sa Municipal Agriculture Office para sa validation.",
      });
      setDisasterDmg("");
      setDisasterLoss("");
      setDisasterNotes("");
      setActiveModal(null);
    } catch (err) {
      if (!isOfflineError(err)) {
        const description =
          err instanceof ApiError
            ? err.message
            : "May problema sa server. Pakisubukan muli.";
        toast.error("Hindi Naisumite ang Ulat", { description });
        return;
      }
      await queueOfflineAction({
        actionType: "CREATE_DISASTER_REPORT",
        payload: {
          farmId: farmContext.farmId,
          disasterType,
          damagePercentage: parseFloat(disasterDmg) || 0,
          estimatedLoss: parseFloat(disasterLoss) || 0,
          notes: disasterNotes,
        },
        displayTitle: `Disaster Claim: ${disasterType} (${disasterDmg}%)`,
      });
      setQueueCount((c) => c + 1);
      toast.info("Nai-save sa Offline Queue", {
        description: "Walang koneksyon. I-sync kapag nagkaroon ng signal.",
      });
      setDisasterDmg("");
      setDisasterLoss("");
      setDisasterNotes("");
      setActiveModal(null);
    } finally {
      setDisasterLoading(false);
    }
  };

  // History / pipeline now lives on the dedicated FarmerHistoryPage
  // (reached via the bottom-nav "History" button → /farmer/history). The old
  // in-dashboard history modal was never wired to a trigger, so it has been
  // removed to avoid duplicate, dead code.

  // ── Derived lifecycle values ──────────────────────────────────────────────
  const dap = farmContext?.dap ?? null;
  const growthStage = dap !== null ? resolveGrowthStage(dap) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full min-h-screen bg-slate-100 md:bg-slate-950 flex flex-col items-center justify-start p-0 md:p-6 lg:p-8 font-sans selection:bg-emerald-500/30 pb-20 md:pb-8">
      <div className="w-full md:max-w-5xl lg:max-w-6xl xl:max-w-7xl bg-slate-50 text-slate-900 shadow-2xl flex flex-col justify-between overflow-x-hidden md:rounded-[36px] md:border-2 md:border-emerald-800/40 min-h-screen relative">
        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <header className="w-full bg-[#03543f] text-white px-5 sm:px-6 py-4 flex items-center justify-between gap-3 shadow-md border-b border-emerald-700/30">
          {/* Left: App identity + Farmer greeting */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight truncate">
              Tahanan ng Magsasaka
            </h1>
            <p className="text-xs sm:text-sm text-emerald-200/90 font-medium mt-0.5 truncate">
              {farmerName
                ? `Mabuhay, ${farmerName.split(" ")[0]}! `
                : "DA Region II • Cagayan Valley"}
              <Wheat className="inline w-4 h-4 text-emerald-200 ml-1" />
            </p>
          </div>

          {/* Right: Essential actions only — Sync (if needed) + Notifications + Profile Menu */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Sync Button — only shows when there's queue, prominent */}
            {queueCount > 0 && (
              <button
                onClick={handleSyncNow}
                disabled={syncing}
                type="button"
                className="bg-[#f59e0b] hover:bg-[#d97706] active:scale-95 text-amber-950 font-black text-sm px-4 py-2.5 rounded-full flex items-center gap-2 shadow-lg transition-all cursor-pointer touch-manipulation select-none border-2 border-amber-300/50"
                aria-label={`${queueCount} rekord na nakatabi. I-sync ngayon.`}
              >
                <RefreshCw
                  className={`w-5 h-5 ${syncing ? "animate-spin" : ""}`}
                />
                <span className="hidden sm:inline">{queueCount} Sync</span>
                <span className="w-5 h-5 rounded-full bg-amber-950/20 flex items-center justify-center text-[10px] font-black">
                  {queueCount > 9 ? "9+" : queueCount}
                </span>
              </button>
            )}

            {/* Notification Bell */}
            <NotificationBell
              userId={profile?.id ?? ""}
              expertCases={[]} // Farmer doesn't have expert cases
              disasterCases={[]} // Farmer doesn't have disaster cases directly
              onOpenCase={() => {}} // No navigation needed for farmer
              onViewAll={() => {}} // No view all for farmer
            />

            {/* Profile Menu Button — single tap target for all account actions */}
            <button
              onClick={() => setActiveModal("profile")}
              type="button"
              aria-label="Menu ng account"
              aria-expanded={activeModal === "profile"}
              aria-haspopup="true"
              className="w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-emerald-700/80 hover:bg-emerald-600 active:scale-95 border border-emerald-400/40 text-white flex items-center justify-center shadow-lg transition-all cursor-pointer touch-manipulation select-none shrink-0"
            >
              <UserCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </header>

        {/* ── DASHBOARD BODY ───────────────────────────────────────────────── */}
        <main className="p-4 sm:p-6 lg:p-8 flex-1 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
            {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
            <div className="lg:col-span-5 space-y-4 sm:space-y-5">
              <MaisyGreeting
                userName={profile?.firstName || "Magsasaka"}
              />

              {/* Weather Card — Dynamic Open-Meteo API with municipality-level geocoding */}
              {!farmContextLoading && farmContext ? (
                <DynamicWeatherCard
                  municipality={farmContext.municipality}
                  province="Cagayan"
                  cropStage={growthStage?.tagalogLabel}
                />
              ) : (
                <DynamicWeatherCard
                  municipality="Iguig"
                  province="Cagayan"
                  cropStage={undefined}
                />
              )}

              {/* Shared farm + crop cycle switcher — changes apply app-wide */}
              {!farmContextLoading && (
                <FarmCycleSelector label="Piliin ang sakahan / pananim" />
              )}

              {/* Crop Growth Card — visual, glanceable lifecycle tracker */}
              {!farmContextLoading &&
                farmContext &&
                dap !== null &&
                growthStage &&
                (() => {
                  const progressPct = Math.min(
                    (dap / HARVEST_TARGET_DAP) * 100,
                    100,
                  );
                  const daysLeft = Math.max(HARVEST_TARGET_DAP - dap, 0);
                  const isReady = dap >= HARVEST_TARGET_DAP;

                  return (
                    <div className="w-full bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                      {/* ── Top accent strip + big emoji ── */}
                      <div className="bg-linear-to-r from-emerald-700 to-emerald-500 px-5 pt-5 pb-6 relative">
                        {/* Decorative circle */}
                        <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />

                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-[10px] font-black tracking-widest uppercase text-emerald-200">
                              Yugto ng Pananim
                            </p>
                            <h3 className="text-2xl sm:text-3xl font-black text-white mt-0.5 tracking-tight">
                              {growthStage.tagalogLabel}
                            </h3>
                            <p className="text-xs text-emerald-100/80 mt-1 font-medium">
                              {growthStage.label}
                            </p>
                          </div>
                          <span className="text-5xl leading-none drop-shadow-lg select-none text-white">
                            <growthStage.icon className="w-14 h-14" />
                          </span>
                        </div>

                        {/* DAP badge */}
                        <span className="inline-flex items-center gap-1 mt-3 bg-white/20 border border-white/30 rounded-full px-3 py-1 text-[11px] font-black text-white">
                          <Calendar className="w-3 h-3" />
                          DAP {dap}
                        </span>
                      </div>

                      {/* ── Progress toward harvest ── */}
                      <div className="px-5 py-4 space-y-3">
                        {/* Progress bar */}
                        <div>
                          <div className="flex justify-between items-center mb-1.5">
                            <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                              {isReady
                                ? "Handa na sa Pag-ani!"
                                : "Progreso sa Pag-ani"}
                            </p>
                            <p className="text-[11px] font-black text-emerald-700">
                              {Math.round(progressPct)}%
                            </p>
                          </div>
                          <div className="h-3.5 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${
                                isReady
                                  ? "bg-amber-500"
                                  : progressPct > 70
                                    ? "bg-emerald-500"
                                    : "bg-emerald-400"
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>

                        {/* Days remaining + stage pills */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1">
                            {isReady ? (
                              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-3.5 py-2.5 text-center">
                                <p className="text-lg font-black text-amber-600 flex items-center justify-center gap-2">
                                  <Trophy className="w-6 h-6" /> Pag-ani Na!
                                </p>
                                <p className="text-[10px] text-amber-700 font-semibold mt-0.5">
                                  Abisuhan ang inyong technician
                                </p>
                              </div>
                            ) : (
                              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-3.5 py-2.5">
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wide">
                                  Natitirang Araw
                                </p>
                                <p className="text-3xl font-black text-emerald-800 leading-none mt-0.5">
                                  {daysLeft}
                                  <span className="text-sm font-bold text-emerald-600 ml-1">
                                    araw
                                  </span>
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Stage progression mini-dots */}
                          <div className="flex flex-col items-center gap-1.5">
                            {GROWTH_STAGES.map((s) => (
                              <div
                                key={s.stageIndex}
                                className="flex items-center gap-2"
                              >
                                <div
                                  className={`w-2 h-2 rounded-full transition-all ${
                                    s.stageIndex < growthStage.stageIndex
                                      ? "bg-emerald-500"
                                      : s.stageIndex === growthStage.stageIndex
                                        ? "bg-emerald-600 ring-2 ring-emerald-300 w-3 h-3"
                                        : "bg-slate-200"
                                  }`}
                                />
                                <p
                                  className={`text-[10px] font-bold flex items-center gap-1.5 ${
                                    s.stageIndex === growthStage.stageIndex
                                      ? "text-emerald-700"
                                      : "text-slate-400"
                                  }`}
                                >
                                  <s.icon className="w-3.5 h-3.5" />{" "}
                                  {s.tagalogLabel}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Planting date footnote */}
                        <p className="text-[10px] text-slate-400 text-center">
                          Itinarak noong{" "}
                          {new Date(
                            farmContext.plantingDate,
                          ).toLocaleDateString("fil-PH", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}{" "}
                          &bull; Target ani: DAP {HARVEST_TARGET_DAP}
                        </p>
                      </div>
                    </div>
                  );
                })()}
            </div>

            {/* ── RIGHT COLUMN ────────────────────────────────────────────── */}
            <div className="lg:col-span-7 space-y-4 sm:space-y-5">
              {/* Offline Sync Banner */}
              {queueCount > 0 && (
                <div className="w-full bg-[#044e3b] text-white rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-md border border-emerald-600/30 gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-700/80 flex items-center justify-center shrink-0 shadow-inner">
                      <RefreshCw className="w-6 h-6 text-emerald-200" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-white leading-snug">
                        May {queueCount} na-record na nakatabi sa phone
                      </h3>
                      <p className="text-xs text-emerald-200/90 mt-0.5">
                        May internet na! I-sync na sa PostgreSQL server.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleSyncNow}
                    disabled={syncing}
                    type="button"
                    className="w-full sm:w-auto bg-[#f59e0b] hover:bg-[#d97706] active:scale-95 text-amber-950 font-black text-xs sm:text-sm px-5 py-3 rounded-2xl shadow-md transition-all shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {syncing ? "Nag-sync..." : "I-sync Ngayon"}
                  </button>
                </div>
              )}

              {/* Action Buttons — Tiered, Mobile-First, Farmer-Optimized */}
              <div className="space-y-4">
                <h2 className="text-xs sm:text-sm font-black text-slate-600 tracking-wider uppercase">
                  Mga Pangunahing Aksyon
                </h2>

                {/* ============================================================ */}
                {/* TIER 1: PRIMARY HERO CARDS — Full width, photo-first, urgent */}
                {/* ============================================================ */}

                {/* 1. AI Plant Health Scanner — PHOTO-FIRST HERO */}
                <button
                  type="button"
                  onClick={() => navigate("/farmer/scanner")}
                  className="w-full min-h-40 sm:min-h-45 rounded-3xl bg-linear-to-br from-emerald-700 via-emerald-600 to-emerald-800 hover:from-emerald-800 hover:via-emerald-700 hover:to-emerald-900 hover:-translate-y-0.5 active:scale-[0.98] text-white p-5 sm:p-6 flex flex-col justify-between text-left shadow-xl hover:shadow-2xl transition-all cursor-pointer touch-manipulation select-none border border-emerald-500/30"
                  aria-label="Suriin ang halaman gamit ang AI Camera"
                >
                  {/* Top: Icon + Badge */}
                  <div className="flex justify-between items-start w-full">
                    <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner border border-white/30">
                      <Scan className="w-7 h-7 text-white stroke-2" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-amber-400 px-3 py-1 text-[10px] sm:text-[11px] font-black text-amber-950 flex items-center gap-1">
                        <Camera className="w-3 h-3" /> AI Camera
                      </span>
                      {/* Offline indicator — Scanner needs online */}
                      <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2.5 py-1 text-[9px] font-bold text-red-100 border border-red-400/30">
                        <Wifi className="w-3 h-3" /> Online
                      </span>
                    </div>
                  </div>

                  {/* Bottom: Label + Description */}
                  <div className="pt-2">
                    <h3 className="font-extrabold text-lg sm:text-xl leading-tight tracking-tight">
                      Suriin ang Halaman
                    </h3>
                    <p className="text-sm sm:text-base text-emerald-100 mt-1.5 font-medium leading-relaxed">
                      Kuhanan ng litrato ang dahon ng mais • Agad na AI
                      diagnosis
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-[11px] sm:text-xs text-emerald-200/80">
                      <span className="flex items-center gap-1 bg-white/15 px-2.5 py-1 rounded-full">
                        <Camera className="w-3.5 h-3.5" /> Tap para kumuha
                      </span>
                      <span className="flex items-center gap-1 bg-white/15 px-2.5 py-1 rounded-full">
                        <Image className="w-3.5 h-3.5" /> O pumili sa gallery
                      </span>
                    </div>
                  </div>
                </button>

                {/* 2. Disaster Report — URGENT HERO (high contrast, alarming) */}
                <button
                  type="button"
                  onClick={() => navigate("/farmer/disaster")}
                  className="w-full min-h-35 sm:min-h-40 rounded-3xl bg-linear-to-br from-rose-700 via-rose-600 to-rose-800 hover:from-rose-800 hover:via-rose-700 hover:to-rose-900 hover:-translate-y-0.5 active:scale-[0.98] text-white p-5 sm:p-6 flex flex-col justify-between text-left shadow-xl hover:shadow-2xl transition-all cursor-pointer touch-manipulation select-none border border-rose-500/30"
                  aria-label="Mag-ulat ng pinsala mula sa bagyo o baha"
                >
                  {/* Top: Icon + Urgent Badge */}
                  <div className="flex justify-between items-start w-full">
                    <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner border border-white/30 animate-pulse">
                      <AlertTriangle className="w-7 h-7 text-white stroke-2" />
                    </div>
                    <span className="rounded-full bg-amber-300 px-3 py-1 text-[10px] sm:text-[11px] font-black text-amber-950 flex items-center gap-1 animate-pulse">
                      <AlertTriangle className="w-3 h-3" /> URHENTE
                    </span>
                  </div>

                  {/* Bottom: Label + Description */}
                  <div className="pt-2">
                    <h3 className="font-extrabold text-lg sm:text-xl leading-tight tracking-tight">
                      Ulat ng Baha / Bagyo
                    </h3>
                    <p className="text-sm sm:text-base text-rose-100 mt-1.5 font-medium leading-relaxed">
                      I-report agad ang pinsala sa pananim • Offline-ready •
                      Dapat maipadala sa DA
                    </p>
                    <div className="mt-3 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/30">
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-100">
                        {isOffline ? (
                          <>
                            <WifiOff className="w-3 h-3" />
                            Walang koneksyon · isi-sync kapag online
                          </>
                        ) : pendingCount > 0 ? (
                          <>
                            <RefreshCw className="w-3 h-3" />
                            {pendingCount} rekord na naghihintay i-sync
                          </>
                        ) : (
                          <>
                            <Wifi className="w-3 h-3" />
                            Online · handa nang ipadala sa DA
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </button>

                {/* ============================================================ */}
                {/* TIER 2: SECONDARY ACTIONS — 2-col grid, standard height */}
                {/* ============================================================ */}
                <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
                  {/* 3. Mag-record ng Gawain — Offline-ready */}
                  <button
                    type="button"
                    onClick={() => navigate("/farmer/activity")}
                    className="min-h-32.5 sm:min-h-35 rounded-3xl bg-linear-to-br from-blue-600 via-blue-700 to-blue-800 hover:from-blue-700 hover:via-blue-800 hover:to-blue-900 hover:-translate-y-0.5 active:scale-[0.98] text-white p-4 sm:p-5 flex flex-col justify-between text-left shadow-lg hover:shadow-xl transition-all cursor-pointer touch-manipulation select-none border border-blue-500/30"
                    aria-label="I-record ang gawaing pataba, patubig, o peste"
                  >
                    <div className="flex justify-between items-start w-full">
                      <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner border border-white/30">
                        <ClipboardCheck className="w-6 h-6 text-white stroke-[2.2]" />
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[9px] font-bold text-white border border-white/30">
                        <WifiOff className="w-3 h-3" /> Offline
                      </span>
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base sm:text-lg leading-tight">
                        Mag-record ng Gawain
                      </h3>
                      <p className="text-xs sm:text-sm text-blue-100 mt-1.5 font-medium leading-relaxed">
                        Pataba • Patubig • Peste control
                      </p>
                    </div>
                  </button>

                  {/* 4. I-report ang Sintomas — Offline-ready, photo */}
                  <button
                    type="button"
                    onClick={() => navigate("/farmer/observation")}
                    className="min-h-32.5 sm:min-h-35 rounded-3xl bg-linear-to-br from-purple-600 via-purple-700 to-purple-800 hover:from-purple-700 hover:via-purple-800 hover:to-purple-900 hover:-translate-y-0.5 active:scale-[0.98] text-white p-4 sm:p-5 flex flex-col justify-between text-left shadow-lg hover:shadow-xl transition-all cursor-pointer touch-manipulation select-none border border-purple-500/30"
                    aria-label="I-report ang sintomas ng sakit o peste sa pananim"
                  >
                    <div className="flex justify-between items-start w-full">
                      <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner border border-white/30">
                        <Camera className="w-6 h-6 text-white stroke-[2.2]" />
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[9px] font-bold text-white border border-white/30">
                        <WifiOff className="w-3 h-3" /> Offline
                      </span>
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base sm:text-lg leading-tight">
                        I-report ang Sintomas
                      </h3>
                      <p className="text-xs sm:text-sm text-purple-100 mt-1.5 font-medium leading-relaxed">
                        Kumuha ng litrato • Severity level • Auto-escalate
                      </p>
                    </div>
                  </button>

                  {/* 5. Magtanong sa AI — Online only */}
                  <button
                    type="button"
                    onClick={() => navigate("/farmer/chat")}
                    className="min-h-32.5 sm:min-h-35 rounded-3xl bg-linear-to-br from-teal-600 via-teal-700 to-teal-800 hover:from-teal-700 hover:via-teal-800 hover:to-teal-900 hover:-translate-y-0.5 active:scale-[0.98] text-white p-4 sm:p-5 flex flex-col justify-between text-left shadow-lg hover:shadow-xl transition-all cursor-pointer touch-manipulation select-none border border-teal-500/30"
                    aria-label="Magtanong sa AI Assistant tungkol sa mais"
                  >
                    <div className="flex justify-between items-start w-full">
                      <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner border border-white/30">
                        <Bot className="w-6 h-6 text-white stroke-[2.2]" />
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2.5 py-1 text-[9px] font-bold text-red-100 border border-red-400/30">
                        <Wifi className="w-3 h-3" /> Online
                      </span>
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base sm:text-lg leading-tight">
                        Magtanong sa AI
                      </h3>
                      <p className="text-xs sm:text-sm text-teal-100 mt-1.5 font-medium leading-relaxed">
                        DA Corn Guides • Tanong sa Tagalog • Mabilis na sagot
                      </p>
                    </div>
                  </button>

                  {/* 6. Humingi ng Tulong — Online, connects to LGU */}
                  <button
                    type="button"
                    onClick={() => navigate("/farmer/expert-request")}
                    className="min-h-32.5 sm:min-h-35 rounded-3xl bg-linear-to-br from-orange-600 via-orange-700 to-orange-800 hover:from-orange-700 hover:via-orange-800 hover:to-orange-900 hover:-translate-y-0.5 active:scale-[0.98] text-white p-4 sm:p-5 flex flex-col justify-between text-left shadow-lg hover:shadow-xl transition-all cursor-pointer touch-manipulation select-none border border-orange-500/30"
                    aria-label="Humingi ng tulong sa LGU Agricultural Technician"
                  >
                    <div className="flex justify-between items-start w-full">
                      <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner border border-white/30">
                        <UserCheck className="w-6 h-6 text-white stroke-[2.2]" />
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2.5 py-1 text-[9px] font-bold text-red-100 border border-red-400/30">
                        <Wifi className="w-3 h-3" /> Online
                      </span>
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base sm:text-lg leading-tight">
                        Humingi ng Tulong
                      </h3>
                      <p className="text-xs sm:text-sm text-orange-100 mt-1.5 font-medium leading-relaxed">
                        LGU Ag Technician • Video call • Schedule visit
                      </p>
                    </div>
                  </button>
                </div>

                {/* ============================================================ */}
                {/* TIER 3: QUICK LINKS ROW — Compact, for power users */}
                {/* ============================================================ */}
                <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                  <a
                    href="/farmer/farms"
                    className="min-h-22.5 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-[0.98] p-3.5 flex flex-col items-center justify-center text-center shadow-sm hover:shadow-md transition-all cursor-pointer touch-manipulation select-none border border-slate-200"
                  >
                    <Tractor className="w-6 h-6 text-emerald-700 stroke-[2.2] mb-1.5" />
                    <span className="text-[11px] sm:text-xs font-extrabold text-slate-900 leading-tight">
                      Mga Sakahan
                    </span>
                  </a>
                  <a
                    href="/farmer/history"
                    className="min-h-22.5 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-[0.98] p-3.5 flex flex-col items-center justify-center text-center shadow-sm hover:shadow-md transition-all cursor-pointer touch-manipulation select-none border border-slate-200 relative"
                  >
                    <div className="relative mb-1.5">
                      <Clock className="w-6 h-6 text-slate-700 stroke-[2.2]" />
                      {queueCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-amber-500 text-amber-950 font-black text-[8px] w-5 h-5 rounded-full flex items-center justify-center">
                          {queueCount > 9 ? "9+" : queueCount}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] sm:text-xs font-extrabold text-slate-900 leading-tight">
                      Kasaysayan
                    </span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setActiveModal("queue")}
                    className="min-h-22.5 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-[0.98] p-3.5 flex flex-col items-center justify-center text-center shadow-sm hover:shadow-md transition-all cursor-pointer touch-manipulation select-none border border-slate-200"
                  >
                    <RefreshCw className="w-6 h-6 text-slate-700 stroke-[2.2] mb-1.5" />
                    <span className="text-[11px] sm:text-xs font-extrabold text-slate-900 leading-tight">
                      Sync Queue
                    </span>
                  </button>
                </div>
              </div>

              {/* Offline Queue Summary */}
              <div className="w-full bg-white rounded-3xl p-5 shadow-sm border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 shadow-inner">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Offline Storage Queue
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {queueCount > 0
                        ? `${queueCount} nakatabing rekord ang naghihintay ng sync`
                        : "Walang nakatagong rekord — lahat naka-sync na"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal("queue")}
                  className="rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <span>Tignan</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* ── BOTTOM NAVIGATION ──────────────────────────────────────────── */}
        <BottomNav active="home" badgeCount={queueCount} />

        {/* ================================================================ */}
        {/* MODALS                                                           */}
        {/* ================================================================ */}

        {/* 1. AI Scanner */}
        {activeModal === "scanner" && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="w-full max-w-lg bg-white rounded-t-4xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800">
                    <Scan className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">
                      AI Plant Health Scanner
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Gemini Multimodal Leaf Disease Vision
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="border-2 border-dashed border-emerald-300 bg-emerald-50/50 rounded-2xl p-4 text-center">
                {scanPreview ? (
                  <div className="relative">
                    <img
                      src={scanPreview}
                      alt="Leaf Scan Preview"
                      className="w-full h-48 object-cover rounded-xl shadow-sm"
                    />
                    <button
                      onClick={() => {
                        setScanFile(null);
                        setScanPreview(null);
                        setScanResult(null);
                      }}
                      className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-44 cursor-pointer">
                    <Camera className="w-12 h-12 text-emerald-600 mb-2 stroke-[1.8]" />
                    <span className="font-bold text-sm text-emerald-950">
                      Kuhanan o Pumili ng Litrato ng Dahon
                    </span>
                    <span className="text-xs text-slate-500 mt-1">
                      Tiyaking may magandang liwanag ang apektadong bahagi
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {scanPreview && !scanResult && (
                <button
                  onClick={handleRunScan}
                  disabled={scanLoading}
                  className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-60 cursor-pointer"
                >
                  {scanLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Sinusuri ng
                      Gemini AI...
                    </>
                  ) : (
                    "Suriin ang Litrato Ngayon"
                  )}
                </button>
              )}

              {scanResult && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 space-y-2.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">
                        AI Diagnosis
                      </span>
                      <h4 className="text-sm font-black text-slate-900 mt-0.5">
                        {scanResult.diseaseDetected}
                      </h4>
                    </div>
                    {scanResult.confidence && (
                      <span className="rounded-full bg-emerald-200 text-emerald-900 font-extrabold text-[10px] px-2.5 py-0.5">
                        {Math.round(scanResult.confidence * 100)}% Kumpyansa
                      </span>
                    )}
                  </div>
                  {scanResult.recommendations &&
                    scanResult.recommendations.length > 0 && (
                      <div className="pt-2 border-t border-emerald-200/80">
                        <p className="text-[11px] font-bold text-emerald-950 mb-1">
                          Mungkahing Lunas (DA Guides):
                        </p>
                        <ul className="text-xs text-slate-700 space-y-1">
                          {scanResult.recommendations.map((rec, i) => (
                            <li key={i}>• {rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => {
                        setObsTitle(
                          scanResult.diseaseDetected || "AI Leaf Scan",
                        );
                        setObsDesc(
                          scanResult.recommendations?.join("; ") || "",
                        );
                        setObsSeverity(scanResult.severity || "MEDIUM");
                        setActiveModal("observation");
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-white border border-emerald-600 font-bold text-xs text-emerald-800 shadow-sm cursor-pointer"
                    >
                      Itala bilang Obserbasyon
                    </button>
                    <button
                      onClick={() => {
                        setChatPrompt(
                          `Paano gamutin ang ${scanResult.diseaseDetected}?`,
                        );
                        setActiveModal("chat");
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 font-bold text-xs text-white shadow-sm cursor-pointer"
                    >
                      Itanong sa Kaagapay AI
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. Activity Modal */}
        {activeModal === "activity" && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="w-full max-w-lg bg-white rounded-t-4xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-800">
                    <ClipboardCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">
                      Mag-record ng Gawain sa Sakahan
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      I-log ang pataba, patubig, o pest control
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSaveActivity} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Uri ng Gawain
                  </label>
                  <select
                    value={actType}
                    onChange={(e) => setActType(e.target.value as ActivityType)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-sm font-semibold text-slate-900"
                  >
                    <option value="FERTILIZER">Pagpapataba (Fertilizer)</option>
                    <option value="IRRIGATION">Patubig (Irrigation)</option>
                    <option value="PEST_CONTROL">
                      Pagkontrol sa Peste (Pest Control)
                    </option>
                    <option value="PLANTING">Pagtatanim (Planting)</option>
                    <option value="PREPARATION">
                      Paghahanda ng Lupa (Preparation)
                    </option>
                    <option value="HARVEST">Pag-ani (Harvest)</option>
                    <option value="OTHER">Iba pa (Other)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Deskripsyon ng Ginawa
                  </label>
                  <input
                    type="text"
                    value={actDesc}
                    onChange={(e) => setActDesc(e.target.value)}
                    required
                    placeholder="Hal. Side-dress ng 2 sako ng Urea"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-sm font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nagastos (Halaga sa Piso)
                  </label>
                  <input
                    type="number"
                    value={actCost}
                    onChange={(e) => setActCost(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-sm font-semibold text-slate-900"
                  />
                </div>
                <button
                  type="submit"
                  disabled={actLoading}
                  className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm shadow-md cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {actLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Itinatala...
                    </>
                  ) : (
                    "I-save ang Gawain"
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 3. Observation Modal */}
        {activeModal === "observation" && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="w-full max-w-lg bg-white rounded-t-4xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center text-purple-800">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">
                      I-report ang Sintomas / Obserbasyon
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Auto-escalate sa DA kapag HIGH o CRITICAL
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSaveObservation} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pamagat ng Obserbasyon
                  </label>
                  <input
                    type="text"
                    value={obsTitle}
                    onChange={(e) => setObsTitle(e.target.value)}
                    required
                    placeholder="Hal. Naninilaw na mga dahon sa ibaba"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-sm font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Antas ng Pinsala (Severity)
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(
                      ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as SeverityLevel[]
                    ).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setObsSeverity(lvl)}
                        className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${obsSeverity === lvl ? (lvl === "HIGH" || lvl === "CRITICAL" ? "bg-rose-600 border-rose-700 text-white" : "bg-emerald-600 border-emerald-700 text-white") : "bg-slate-50 border-slate-200 text-slate-700"}`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Detalyadong Paliwanag
                  </label>
                  <textarea
                    rows={3}
                    value={obsDesc}
                    onChange={(e) => setObsDesc(e.target.value)}
                    required
                    placeholder="Ilarawan ang mga sintomas na nakita sa pananim..."
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-xs font-medium text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Litrato (Opsiyonal)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setObsFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-purple-100 font-medium"
                  />
                </div>
                <button
                  type="submit"
                  disabled={obsLoading}
                  className="w-full h-12 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-sm shadow-md cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {obsLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Itinatala...
                    </>
                  ) : (
                    "I-submit ang Obserbasyon"
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 4. RAG Chat Modal */}
        {activeModal === "chat" && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="w-full max-w-lg bg-white rounded-t-4xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl h-[85vh] flex flex-col justify-between">
              <div className="flex justify-between items-center border-b pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-100 flex items-center justify-center text-teal-800">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">
                      Kaagapay AI (RAG Assistant)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Grounded sa DA Region II Corn Guides
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-3 space-y-3">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${msg.role === "user" ? "bg-emerald-600 text-white rounded-br-none" : "bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200"}`}
                    >
                      <p className="whitespace-pre-line">{msg.text}</p>
                    </div>
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {msg.sources.map((s, i) => (
                          <span
                            key={i}
                            className="rounded-md bg-teal-50 border border-teal-200 px-2 py-0.5 text-[9px] font-bold text-teal-700"
                          >
                            📖 {s.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 italic">
                    <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                    <span>
                      Naghahanap sa DA Region II Corn Knowledge Base...
                    </span>
                  </div>
                )}
              </div>
              <form
                onSubmit={handleSendChat}
                className="flex gap-2 pt-2 border-t"
              >
                <input
                  type="text"
                  value={chatPrompt}
                  onChange={(e) => setChatPrompt(e.target.value)}
                  placeholder="Itanong ukol sa abono, peste, o ani..."
                  className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none"
                />
                <button
                  type="submit"
                  disabled={chatLoading}
                  className="h-10 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Ipadala</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 5. Disaster Modal */}
        {activeModal === "disaster" && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="w-full max-w-lg bg-white rounded-t-4xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-800">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">
                      Ulat ng Pinsala (Disaster Claim)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Para sa insurance at tulong-pinansyal ng DA/LGU
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSaveDisaster} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Uri ng Kalamidad
                  </label>
                  <select
                    value={disasterType}
                    onChange={(e) => setDisasterType(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-sm font-semibold text-slate-900"
                  >
                    <option value="TYPHOON">Bagyo (Typhoon)</option>
                    <option value="FLOOD">Baha (Flood)</option>
                    <option value="DROUGHT">Tagtuyot (Drought)</option>
                    <option value="PEST_OUTBREAK">
                      Peste / Fall Armyworm Outbreak
                    </option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Porsyento ng Pinsala (%)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={disasterDmg}
                      onChange={(e) => setDisasterDmg(e.target.value)}
                      required
                      placeholder="Hal. 65"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-sm font-semibold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tinatayang Lugi (PHP)
                    </label>
                    <input
                      type="number"
                      value={disasterLoss}
                      onChange={(e) => setDisasterLoss(e.target.value)}
                      required
                      placeholder="Hal. 84000"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-sm font-semibold text-slate-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Paliwanag / Mga Detalye
                  </label>
                  <textarea
                    rows={3}
                    value={disasterNotes}
                    onChange={(e) => setDisasterNotes(e.target.value)}
                    required
                    placeholder="Ilarawan ang nangyari sa inyong sakahan..."
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-xs font-medium text-slate-900"
                  />
                </div>
                <button
                  type="submit"
                  disabled={disasterLoading}
                  className="w-full h-12 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm shadow-md cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {disasterLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />{" "}
                      Isinusumite...
                    </>
                  ) : (
                    "I-submit ang Ulat ng Kalamidad"
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 6. Offline Queue Modal */}
        {activeModal === "queue" && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="w-full max-w-lg bg-white rounded-t-4xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">
                      Offline Storage Queue
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Mga ulat na nakatabi habang walang cellular signal
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {queueCount === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  Walang nakapilang ulat. Lahat ng datos ay naka-sync na sa DA
                  server!
                </div>
              ) : (
                <div className="space-y-2">
                  {queue.map((q) => {
                    const payload = (q.payload || {}) as Record<
                      string,
                      unknown
                    >;
                    const label = q.displayTitle || q.actionType;
                    const sub =
                      q.actionType === "CREATE_CROP_ACTIVITY"
                        ? (payload["activityType"] as string) || ""
                        : q.actionType === "CREATE_DISASTER_REPORT"
                          ? `${payload["damagePercentage"] || 0}% pinsala`
                          : (payload["severity"] as string) || "";
                    return (
                      <div
                        key={q.clientRefId}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex justify-between items-center text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-900">{label}</p>
                          {sub && (
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {sub}
                            </p>
                          )}
                        </div>
                        <span className="rounded-md bg-amber-100 text-amber-900 font-extrabold text-[10px] px-2 py-0.5">
                          Waiting Sync
                        </span>
                      </div>
                    );
                  })}
                  <button
                    onClick={handleSyncNow}
                    disabled={syncing}
                    className="w-full mt-3 h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-amber-950 font-black text-sm flex items-center justify-center gap-2 shadow cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`}
                    />
                    <span>
                      {syncing
                        ? "Isini-sync..."
                        : "I-sync Lahat sa PostgreSQL Database"}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 7. Profile / Account Menu Modal */}
        {activeModal === "profile" && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="w-full max-w-md bg-white rounded-t-4xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-800">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">
                      Account
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Pamahalaan ang iyong profile at settings
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Farmer Info */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-black text-xl">
                    {farmerName
                      ? farmerName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                      : "TM"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 truncate">
                      {farmerName || "Magsasaka"}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Magsasaka • DA Region II
                    </p>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="space-y-1">
                <a
                  href="/farmer/farms"
                  onClick={() => setActiveModal(null)}
                  className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-[0.98] transition-all cursor-pointer touch-manipulation"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                    <Tractor className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-slate-900">Mga Sakahan</p>
                    <p className="text-xs text-slate-500">
                      Kelola ang mga sakahan at pananim
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </a>

                <button
                  type="button"
                  onClick={() => {
                    setActiveModal("queue");
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-[0.98] transition-all cursor-pointer touch-manipulation text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-slate-900">
                      Offline Sync Queue
                    </p>
                    <p className="text-xs text-slate-500">
                      {queueCount > 0
                        ? `${queueCount} rekord na nakatabi`
                        : "Lahat naka-sync na"}
                    </p>
                  </div>
                  {queueCount > 0 && (
                    <span className="w-6 h-6 rounded-full bg-amber-500 text-amber-950 font-black text-[10px] flex items-center justify-center">
                      {queueCount > 9 ? "9+" : queueCount}
                    </span>
                  )}
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmLogout(true)}
                  className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl bg-red-50 hover:bg-red-100 active:scale-[0.98] transition-all cursor-pointer touch-manipulation text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                    <LogOut className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-red-700">Mag-logout</p>
                    <p className="text-xs text-red-500">
                      Kakailanganin mong mag-login muli
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-red-400" />
                </button>
              </div>

              {/* App Version */}
              <p className="text-center text-[10px] text-slate-400 pt-2 border-t border-slate-100">
                TarabayMais v1.0.0 • DA Region II
              </p>
            </div>
          </div>
        )}

        {/* ── LOGOUT CONFIRMATION ──────────────────────────────────────────── */}
        {confirmLogout && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                  <LogOut className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Mag-logout?
                  </h3>
                  <p className="text-sm font-medium text-slate-500">
                    Kakailanganin mong mag-login muli.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-red-600 text-base font-black text-white transition-colors hover:bg-red-700 disabled:opacity-60"
                >
                  <LogOut className="h-5 w-5" />
                  {loggingOut ? "Nilalabas..." : "Oo, mag-logout"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmLogout(false)}
                  disabled={loggingOut}
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-100 text-base font-bold text-slate-600 transition-colors hover:bg-slate-200"
                >
                  Huwag na
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FarmerDashboardPage;
