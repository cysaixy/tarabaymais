import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronLeft,
  RefreshCw,
  AlertTriangle,
  Calendar,
  UploadCloud,
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
import { useFarmContext } from "../../hooks/useFarmContext";

const EVENT_TYPES = [
  { id: "FLOOD", label: "Flood" },
  { id: "TYPHOON", label: "Typhoon" },
  { id: "DROUGHT", label: "Drought" },
  { id: "PEST_OUTBREAK", label: "Pest" },
];

export const FarmerDisasterReportPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const farmCtx = useFarmContext();

  // Tab State
  const [activeTab, setActiveTab] = useState<"report" | "status">("report");

  const [queueCount, setQueueCount] = useState(0);

  // Form Fields
  const [disasterType, setDisasterType] = useState<string>("FLOOD");
  const [eventDate, setEventDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [affectedHectares, setAffectedHectares] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  // Photo Evidence
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  // Pipeline Status List
  const [claimList, setClaimList] = useState<DisasterReport[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);

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
        .then((res) => { setClaimList(res.disasterCases || []); })
        .catch(() => { setClaimList([]); })
        .finally(() => { setClaimsLoading(false); });
    }
  }, [activeTab]);

  // Derived calculations
  const haNum = parseFloat(affectedHectares) || 0;
  const totalHa = farmCtx.areaHectares || 2.5;
  const damagePct = Math.min(100, Math.max(1, Math.round((haNum / totalHa) * 100)));
  const estimatedLossPhp = Math.round(haNum * 36000);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      toast.success("Nailakip ang ebidensya ng pinsala!");
    }
  };

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

    setSubmitting(true);

    if (!farmCtx.farmId) {
      toast.error("Walang aktibong sakahan.", {
        description: "Mag-onboard muna o magdagdag ng sakahan.",
      });
      setSubmitting(false);
      return;
    }

    const notesWithContext = `${description.trim()}\n\n[Petsa ng Kalamidad: ${eventDate}] [Naapektuhan: ${haNum} ha mula sa ${totalHa} ha (${damagePct}%)]`;

    try {
      await createDisasterReport(farmCtx.farmId, {
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
    } catch {
      // Offline Queue Fallback
      queueOfflineAction({
        actionType: "CREATE_DISASTER_REPORT",
        displayTitle: `Ulat ng Kalamidad: ${disasterType} (${damagePct}%)`,
        payload: {
          farmId: farmCtx.farmId,
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
                  I-report ang pinsala sa Mais dulot ng Bagyo, Baha, o Tagtuyot para sa PCIC insurance at emergency assistance.
                </p>
              </div>

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
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
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
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-3 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:border-[#9f1239] transition"
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
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-3 text-sm font-extrabold text-[#9f1239] outline-none focus:border-[#9f1239] transition"
                />
                
                {/* Helper Footnote */}
                <div className="flex justify-between items-center text-[11px] text-slate-500 pt-0.5 font-medium">
                  <span>Kabuuang Sukat: {totalHa} ha</span>
                  <span className="font-bold text-[#9f1239]">
                    ~{damagePct}% Pinsala (₱{estimatedLossPhp.toLocaleString()})
                  </span>
                </div>
              </div>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                Kabuuang Sukat ng Sakahan: {totalHa} ha</p>

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
                  className="w-full rounded-2xl border border-slate-300 bg-white p-3.5 text-xs font-medium text-slate-800 outline-none focus:border-[#9f1239] transition placeholder:text-slate-400 leading-relaxed resize-none"
                />
              </div>

              {/* Hidden File Input */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                capture="environment"
                onChange={handlePhotoSelect}
                className="hidden"
              />

              {/* Section 5: Damage Photo Evidence */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  Litrato ng Nasirang Taniman (Damage Photo Evidence)
                </label>

                <div className="w-full border-2 border-dashed border-rose-300 rounded-3xl p-3 bg-rose-50/20 flex flex-col items-center justify-center relative overflow-hidden transition-colors hover:border-rose-400">
                  {imagePreview ? (
                    <div className="relative w-full rounded-2xl overflow-hidden shadow-inner bg-slate-900 flex items-center justify-center">
                      <img
                        src={imagePreview}
                        alt="Disaster damage evidence"
                        className="w-full max-h-48 object-cover rounded-2xl"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute top-2.5 right-2.5 bg-[#e11d48] hover:bg-[#be123c] text-white font-extrabold text-[11px] px-3.5 py-1 rounded-full shadow-md active:scale-95 transition cursor-pointer"
                      >
                        Palitan
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-6 flex flex-col items-center justify-center gap-2 text-center group cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 text-[#9f1239] flex items-center justify-center group-hover:scale-105 transition shadow-sm">
                        <UploadCloud className="w-6 h-6 stroke-[2.2]" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          Kuhanan ng litrato ang pinsala
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          Ebidensya para sa mabilis na claim ng tulong
                        </p>
                      </div>
                    </button>
                  )}
                </div>
              </div>

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
                    <span>Kinukuha ang pinakabagong status mula sa DA server...</span>
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
                      const statusColor =
                        c.status === "RESOLVED"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : c.status === "INSPECTED"
                          ? "bg-purple-100 text-purple-800 border-purple-300"
                          : c.status === "UNDER_REVIEW"
                          ? "bg-amber-100 text-amber-900 border-amber-300"
                          : c.status === "REJECTED"
                          ? "bg-rose-100 text-rose-800 border-rose-300"
                          : "bg-blue-100 text-blue-800 border-blue-300";

                      const statusTagalog =
                        c.status === "RESOLVED"
                          ? "Aprubado sa Tulong / Payout"
                          : c.status === "INSPECTED"
                          ? "Nainspeksyon na sa Bukid"
                          : c.status === "UNDER_REVIEW"
                          ? "Sinusuri ng Technician"
                          : c.status === "REJECTED"
                          ? "Hindi Naaprubahan"
                          : "Naipasa (Waiting Review)";

                      return (
                        <div
                          key={c.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2 hover:border-slate-300 transition"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <span className="font-extrabold text-xs sm:text-sm text-slate-900">
                                Kalamidad: {c.disasterType}
                              </span>
                              <p className="text-[10px] text-slate-400">
                                Naitala noong:{" "}
                                {new Date(c.createdAt).toLocaleDateString("fil-PH", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </p>
                            </div>

                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-black border ${statusColor}`}
                            >
                              {statusTagalog}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60">
                            <div>
                              <span className="text-[10px] text-slate-500">Antas ng Sira:</span>
                              <p className="font-bold text-rose-700">{c.damagePercentage}% Pinsala</p>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500">Tinatayang Lugi:</span>
                              <p className="font-bold text-slate-800">
                                ₱{Number(c.estimatedLoss || 0).toLocaleString()}
                              </p>
                            </div>
                          </div>

                          {c.notes && (
                            <p className="text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/80 leading-snug">
                              {c.notes}
                            </p>
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

export default FarmerDisasterReportPage;
