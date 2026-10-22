/**
 * OfflineBanner — Global connection-status banner.
 *
 * Four states:
 *  A. Offline (no pending)        → amber, "Naka-offline ka. ..."
 *  B. Offline + pending queue     → amber, "Naka-offline • [X] ..."
 *  C. Online + pending queue      → emerald/green, "Balik na online! ..." + "I-sync Ngayon"
 *  D. Online & empty queue        → hidden
 *
 * Copy is in conversational Filipino per AGENTS.md. Placed at the top of the
 * layout (sticky) so it is visible on every route.
 */
import { useState } from "react";
import { WifiOff, Wifi, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { useSyncQueue } from "../hooks/useSyncQueue";
import {
  getOfflineQueue,
  sendBatchSync,
  clearOfflineQueue,
} from "../services/sync.service";

export function OfflineBanner() {
  const isOffline = useNetworkStatus();
  const { pendingCount } = useSyncQueue();
  const [syncing, setSyncing] = useState(false);
  const hasPending = pendingCount > 0;

  // State D: online & empty queue → completely hidden.
  if (!isOffline && !hasPending) return null;

  const isOnline = !isOffline;
  const isOfflineWithPending = isOffline && hasPending;
  const isOnlineWithPending = isOnline && hasPending;

  const handleSyncNow = async () => {
    if (syncing || !hasPending) return;
    if (isOffline) {
      toast.error("Walang koneksyon sa internet!", {
        description:
          "Maaari mong i-sync ang mga rekord kapag balik na ang signal.",
      });
      return;
    }
    setSyncing(true);
    const toastId = toast.loading("Isini-sync ang mga rekord sa server...");
    try {
      const queue = await getOfflineQueue();
      if (queue.length > 0) await sendBatchSync(queue);
      await clearOfflineQueue();
      toast.success("Matagumpay na nai-sync!", {
        id: toastId,
        description: "Lahat ng nakabinbing record ay naipadala na sa server.",
      });
    } catch {
      toast.error("Hindi natapos ang pag-sync.", {
        id: toastId,
        description: "Subukan muli kapag may koneksyon na.",
      });
    } finally {
      setSyncing(false);
    }
  };

  const bg = isOnlineWithPending
    ? "bg-emerald-600 border-emerald-400/70"
    : "bg-amber-600 border-amber-400/70";

  return (
    <div
      className={`sticky top-0 z-60 px-4 py-3 flex items-center justify-between gap-3 text-white font-bold text-sm shadow-lg border-b transform transition duration-300 ${bg}`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {isOnlineWithPending ? (
          <>
            <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
            <span className="text-emerald-100">
              Balik na ang online!{" "}
              <span className="font-black">{pendingCount}</span> na pagbabago
              ang hindi pa nai-sync.
            </span>
          </>
        ) : isOfflineWithPending ? (
          <>
            <WifiOff className="w-5 h-5 text-amber-300 shrink-0" />
            <span className="text-amber-100">
              Naka-offline • <span className="font-black">{pendingCount}</span>{" "}
              pagbabago ang naghihintay mag-sync.
            </span>
          </>
        ) : (
          // State A: offline, no pending
          <>
            <WifiOff className="w-5 h-5 text-amber-300 shrink-0" />
            <span className="text-amber-100">
              Naka-offline ka. Nakapagpapatuloy ka sa offline mode.
            </span>
          </>
        )}
      </div>

      {isOnlineWithPending && (
        <button
          type="button"
          onClick={handleSyncNow}
          disabled={syncing}
          aria-label="I-sync ngayon ang nakabinbing rekord"
          className="shrink-0 min-h-12 px-4 py-2 rounded-xl bg-white text-emerald-700 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          {syncing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Isini-sync...</span>
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4 text-emerald-700" />
              <span>I-sync Ngayon</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
