import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronLeft,
  RefreshCw,
  Camera,
  CheckCircle2,
  ArrowRight,
  UploadCloud,
} from "lucide-react";
import {
  createObservation,
  type SeverityLevel,
} from "../../services/observation.service";
import {
  getOfflineQueue,
  queueOfflineAction,
} from "../../services/sync.service";

interface FarmContext {
  farmName: string;
  farmerName: string;
  municipality: string;
  barangay: string;
  variety: string;
  cropCycleId: string;
}

const SYMPTOM_OPTIONS = [
  "Butas-butas na dahon (Uod/FAW)",
  "Paninilaw sa gilid ng dahon (Yellowing)",
  "Natutuyo o brown na dulo",
  "Maliit o bansot na paglaki",
  "Panlalanta sa tanghali (Wilt)",
  "Linta o amag sa basang bahagi",
];

export const FarmerObservationPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Farm Context
  const [farmData, setFarmData] = useState<FarmContext>({
    farmName: "Basi Corn Plantation #1",
    farmerName: "Mang Danilo Ramos",
    municipality: "Solana",
    barangay: "Basi East",
    variety: "Pioneer 30T60",
    cropCycleId: "cycle-local-01",
  });

  const [queueCount, setQueueCount] = useState(2);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([
    "Butas-butas na dahon (Uod/FAW)",
  ]);
  const [affectedPercent, setAffectedPercent] = useState<number>(15);
  const [description, setDescription] = useState<string>(
    "Nakakita ng maliit na uod sa puso ng mais at ilang butas sa dahon."
  );

  // Photo Input state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  // Load local context on mount
  useEffect(() => {
    try {
      const savedFarm = localStorage.getItem("tarabay_active_farm");
      if (savedFarm) {
        const parsed = JSON.parse(savedFarm);
        setFarmData((prev) => ({
          ...prev,
          farmName: parsed.farmName || prev.farmName,
          farmerName: parsed.farmerName || prev.farmerName,
          municipality: parsed.municipality || prev.municipality,
          barangay: parsed.barangay || prev.barangay,
          variety: parsed.variety || prev.variety,
          cropCycleId: parsed.cropCycleId || prev.cropCycleId,
        }));
      }
    } catch {
      // Ignore
    }

    const q = getOfflineQueue();
    if (q.length > 0) {
      setQueueCount(q.length);
    }
  }, []);

  // Compute severity from affected percentage
  const getSeverity = (pct: number): SeverityLevel => {
    if (pct <= 20) return "LOW";
    if (pct <= 40) return "MEDIUM";
    if (pct <= 70) return "HIGH";
    return "CRITICAL";
  };

  const severity = getSeverity(affectedPercent);

  // Handle Photo selection
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      toast.success("Nailakip ang litrato ng tanim!");
    }
  };

  const handleToggleSymptom = (symptom: string) => {
    setSelectedSymptoms((prev) => {
      if (prev.includes(symptom)) {
        // Keep at least one or let empty
        return prev.filter((s) => s !== symptom);
      } else {
        return [...prev, symptom];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSymptoms.length === 0 && !description.trim()) {
      toast.error("Pumili ng kahit isang sintomas o magbigay ng paliwanag.");
      return;
    }

    setSubmitting(true);
    const title =
      selectedSymptoms.length > 0
        ? selectedSymptoms[0]
        : "Obserbasyon sa Sakahan";

    const fullDescription = `${description.trim()}\n\n[Tantiya na Naapektuhan: ${affectedPercent}% ng Sakahan]${
      selectedSymptoms.length > 1
        ? `\n[Iba pang Sintomas: ${selectedSymptoms.slice(1).join(", ")}]`
        : ""
    }`;

    try {
      const res = await createObservation({
        cropCycleId: farmData.cropCycleId,
        title,
        description: fullDescription,
        severity,
        image: imageFile,
      });

      if (res.autoEscalatedCase) {
        toast.warning("Mataas ang Pinsala (Auto-Escalated)", {
          description:
            "Awtomatikong naipasa ang kaso sa LGU Agricultural Technician para sa agarang pagsusuri.",
        });
      } else {
        toast.success("Matagumpay na Naitala!", {
          description: "Nai-save ang obserbasyon sa record ng inyong sakahan.",
        });
      }

      navigate("/farmer");
    } catch {
      // Offline fallback: Queue locally
      queueOfflineAction({
        actionType: "CREATE_OBSERVATION",
        displayTitle: title,
        payload: {
          cropCycleId: farmData.cropCycleId,
          title,
          description: fullDescription,
          severity,
          imageUrl: imagePreview || undefined,
        },
      });

      setQueueCount((prev) => prev + 1);

      toast.info("Nai-save sa Offline Storage (Queue)", {
        description:
          "Dahil mahina o walang cellular signal, itinago ito sa telepono. Awtomatikong mai-sync sa DA server kapag nagkaroon ng koneksyon.",
      });

      navigate("/farmer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleQueueClick = () => {
    toast.info("Offline Sync Queue", {
      description: `May ${queueCount} nakatagong ulat/obserbasyon sa telepono na handang i-sync.`,
    });
  };

  return (
    <div className="w-full min-h-screen bg-slate-100 md:bg-slate-950 flex flex-col items-center justify-start p-0 md:p-6 lg:p-8 font-sans selection:bg-purple-500/30">
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
                Pagsusuri sa Tanim
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
          <div className="w-full bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-5">
            
            {/* Card Header */}
            <div>
              <div className="flex items-center gap-2 text-[#7e22ce]">
                <Camera className="w-5 h-5 stroke-[2.4]" />
                <h2 className="text-base sm:text-lg font-black tracking-tight text-[#7e22ce]">
                  Record Crop Observation
                </h2>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-snug">
                Mag-upload o kumuha ng litrato at itala ang mga nakikitang sintomas.
              </p>
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

            {/* Section 1: Photo Input */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                Litrato ng Sintomas o Tanim (Photo Input)
              </label>

              <div className="w-full border-2 border-dashed border-purple-300 rounded-3xl p-3 bg-purple-50/20 flex flex-col items-center justify-center relative overflow-hidden transition-colors hover:border-purple-400">
                {imagePreview ? (
                  <div className="relative w-full rounded-2xl overflow-hidden shadow-inner bg-slate-900 flex items-center justify-center">
                    <img
                      src={imagePreview}
                      alt="Crop symptom preview"
                      className="w-full max-h-56 object-cover rounded-2xl"
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
                    className="w-full py-8 flex flex-col items-center justify-center gap-2.5 text-center group cursor-pointer"
                  >
                    <div className="w-13 h-13 rounded-2xl bg-purple-100 border border-purple-200 text-purple-700 flex items-center justify-center group-hover:scale-105 transition shadow-sm">
                      <UploadCloud className="w-7 h-7 stroke-[2.2]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Pindutin upang kumuha ng litrato o mag-upload
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium">
                        Kamera o Gallery (One-Tap Camera)
                      </p>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Section 2: Symptom Checklist */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-800">
                Mga Nakikitang Sintomas (Symptom Checklist)
              </label>

              <div className="space-y-2">
                {SYMPTOM_OPTIONS.map((symptom, idx) => {
                  const isChecked = selectedSymptoms.includes(symptom);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleToggleSymptom(symptom)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left flex items-center justify-between text-xs font-semibold transition active:scale-[0.99] cursor-pointer ${
                        isChecked
                          ? "border-purple-500 bg-purple-50/70 text-purple-950 font-bold shadow-sm"
                          : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <span>{symptom}</span>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                          isChecked
                            ? "border-purple-600 bg-purple-600 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isChecked && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Affected Percentage Slider */}
            <div className="space-y-2 pt-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-800">
                  Tantiya na Naapektuhang Bahagi
                </span>
                <span className="font-black text-[#7e22ce] text-sm">
                  {affectedPercent}% ng Sakahan
                </span>
              </div>

              <input
                type="range"
                min="1"
                max="100"
                value={affectedPercent}
                onChange={(e) => setAffectedPercent(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#7e22ce]"
              />

              {/* Dynamic Severity Hint */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                <span>Antas ng Pinsala:</span>
                <span
                  className={`font-black rounded-full px-2 py-0.5 ${
                    severity === "LOW"
                      ? "bg-emerald-100 text-emerald-800"
                      : severity === "MEDIUM"
                      ? "bg-amber-100 text-amber-800"
                      : severity === "HIGH"
                      ? "bg-orange-100 text-orange-800"
                      : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {severity === "LOW"
                    ? "Mababa (Normal)"
                    : severity === "MEDIUM"
                    ? "Katamtaman"
                    : severity === "HIGH"
                    ? "Mataas (Auto-Escalate sa LGU)"
                    : "Kritikal (Urgent Inspection)"}
                </span>
              </div>
            </div>

            {/* Section 4: Description Textarea */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-bold text-slate-800">
                Paliwanag o Karagdagang Obserbasyon
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ilarawan ang nakikita sa dahon, tangkay, o lupa..."
                className="w-full rounded-2xl border border-slate-300 bg-white p-3.5 text-xs font-medium text-slate-800 outline-none focus:border-purple-600 transition placeholder:text-slate-400 leading-relaxed resize-none"
              />
            </div>

            {/* Section 5: AI Scanner Banner */}
            <div className="rounded-2xl border border-purple-200 bg-purple-50/60 p-4 flex items-center justify-between gap-3 shadow-xs">
              <div className="space-y-0.5">
                <h3 className="text-xs sm:text-sm font-extrabold text-[#7e22ce] leading-tight">
                  Gusto mo bang suriin ito ng AI Scanner?
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-600 font-medium">
                  Aalamin ng Computer Vision ang uri ng peste o sakit.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  toast.info("AI Scanner", {
                    description:
                      "Maaari mong gamitin ang AI scanner sa Dashboard para sa instant computer vision diagnosis.",
                  });
                  navigate("/farmer");
                }}
                className="bg-[#7e22ce] hover:bg-[#6b21a8] active:scale-95 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1 shrink-0 shadow-sm transition cursor-pointer"
              >
                <span>I-Scan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Section 6: Primary Submit Button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full h-14 rounded-2xl bg-[#7e22ce] hover:bg-[#6b21a8] active:scale-[0.98] text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Isinusumite ang Obserbasyon...</span>
                </>
              ) : (
                <>
                  <span>I-save ang Obserbasyon</span>
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

export default FarmerObservationPage;
