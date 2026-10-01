import React, { useState, useEffect, useCallback } from "react";
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
  Sprout,
  AlertCircle,
} from "lucide-react";
import {
  createActivity,
  type ActivityType,
} from "../../services/activity.service";
import {
  getActiveCropCycle,
  type ActiveCropCycle,
} from "../../services/farm.service";
import {
  getOfflineQueue,
  queueOfflineAction,
} from "../../services/sync.service";

/**
 * Optional category suggestions. These are *not* a restriction — the farmer
 * types their activity freely. Tapping a chip only (1) prefills a hint into the
 * text field when it's still empty and (2) locks the backend `activityType`
 * enum. If no chip is tapped, the enum is inferred from keywords (see
 * `inferActivityType`) and defaults to OTHER.
 */
const ACTIVITY_SUGGESTIONS: {
  id: ActivityType;
  label: string;
  hint: string;
}[] = [
  { id: "FERTILIZER", label: "Pataba", hint: "2 sako ng Urea (46-0-0)" },
  { id: "IRRIGATION", label: "Patubig", hint: "Patubig sa buong plot" },
  { id: "PEST_CONTROL", label: "Peste", hint: "Pag-spray laban sa peste" },
  { id: "PLANTING", label: "Pagtatanim", hint: "Pagtatanim ng binhi" },
  { id: "HARVEST", label: "Pag-ani", hint: "Pag-ani ng mais" },
  { id: "PREPARATION", label: "Paghahanda", hint: "Pag-aararo ng lupa" },
  { id: "OTHER", label: "Iba pa", hint: "" },
];

/**
 * Infers a backend `ActivityType` enum from free-typed farmer text using simple
 * Tagalog/English keyword matching. Returns `OTHER` when nothing matches, so a
 * valid enum is always sent to the API.
 */
const inferActivityType = (text: string): ActivityType => {
  const t = text.toLowerCase();
  const has = (...words: string[]) => words.some((w) => t.includes(w));

  if (has("urea", "abono", "pataba", "fertiliz", "16-20", "46-0-0", "ammon"))
    return "FERTILIZER";
  if (has("tubig", "patubig", "irrig", "dilig", "water")) return "IRRIGATION";
  if (
    has("peste", "insekto", "uod", "spray", "pestisid", "pesticide", "pest")
  )
    return "PEST_CONTROL";
  if (has("tanim", "binhi", "plant", "seed", "pagtatanim")) return "PLANTING";
  if (has("ani", "harvest", "pag-ani", "anihan")) return "HARVEST";
  if (has("araro", "linang", "paghahanda", "prepar", "ready", "lupa"))
    return "PREPARATION";
  return "OTHER";
};

const todayIso = () => new Date().toISOString().split("T")[0];

export const FarmerActivityPage: React.FC = () => {
  const navigate = useNavigate();

  // ── Real farm/crop context loaded from the backend ────────────────────────
  const [loadingContext, setLoadingContext] = useState(true);
  const [context, setContext] = useState<ActiveCropCycle | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);

  const [queueCount, setQueueCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // ── Form fields (no prefilled demo text) ──────────────────────────────────
  // Free text is the primary input. A category chip is optional: when tapped it
  // sets `selectedCategory` (which locks the enum); otherwise the enum is
  // inferred from the text at submit time.
  const [selectedCategory, setSelectedCategory] = useState<ActivityType | null>(
    null,
  );
  const [performedAt, setPerformedAt] = useState<string>(todayIso);
  const [quantityBrand, setQuantityBrand] = useState<string>("");
  const [additionalDetails, setAdditionalDetails] = useState<string>("");

  // Tapping a suggestion chip sets the category and, if the text field is still
  // empty, prefills a helpful hint the farmer can edit or replace.
  const handleSelectSuggestion = (id: ActivityType, hint: string) => {
    setSelectedCategory((prev) => (prev === id ? null : id));
    if (hint && !quantityBrand.trim() && !additionalDetails.trim()) {
      setQuantityBrand(hint);
    }
  };

  const [submitting, setSubmitting] = useState(false);

  const loadContext = useCallback(async () => {
    setLoadingContext(true);
    setContextError(null);
    try {
      const active = await getActiveCropCycle();
      setContext(active);
    } catch (err) {
      console.error("Failed to load farm context:", err);
      setContextError(
        "Hindi makuha ang impormasyon ng sakahan. Pakisuri ang koneksyon.",
      );
    } finally {
      setLoadingContext(false);
    }
  }, []);

  // Online/offline detection, queue count, and initial context load.
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    setQueueCount(getOfflineQueue().length);
    void loadContext();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [loadContext]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!context) {
      toast.error("Walang aktibong taniman", {
        description: "Kailangan munang magparehistro ng sakahan at taniman.",
      });
      return;
    }

    if (!quantityBrand.trim() && !additionalDetails.trim()) {
      toast.error("Kulang ang detalye", {
        description: "Pakilagay ang dami, sako, o karagdagang detalye ng gawain.",
      });
      return;
    }

    setSubmitting(true);
    const combinedDescription = `${quantityBrand.trim()}${
      additionalDetails.trim() ? ` — ${additionalDetails.trim()}` : ""
    }`;
    // Enum sent to the backend: the chosen category if the farmer tapped one,
    // otherwise inferred from what they typed (defaults to OTHER).
    const activityType: ActivityType =
      selectedCategory ?? inferActivityType(combinedDescription);
    const cropCycleId = context.cropCycle.id;

    try {
      await createActivity(cropCycleId, {
        activityType,
        description: combinedDescription,
        performedAt,
      });

      toast.success("Nai-save ang Gawain!", {
        description: `Matagumpay na naitala sa ${context.farm.name}.`,
      });
      navigate("/farmer");
    } catch (err) {
      // Offline-first fallback: only queue when the failure looks like a
      // connectivity problem. Real validation/permission errors (4xx) should
      // surface to the farmer instead of being silently queued.
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      const isNetworkError = status === undefined; // no HTTP response => offline

      if (isNetworkError) {
        queueOfflineAction({
          actionType: "CREATE_CROP_ACTIVITY",
          displayTitle: `Gawain: ${combinedDescription || activityType}`,
          payload: {
            cropCycleId,
            activityType,
            description: combinedDescription,
            performedAt,
          },
        });
        setQueueCount((prev) => prev + 1);
        toast.info("Nai-save sa Offline Storage (Queue)", {
          description:
            "Walang signal ngayon. Awtomatikong mai-sync sa DA server pagbalik ng koneksyon.",
        });
        navigate("/farmer");
      } else {
        console.error("Activity submit failed:", err);
        toast.error("Hindi Nai-save ang Gawain", {
          description:
            "May problema sa server. Pakisuri ang detalye at subukang muli.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleQueueClick = () => {
    navigate("/farmer/history");
  };

  // Context label shown in the header (municipality from the real farm record).
  const headerContext = context
    ? `${context.farm.municipality}, Cagayan • ${context.farm.name}`
    : "Cagayan • Corn Field";

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
                {headerContext}
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
          {/* --- Loading state --- */}
          {loadingContext && (
            <div className="w-full bg-white rounded-3xl p-8 shadow-sm border border-slate-200/80 flex flex-col items-center justify-center gap-3 text-slate-500">
              <RefreshCw className="w-7 h-7 animate-spin text-emerald-600" />
              <p className="text-sm font-semibold">
                Kinukuha ang inyong taniman...
              </p>
            </div>
          )}

          {/* --- Error loading context --- */}
          {!loadingContext && contextError && (
            <div className="w-full bg-white rounded-3xl p-6 shadow-sm border border-red-200 flex flex-col items-center gap-3 text-center">
              <AlertCircle className="w-9 h-9 text-red-500" />
              <p className="text-sm font-semibold text-slate-700">
                {contextError}
              </p>
              <button
                type="button"
                onClick={() => void loadContext()}
                className="mt-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white transition active:scale-[0.98] cursor-pointer"
              >
                Subukang Muli
              </button>
            </div>
          )}

          {/* --- Empty state: no farm / no crop cycle --- */}
          {!loadingContext && !contextError && !context && (
            <div className="w-full bg-white rounded-3xl p-6 shadow-sm border border-emerald-200 flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
                <Sprout className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-base font-black text-slate-800">
                Wala pang Taniman
              </h2>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Kailangan munang magparehistro ng sakahan at tanim na mais bago
                makapagtala ng gawain.
              </p>
              <button
                type="button"
                onClick={() => navigate("/onboarding")}
                className="mt-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white transition active:scale-[0.98] cursor-pointer"
              >
                Magrehistro ng Sakahan
              </button>
            </div>
          )}

          {/* --- Ready: the real form --- */}
          {!loadingContext && !contextError && context && (
            <form
              onSubmit={handleSubmit}
              className="w-full bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-4"
            >
              {/* Card Header */}
              <div>
                <div className="flex items-center gap-2 text-[#2563eb]">
                  <ClipboardCheck className="w-5 h-5 stroke-[2.4]" />
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-[#2563eb]">
                    Record Farm Activity
                  </h2>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1 leading-snug">
                  Itala ang pataba, patubig, o pagpuksa sa peste sa{" "}
                  <span className="font-bold text-slate-700">
                    {context.cropCycle.variety ?? "mais"}
                  </span>{" "}
                  ({context.farm.name}).
                </p>
              </div>

              {/* Section 1: Mungkahing Uri (optional category suggestions) */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  Mungkahing Uri (Opsyonal)
                </label>
                <p className="text-[11px] text-slate-500 font-medium -mt-0.5">
                  Pumili ng kategorya o magtype na lang sa ibaba.
                </p>
                <div className="flex flex-wrap gap-2">
                  {ACTIVITY_SUGGESTIONS.map((act) => {
                    const isSelected = selectedCategory === act.id;
                    return (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => handleSelectSuggestion(act.id, act.hint)}
                        className={`h-10 rounded-full border px-3.5 flex items-center gap-1.5 text-xs font-bold transition active:scale-[0.98] cursor-pointer ${
                          isSelected
                            ? "border-[#2563eb] bg-blue-50/70 text-[#1d4ed8] shadow-xs"
                            : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-[#2563eb] text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-3" />
                          </div>
                        )}
                        <span>{act.label}</span>
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
                    max={todayIso()}
                    onChange={(e) => setPerformedAt(e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-3 text-xs sm:text-sm font-semibold text-slate-800 outline-none transition"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Section 3: Anong Gawain / Dami, Sako, o Brand (primary input) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Anong Ginawa? (Dami, Sako, o Brand)
                </label>
                <input
                  type="text"
                  value={quantityBrand}
                  onChange={(e) => setQuantityBrand(e.target.value)}
                  placeholder="Hal. 2 sako ng Urea, o isulat ang ginawa"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-3 text-xs sm:text-sm font-semibold text-slate-800 outline-none transition"
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
                  className="w-full rounded-2xl border border-slate-300 bg-white p-3.5 text-xs font-medium text-slate-800 outline-none transition leading-relaxed resize-none"
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
                    <span>
                      Itatabi muna sa offline queue habang mahina ang signal.
                    </span>
                  </>
                )}
              </div>

              {/* Section 6: Primary Action Button */}
              <button
                type="submit"
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
            </form>
          )}
        </main>
      </div>
    </div>
  );
};

export default FarmerActivityPage;
