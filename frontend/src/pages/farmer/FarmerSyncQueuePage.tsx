/**
 * FarmerSyncQueuePage — Dedicated offline sync queue management
 * Features: View pending items, manual sync, clear queue, retry failed
 */

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronLeft,
  RefreshCw,
  Database,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Home,
  Scan,
  MessageSquare,
  History,
} from "lucide-react";
import {
  getOfflineQueue,
  clearOfflineQueue,
  sendBatchSync,
  type SyncActionItem,
} from "../../services/sync.service";

export const FarmerSyncQueuePage: React.FC = () => {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [queue, setQueue] = useState<SyncActionItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadQueue = useCallback(() => {
    const q = getOfflineQueue();
    setQueue(q);
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("May koneksyon na sa internet!", {
        description: "Maaari mo nang i-sync ang mga nakabinbing rekord.",
      });
      loadQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.info("Nawalan ng koneksyon sa internet", {
        description: "Ang mga bagong tala ay itatago sa telepono.",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [loadQueue]);

  const handleSyncNow = async () => {
    if (queue.length === 0) {
      toast.info("Lahat ay naka-sync na!", { description: "Walang pending records sa iyong telepono." });
      return;
    }
    if (!navigator.onLine) {
      toast.error("Walang koneksyon sa internet!", {
        description: "Hindi pa maipapadala ang mga rekord. Mananatili itong ligtas sa telepono hanggang magkaroon ng signal.",
      });
      return;
    }

    setSyncing(true);
    const toastId = toast.loading("Isini-sync ang mga rekord sa DA Server...");

    try {
      await sendBatchSync(queue);
      clearOfflineQueue();
      loadQueue();
      toast.success("Matagumpay na nai-sync sa PostgreSQL Server!", {
        id: toastId,
        description: `${queue.length} rekord ang nai-record sa DA Database.`,
      });
    } catch {
      toast.error("Hindi matapos ang pag-sync", {
        id: toastId,
        description: "Nagkaroon ng problema sa network. Nakatago pa rin ang mga tala sa telepono.",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleClearQueue = async () => {
    if (queue.length === 0) return;

    const confirmed = window.confirm(
      `Sigurado ka bang gusto mong alisin ang ${queue.length} nakabinbing rekord? Ito ay hindi na maibabalik.`
    );
    if (!confirmed) return;

    setClearing(true);
    try {
      clearOfflineQueue();
      loadQueue();
      toast.success("Queue na-clear", { description: "Lahat ng nakabinbing rekord ay naalis na." });
    } catch {
      toast.error("Hindi na-clear ang queue", { description: "Subukan muli." });
    } finally {
      setClearing(false);
    }
  };

  const formatActionType = (type: string) => {
    switch (type) {
      case "CREATE_CROP_ACTIVITY": return "Gawain sa Pananim";
      case "CREATE_OBSERVATION": return "Obserbasyon sa Halaman";
      case "CREATE_DISASTER_REPORT": return "Ulat ng Kalamidad";
      default: return type;
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case "CREATE_CROP_ACTIVITY": return <RefreshCw className="w-4 h-4" />;
      case "CREATE_OBSERVATION": return <AlertTriangle className="w-4 h-4" />;
      case "CREATE_DISASTER_REPORT": return <AlertTriangle className="w-4 h-4" />;
      default: return <Database className="w-4 h-4" />;
    }
  };

  const pendingCount = queue.length;

  return (
    <div className="w-full min-h-screen bg-slate-100 md:bg-slate-950 flex flex-col items-center justify-start p-0 md:p-6 lg:p-8 font-sans selection:bg-emerald-500/30">
      <div className="w-full md:max-w-3xl bg-slate-50 text-slate-900 shadow-2xl flex flex-col h-[100dvh] md:h-[92vh] md:max-h-[920px] overflow-hidden md:rounded-[36px] md:border-2 md:border-emerald-800/40 relative">

        {/* Header */}
        <header className="w-full bg-[#03543f] text-white px-4 sm:px-6 pt-4 pb-3 flex justify-between items-center shadow-md shrink-0 z-20">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate("/farmer/history")}
              className="w-10 h-10 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 border border-emerald-500/30 flex items-center justify-center text-white active:scale-95 transition cursor-pointer"
              title="Bumalik sa History Hub"
            >
              <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight">
                Offline Sync Queue
              </h1>
              <p className="text-[11px] sm:text-xs text-emerald-200/90 font-medium">
                Mga rekord na nakatabi habang offline
              </p>
            </div>
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
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-amber-400" />
                <span>Offline</span>
              </>
            )}
          </div>
        </header>

        {/* Main Content */}
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
                  {pendingCount > 0 ? "..." : "0"}
                </p>
                <p className="text-[10px] sm:text-[11px] text-slate-300 font-medium mt-0.5 leading-snug">
                  Naka-save sa Server
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSyncNow}
              disabled={syncing || pendingCount === 0 || !isOnline}
              className={`w-full h-12 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-[0.99] cursor-pointer shadow-md ${
                pendingCount > 0 && isOnline
                  ? "bg-[#059669] hover:bg-[#047857] text-white"
                  : "bg-slate-800 text-slate-400 cursor-not-allowed"
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              <span>
                {syncing
                  ? "Kasalukuyang isini-sync..."
                  : pendingCount > 0 && isOnline
                  ? `I-sync ang ${pendingCount} na Rekord Ngayon`
                  : pendingCount > 0
                  ? "Kailangan ng koneksyon para i-sync"
                  : "Lahat ay Naka-sync Na"}
              </span>
            </button>

            {pendingCount > 0 && (
              <button
                type="button"
                onClick={handleClearQueue}
                disabled={clearing}
                className="w-full h-10 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 font-bold text-xs flex items-center justify-center gap-2 border border-rose-600/30 transition disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{clearing ? "Nino-clear..." : "Alisin ang Lahat sa Queue"}</span>
              </button>
            )}
          </div>

          {/* Queue Items */}
          <div className="pt-2">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
              MGA NAKABINBING RECORD ({pendingCount})
            </h3>
          </div>

          {pendingCount === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/80 space-y-2">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
              <p className="text-xs font-bold text-slate-600">Walang pending na rekord</p>
              <p className="text-[11px] text-slate-400">Lahat ng datos ay naka-sync na sa DA Server</p>
            </div>
          ) : (
            <div className="space-y-3 pb-6">
              {queue.map((q) => {
                const payload = (q.payload || {}) as Record<string, unknown>;
                const expanded = expandedId === q.clientRefId;
                return (
                  <div
                    key={q.clientRefId}
                    className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden hover:border-slate-300 transition"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : q.clientRefId)}
                      className="w-full p-4 flex justify-between items-start gap-2 text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                          {getActionIcon(q.actionType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                              {q.displayTitle || formatActionType(q.actionType)}
                            </h4>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {q.clientTimestamp ? new Date(q.clientTimestamp).toLocaleString("fil-PH") : "Walang timestamp"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="rounded-full bg-amber-100 text-amber-900 font-extrabold text-[10px] px-2 py-0.5 border border-amber-300/60">
                          Pending
                        </span>
                        <ChevronLeft className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
                      </div>
                    </button>

                    {expanded && (
                      <div className="px-4 pb-4 border-t border-slate-100/70 pt-3 bg-slate-50/50">
                        <div className="space-y-2 text-xs text-slate-600">
                          <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                            <p className="font-bold text-slate-900">Action Type</p>
                            <p className="text-slate-700">{q.actionType}</p>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                            <p className="font-bold text-slate-900">Client Ref ID</p>
                            <p className="font-mono text-slate-700 break-all">{q.clientRefId}</p>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                            <p className="font-bold text-slate-900">Payload</p>
                            <pre className="text-[9px] text-slate-700 mt-1 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(payload, null, 2)}</pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </main>

        {/* Bottom Nav */}
        <nav className="shrink-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 pt-2 pb-3.5 md:py-2 flex justify-around items-center z-30 shadow-lg">
          <button onClick={() => navigate("/farmer")} className="flex flex-col items-center justify-center min-h-[48px] gap-1 px-3 py-1 text-slate-500 hover:text-emerald-700 font-medium text-[11px] transition cursor-pointer"><Home className="w-5 h-5 stroke-[2]" /><span>Tahanan</span></button>
          <button onClick={() => navigate("/farmer/scanner")} className="flex flex-col items-center justify-center min-h-[48px] gap-1 px-3 py-1 text-slate-500 hover:text-emerald-700 font-medium text-[11px] transition cursor-pointer"><Scan className="w-5 h-5 stroke-[2]" /><span>Scanner</span></button>
          <button onClick={() => navigate("/farmer/chat")} className="flex flex-col items-center justify-center min-h-[48px] gap-1 px-3 py-1 text-slate-500 hover:text-emerald-700 font-medium text-[11px] transition cursor-pointer"><MessageSquare className="w-5 h-5 stroke-[2]" /><span>AI Chat</span></button>
          <button onClick={() => navigate("/farmer/history")} className="flex flex-col items-center justify-center min-h-[48px] gap-1 px-3 py-1 rounded-2xl bg-emerald-50 text-emerald-800 font-bold text-[11px] transition cursor-pointer relative"><History className="w-5 h-5 text-emerald-700 stroke-[2.4]" /><span>History</span></button>
        </nav>

      </div>
    </div>
  );
};

export default FarmerSyncQueuePage;