import React, { useState, useEffect, useCallback } from "react";
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
  HelpCircle,
} from "lucide-react";
import { createObservation } from "../../services/observation.service";
import { getCasePipeline, type ExpertCase } from "../../services/case.service";
import { queueOfflineAction } from "../../services/sync.service";
import { useFarmContext } from "../../hooks/useFarmContext";
import { useFarmSelection } from "../../context/farmSelectionContext";
import { ApiError } from "../../lib/api";
import { FarmCycleSelector } from "../../components/FarmCycleSelector";
import { caseStatusDisplay, CASE_STATUS_TIMELINE } from "../../lib/caseStatus";
import { parseLegacyCaseDescription } from "../../lib/parseLegacyCaseDescription";
import { useSyncQueue } from "../../hooks/useSyncQueue";
import { QUEUE_UPDATED_EVENT } from "../../lib/offlineQueue";

export const FarmerExpertRequestPage: React.FC = () => {
  const navigate = useNavigate();

  const farmCtx = useFarmContext();
  const { selectedCycle } = useFarmSelection();
  const cropCycleId = selectedCycle?.id ?? "";

  // Tab State
  const [activeTab, setActiveTab] = useState<"request" | "status">("request");

  const { pendingCount: queueCount } = useSyncQueue();

  // Form Fields
  const [subject, setSubject] = useState<string>("");
  const [problemDescription, setProblemDescription] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);

  // Expert Cases List
  const [expertCases, setExpertCases] = useState<ExpertCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refreshCases = useCallback(async () => {
    if (activeTab !== "status") return;
    setCasesLoading(true);
    try {
      const res = await getCasePipeline();
      setExpertCases(res.expertCases || []);
    } catch {
      setExpertCases([]);
    } finally {
      setCasesLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    void refreshCases();
  }, [refreshCases]);

  useEffect(() => {
    window.addEventListener(QUEUE_UPDATED_EVENT, refreshCases);
    return () => window.removeEventListener(QUEUE_UPDATED_EVENT, refreshCases);
  }, [refreshCases]);

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

    if (!cropCycleId) {
      toast.error("Walang napiling pananim.", {
        description: "Pumili ng sakahan at pananim sa itaas.",
      });
      return;
    }

    setSubmitting(true);

    const submissionTitle = subject
      .trim()
      .startsWith("[Hinihinging Tulong sa LGU Technician]")
      ? subject.trim()
      : `[Hinihinging Tulong sa LGU Technician] ${subject.trim()}`;
    const cleanDescription = problemDescription.trim();

    try {
      // High severity observation triggers auto-escalation to expertRequest in backend
      await createObservation({
        cropCycleId,
        title: submissionTitle,
        description: cleanDescription,
        severity: "HIGH",
      });

      toast.success("Naipadala sa Ag Technician!", {
        description: `Nakatanggap ng abiso ang Municipal Agriculture Office sa ${farmCtx.municipality || "inyong munisipalidad"} para sa inyong katanungan.`,
      });

      setActiveTab("status");
    } catch (err) {
      // Only queue on a genuine connectivity failure; a 4xx/5xx must surface.
      const isNetworkError =
        (err instanceof ApiError && err.isNetworkError) || !navigator.onLine;
      const isTemporaryServerError =
        err instanceof ApiError &&
        (err.status >= 500 || err.status === 408 || err.status === 429);

      if (!isNetworkError && !isTemporaryServerError) {
        console.error("Expert request submit failed:", err);
        const description =
          err instanceof ApiError
            ? err.message
            : "May problema sa server. Pakisuri ang detalye at subukang muli.";
        toast.error("Hindi Naipadala ang Kahilingan", { description });
        setSubmitting(false);
        return;
      }

      try {
        await queueOfflineAction({
          actionType: "CREATE_OBSERVATION",
          displayTitle: `Humingi ng Tulong: ${subject.trim()}`,
          payload: {
            cropCycleId,
            title: submissionTitle,
            description: cleanDescription,
            severity: "HIGH",
          },
        });
      } catch (queueError) {
        console.error("Could not save expert request to offline queue:", queueError);
        toast.error("Hindi na-save ang Kahilingan", {
          description:
            "Hindi naipadala at hindi rin naitabi sa telepono ang kahilingan. Pakisubukan muli.",
        });
        return;
      }

      toast.info("Naitago sa Offline Storage (Queue)", {
        description: isNetworkError
          ? `Dahil walang koneksyon, itinabi ito sa telepono. Isi-sync kapag bumalik ang signal. (${queueCount + 1} sa queue)`
          : "Pansamantalang may problema ang server. Nasa telepono ang kahilingan at maaari itong i-sync kapag maayos na ang server.",
      });

      setActiveTab("status");
    } finally {
      setSubmitting(false);
    }
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
            <div className="w-full bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-5">
              {/* Context Header - Shows selected farm/cycle from FarmCycleSelector */}
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0">
                  <HelpCircle className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-sm text-emerald-900 leading-tight">
                    Humingi ng tulong sa LGU Agri-Technician
                  </p>
                  <p className="text-xs text-emerald-700/90 mt-0.5 leading-snug">
                    Ang iyong katanungan ay maipapadala agad sa Municipal
                    Agriculture Office ng{" "}
                    <strong>
                      {farmCtx.municipality || "inyong munisipalidad"}
                    </strong>
                    . Titiyakin na may napiling pananim sa ibaba.
                  </p>
                </div>
              </div>

              {/* Shared farm + crop cycle selector (drives cropCycleId) */}
              <FarmCycleSelector label="Para saang pananim ang tulong?" />

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
                  rows={5}
                  value={problemDescription}
                  onChange={(e) => setProblemDescription(e.target.value)}
                  placeholder="Isalaysay ang nararanasang problema o itanong ang nais malaman...&#10;&#10;Halimbawa:&#10;• Anong yugto ng pananim? (DAP)&#10;• Anong sintomas ang nakikita?&#10;• Kailan nagsimula ang problema?&#10;• Anong gawin na ang ginawa mo?"
                  className="w-full rounded-2xl border bg-white p-3.5 text-xs font-medium outline-none focus:border-[#c2410c] transition placeholder:text-slate-400 leading-relaxed resize-none"
                />
              </div>

              {/* Helpful Tips */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 space-y-1.5">
                <p className="text-[10px] font-black text-amber-900 uppercase tracking-wide flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Mga Tip para sa Mabilis
                  na Tugon
                </p>
                <ul className="text-[11px] text-amber-800 space-y-1 pl-4 list-disc">
                  <li>
                    Ilarawan ang kulay, hugis, at lokasyon ng pinsala sa
                    dahon/tangkay
                  </li>
                  <li>
                    Banggitin kung ilang ektarya ang apektado at anong variety
                    ng mais
                  </li>
                  <li>
                    Mag-attach ng litrato gamit ang{" "}
                    <strong>Suriin ang Halaman</strong> sa dashboard
                  </li>
                </ul>
              </div>

              {/* Oversized Submit Button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !cropCycleId}
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

              {/* Offline Hint */}
              <p className="text-center text-[10px] text-slate-400">
                Walang signal? Ang kahilingan ay awtomatikong maitatabi sa{" "}
                <strong>Offline Queue</strong> at maipapadala pagbalik ng
                koneksyon.
              </p>
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
                    <span>
                      Kinukuha ang status mula sa LGU Agriculture Office...
                    </span>
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
                      const display = caseStatusDisplay(ec.status);
                      const expanded = expandedId === ec.id;
                      const isRejected = ec.status === "REJECTED";
                      return (
                        <div
                          key={ec.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50/70 overflow-hidden hover:border-slate-300 transition"
                        >
                          {/* Header row — tap to expand */}
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedId(expanded ? null : ec.id)
                            }
                            className="w-full p-4 flex justify-between items-start gap-2 text-left cursor-pointer"
                          >
                            <div className="min-w-0">
                              <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                                {ec.observation?.title ||
                                  "Katanungan sa Taniman"}
                              </h4>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Kaso ID: #{ec.id.slice(0, 8)}
                                {ec.createdAt
                                  ? ` • ${new Date(ec.createdAt).toLocaleDateString("fil-PH", { month: "short", day: "numeric", year: "numeric" })}`
                                  : ""}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-black border shrink-0 ${display.badge}`}
                            >
                              {display.label}
                            </span>
                          </button>

                          {expanded && (
                            <div className="px-4 pb-4 space-y-3 border-t border-slate-200/70 pt-3">
                              {/* Status timeline (skipped for rejected) */}
                              {!isRejected && (
                                <div className="flex items-center justify-between">
                                  {CASE_STATUS_TIMELINE.map((step, idx) => {
                                    const reached = display.step >= idx;
                                    return (
                                      <React.Fragment key={step.key}>
                                        <div className="flex flex-col items-center gap-1 flex-1">
                                          <div
                                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                                              reached
                                                ? "bg-emerald-600 text-white"
                                                : "bg-slate-200 text-slate-400"
                                            }`}
                                          >
                                            {idx + 1}
                                          </div>
                                          <span
                                            className={`text-[9px] font-bold text-center ${reached ? "text-emerald-700" : "text-slate-400"}`}
                                          >
                                            {step.label}
                                          </span>
                                        </div>
                                        {idx <
                                          CASE_STATUS_TIMELINE.length - 1 && (
                                          <div
                                            className={`h-0.5 flex-1 -mt-4 ${display.step > idx ? "bg-emerald-600" : "bg-slate-200"}`}
                                          />
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                </div>
                              )}

                              {ec.observation?.description && (
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 mb-1">
                                    Detalye
                                  </p>
                                  <p className="text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/80 leading-snug whitespace-pre-line">
                                    {
                                      parseLegacyCaseDescription(
                                        ec.observation.description,
                                      ).message
                                    }
                                  </p>
                                </div>
                              )}

                              {ec.assignedTechnician && (
                                <p className="flex items-center gap-1.5 text-[11px] text-slate-600">
                                  <UserCheck className="w-3.5 h-3.5 text-[#c2410c] shrink-0" />
                                  Technician:{" "}
                                  <strong className="text-slate-900">
                                    {ec.assignedTechnician.firstName}{" "}
                                    {ec.assignedTechnician.lastName}
                                  </strong>
                                  {ec.assignedTechnician.phone
                                    ? ` • ${ec.assignedTechnician.phone}`
                                    : ""}
                                </p>
                              )}

                              {/* Technician's Official Recommendation */}
                              {ec.recommendation ? (
                                <div className="rounded-xl border border-emerald-300 bg-emerald-50/80 p-3 space-y-1">
                                  <div className="flex items-center gap-1.5 text-xs font-black text-emerald-950">
                                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>
                                      Opisyal na Payo ng LGU Agri-Technician:
                                    </span>
                                  </div>
                                  <p className="text-xs text-emerald-900 font-medium leading-relaxed whitespace-pre-line">
                                    {ec.recommendation}
                                  </p>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 p-2 rounded-xl border border-amber-200">
                                  <MessageSquare className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  <span>
                                    Naghihintay ng tugon mula sa nakatalagang
                                    technician sa{" "}
                                    {farmCtx.municipality ||
                                      "inyong munisipalidad"}
                                    .
                                  </span>
                                </div>
                              )}
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
