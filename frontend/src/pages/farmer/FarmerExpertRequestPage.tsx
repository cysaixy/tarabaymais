import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronLeft,
  RefreshCw,
  UserCheck,
  Send,
  Clock,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { createObservation } from "../../services/observation.service";
import { getCasePipeline, type ExpertCase } from "../../services/case.service";
import { getOfflineQueue, queueOfflineAction } from "../../services/sync.service";
import { useFarmContext } from "../../hooks/useFarmContext";
import { useAuth } from "../../context/authContext";
import { ApiError } from "../../lib/api";

export const FarmerExpertRequestPage: React.FC = () => {
  const navigate = useNavigate();

  const farmCtx = useFarmContext();
  const { profile } = useAuth();

  // Tab State
  const [activeTab, setActiveTab] = useState<"request" | "status">("request");

  const [queueCount, setQueueCount] = useState(0);

  // Form Fields
  const [subject, setSubject] = useState<string>("");
  const [problemDescription, setProblemDescription] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);

  // Expert Cases List
  const [expertCases, setExpertCases] = useState<ExpertCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);

  // Load queue count on mount
  useEffect(() => {
    const q = getOfflineQueue();
    setQueueCount(q.length);
  }, []);

  // Fetch cases when switching to status tab
  useEffect(() => {
    if (activeTab === "status") {
      setCasesLoading(true);
      getCasePipeline()
        .then((res) => { setExpertCases(res.expertCases || []); })
        .catch(() => { setExpertCases([]); })
        .finally(() => { setCasesLoading(false); });
    }
  }, [activeTab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      toast.error("Pakilagay ang paksa o pamagat ng inyong katanungan.");
      return;
    }
    if (!problemDescription.trim()) {
      toast.error("Pakilarawan ang problema sa taniman.");
      return;
    }

    setSubmitting(true);

    if (!farmCtx.cropCycleId) {
      toast.error("Walang aktibong pananim.", {
        description: "Mag-onboard muna o magdagdag ng crop cycle sa inyong sakahan.",
      });
      setSubmitting(false);
      return;
    }

    const farmerName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : "";
    const farmerPhone = profile?.phone || "";
    const fullNotes = `[Hinihinging Tulong sa LGU Technician]\n${problemDescription.trim()}\n\nMagsasaka: ${farmerName}${farmerPhone ? ` (${farmerPhone})` : ""}\nSakahan: ${farmCtx.farmName} (${farmCtx.barangay}, ${farmCtx.municipality})`;

    try {
      // High severity observation triggers auto-escalation to expertRequest in backend
      await createObservation({
        cropCycleId: farmCtx.cropCycleId,
        title: subject.trim(),
        description: fullNotes,
        severity: "HIGH",
      });

      toast.success("Naipadala sa Ag Technician!", {
        description:
          `Nakatanggap ng abiso ang Municipal Agriculture Office sa ${farmCtx.municipality || "inyong munisipalidad"} para sa inyong katanungan.`,
      });

      setActiveTab("status");
    } catch (err) {
      // Only queue on a genuine connectivity failure; a 4xx/5xx must surface.
      const isNetworkError =
        (err instanceof ApiError && err.isNetworkError) || !navigator.onLine;

      if (!isNetworkError) {
        console.error("Expert request submit failed:", err);
        const description =
          err instanceof ApiError
            ? err.message
            : "May problema sa server. Pakisuri ang detalye at subukang muli.";
        toast.error("Hindi Naipadala ang Kahilingan", { description });
        setSubmitting(false);
        return;
      }

      queueOfflineAction({
        actionType: "CREATE_OBSERVATION",
        displayTitle: `Humingi ng Tulong: ${subject.trim()}`,
        payload: {
          cropCycleId: farmCtx.cropCycleId,
          title: subject.trim(),
          description: fullNotes,
          severity: "HIGH",
        },
      });

      setQueueCount((prev) => prev + 1);

      toast.info("Naitago sa Offline Storage (Queue)", {
        description:
          "Dahil walang koneksyon, itinabi ito sa telepono. Awtomatikong maipapadala sa technician pagbalik ng signal.",
      });

      setActiveTab("status");
    } finally {
      setSubmitting(false);
    }
  };

  const handleQueueClick = () => {
    toast.info("Offline Sync Queue", {
      description: `May ${queueCount} nakatagong ulat sa telepono na handang i-sync.`,
    });
  };

  return (
    <div className="w-full min-h-screen bg-slate-100 md:bg-slate-950 flex flex-col items-center justify-start p-0 md:p-6 lg:p-8 font-sans selection:bg-orange-500/30">
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
                Humingi ng Tulong sa Eksperto
              </h1>
              <p className="text-[11px] sm:text-xs text-emerald-200/90 font-medium">
                {farmCtx.municipality || "Cagayan"}, Cagayan • Corn Field
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
        {/* 2. TOP SEGMENTED SWITCHER (DALAWANG TAB)                  */}
        {/* ========================================================= */}
        <div className="px-4 sm:px-5 pt-3 shrink-0">
          <div className="w-full bg-slate-200/80 p-1 rounded-2xl flex items-center">
            <button
              type="button"
              onClick={() => setActiveTab("request")}
              className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer text-center ${
                activeTab === "request"
                  ? "bg-[#c2410c] text-white shadow-md"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Humingi ng Tulong
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("status")}
              className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer text-center ${
                activeTab === "status"
                  ? "bg-[#c2410c] text-white shadow-md"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Status ng Kaso (Cases)
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3. MAIN CARD CONTENT CONTAINER                            */}
        {/* ========================================================= */}
        <main className="flex-1 p-4 sm:p-5 space-y-4 overflow-y-auto">
          {activeTab === "request" ? (
            <div className="w-full bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-4">
              
              {/* Card Header */}
              <div>
                <div className="flex items-center gap-2 text-[#c2410c]">
                  <UserCheck className="w-5 h-5 stroke-[2.4]" />
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-[#c2410c]">
                    Request Ag Technician Assistance
                  </h2>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1 leading-snug">
                  Ipadala ang iyong katanungan o problema sa nakatalagang LGU Agriculture Technician sa {farmCtx.municipality || "inyong munisipalidad"}.
                </p>
              </div>

              {/* Magsasaka & Sakahan Context Box */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-1.5 text-xs text-slate-700">
                <p className="font-extrabold text-slate-900 text-xs">Magsasaka & Sakahan:</p>
                <div className="space-y-1 text-[11px] sm:text-xs">
                  {profile && (
                    <p className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-600 shrink-0" />
                      <span>
                        <strong className="text-slate-900">{profile.firstName} {profile.lastName}</strong>
                        {profile.phone && ` (${profile.phone})`}
                      </span>
                    </p>
                  )}
                  {farmCtx.farmName && (
                    <p className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-600 shrink-0" />
                      <span>
                        {farmCtx.farmName} — {farmCtx.barangay}, {farmCtx.municipality}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {/* Field 1: Paksa / Pamagat */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Paksa / Pamagat ng Katanungan
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Hal. Paninilaw ng Mais pagkatapos ng Baha"
                  className="w-full rounded-2xl border bg-white px-3.5 py-3 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:border-[#c2410c] transition"
                />
              </div>

              {/* Field 2: Buong Paliwanag */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Buong Paliwanag sa Problema sa Taniman
                </label>
                <textarea
                  rows={4}
                  value={problemDescription}
                  onChange={(e) => setProblemDescription(e.target.value)}
                  placeholder="Isalaysay ang nararanasang problema o itanong ang nais malaman..."
                  className="w-full rounded-2xl border bg-white p-3.5 text-xs font-medium outline-none focus:border-[#c2410c] transition placeholder:text-slate-400 leading-relaxed resize-none"
                />
              </div>

              {/* Oversized Submit Button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full h-14 rounded-2xl bg-[#c2410c] hover:bg-[#9a3412] active:scale-[0.98] text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Isinusumite sa Technician...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 stroke-[2.4]" />
                    <span>Ipadala sa Ag Technician</span>
                  </>
                )}
              </button>

            </div>
          ) : (
            /* ========================================================= */
            /* TAB 2: STATUS NG KASO (CASES)                             */
            /* ========================================================= */
            <div className="space-y-3">
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-[#c2410c]" />
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                      Mga Huminging Tulong sa Eksperto
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">
                    {expertCases.length} Tala
                  </span>
                </div>

                {casesLoading ? (
                  <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#c2410c]" />
                    <span>Kinukuha ang status mula sa LGU Agriculture Office...</span>
                  </div>
                ) : expertCases.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-semibold text-slate-600">
                      Wala pang naipapasang katanungan sa technician.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab("request")}
                      className="text-xs font-bold text-[#c2410c] hover:underline"
                    >
                      Magpadala ng bagong katanungan →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {expertCases.map((ec) => {
                      const isResolved = ec.status === "RESOLVED";
                      return (
                        <div
                          key={ec.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5 hover:border-slate-300 transition"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">
                                {ec.observation?.title || "Katanungan sa Taniman"}
                              </h4>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Kaso ID: #{ec.id.slice(0, 8)}
                              </p>
                            </div>

                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-black border ${
                                isResolved
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : ec.status === "IN_PROGRESS"
                                  ? "bg-purple-100 text-purple-800 border-purple-300"
                                  : "bg-amber-100 text-amber-900 border-amber-300"
                              }`}
                            >
                              {isResolved
                                ? "Nalutas na (May Payo)"
                                : ec.status === "IN_PROGRESS"
                                ? "Kasalukuyang Sinusuri"
                                : "Nakatanggap na ang LGU"}
                            </span>
                          </div>

                          {ec.observation?.description && (
                            <p className="text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/80 leading-snug">
                              {ec.observation.description}
                            </p>
                          )}

                          {/* Technician's Official Recommendation */}
                          {ec.recommendation ? (
                            <div className="rounded-xl border border-emerald-300 bg-emerald-50/80 p-3 space-y-1">
                              <div className="flex items-center gap-1.5 text-xs font-black text-emerald-950">
                                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Opisyal na Payo ng LGU Agri-Technician:</span>
                              </div>
                              <p className="text-xs text-emerald-900 font-medium leading-relaxed">
                                {ec.recommendation}
                              </p>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 p-2 rounded-xl border border-amber-200">
                              <MessageSquare className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Naghihintay ng tugon mula sa nakatalagang technician sa {farmCtx.municipality || "inyong munisipalidad"}.</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

      </div>
    </div>
  );
};

export default FarmerExpertRequestPage;
