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
  Home,
  MessageSquare,
  Clock,
  X,
  Send,
  Calendar,
  Loader2,
} from "lucide-react";
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
import {
  createDisasterReport,
} from "../../services/case.service";
import {
  getOfflineQueue,
  queueOfflineAction,
  clearOfflineQueue,
  sendBatchSync,
} from "../../services/sync.service";
import { getActiveCropCycle } from "../../services/farm.service";
import { useAuth } from "../../context/authContext";

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
 * Maps a DAP value to a Tagalog growth-stage label and 0-4 progress index.
 */
const resolveGrowthStage = (
  dap: number
): { label: string; stageIndex: number } => {
  if (dap < 15) return { label: "Seedling Stage (DAP 0-14)", stageIndex: 0 };
  if (dap < 46) return { label: "Vegetative Stage (V-Stage)", stageIndex: 1 };
  if (dap < 61) return { label: "Tasseling / Silking Stage", stageIndex: 2 };
  if (dap < 91) return { label: "Grain Filling Stage", stageIndex: 3 };
  return { label: "Maturity / Harvest Stage", stageIndex: 4 };
};

// ─── Component ──────────────────────────────────────────────────────────────

export const FarmerDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();

  // ── Farm Context (resolved from API) ──────────────────────────────────────
  const [farmContextLoading, setFarmContextLoading] = useState(true);
  const [farmContext, setFarmContext] = useState<{
    farmName: string;
    municipality: string;
    barangay: string;
    variety: string;
    areaHectares: number;
    ownership: string;
    cropCycleId: string;
    farmId: string;
    dap: number | null;
    plantingDate: string;
  } | null>(null);

  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const [activeModal, setActiveModal] = useState<
    | "scanner"
    | "activity"
    | "observation"
    | "chat"
    | "expert"
    | "disaster"
    | "queue"
    | null
  >(null);

  // ── Bootstrap: resolve active crop cycle from API ────────────────────────
  useEffect(() => {
    const bootstrap = async () => {
      setFarmContextLoading(true);
      try {
        const active = await getActiveCropCycle();
        if (active) {
          const { cropCycle, farm } = active;
          const dap = computeDAP(cropCycle.plantingDate);
          setFarmContext({
            farmName: farm.name,
            municipality: farm.municipality,
            barangay: farm.barangay,
            variety: cropCycle.variety || cropCycle.cropType || "Mais",
            areaHectares: Number(farm.areaHectares),
            ownership: "",
            cropCycleId: cropCycle.id,
            farmId: farm.id,
            dap,
            plantingDate: cropCycle.plantingDate,
          });
        }
      } catch {
        toast.error("Hindi makuha ang impormasyon ng sakahan.", {
          description: "Subukan muli o i-check ang koneksyon.",
        });
      } finally {
        setFarmContextLoading(false);
      }
    };

    bootstrap();

    // Load offline queue count
    const q = getOfflineQueue();
    setQueueCount(q.length);
  }, []);

  // ── Farmer display name from auth context ────────────────────────────────
  const farmerName = profile
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : "";

  // ── Sync ─────────────────────────────────────────────────────────────────
  const handleSyncNow = async () => {
    setSyncing(true);
    const queue = getOfflineQueue();

    try {
      if (queue.length > 0) {
        await sendBatchSync(queue);
      }
      clearOfflineQueue();
      setQueueCount(0);
      toast.success("Matagumpay na Na-sync!", {
        description:
          "Lahat ng nakatagong ulat ay naipadala na sa PostgreSQL database.",
      });
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
    } catch {
      queueOfflineAction({
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
    } catch {
      queueOfflineAction({
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
  const [scanResult, setScanResult] = useState<ScanDiagnosisResult | null>(null);

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
        farmContext?.cropCycleId ?? undefined
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
    } catch {
      queueOfflineAction({
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
  const growthStage =
    dap !== null ? resolveGrowthStage(dap) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full min-h-screen bg-slate-100 md:bg-slate-950 flex flex-col items-center justify-start p-0 md:p-6 lg:p-8 font-sans selection:bg-emerald-500/30 pb-20 md:pb-8">
      <div className="w-full md:max-w-5xl lg:max-w-6xl xl:max-w-7xl bg-slate-50 text-slate-900 shadow-2xl flex flex-col justify-between overflow-x-hidden md:rounded-[36px] md:border-2 md:border-emerald-800/40 min-h-screen relative">

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <header className="w-full bg-[#03543f] text-white px-5 sm:px-8 pt-5 pb-4 flex justify-between items-center shadow-md border-b border-emerald-700/30">
          <div>
            <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white leading-tight">
              Tahanan ng Magsasaka
            </h1>
            <p className="text-xs sm:text-sm text-emerald-200/90 font-medium mt-0.5">
              {farmContext
                ? `${farmContext.municipality}, Cagayan • Corn Field`
                : "Cagayan • Corn Field"}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-emerald-950/60 border border-emerald-400/30 px-3.5 py-1 text-xs font-semibold text-emerald-200">
              🏛️ DA Region II Connected
            </span>
            <button
              onClick={() => setActiveModal("queue")}
              type="button"
              className="bg-[#f59e0b] hover:bg-[#d97706] active:scale-95 text-amber-950 font-black text-xs sm:text-sm px-4 py-2 rounded-full flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              <span>{queueCount} Queue</span>
            </button>
          </div>
        </header>

        {/* ── DASHBOARD BODY ───────────────────────────────────────────────── */}
        <main className="p-4 sm:p-6 lg:p-8 flex-1 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">

            {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
            <div className="lg:col-span-5 space-y-4 sm:space-y-5">

              {/* Farm Profile Card */}
              <div className="w-full bg-linear-to-br from-[#023326] via-[#034433] to-[#04281f] text-white rounded-3xl p-5 sm:p-6 shadow-lg border border-emerald-500/20 relative overflow-hidden">
                {farmContextLoading ? (
                  <div className="flex items-center gap-3 py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                    <span className="text-sm text-emerald-200">Kinukuha ang impormasyon ng sakahan...</span>
                  </div>
                ) : farmContext ? (
                  <>
                    <div className="flex justify-between items-start">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/60 border border-emerald-400/40 px-3 py-1 text-[11px] font-semibold text-emerald-200">
                        🌱 {farmContext.areaHectares.toFixed(1)} Hectares
                      </span>
                      <div className="w-12 h-12 rounded-2xl bg-emerald-700/60 border border-emerald-400/30 flex items-center justify-center text-2xl shadow-inner">
                        🌽
                      </div>
                    </div>
                    <div className="mt-3">
                      <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                        {farmContext.farmName}
                      </h2>
                      {farmerName && (
                        <p className="text-xs sm:text-sm text-emerald-100 font-medium mt-1">
                          {farmerName} • {farmContext.barangay}, {farmContext.municipality}, Cagayan
                        </p>
                      )}
                      <div className="mt-2 text-xs sm:text-sm text-emerald-200/90 font-medium">
                        Bariedad: <span className="font-bold text-white">{farmContext.variety}</span>
                        {farmContext.areaHectares > 0 && (
                          <span> ({farmContext.areaHectares} ha)</span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="py-4 space-y-2">
                    <p className="text-sm font-bold text-emerald-200">Walang aktibong pananim.</p>
                    <p className="text-xs text-emerald-300/80">
                      Mag-onboard muna o magdagdag ng bagong crop cycle sa inyong sakahan.
                    </p>
                  </div>
                )}
              </div>

              {/* Crop Lifecycle Engine Card */}
              {!farmContextLoading && farmContext && dap !== null && growthStage && (
                <div className="w-full bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="rounded-full bg-emerald-100/80 px-3 py-1 text-[10px] sm:text-[11px] font-extrabold text-emerald-800 tracking-wide">
                      CROP LIFECYCLE ENGINE
                    </span>
                    <span className="rounded-full border border-emerald-400 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
                      {dap} Araw
                    </span>
                  </div>

                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
                      DAP {dap} — {growthStage.label}{" "}
                      <span className="font-normal text-xs text-slate-500">
                        mula noong tinarak ({farmContext.plantingDate})
                      </span>
                    </h3>
                  </div>

                  {/* 5-Stage Progress Bar */}
                  <div className="pt-1">
                    <div className="grid grid-cols-5 gap-1.5">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-2.5 rounded-full ${
                            i <= growthStage.stageIndex
                              ? "bg-emerald-600"
                              : "bg-slate-200"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-5 gap-1 pt-2 text-center">
                      {[
                        { label: "Seedling", range: "DAP 0-14" },
                        { label: "Vegetative", range: "DAP 15-45" },
                        { label: "Tasseling", range: "DAP 46-60" },
                        { label: "Grain Fill", range: "DAP 61-90" },
                        { label: "Harvest", range: "DAP 91+" },
                      ].map((s, i) => (
                        <div key={i}>
                          <p
                            className={`text-[10px] font-bold ${
                              i === growthStage.stageIndex
                                ? "text-emerald-700"
                                : "text-slate-500"
                            }`}
                          >
                            {s.label}
                          </p>
                          <p
                            className={`text-[9px] ${
                              i === growthStage.stageIndex
                                ? "text-emerald-600 font-semibold"
                                : "text-slate-400"
                            }`}
                          >
                            {s.range}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-black text-emerald-950">
                      <Calendar className="w-4 h-4 text-emerald-600" />
                      <span>Kasalukuyang yugto: {growthStage.label}</span>
                    </div>
                    <p className="text-xs text-emerald-900/80">
                      Suriin ang rekomendasyon ng DA para sa yugtong ito sa pamamagitan ng Kaagapay AI Chat.
                    </p>
                  </div>
                </div>
              )}
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

              {/* Action Buttons */}
              <div className="space-y-3">
                <h2 className="text-xs sm:text-sm font-black text-slate-600 tracking-wider uppercase">
                  Mga Pangunahing Aksyon
                </h2>
                <div className="grid grid-cols-2 gap-3.5 sm:gap-4">

                  {/* Suriin ang Halaman */}
                  <button
                    type="button"
                    onClick={() => navigate("/farmer/scanner")}
                    className="min-h-30 sm:min-h-33.75 rounded-3xl bg-[#047857] hover:bg-[#065f46] hover:-translate-y-0.5 active:scale-[0.98] text-white p-4 sm:p-5 flex flex-col justify-between text-left shadow-md hover:shadow-lg transition-all cursor-pointer"
                  >
                    <div className="flex justify-between items-start w-full">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-600/80 flex items-center justify-center shadow-inner">
                        <Scan className="w-5 h-5 text-white stroke-[2.4]" />
                      </div>
                      <span className="rounded-full bg-[#f59e0b] px-2.5 py-0.5 text-[9px] sm:text-[10px] font-black text-amber-950">
                        AI Camera
                      </span>
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm sm:text-base leading-tight">
                        Suriin ang Halaman
                      </h3>
                      <p className="text-[11px] sm:text-xs text-emerald-200 mt-1 font-medium">
                        AI Plant Health Scanner
                      </p>
                    </div>
                  </button>

                  {/* Mag-record ng Gawain */}
                  <button
                    type="button"
                    onClick={() => navigate("/farmer/activity")}
                    className="min-h-30 sm:min-h-33.75 rounded-3xl bg-[#2563eb] hover:bg-[#1d4ed8] hover:-translate-y-0.5 active:scale-[0.98] text-white p-4 sm:p-5 flex flex-col justify-between text-left shadow-md hover:shadow-lg transition-all cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-blue-500/80 flex items-center justify-center shadow-inner">
                      <ClipboardCheck className="w-5 h-5 text-white stroke-[2.4]" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm sm:text-base leading-tight">
                        Mag-record ng Gawain
                      </h3>
                      <p className="text-[11px] sm:text-xs text-blue-200 mt-1 font-medium">
                        Pataba / Patubig / Peste
                      </p>
                    </div>
                  </button>

                  {/* I-report ang Sintomas */}
                  <button
                    type="button"
                    onClick={() => navigate("/farmer/observation")}
                    className="min-h-30 sm:min-h-33.75 rounded-3xl bg-[#7c3aed] hover:bg-[#6d28d9] hover:-translate-y-0.5 active:scale-[0.98] text-white p-4 sm:p-5 flex flex-col justify-between text-left shadow-md hover:shadow-lg transition-all cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-purple-500/80 flex items-center justify-center shadow-inner">
                      <Camera className="w-5 h-5 text-white stroke-[2.4]" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm sm:text-base leading-tight">
                        I-report ang Sintomas
                      </h3>
                      <p className="text-[11px] sm:text-xs text-purple-200 mt-1 font-medium">
                        Kumuha ng litrato
                      </p>
                    </div>
                  </button>

                  {/* Magtanong sa AI */}
                  <button
                    type="button"
                    onClick={() => navigate("/farmer/chat")}
                    className="min-h-30 sm:min-h-33.75 rounded-3xl bg-[#0d9488] hover:bg-[#0f766e] hover:-translate-y-0.5 active:scale-[0.98] text-white p-4 sm:p-5 flex flex-col justify-between text-left shadow-md hover:shadow-lg transition-all cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-teal-500/80 flex items-center justify-center shadow-inner">
                      <Bot className="w-5 h-5 text-white stroke-[2.4]" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm sm:text-base leading-tight">
                        Magtanong sa AI
                      </h3>
                      <p className="text-[11px] sm:text-xs text-teal-200 mt-1 font-medium">
                        DA Knowledge Assistant
                      </p>
                    </div>
                  </button>

                  {/* Humingi ng Tulong */}
                  <button
                    type="button"
                    onClick={() => navigate("/farmer/expert-request")}
                    className="min-h-30 sm:min-h-33.75 rounded-3xl bg-[#c2410c] hover:bg-[#9a3412] hover:-translate-y-0.5 active:scale-[0.98] text-white p-4 sm:p-5 flex flex-col justify-between text-left shadow-md hover:shadow-lg transition-all cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-orange-600/80 flex items-center justify-center shadow-inner">
                      <UserCheck className="w-5 h-5 text-white stroke-[2.4]" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm sm:text-base leading-tight">
                        Humingi ng Tulong
                      </h3>
                      <p className="text-[11px] sm:text-xs text-orange-200 mt-1 font-medium">
                        LGU Ag Technician
                      </p>
                    </div>
                  </button>

                  {/* Ulat ng Baha/Bagyo */}
                  <button
                    type="button"
                    onClick={() => navigate("/farmer/disaster")}
                    className="min-h-30 sm:min-h-33.75 rounded-3xl bg-[#9f1239] hover:bg-[#881337] hover:-translate-y-0.5 active:scale-[0.98] text-white p-4 sm:p-5 flex flex-col justify-between text-left shadow-md hover:shadow-lg transition-all cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-rose-700/80 flex items-center justify-center shadow-inner">
                      <AlertTriangle className="w-5 h-5 text-white stroke-[2.4]" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm sm:text-base leading-tight">
                        Ulat ng Baha/Bagyo
                      </h3>
                      <p className="text-[11px] sm:text-xs text-rose-200 mt-1 font-medium">
                        Disaster Damage Claim
                      </p>
                    </div>
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
        <nav className="fixed md:sticky bottom-0 left-0 right-0 max-w-full md:max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2 flex justify-around items-center z-30 shadow-lg">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex flex-col items-center gap-1 px-3 py-1 rounded-2xl bg-emerald-50 text-emerald-800 font-bold text-[11px] transition cursor-pointer"
          >
            <Home className="w-5 h-5 text-emerald-700 stroke-[2.4]" />
            <span>Tahanan</span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/farmer/scanner")}
            className="flex flex-col items-center gap-1 px-3 py-1 text-slate-500 hover:text-emerald-700 font-medium text-[11px] transition cursor-pointer"
          >
            <Scan className="w-5 h-5 stroke-2" />
            <span>Scanner</span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/farmer/chat")}
            className="flex flex-col items-center gap-1 px-3 py-1 text-slate-500 hover:text-emerald-700 font-medium text-[11px] transition cursor-pointer"
          >
            <MessageSquare className="w-5 h-5 stroke-2" />
            <span>AI Chat</span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/farmer/history")}
            className="flex flex-col items-center gap-1 px-3 py-1 text-slate-500 hover:text-emerald-700 font-medium text-[11px] transition cursor-pointer relative"
          >
            <div className="relative">
              <Clock className="w-5 h-5 stroke-2" />
              {queueCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-amber-500 text-amber-950 font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                  {queueCount}
                </span>
              )}
            </div>
            <span>History</span>
          </button>
        </nav>

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
                    <h3 className="font-extrabold text-base text-slate-900">AI Plant Health Scanner</h3>
                    <p className="text-[11px] text-slate-500">Gemini Multimodal Leaf Disease Vision</p>
                  </div>
                </div>
                <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="border-2 border-dashed border-emerald-300 bg-emerald-50/50 rounded-2xl p-4 text-center">
                {scanPreview ? (
                  <div className="relative">
                    <img src={scanPreview} alt="Leaf Scan Preview" className="w-full h-48 object-cover rounded-xl shadow-sm" />
                    <button
                      onClick={() => { setScanFile(null); setScanPreview(null); setScanResult(null); }}
                      className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-44 cursor-pointer">
                    <Camera className="w-12 h-12 text-emerald-600 mb-2 stroke-[1.8]" />
                    <span className="font-bold text-sm text-emerald-950">Kuhanan o Pumili ng Litrato ng Dahon</span>
                    <span className="text-xs text-slate-500 mt-1">Tiyaking may magandang liwanag ang apektadong bahagi</span>
                    <input type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" />
                  </label>
                )}
              </div>

              {scanPreview && !scanResult && (
                <button
                  onClick={handleRunScan}
                  disabled={scanLoading}
                  className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-60 cursor-pointer"
                >
                  {scanLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sinusuri ng Gemini AI...</> : "Suriin ang Litrato Ngayon"}
                </button>
              )}

              {scanResult && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 space-y-2.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">AI Diagnosis</span>
                      <h4 className="text-sm font-black text-slate-900 mt-0.5">{scanResult.diseaseDetected}</h4>
                    </div>
                    {scanResult.confidence && (
                      <span className="rounded-full bg-emerald-200 text-emerald-900 font-extrabold text-[10px] px-2.5 py-0.5">
                        {Math.round(scanResult.confidence * 100)}% Kumpyansa
                      </span>
                    )}
                  </div>
                  {scanResult.recommendations && scanResult.recommendations.length > 0 && (
                    <div className="pt-2 border-t border-emerald-200/80">
                      <p className="text-[11px] font-bold text-emerald-950 mb-1">Mungkahing Lunas (DA Guides):</p>
                      <ul className="text-xs text-slate-700 space-y-1">
                        {scanResult.recommendations.map((rec, i) => <li key={i}>• {rec}</li>)}
                      </ul>
                    </div>
                  )}
                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => {
                        setObsTitle(scanResult.diseaseDetected || "AI Leaf Scan");
                        setObsDesc(scanResult.recommendations?.join("; ") || "");
                        setObsSeverity(scanResult.severity || "MEDIUM");
                        setActiveModal("observation");
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-white border border-emerald-600 font-bold text-xs text-emerald-800 shadow-sm cursor-pointer"
                    >
                      Itala bilang Obserbasyon
                    </button>
                    <button
                      onClick={() => {
                        setChatPrompt(`Paano gamutin ang ${scanResult.diseaseDetected}?`);
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
                    <h3 className="font-extrabold text-base text-slate-900">Mag-record ng Gawain sa Sakahan</h3>
                    <p className="text-[11px] text-slate-500">I-log ang pataba, patubig, o pest control</p>
                  </div>
                </div>
                <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSaveActivity} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Uri ng Gawain</label>
                  <select value={actType} onChange={(e) => setActType(e.target.value as ActivityType)} className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-sm font-semibold text-slate-900">
                    <option value="FERTILIZER">Pagpapataba (Fertilizer)</option>
                    <option value="IRRIGATION">Patubig (Irrigation)</option>
                    <option value="PEST_CONTROL">Pagkontrol sa Peste (Pest Control)</option>
                    <option value="PLANTING">Pagtatanim (Planting)</option>
                    <option value="PREPARATION">Paghahanda ng Lupa (Preparation)</option>
                    <option value="HARVEST">Pag-ani (Harvest)</option>
                    <option value="OTHER">Iba pa (Other)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Deskripsyon ng Ginawa</label>
                  <input type="text" value={actDesc} onChange={(e) => setActDesc(e.target.value)} required placeholder="Hal. Side-dress ng 2 sako ng Urea" className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-sm font-semibold text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nagastos (Halaga sa Piso)</label>
                  <input type="number" value={actCost} onChange={(e) => setActCost(e.target.value)} placeholder="0" className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-sm font-semibold text-slate-900" />
                </div>
                <button type="submit" disabled={actLoading} className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm shadow-md cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2">
                  {actLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Itinatala...</> : "I-save ang Gawain"}
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
                    <h3 className="font-extrabold text-base text-slate-900">I-report ang Sintomas / Obserbasyon</h3>
                    <p className="text-[11px] text-slate-500">Auto-escalate sa DA kapag HIGH o CRITICAL</p>
                  </div>
                </div>
                <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSaveObservation} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pamagat ng Obserbasyon</label>
                  <input type="text" value={obsTitle} onChange={(e) => setObsTitle(e.target.value)} required placeholder="Hal. Naninilaw na mga dahon sa ibaba" className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-sm font-semibold text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Antas ng Pinsala (Severity)</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as SeverityLevel[]).map((lvl) => (
                      <button key={lvl} type="button" onClick={() => setObsSeverity(lvl)} className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${obsSeverity === lvl ? lvl === "HIGH" || lvl === "CRITICAL" ? "bg-rose-600 border-rose-700 text-white" : "bg-emerald-600 border-emerald-700 text-white" : "bg-slate-50 border-slate-200 text-slate-700"}`}>
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Detalyadong Paliwanag</label>
                  <textarea rows={3} value={obsDesc} onChange={(e) => setObsDesc(e.target.value)} required placeholder="Ilarawan ang mga sintomas na nakita sa pananim..." className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-xs font-medium text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Litrato (Opsiyonal)</label>
                  <input type="file" accept="image/*" onChange={(e) => setObsFile(e.target.files?.[0] || null)} className="w-full text-xs text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-purple-100 font-medium" />
                </div>
                <button type="submit" disabled={obsLoading} className="w-full h-12 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-sm shadow-md cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2">
                  {obsLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Itinatala...</> : "I-submit ang Obserbasyon"}
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
                    <h3 className="font-extrabold text-base text-slate-900">Kaagapay AI (RAG Assistant)</h3>
                    <p className="text-[11px] text-slate-500">Grounded sa DA Region II Corn Guides</p>
                  </div>
                </div>
                <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-3 space-y-3">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${msg.role === "user" ? "bg-emerald-600 text-white rounded-br-none" : "bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200"}`}>
                      <p className="whitespace-pre-line">{msg.text}</p>
                    </div>
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {msg.sources.map((s, i) => (
                          <span key={i} className="rounded-md bg-teal-50 border border-teal-200 px-2 py-0.5 text-[9px] font-bold text-teal-700">
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
                    <span>Naghahanap sa DA Region II Corn Knowledge Base...</span>
                  </div>
                )}
              </div>
              <form onSubmit={handleSendChat} className="flex gap-2 pt-2 border-t">
                <input type="text" value={chatPrompt} onChange={(e) => setChatPrompt(e.target.value)} placeholder="Itanong ukol sa abono, peste, o ani..." className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none" />
                <button type="submit" disabled={chatLoading} className="h-10 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow cursor-pointer disabled:opacity-50">
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
                    <h3 className="font-extrabold text-base text-slate-900">Ulat ng Pinsala (Disaster Claim)</h3>
                    <p className="text-[11px] text-slate-500">Para sa insurance at tulong-pinansyal ng DA/LGU</p>
                  </div>
                </div>
                <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSaveDisaster} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Uri ng Kalamidad</label>
                  <select value={disasterType} onChange={(e) => setDisasterType(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-sm font-semibold text-slate-900">
                    <option value="TYPHOON">Bagyo (Typhoon)</option>
                    <option value="FLOOD">Baha (Flood)</option>
                    <option value="DROUGHT">Tagtuyot (Drought)</option>
                    <option value="PEST_OUTBREAK">Peste / Fall Armyworm Outbreak</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Porsyento ng Pinsala (%)</label>
                    <input type="number" min="1" max="100" value={disasterDmg} onChange={(e) => setDisasterDmg(e.target.value)} required placeholder="Hal. 65" className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-sm font-semibold text-slate-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tinatayang Lugi (PHP)</label>
                    <input type="number" value={disasterLoss} onChange={(e) => setDisasterLoss(e.target.value)} required placeholder="Hal. 84000" className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-sm font-semibold text-slate-900" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Paliwanag / Mga Detalye</label>
                  <textarea rows={3} value={disasterNotes} onChange={(e) => setDisasterNotes(e.target.value)} required placeholder="Ilarawan ang nangyari sa inyong sakahan..." className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-xs font-medium text-slate-900" />
                </div>
                <button type="submit" disabled={disasterLoading} className="w-full h-12 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm shadow-md cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2">
                  {disasterLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Isinusumite...</> : "I-submit ang Ulat ng Kalamidad"}
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
                    <h3 className="font-extrabold text-base text-slate-900">Offline Storage Queue</h3>
                    <p className="text-[11px] text-slate-500">Mga ulat na nakatabi habang walang cellular signal</p>
                  </div>
                </div>
                <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {queueCount === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  Walang nakapilang ulat. Lahat ng datos ay naka-sync na sa DA server!
                </div>
              ) : (
                <div className="space-y-2">
                  {getOfflineQueue().map((q) => {
                    const payload = (q.payload || {}) as Record<string, unknown>;
                    const label = q.displayTitle || q.actionType;
                    const sub =
                      q.actionType === "CREATE_CROP_ACTIVITY"
                        ? (payload["activityType"] as string) || ""
                        : q.actionType === "CREATE_DISASTER_REPORT"
                        ? `${payload["damagePercentage"] || 0}% pinsala`
                        : (payload["severity"] as string) || "";
                    return (
                      <div key={q.clientRefId} className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-slate-900">{label}</p>
                          {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
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
                    <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                    <span>{syncing ? "Isini-sync..." : "I-sync Lahat sa PostgreSQL Database"}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default FarmerDashboardPage;
