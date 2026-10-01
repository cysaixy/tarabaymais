import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronLeft,
  RefreshCw,
  Database,
  Wifi,
  WifiOff,
  Clock,
  ClipboardCheck,
  Home,
  Scan,
  MessageSquare,
  AlertTriangle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import {
  getOfflineQueue,
  clearOfflineQueue,
  sendBatchSync,
  type SyncActionItem,
} from "../../services/sync.service";
import { listActivities, type CropActivity } from "../../services/activity.service";
import { listObservations, type ObservationRecord } from "../../services/observation.service";
import { getCasePipeline, type CasePipelineData } from "../../services/case.service";
import { useFarmContext } from "../../hooks/useFarmContext";

interface HistoryItem {
  id: string;
  title: string;
  category: "Fertilizer" | "Pest Control" | "Irrigation" | "Observation" | "Disaster" | "Other";
  date: string;
  description: string;
  detailHighlight?: string;
  status: "Synced" | "Pending";
  clientRefId?: string;
  iconType?: "activity" | "observation" | "disaster" | "expert";
}

export const FarmerHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const farmCtx = useFarmContext();

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [filterTab, setFilterTab] = useState<"ALL" | "SYNCED" | "PENDING">("ALL");
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<HistoryItem[]>([]);

  const loadRecords = useCallback(async () => {
    setLoading(true);

    // 1. Get offline queued items
    const queue = getOfflineQueue();
    const pendingItems: HistoryItem[] = queue.map((q: SyncActionItem) => {
      const payload = (q.payload || {}) as Record<string, unknown>;
      const rawDate =
        (payload["performedAt"] as string) ||
        q.clientTimestamp ||
        new Date().toISOString();
      const dateStr = rawDate.split("T")[0];

      let title = q.displayTitle || "Offline Tala";
      let detailHighlight = "";
      let description =
        (payload["description"] as string) || "Nakatabi sa offline queue";
      let category: HistoryItem["category"] = "Other";
      let iconType: HistoryItem["iconType"] = "activity";

      if (q.actionType === "CREATE_CROP_ACTIVITY") {
        const actType = (payload["activityType"] as string) || "Gawain";
        title = `${actType.charAt(0).toUpperCase() + actType.slice(1).toLowerCase()} (Gawain)`;
        if (description.includes("—")) {
          const parts = description.split("—");
          detailHighlight = parts[0]?.trim() || "";
          description = parts[1]?.trim() || description;
        }
        if (actType === "FERTILIZER") category = "Fertilizer";
        else if (actType === "PEST_CONTROL") category = "Pest Control";
        else if (actType === "IRRIGATION") category = "Irrigation";
        iconType = "activity";
      } else if (q.actionType === "CREATE_DISASTER_REPORT") {
        title = `Disaster Claim: ${(payload["disasterType"] as string) || "Pinsala"}`;
        detailHighlight = `${payload["damagePercentage"] || 0}% Pinsala`;
        description = (payload["notes"] as string) || "Ulat ng pinsala sa sakahan";
        category = "Disaster";
        iconType = "disaster";
      } else if (q.actionType === "CREATE_OBSERVATION") {
        title = (payload["title"] as string) || "Plant Health Observation";
        detailHighlight = `${(payload["severity"] as string) || "Normal"} severity`;
        description = (payload["description"] as string) || description;
        category = "Observation";
        iconType = "observation";
      }

      return {
        id: q.clientRefId,
        title,
        category,
        date: dateStr,
        description,
        detailHighlight,
        status: "Pending" as const,
        clientRefId: q.clientRefId,
        iconType,
      };
    });

    // 2. Fetch live synced data from backend
    let backendItems: HistoryItem[] = [];
    try {
      const [activities, observations, pipeline] = await Promise.allSettled([
        listActivities(farmCtx.cropCycleId || undefined),
        listObservations(farmCtx.cropCycleId || undefined),
        getCasePipeline(),
      ]);

      if (activities.status === "fulfilled" && Array.isArray(activities.value)) {
        activities.value.forEach((act: CropActivity) => {
          let category: HistoryItem["category"] = "Other";
          if (act.activityType === "FERTILIZER") category = "Fertilizer";
          else if (act.activityType === "PEST_CONTROL") category = "Pest Control";
          else if (act.activityType === "IRRIGATION") category = "Irrigation";

          backendItems.push({
            id: `act-${act.id}`,
            title: `${act.activityType} — Gawain`,
            category,
            date: (act.performedAt || act.createdAt || "").split("T")[0],
            description: act.description,
            detailHighlight: act.costAmount
              ? `Gastos: ₱${Number(act.costAmount).toLocaleString()}`
              : undefined,
            status: "Synced",
            iconType: "activity",
          });
        });
      }

      if (observations.status === "fulfilled" && Array.isArray(observations.value)) {
        observations.value.forEach((obs: ObservationRecord) => {
          backendItems.push({
            id: `obs-${obs.id}`,
            title: obs.title,
            category: "Observation",
            date: (obs.createdAt || "").split("T")[0],
            description: obs.description,
            detailHighlight: `${obs.severity} Severity`,
            status: "Synced",
            iconType: "observation",
          });
        });
      }

      if (pipeline.status === "fulfilled" && pipeline.value) {
        const pipe = pipeline.value as CasePipelineData;
        (pipe.disasterCases || []).forEach((dc) => {
          backendItems.push({
            id: `dis-${dc.id}`,
            title: `Disaster Claim: ${dc.disasterType}`,
            category: "Disaster",
            date: (dc.createdAt || "").split("T")[0],
            description: dc.notes || "Ulat ng pinsala sa sakahan",
            detailHighlight: `${dc.damagePercentage}% Pinsala • Status: ${dc.status}`,
            status: "Synced",
            iconType: "disaster",
          });
        });

        (pipe.expertCases || []).forEach((ec) => {
          backendItems.push({
            id: `exp-${ec.id}`,
            title: `Konsultasyon: ${ec.observation?.title || "Tulong sa Taniman"}`,
            category: "Observation",
            date: new Date().toISOString().split("T")[0],
            description: ec.recommendation
              ? `Payo ng DA: ${ec.recommendation}`
              : ec.observation?.description || "Nakabinbin sa technician",
            detailHighlight: `Status: ${ec.status}`,
            status: "Synced",
            iconType: "expert",
          });
        });
      }
    } catch (err) {
      console.warn("Backend records could not be fetched (offline or auth pending):", err);
    }

    // Sort: Pending first, then by date descending
    const combined = [
      ...pendingItems,
      ...backendItems.sort((a, b) => b.date.localeCompare(a.date)),
    ];

    setRecords(combined);
    setLoading(false);
  }, [farmCtx.cropCycleId]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("May koneksyon na sa internet!", {
        description: "Maaari mo nang i-sync ang mga nakabinbing rekord.",
      });
      void loadRecords();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.info("Nawalan ng koneksyon sa internet", {
        description: "Ang mga bagong tala ay itatago sa telepono.",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    void loadRecords();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [loadRecords]);

  const pendingCount = records.filter((r) => r.status === "Pending").length;
  const syncedCount = records.filter((r) => r.status === "Synced").length;
  const totalCount = records.length;

  const handleSyncNow = async () => {
    if (pendingCount === 0) {
      toast.info("Lahat ay naka-sync na!", {
        description: "Walang pending records sa iyong telepono.",
      });
      return;
    }

    if (!navigator.onLine) {
      toast.error("Walang koneksyon sa internet!", {
        description:
          "Hindi pa maipapadala ang mga rekord. Mananatili itong ligtas sa telepono hanggang magkaroon ng signal.",
      });
      return;
    }

    setSyncing(true);
    const toastId = toast.loading("Isini-sync ang mga rekord sa DA Server...");

    try {
      const queue = getOfflineQueue();
      if (queue.length > 0) {
        await sendBatchSync(queue);
        clearOfflineQueue();
      }

      await loadRecords();

      toast.success("Matagumpay na nai-sync sa PostgreSQL Server!", {
        id: toastId,
        description: `${pendingCount} rekord ang nai-record sa DA Database.`,
      });
    } catch {
      toast.error("Hindi matapos ang pag-sync", {
        id: toastId,
        description:
          "Nagkaroon ng problema sa network. Nakatago pa rin ang mga tala sa telepono.",
      });
    } finally {
      setSyncing(false);
    }
  };

  const displayedRecords =
    filterTab === "PENDING"
      ? records.filter((r) => r.status === "Pending")
      : filterTab === "SYNCED"
      ? records.filter((r) => r.status === "Synced")
      : records;

  const locationLabel = farmCtx.municipality
    ? `${farmCtx.municipality}, Cagayan • ${farmCtx.farmName || "Corn Field"}`
    : "Cagayan • Corn Field";

  return (
    <div className="w-full min-h-screen bg-slate-100 md:bg-slate-950 flex flex-col items-center justify-start p-0 md:py-6 md:px-4 font-sans selection:bg-emerald-500/30">
      <div className="w-full md:max-w-md lg:max-w-lg bg-slate-50 text-slate-900 shadow-2xl flex flex-col h-[100dvh] md:h-[92vh] md:max-h-[920px] overflow-hidden md:rounded-[36px] md:border-2 md:border-emerald-800/40 relative">

        {/* TOP HEADER */}
        <header className="w-full bg-[#03543f] text-white px-4 sm:px-6 pt-4 pb-3 flex justify-between items-center shadow-md shrink-0 z-20">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate("/farmer")}
              className="w-10 h-10 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 border border-emerald-500/30 flex items-center justify-center text-white active:scale-95 transition cursor-pointer"
              title="Bumalik sa Dashboard"
            >
              <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight">
                Kasaysayan at Offline Queue
              </h1>
              <p className="text-[11px] sm:text-xs text-emerald-200/90 font-medium">
                {locationLabel}
              </p>
            </div>
          </div>

          <button
            onClick={() => setFilterTab("PENDING")}
            type="button"
            className="bg-[#f59e0b] hover:bg-[#d97706] active:scale-95 text-amber-950 font-black text-xs px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{pendingCount} Queue</span>
          </button>
        </header>

        {/* MAIN SCROLLABLE CONTENT */}
        <main className="flex-1 p-4 sm:p-5 space-y-4 overflow-y-auto">

          {/* Sync Card */}
          <div className="w-full bg-[#0b1329] text-white rounded-3xl p-5 shadow-xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-emerald-400 stroke-[2.2]" />
                <h2 className="text-sm font-bold tracking-tight text-white">
                  Local Queue at PostgreSQL Sync
                </h2>
              </div>

              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition ${
                  isOnline
                    ? "bg-emerald-950/80 text-emerald-300 border-emerald-600/50"
                    : "bg-amber-950/80 text-amber-300 border-amber-600/50"
                }`}
              >
                {isOnline ? (
                  <>
                    <Wifi className="w-3 h-3 text-emerald-400" />
                    <span>Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 text-amber-400" />
                    <span>Offline</span>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-slate-800 bg-[#070d1e] rounded-2xl p-4 border border-slate-800/80">
              <div className="text-center pr-2">
                <p className="text-2xl sm:text-3xl font-black text-amber-400">
                  {pendingCount}
                </p>
                <p className="text-[10px] sm:text-[11px] text-slate-300 font-medium mt-0.5 leading-snug">
                  Pending Sync sa Phone
                </p>
              </div>
              <div className="text-center pl-2">
                <p className="text-2xl sm:text-3xl font-black text-emerald-400">
                  {syncedCount}
                </p>
                <p className="text-[10px] sm:text-[11px] text-slate-300 font-medium mt-0.5 leading-snug">
                  Naka-save sa PostgreSQL Server
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSyncNow}
              disabled={syncing || pendingCount === 0}
              className={`w-full h-12 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-[0.99] cursor-pointer shadow-md ${
                pendingCount > 0
                  ? "bg-[#059669] hover:bg-[#047857] text-white"
                  : "bg-slate-800 text-slate-400 cursor-not-allowed"
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              <span>
                {syncing
                  ? "Kasalukuyang isini-sync..."
                  : pendingCount > 0
                  ? `I-sync ang ${pendingCount} na Rekord Ngayon`
                  : "Lahat ay Naka-sync Na"}
              </span>
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 pt-1 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setFilterTab("ALL")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition active:scale-95 cursor-pointer whitespace-nowrap ${
                filterTab === "ALL"
                  ? "bg-[#03543f] text-white shadow-sm"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              Lahat ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("SYNCED")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition active:scale-95 cursor-pointer whitespace-nowrap ${
                filterTab === "SYNCED"
                  ? "bg-[#03543f] text-white shadow-sm"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              Naka-sync ({syncedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("PENDING")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition active:scale-95 cursor-pointer whitespace-nowrap ${
                filterTab === "PENDING"
                  ? "bg-[#03543f] text-white shadow-sm"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              Pending ({pendingCount})
            </button>
          </div>

          <div className="pt-2">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
              MGA NA-RECORD NA GAWAIN AT PAGSUSURI
            </h3>
          </div>

          {pendingCount > 0 && filterTab !== "SYNCED" && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-3.5 flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-amber-950">
                  May {pendingCount} item sa offline queue
                </p>
                <p className="text-[11px] text-amber-900/90 leading-relaxed">
                  Nakatabi nang ligtas sa telepono. Awtomatikong maipapadala o pindutin ang "I-sync Ngayon" kapag may signal.
                </p>
              </div>
            </div>
          )}

          {/* Record List */}
          <div className="space-y-3 pb-6">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                <span>Kinukuha ang kasaysayan mula sa server...</span>
              </div>
            ) : displayedRecords.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center border border-slate-200/80 space-y-1">
                <p className="text-xs font-bold text-slate-600">
                  Walang nakitang rekord.
                </p>
                <p className="text-[11px] text-slate-400">
                  {filterTab === "PENDING"
                    ? "Walang pending na tala sa offline queue."
                    : "Magtala ng mga gawain o obserbasyon sa inyong sakahan."}
                </p>
              </div>
            ) : (
              displayedRecords.map((item) => {
                const isPending = item.status === "Pending";
                let iconBg = "bg-emerald-100 text-emerald-700";
                let IconComponent = ClipboardCheck;

                if (item.iconType === "observation") {
                  iconBg = "bg-amber-100 text-amber-700";
                  IconComponent = AlertTriangle;
                } else if (item.iconType === "disaster") {
                  iconBg = "bg-rose-100 text-rose-700";
                  IconComponent = AlertTriangle;
                } else if (item.iconType === "expert") {
                  iconBg = "bg-blue-100 text-blue-700";
                  IconComponent = CheckCircle2;
                }

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-start gap-3.5 hover:border-slate-300 transition"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${iconBg}`}>
                      <IconComponent className="w-5 h-5 stroke-[2.2]" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {item.title}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">
                            {item.date}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            isPending
                              ? "bg-amber-100 text-amber-900 border border-amber-300/60"
                              : "bg-emerald-100 text-emerald-800 border border-emerald-300/60"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 leading-snug">
                        {item.description}
                      </p>

                      {item.detailHighlight && (
                        <p className="text-xs font-bold text-emerald-800 leading-snug pt-0.5">
                          {item.detailHighlight}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>

        {/* BOTTOM NAVIGATION */}
        <nav className="shrink-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 pt-2 pb-3.5 md:py-2 flex justify-around items-center z-30 shadow-lg">
          <button
            type="button"
            onClick={() => navigate("/farmer")}
            className="flex flex-col items-center justify-center min-h-[48px] gap-1 px-3 py-1 text-slate-500 hover:text-emerald-700 font-medium text-[11px] transition cursor-pointer"
          >
            <Home className="w-5 h-5 stroke-[2]" />
            <span>Tahanan</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/farmer/scanner")}
            className="flex flex-col items-center justify-center min-h-[48px] gap-1 px-3 py-1 text-slate-500 hover:text-emerald-700 font-medium text-[11px] transition cursor-pointer"
          >
            <Scan className="w-5 h-5 stroke-[2]" />
            <span>Scanner</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/farmer/chat")}
            className="flex flex-col items-center justify-center min-h-[48px] gap-1 px-3 py-1 text-slate-500 hover:text-emerald-700 font-medium text-[11px] transition cursor-pointer"
          >
            <MessageSquare className="w-5 h-5 stroke-[2]" />
            <span>AI Chat</span>
          </button>

          {/* History (Active) */}
          <button
            type="button"
            onClick={() => {}}
            className="flex flex-col items-center justify-center min-h-[48px] gap-1 px-3 py-1 rounded-2xl bg-emerald-50 text-emerald-800 font-bold text-[11px] transition cursor-pointer relative"
          >
            <div className="relative">
              <Clock className="w-5 h-5 text-emerald-700 stroke-[2.4]" />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-amber-500 text-amber-950 font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </div>
            <span>History</span>
          </button>
        </nav>

      </div>
    </div>
  );
};

export default FarmerHistoryPage;
