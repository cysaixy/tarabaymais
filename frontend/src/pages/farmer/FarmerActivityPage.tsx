import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronLeft,
  RefreshCw,
  ClipboardCheck,
  CheckCircle2,
  Calendar,
  Sparkles,
  Check,
  WifiOff,
} from "lucide-react";
import {
  createActivity,
  type ActivityType,
} from "../../services/activity.service";
import {
  getOfflineQueue,
  queueOfflineAction,
} from "../../services/sync.service";

interface FarmContext {
  cropCycleId: string;
  farmName: string;
  municipality: string;
  barangay: string;
}

const ACTIVITY_TYPES: { id: ActivityType; label: string }[] = [
  { id: "FERTILIZER", label: "Fertilizer" },
  { id: "IRRIGATION", label: "Irrigation" },
  { id: "OTHER", label: "Weeding" },
  { id: "PEST_CONTROL", label: "Pest" },
];

export const FarmerActivityPage: React.FC = () => {
  const navigate = useNavigate();

  // Active Farm Context
  const [farmData, setFarmData] = useState<FarmContext>({
    cropCycleId: "cycle-local-01",
    farmName: "Basi Corn Plantation #1",
    municipality: "Solana",
    barangay: "Basi East",
  });

  const [queueCount, setQueueCount] = useState(2);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Form Fields
  const [activityType, setActivityType] = useState<ActivityType>("FERTILIZER");
  const [performedAt, setPerformedAt] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [quantityBrand, setQuantityBrand] = useState<string>(
    "2 sako ng Urea (46-0-0)"
  );
  const [additionalDetails, setAdditionalDetails] = useState<string>(
    "Side-dress Urea sa gitna ng plot bago ang ulan."
  );

  const [submitting, setSubmitting] = useState(false);

  // Online/Offline detection and context loading
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    try {
      const savedFarm = localStorage.getItem("tarabay_active_farm");
      if (savedFarm) {
        const parsed = JSON.parse(savedFarm);
        setFarmData((prev) => ({
          ...prev,
          cropCycleId: parsed.cropCycleId || prev.cropCycleId,
          farmName: parsed.farmName || prev.farmName,
          municipality: parsed.municipality || prev.municipality,
          barangay: parsed.barangay || prev.barangay,
        }));
      }
    } catch {
      // Ignore
    }

    const q = getOfflineQueue();
    if (q.length > 0) {
      setQueueCount(q.length);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quantityBrand.trim() && !additionalDetails.trim()) {
      toast.error("Pakilagay ang dami, sako, o karagdagang detalye ng gawain.");
      return;
    }

    setSubmitting(true);
    const combinedDescription = `${quantityBrand.trim()}${
      additionalDetails.trim() ? ` — ${additionalDetails.trim()}` : ""
    }`;

    try {
      await createActivity(farmData.cropCycleId, {
        activityType,
        description: combinedDescription,
        performedAt,
      });

      toast.success("Nai-save ang Gawain!", {
        description: `Matagumpay na naitala ang ${activityType.toLowerCase()} sa record ng sakahan.`,
      });

      navigate("/farmer");
    } catch {
      // Offline fallback: Queue locally
      queueOfflineAction({
        actionType: "CREATE_CROP_ACTIVITY",
        displayTitle: `Gawain: ${activityType} (${quantityBrand.trim() || "Pagsasaka"})`,
        payload: {
          cropCycleId: farmData.cropCycleId,
          activityType,
          description: combinedDescription,
          performedAt,
        },
      });

      setQueueCount((prev) => prev + 1);

      toast.info("Nai-save sa Offline Storage (Queue)", {
        description:
          "Dahil walang cellular signal, itinago ito sa telepono. Awtomatikong mai-sync sa DA server pagbalik ng koneksyon.",
      });

      navigate("/farmer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleQueueClick = () => {
    toast.info("Offline Sync Queue", {
      description: `May ${queueCount} nakatagong tala sa telepono na handang i-sync.`,
    });
  };

  return (
    <div className="w-full min-h-screen bg-slate-100 md:bg-slate-950 flex flex-col items-center justify-start p-0 md:p-6 lg:p-8 font-sans selection:bg-blue-500/30">
      {/* Responsive Container: Mobile Viewport (412x917 edge-to-edge) vs Tablet/Desktop Card (md/lg) */}
      <div className="w-full md:max-w-md lg:max-w-lg bg-slate-50 text-slate-900 shadow-2xl flex flex-col justify-between overflow-x-hidden md:rounded-[36px] md:border-2 md:border-emerald-800/40 min-h-screen relative pb-6">
        
        {/* ========================================================= */}
        {/* 1. TOP HEADER (Deep Emerald #03543f)                      */}
        {/* ========================================================= */}
        <header className="w-full bg-[#03543f] text-white px-4 sm:px-6 pt-4 pb-3 flex justify-between items-center shadow-md shrink-0">
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
                Mag-record ng Gawain
              </h1>
              <p className="text-[11px] sm:text-xs text-emerald-200/90 font-medium">
                {farmData.municipality}, Cagayan • Corn Field
              </p>
            </div>
          </div>

          {/* Offline Queue Badge Button */}
          <button
            onClick={handleQueueClick}
            type="button"
            className="bg-[#f59e0b] hover:bg-[#d97706] active:scale-95 text-amber-950 font-black text-xs px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{queueCount} Queue</span>
          </button>
        </header>

        {/* ========================================================= */}
        {/* 2. MAIN CARD CONTENT CONTAINER                            */}
        {/* ========================================================= */}
        <main className="flex-1 p-4 sm:p-5 space-y-4 overflow-y-auto">
          <div className="w-full bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-4">
            
            {/* Card Header */}
            <div>
              <div className="flex items-center gap-2 text-[#2563eb]">
                <ClipboardCheck className="w-5 h-5 stroke-[2.4]" />
                <h2 className="text-base sm:text-lg font-black tracking-tight text-[#2563eb]">
                  Record Farm Activity
                </h2>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-snug">
                Itala ang pataba, patubig, o pagpuksa sa peste sa iyong taniman.
              </p>
            </div>

            {/* Section 1: Uri ng Gawain (Activity Type - 2x2 Grid) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                Uri ng Gawain (Activity Type)
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {ACTIVITY_TYPES.map((act) => {
                  const isSelected = activityType === act.id;
                  return (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => setActivityType(act.id)}
                      className={`h-12 rounded-2xl border px-3.5 flex items-center justify-between text-xs font-bold transition active:scale-[0.98] cursor-pointer ${
                        isSelected
                          ? "border-[#2563eb] bg-blue-50/70 text-[#1d4ed8] shadow-xs"
                          : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <span>{act.label}</span>
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-[#2563eb] text-white flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Petsa ng Isinagawang Gawain */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">
                Petsa ng Isinagawang Gawain
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={performedAt}
                  onChange={(e) => setPerformedAt(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-3 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:border-[#2563eb] transition"
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
              </div>
            </div>

            {/* Section 3: Dami, Sako, o Brand na Ginamit */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">
                Dami, Sako, o Brand na Ginamit
              </label>
              <input
                type="text"
                value={quantityBrand}
                onChange={(e) => setQuantityBrand(e.target.value)}
                placeholder="Hal. 2 sako ng Urea (46-0-0)"
                className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-3 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:border-[#2563eb] transition"
              />
            </div>

            {/* Section 4: Karagdagang Detalye */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">
                Karagdagang Detalye
              </label>
              <textarea
                rows={3}
                value={additionalDetails}
                onChange={(e) => setAdditionalDetails(e.target.value)}
                placeholder="Hal. Side-dress Urea sa gitna ng plot bago ang ulan..."
                className="w-full rounded-2xl border border-slate-300 bg-white p-3.5 text-xs font-medium text-slate-800 outline-none focus:border-[#2563eb] transition placeholder:text-slate-400 leading-relaxed resize-none"
              />
            </div>

            {/* Section 5: Sync Status Indicator Box */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3.5 flex items-center gap-2.5 text-xs text-slate-600">
              {isOnline ? (
                <>
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Ise-save agad sa online server.</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Itatabi muna sa offline queue habang mahina ang signal.</span>
                </>
              )}
            </div>

            {/* Section 6: Primary Action Button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full h-14 rounded-2xl bg-[#2563eb] hover:bg-[#1d4ed8] active:scale-[0.98] text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Isinusumite ang Gawain...</span>
                </>
              ) : (
                <>
                  <span>I-save ang Gawain</span>
                  <CheckCircle2 className="w-5 h-5 stroke-[2.4]" />
                </>
              )}
            </button>

          </div>
        </main>

      </div>
    </div>
  );
};

export default FarmerActivityPage;
