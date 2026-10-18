import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronLeft,
  RefreshCw,
  AlertTriangle,
  Calendar,
  FileText,
  Clock,
  Check,
} from "lucide-react";
import {
  createDisasterReport,
  getCasePipeline,
  type DisasterReport,
} from "../../services/case.service";
import {
  getOfflineQueue,
  queueOfflineAction,
} from "../../services/sync.service";
import { useFarmSelection } from "../../context/farmSelectionContext";
import { ApiError } from "../../lib/api";
import { FarmCycleSelector } from "../../components/FarmCycleSelector";
import { caseStatusDisplay, CASE_STATUS_TIMELINE } from "../../lib/caseStatus";

/** Suggested loss per hectare (₱) — an estimate only, farmer can override. */
const SUGGESTED_LOSS_PER_HA = 36000;

const EVENT_TYPES = [
  { id: "FLOOD", label: "Flood" },
  { id: "TYPHOON", label: "Typhoon" },
  { id: "DROUGHT", label: "Drought" },
  { id: "PEST_OUTBREAK", label: "Pest" },
];

export const FarmerDisasterReportPage: React.FC = () => {
  const navigate = useNavigate();

  const { selectedFarm } = useFarmSelection();

  // Tab State
  const [activeTab, setActiveTab] = useState<"report" | "status">("report");

  const [queueCount, setQueueCount] = useState(0);

  // Form Fields
  const [disasterType, setDisasterType] = useState<string>("FLOOD");
  const [eventDate, setEventDate] = useState<string>(
    () => new Date().toISOString().split("T")[0],
  );
  const [affectedHectares, setAffectedHectares] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  // Editable estimated loss. Seeded from a per-hectare suggestion but the
  // farmer can override it; `lossEdited` stops the suggestion from clobbering
  // a manual value when the hectares change.
  const [estimatedLoss, setEstimatedLoss] = useState<string>("");
  const [lossEdited, setLossEdited] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // Pipeline Status List
  const [claimList, setClaimList] = useState<DisasterReport[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [expandedClaimId, setExpandedClaimId] = useState<string | null>(null);

  // Load queue count on mount
  useEffect(() => {
    const q = getOfflineQueue();
    setQueueCount(q.length);
  }, []);

  // Fetch claims when switching to status tab
  useEffect(() => {
    if (activeTab === "status") {
      setClaimsLoading(true);
      getCasePipeline()
        .then((res) => {
          setClaimList(res.disasterCases || []);
        })
        .catch(() => {
          setClaimList([]);
        })
        .finally(() => {
          setClaimsLoading(false);
        });
    }
  }, [activeTab]);

  // Derived calculations
  const haNum = parseFloat(affectedHectares) || 0;
  const totalHa = selectedFarm ? Number(selectedFarm.areaHectares) : 0;
  const damagePct =
    totalHa > 0
      ? Math.min(100, Math.max(1, Math.round((haNum / totalHa) * 100)))
      : 0;
  const suggestedLoss = Math.round(haNum * SUGGESTED_LOSS_PER_HA);
  const estimatedLossPhp = Math.round(Number(estimatedLoss) || 0);

  // Keep the suggestion in sync with hectares until the farmer edits it.
  useEffect(() => {
    if (!lossEdited) {
      setEstimatedLoss(haNum > 0 ? String(suggestedLoss) : "");
    }
  }, [haNum, suggestedLoss, lossEdited]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!affectedHectares || haNum <= 0) {
      toast.error("Pakilagay ang tantiya na naapektuhang sukat sa ektarya.");
      return;
    }
    if (!description.trim()) {
      toast.error("Pakilarawan ang uri ng pinsala.");
      return;
    }

    const farmId = selectedFarm?.id ?? "";
    if (!farmId) {
      toast.error("Walang napiling sakahan.", {
        description: "Pumili ng sakahan sa itaas.",
      });
      return;
    }

    setSubmitting(true);

    const notesWithContext = `${description.trim()}\n\n[Petsa ng Kalamidad: ${eventDate}] [Naapektuhan: ${haNum} ha mula sa ${totalHa} ha (${damagePct}%)]`;

    try {
      await createDisasterReport(farmId, {
        disasterType,
        damagePercentage: damagePct,
        estimatedLoss: estimatedLossPhp,
        notes: notesWithContext,
      });

      toast.success("Naisumite ang Ulat ng Kalamidad!", {
        description:
          "Matagumpay na naipadala sa Municipal Agriculture Office at PCIC para sa verification at assistance.",
      });

      setActiveTab("status");
    } catch (err) {
      // Only queue on a genuine connectivity failure. A 4xx/5xx from the server
      // must surface its message and NOT be silently queued.
      const isNetworkError =
        (err instanceof ApiError && err.isNetworkError) || !navigator.onLine;

      if (!isNetworkError) {
        console.error("Disaster report submit failed:", err);
        const description =
          err instanceof ApiError
            ? err.message
            : "May problema sa server. Pakisuri ang detalye at subukang muli.";
        toast.error("Hindi Naisumite ang Ulat", { description });
        setSubmitting(false);
        return;
      }

      queueOfflineAction({
        actionType: "CREATE_DISASTER_REPORT",
        displayTitle: `Ulat ng Kalamidad: ${disasterType} (${damagePct}%)`,
        payload: {
          farmId,
          disasterType,
          damagePercentage: damagePct,
          estimatedLoss: estimatedLossPhp,
          notes: notesWithContext,
        },
      });

      setQueueCount((prev) => prev + 1);

      toast.info("Naitago sa Offline Storage (Queue)", {
        description:
          "Dahil mahina ang signal, itinago ito sa telepono. Awtomatikong mai-sync sa DA server kapag nagkaroon ng koneksyon.",
      });

      setActiveTab("status");
    } finally {
      setSubmitting(false);
    }
  };

  const handleQueueClick = () => {
    toast.info("Offline Sync Queue", {
      description: `May ${queueCount} nakatagong ulat sa telepono na handang i-sync kapag may signal na.`,
    });
  };

  return (
    <div className="w-full min-h-screen bg-slate-100 md:bg-slate-950 flex flex-col items-center justify-start p-0 md:p-6 lg:p-8 font-sans selection:bg-rose-500/30">
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
                Ulat ng Pinsala ng Bagyo/Baha
              </h1>
              <p className="text-[11px] sm:text-xs text-emerald-200/90 font-medium">
                {selectedFarm?.municipality || "Cagayan"}, Cagayan • Corn Field
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
        {/* 2. TOP SEGMENTED PILL SWITCHER (DALAWANG TAB)             */}
        {/* ========================================================= */}
        <div className="px-4 sm:px-5 pt-3 shrink-0">
          <div className="w-full bg-slate-200/80 p-1 rounded-2xl flex items-center">
            <button
              type="button"
              onClick={() => setActiveTab("report")}
              className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer text-center ${
                activeTab === "report"
                  ? "bg-[#9f1239] text-white shadow-md"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Mag-report ng Pinsala
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("status")}
              className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer text-center ${
                activeTab === "status"
                  ? "bg-[#9f1239] text-white shadow-md"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Status ng Claim / Ulat
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3. MAIN CARD CONTENT CONTAINER                            */}
        {/* ========================================================= */}
        <main className="flex-1 p-4 sm:p-5 space-y-4 overflow-y-auto">
          {activeTab === "report" ? (
            <div className="w-full bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-4">
              {/* Card Header */}
              <div>
                <div className="flex items-center gap-2 text-[#9f1239]">
                  <AlertTriangle className="w-5 h-5 stroke-[2.4]" />
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-[#9f1239]">
                    Disaster Crop Damage Report
                  </h2>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1 leading-snug">
                  I-report ang pinsala sa Mais dulot ng Bagyo, Baha, o Tagtuyot
                  para sa PCIC insurance at emergency assistance.
                </p>
              </div>

              {/* Shared farm selector (farm-only; drives farmId) */}
              <FarmCycleSelector
                farmOnly
                label="Aling sakahan ang naapektuhan?"
              />

              {/* Section 1: Event Type (2x2 Grid) */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  Uri ng Kalamidad (Event Type)
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {EVENT_TYPES.map((evt) => {
                    const isSelected = disasterType === evt.id;
                    return (
                      <button
                        key={evt.id}
                        type="button"
                        onClick={() => setDisasterType(evt.id)}
                        className={`h-12 rounded-2xl border px-3.5 flex items-center justify-between text-xs font-bold transition active:scale-[0.98] cursor-pointer ${
                          isSelected
                            ? "border-[#e11d48] bg-rose-50/70 text-[#9f1239] shadow-xs"
                            : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <span>{evt.label}</span>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-[#e11d48] text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-3" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Petsa ng Pagkaganap */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Petsa ng Pagkaganap ng Bagyo/Baha
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-3 text-xs sm:text-sm font-semibold text-slate-800 outline-none transition"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Section 3: Affected Area Input & Calculation */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Tantiya na Naapektuhang Luwang (Ektarya / Hectares)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max={totalHa}
                  value={affectedHectares}
                  onChange={(e) => setAffectedHectares(e.target.value)}
                  placeholder="Hal. 1.5"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-3 text-sm font-extrabold text-[#9f1239] outline-none transition"
                />

                {/* Helper Footnote */}
                <div className="flex justify-between items-center text-[11px] text-slate-500 pt-0.5 font-medium">
                  <span>Kabuuang Sukat: {totalHa || "—"} ha</span>
                  <span className="font-bold text-[#9f1239]">
                    ~{damagePct}% Pinsala
                  </span>
                </div>
              </div>

              {/* Estimated loss — editable, clearly labeled as an estimate */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Tinatayang Halaga ng Pinsala (₱) — Estimate lang
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  inputMode="numeric"
                  value={estimatedLoss}
                  onChange={(e) => {
                    setLossEdited(true);
                    setEstimatedLoss(e.target.value);
                  }}
                  placeholder="Hal. 54000"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-3 text-sm font-extrabold text-[#9f1239] outline-none transition"
                />
                <p className="text-[11px] font-medium text-slate-500">
                  Mungkahi base sa ~₱{SUGGESTED_LOSS_PER_HA.toLocaleString()}/ha
                  ({haNum || 0} ha = ₱{suggestedLoss.toLocaleString()}). Maaari
                  mong baguhin ito ayon sa aktwal na pagkakalkula.
                </p>
              </div>

              {/* Section 4: Description Textarea */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Paliwanag sa Uri ng Sira (Description)
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ilarawan kung ano ang nangyari sa pananim..."
                  className="w-full rounded-2xl border border-slate-300 bg-white p-3.5 text-xs font-medium text-slate-800 outline-none transition leading-relaxed resize-none"
                />
              </div>

              {/* Photo evidence deferred: the backend has no disaster-image
                  field yet, so the control is intentionally omitted (PWA phase). */}

              {/* Section 6: Oversized Submit Button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full h-14 rounded-2xl bg-[#9f1239] hover:bg-[#881337] active:scale-[0.98] text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Isinusumite ang Ulat...</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 stroke-[2.4]" />
                    <span>I-submit ang Disaster Damage Report</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* ========================================================= */
            /* TAB 2: STATUS NG CLAIM / ULAT                             */
            /* ========================================================= */
            <div className="space-y-3">
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#9f1239]" />
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                      Mga Naipasang Claim at Ulat
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">
                    {claimList.length} Tala
                  </span>
                </div>

                {claimsLoading ? (
                  <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#9f1239]" />
                    <span>
                      Kinukuha ang pinakabagong status mula sa DA server...
                    </span>
                  </div>
                ) : claimList.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-semibold text-slate-600">
                      Wala pang naipapasang ulat ng pinsala sa sakahang ito.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab("report")}
                      className="text-xs font-bold text-[#9f1239] hover:underline"
                    >
                      Mag-sumite ng bagong ulat ngayon →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {claimList.map((c) => {
                      const display = caseStatusDisplay(c.status);
                      const expanded = expandedClaimId === c.id;
                      const isRejected = c.status === "REJECTED";
                      return (
                        <div
                          key={c.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50/70 overflow-hidden hover:border-slate-300 transition"
                        >
                          {/* Header row — tap to expand */}
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedClaimId(expanded ? null : c.id)
                            }
                            className="w-full p-4 flex justify-between items-start gap-2 text-left cursor-pointer"
                          >
                            <div className="min-w-0">
                              <span className="font-extrabold text-xs sm:text-sm text-slate-900">
                                Kalamidad: {c.disasterType}
                              </span>
                              <p className="text-[10px] text-slate-400">
                                Naitala noong:{" "}
                                {new Date(c.createdAt).toLocaleDateString(
                                  "fil-PH",
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  },
                                )}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-black border shrink-0 ${display.badge}`}
                            >
                              {display.label}
                            </span>
                          </button>

                          <div className="px-4 pb-4 space-y-2.5">
                            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60">
                              <div>
                                <span className="text-[10px] text-slate-500">
                                  Antas ng Sira:
                                </span>
                                <p className="font-bold text-rose-700">
                                  {c.damagePercentage}% Pinsala
                                </p>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500">
                                  Tinatayang Lugi:
                                </span>
                                <p className="font-bold text-slate-800">
                                  ₱
                                  {Number(
                                    c.estimatedLoss || 0,
                                  ).toLocaleString()}
                                </p>
                              </div>
                            </div>

                            {expanded && (
                              <>
                                {/* Status timeline (skipped for rejected) */}
                                {!isRejected && (
                                  <div className="flex items-center justify-between pt-1">
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

                                {c.farm && (
                                  <p className="text-[11px] text-slate-600">
                                    Sakahan:{" "}
                                    <strong className="text-slate-900">
                                      {c.farm.name}
                                    </strong>{" "}
                                    ({c.farm.barangay}, {c.farm.municipality})
                                  </p>
                                )}

                                {c.verifiedBy && (
                                  <p className="text-[11px] text-slate-600">
                                    Ni-verify ni:{" "}
                                    <strong className="text-slate-900">
                                      {c.verifiedBy.firstName}{" "}
                                      {c.verifiedBy.lastName}
                                    </strong>
                                  </p>
                                )}

                                {c.notes && (
                                  <div>
                                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 mb-1">
                                      Paliwanag
                                    </p>
                                    <p className="text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/80 leading-snug whitespace-pre-line">
                                      {c.notes}
                                    </p>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
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

export default FarmerDisasterReportPage;
