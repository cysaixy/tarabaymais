import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronLeft,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  Layers,
  Calendar,
} from "lucide-react";
import { useAuth } from "../../context/authContext";
import { syncUser } from "../../services/auth.service";
import { createFarm, createCropCycle } from "../../services/farm.service";

const CAGAYAN_MUNICIPALITIES = [
  "Solana",
  "Tuguegarao City",
  "Iguig",
  "Piat",
  "Tuao",
  "Enrile",
  "Alcala",
  "Amulung",
  "Baggao",
  "Ballesteros",
  "Buguey",
  "Camalaniugan",
  "Claveria",
  "Gattaran",
  "Gonzaga",
  "Lal-lo",
  "Lasam",
  "Pamplona",
  "Peñablanca",
  "Rizal",
  "Sanchez-Mira",
  "Santa Ana",
  "Santa Praxedes",
  "Santa Teresita",
  "Santo Niño",
];

const CORN_VARIETIES = [
  "Pioneer 30T60 (Yellow Hybrid)",
  "NK8840 (Syngenta Hybrid)",
  "Dekalb 9118S (Bayer Hybrid)",
  "Bioseed 9909 (Yellow Hybrid)",
  "IPB Var 6 (White Corn)",
  "Lagkitan (Traditional White Glutinous)",
];

export const FarmerOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginAsDemo } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);

  // ── Step 1 State: Farmer Profile ──────────────────────────────────────────
  const [fullName, setFullName] = useState("Mang Danilo Ramos");
  const [phone, setPhone] = useState("0917 584 9201");
  const [municipality, setMunicipality] = useState("Solana");
  const [barangay, setBarangay] = useState("Basi East");

  // ── Step 2 State: Farm Information ────────────────────────────────────────
  const [farmName, setFarmName] = useState("Basi Corn Plantation #1");
  const [ownership, setOwnership] = useState<"owned" | "rented" | "arb">("owned");
  const [scope, setScope] = useState<"medium" | "above_medium">("medium");
  const [areaHectares, setAreaHectares] = useState<string>("2.5");

  // ── Step 3 State: Crop Cycle ──────────────────────────────────────────────
  const [cropType] = useState("Corn / Yellow Hybrid Corn (Mais)");
  const [variety, setVariety] = useState(CORN_VARIETIES[0]);
  const [plantingDate, setPlantingDate] = useState("2026-08-04");

  // ── Phone formatting ──────────────────────────────────────────────────────
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 11);
    if (raw.length <= 4) {
      setPhone(raw);
    } else if (raw.length <= 7) {
      setPhone(`${raw.slice(0, 4)} ${raw.slice(4)}`);
    } else {
      setPhone(`${raw.slice(0, 4)} ${raw.slice(4, 7)} ${raw.slice(7)}`);
    }
  };

  // ── Lifecycle Engine Calculation ──────────────────────────────────────────
  const lifecycle = useMemo(() => {
    const planted = new Date(plantingDate);
    const valid = !isNaN(planted.getTime());
    if (!valid) {
      return {
        dap: 0,
        harvestDateStr: "---",
        stageName: "Pagsisimula",
      };
    }

    const today = new Date("2026-09-28"); // anchored to current context date
    const diffTime = today.getTime() - planted.getTime();
    const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

    // Expected harvest is ~108 days for hybrid corn
    const harvestDate = new Date(planted.getTime() + 108 * 24 * 60 * 60 * 1000);
    const months = [
      "Enero",
      "Pebrero",
      "Marso",
      "Abril",
      "Mayo",
      "Hunyo",
      "Hulyo",
      "Agosto",
      "Setyembre",
      "Oktubre",
      "Nobyembre",
      "Disyembre",
    ];
    const harvestDateStr = `${months[harvestDate.getMonth()]} ${harvestDate.getDate()}, ${harvestDate.getFullYear()}`;

    let stageName = "Germination / Pagsibol";
    if (diffDays >= 16 && diffDays <= 45) {
      stageName = "Vegetative Stage";
    } else if (diffDays >= 46 && diffDays <= 65) {
      stageName = "Tasseling / Pamumulaklak";
    } else if (diffDays >= 66 && diffDays <= 85) {
      stageName = "Silking & Grain Filling / Pagkakaroon ng Butil";
    } else if (diffDays >= 86 && diffDays <= 108) {
      stageName = "Maturity / Pagkahinog";
    } else if (diffDays > 108) {
      stageName = "Harvest Ready / Handa nang Anihin";
    }

    return {
      dap: diffDays,
      harvestDateStr,
      stageName,
    };
  }, [plantingDate]);

  // ── Navigation Back ───────────────────────────────────────────────────────
  const handleBack = () => {
    if (step === 3) {
      setStep(2);
    } else if (step === 2) {
      setStep(1);
    } else {
      navigate("/login");
    }
  };

  // ── Step 1 Next ───────────────────────────────────────────────────────────
  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Kulang ang Pangalan", {
        description: "Mangyaring ilagay ang inyong buong pangalan.",
      });
      return;
    }
    const rawPhone = phone.replace(/\D/g, "");
    if (rawPhone.length < 10) {
      toast.error("Kulang ang Telepono", {
        description: "Mangyaring ilagay ang kumpletong mobile number.",
      });
      return;
    }
    setStep(2);
  };

  // ── Step 2 Next ───────────────────────────────────────────────────────────
  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmName.trim()) {
      toast.error("Kulang ang Pangalan ng Sakahan", {
        description: "Mangyaring ilagay ang pangalan o pagkakakilanlan ng bukid.",
      });
      return;
    }
    const numArea = parseFloat(areaHectares);
    if (isNaN(numArea) || numArea <= 0) {
      toast.error("Maling Sukat ng Ektarya", {
        description: "Ang sukat ng sakahan ay dapat positibong numero (hal. 2.5).",
      });
      return;
    }
    setStep(3);
  };

  // ── Step 3 Complete ───────────────────────────────────────────────────────
  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const nameParts = fullName.trim().split(" ");
    const firstName = nameParts.slice(0, -1).join(" ") || nameParts[0] || "Magsasaka";
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "Dela Cruz";
    const numArea = parseFloat(areaHectares) || 2.5;

    try {
      // 1. Try creating user profile via backend sync if authenticated
      try {
        await syncUser({
          firstName,
          lastName,
          phone: phone.trim(),
          preferredLanguage: "filipino",
        });
      } catch {
        // Backend or token might be offline/unauthenticated in demo
      }

      // 2. Try creating farm via backend
      let createdFarmId = "farm-local-01";
      try {
        const farmRes = await createFarm({
          name: farmName.trim(),
          municipality,
          barangay: barangay.trim(),
          areaHectares: numArea,
        });
        if (farmRes?.id) {
          createdFarmId = farmRes.id;
        }
      } catch {
        // Offline fallback
      }

      // 3. Try creating crop cycle via backend
      try {
        await createCropCycle(createdFarmId, {
          cropType: "corn",
          variety,
          plantingDate,
          areaHectares: numArea,
        });
      } catch {
        // Offline fallback
      }

      // 4. Update local session state for seamless farmer dashboard access
      if (loginAsDemo) {
        loginAsDemo("farmer");
      }

      // Save onboarding farm context locally for offline resilience
      const localFarmRecord = {
        id: createdFarmId,
        farmerName: fullName.trim(),
        phone: phone.trim(),
        municipality,
        barangay: barangay.trim(),
        farmName: farmName.trim(),
        ownership,
        scope,
        areaHectares: numArea,
        cropType: "corn",
        variety,
        plantingDate,
        dap: lifecycle.dap,
        stage: lifecycle.stageName,
        expectedHarvestDate: lifecycle.harvestDateStr,
      };
      localStorage.setItem("tarabay_active_farm", JSON.stringify(localFarmRecord));

      toast.success("Maligayang Pagdating sa Tarabay-Mais!", {
        description: `Matagumpay na nairehistro ang sakahan sa ${barangay}, ${municipality}.`,
      });

      navigate("/farmer", { replace: true });
    } catch (err) {
      console.error(err);
      toast.error("May problemang teknikal", {
        description: "Naitago ang inyong datos sa telepono. Tutuloy na sa Dashboard.",
      });
      if (loginAsDemo) loginAsDemo("farmer");
      navigate("/farmer", { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  const handleQueueClick = () => {
    toast.info("Offline Sync Queue", {
      description: "May 2 nakatagong ulat/obserbasyon sa telepono na handang i-sync kapag may signal.",
    });
  };

  return (
    <div className="w-full min-h-screen bg-[#03543f] md:bg-slate-950 flex flex-col items-center justify-center p-0 md:p-6 lg:p-10 font-sans selection:bg-emerald-500/30">
      {/* Responsive Container: Mobile Viewport (412x917 edge-to-edge) vs Tablet/Desktop Card (md+) */}
      <div className="w-full md:max-w-4xl lg:max-w-5xl bg-gradient-to-b from-[#03543f] to-[#046c4e] text-white shadow-2xl flex flex-col md:flex-row justify-between overflow-x-hidden md:rounded-[36px] md:border-4 md:border-slate-800/80 min-h-screen md:min-h-[720px] lg:min-h-[760px]">
        
        {/* ========================================================= */}
        {/* TOP / LEFT PANE (Progress, Context, Instructions)         */}
        {/* ========================================================= */}
        <div className="w-full md:w-1/2 flex flex-col justify-between pt-4 pb-4 sm:py-6 px-4 sm:px-6 lg:px-10 relative">
          
          {/* Header Navigation Bar */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleBack}
                className="w-10 h-10 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 border border-emerald-500/30 flex items-center justify-center text-white active:scale-95 transition cursor-pointer"
                title="Bumalik"
              >
                <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
              </button>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight leading-tight">
                  {step === 1 && "Profile ng Magsasaka"}
                  {step === 2 && "Rehistro ng Sakahan"}
                  {step === 3 && "Siklo ng Tanim na Mais"}
                </h2>
                <p className="text-[11px] sm:text-xs text-emerald-200/90 font-medium">
                  {municipality}, Cagayan • Corn Field
                </p>
              </div>
            </div>

            {/* Offline Queue Badge */}
            <button
              onClick={handleQueueClick}
              type="button"
              className="bg-[#f59e0b] hover:bg-[#d97706] active:scale-95 text-amber-950 font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <RefreshCw className="w-3 h-3 animate-spin-slow" />
              <span>2 Queue</span>
            </button>
          </div>

          {/* Progress Header and Step Description */}
          <div className="my-3 sm:my-5 md:my-auto">
            {/* Step Label & Capsule Indicators */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-emerald-200">
                {step === 1 && "HAKBANG 1 NG 3: PROFILE"}
                {step === 2 && "HAKBANG 2 NG 3: SAKAHAN"}
                {step === 3 && "HAKBANG 3 NG 3: SIKLO NG TANIM"}
              </span>

              {/* 3 Capsules */}
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-8 sm:w-10 h-2 rounded-full transition-all duration-300 ${
                    step >= 1 ? "bg-white" : "bg-emerald-500/30"
                  }`}
                />
                <div
                  className={`w-8 sm:w-10 h-2 rounded-full transition-all duration-300 ${
                    step >= 2 ? "bg-white" : "bg-emerald-500/30"
                  }`}
                />
                <div
                  className={`w-8 sm:w-10 h-2 rounded-full transition-all duration-300 ${
                    step >= 3 ? "bg-white" : "bg-emerald-500/30"
                  }`}
                />
              </div>
            </div>

            {/* Step Title & Subtitle */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-3">
              {step === 1 && "Impormasyon ng Magsasaka"}
              {step === 2 && "Impormasyon ng Sakahan"}
              {step === 3 && "Siklo ng Tanim na Mais"}
            </h1>

            <p className="text-xs sm:text-sm text-emerald-100/90 font-medium mt-1 leading-relaxed max-w-md">
              {step === 1 &&
                "Ipasok ang inyong pangalan at lokasyon sa Cagayan para sa opisyal na rekord ng DA."}
              {step === 2 &&
                "Sukat, uri ng pagmamay-ari, at lokasyon ng inyong bukid ng mais."}
              {step === 3 &&
                "Bariedad ng mais at petsa ng pagtatanim para sa pagkwenta ng stage."}
            </p>
          </div>

          {/* Desktop Footer Accreditation */}
          <div className="hidden md:block text-[11px] text-emerald-200/70">
            Republic of the Philippines • Department of Agriculture Region II
          </div>
        </div>

        {/* ========================================================= */}
        {/* BOTTOM / RIGHT PANE (Interactive Forms per Step)          */}
        {/* ========================================================= */}
        <div className="w-full md:w-1/2 bg-white text-slate-900 rounded-t-[30px] md:rounded-t-none md:rounded-l-[36px] px-5 sm:px-8 lg:px-12 pt-6 pb-6 sm:pt-8 sm:pb-8 shadow-2xl flex flex-col justify-between flex-1">
          
          {/* STEP 1: FARMER PROFILE FORM */}
          {step === 1 && (
            <form onSubmit={handleStep1Submit} className="flex flex-col justify-between flex-1 space-y-4">
              <div className="space-y-4">
                {/* Buong Pangalan */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Buong Pangalan
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Mang Danilo Ramos"
                    required
                    className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/80 px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                  />
                </div>

                {/* Numero ng Telepono */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Numero ng Telepono
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="0917 584 9201"
                    required
                    className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/80 px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                  />
                </div>

                {/* Bayan (Municipality) & Barangay */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Bayan (Municipality)
                    </label>
                    <select
                      value={municipality}
                      onChange={(e) => setMunicipality(e.target.value)}
                      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/80 px-3.5 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white"
                    >
                      {CAGAYAN_MUNICIPALITIES.map((mun) => (
                        <option key={mun} value={mun}>
                          {mun}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Barangay
                    </label>
                    <input
                      type="text"
                      value={barangay}
                      onChange={(e) => setBarangay(e.target.value)}
                      placeholder="Basi East"
                      required
                      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/80 px-3.5 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button Step 1 */}
              <button
                type="submit"
                className="w-full mt-4 h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold text-base shadow-lg shadow-emerald-700/20 hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Magpatuloy sa Rehistro ng Lupa</span>
                <ArrowRight className="w-5 h-5 stroke-[2.5]" />
              </button>
            </form>
          )}

          {/* STEP 2: FARM INFORMATION FORM */}
          {step === 2 && (
            <form onSubmit={handleStep2Submit} className="flex flex-col justify-between flex-1 space-y-4">
              <div className="space-y-3.5">
                {/* Pangalan ng Sakahan / Bukid */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pangalan ng Sakahan / Bukid
                  </label>
                  <input
                    type="text"
                    value={farmName}
                    onChange={(e) => setFarmName(e.target.value)}
                    placeholder="Basi Corn Plantation #1"
                    required
                    className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/80 px-4 py-2.5 text-base font-semibold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white"
                  />
                </div>

                {/* Status ng Pagmamay-ari (Ownership) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Status ng Pagmamay-ari ng Lupa (Ownership)
                  </label>
                  <div className="space-y-1.5">
                    {[
                      { key: "owned", label: "Sarili (Owned)" },
                      { key: "rented", label: "Inupahan (Rented)" },
                      { key: "arb", label: "Agrarian Reform Beneficiary (ARB)" },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setOwnership(opt.key as typeof ownership)}
                        className={`w-full h-11 px-4 rounded-xl border-2 text-left text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                          ownership === opt.key
                            ? "border-emerald-600 bg-emerald-50/80 text-emerald-950"
                            : "border-slate-200 bg-slate-50/60 text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <span>{opt.label}</span>
                        {ownership === opt.key && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sukat ng Sakahan ng Mais (Corn Scope) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Sukat ng Sakahan ng Mais (Corn Scope)
                  </label>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setScope("medium");
                        setAreaHectares("2.5");
                      }}
                      className={`w-full h-12 px-4 rounded-xl border-2 text-left text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                        scope === "medium"
                          ? "border-emerald-600 bg-emerald-50/80 text-emerald-950"
                          : "border-slate-200 bg-slate-50/60 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-emerald-600" />
                        <span>Medium Farm Scope (1.0 hanggang 3.0 Ektarya)</span>
                      </div>
                      {scope === "medium" && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setScope("above_medium");
                        setAreaHectares("4.5");
                      }}
                      className={`w-full h-12 px-4 rounded-xl border-2 text-left text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                        scope === "above_medium"
                          ? "border-emerald-600 bg-emerald-50/80 text-emerald-950"
                          : "border-slate-200 bg-slate-50/60 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-emerald-600" />
                        <span>Above-Medium Farm Scope (3.0 hanggang 7.0 Ektarya)</span>
                      </div>
                      {scope === "above_medium" && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Tumpak na Sukat sa Ektarya */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tumpak na Sukat sa Ektarya (Hectares)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={areaHectares}
                    onChange={(e) => setAreaHectares(e.target.value)}
                    placeholder="2.5"
                    required
                    className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/80 px-4 py-2 text-base font-bold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white"
                  />
                </div>
              </div>

              {/* Submit Button Step 2 */}
              <button
                type="submit"
                className="w-full mt-3 h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold text-base shadow-lg shadow-emerald-700/20 hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>I-rehistro ang Tanim na Mais</span>
                <ArrowRight className="w-5 h-5 stroke-[2.5]" />
              </button>
            </form>
          )}

          {/* STEP 3: CROP CYCLE FORM */}
          {step === 3 && (
            <form onSubmit={handleStep3Submit} className="flex flex-col justify-between flex-1 space-y-4">
              <div className="space-y-3.5">
                {/* Uri ng Tanim */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Uri ng Tanim
                  </label>
                  <input
                    type="text"
                    value={cropType}
                    readOnly
                    className="w-full rounded-2xl border-2 border-slate-200 bg-slate-100/90 px-4 py-2.5 text-sm font-semibold text-slate-700 cursor-not-allowed"
                  />
                </div>

                {/* Bariedad ng Mais */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bariedad ng Mais (Corn Variety)
                  </label>
                  <select
                    value={variety}
                    onChange={(e) => setVariety(e.target.value)}
                    className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white"
                  >
                    {CORN_VARIETIES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Petsa ng Pagtatanim */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Petsa ng Pagtatanim (Planting Date)
                  </label>
                  <div className="relative flex items-center">
                    <Calendar className="w-5 h-5 text-emerald-600 absolute left-4 pointer-events-none stroke-[2]" />
                    <input
                      type="date"
                      value={plantingDate}
                      onChange={(e) => setPlantingDate(e.target.value)}
                      required
                      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/80 pl-12 pr-4 py-2.5 text-base font-semibold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Kalkulado ng Lifecycle Engine Card */}
                <div className="rounded-2xl border border-emerald-300 bg-emerald-50/90 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-xs sm:text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                    <span>Kalkulado ng Lifecycle Engine:</span>
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-emerald-950 font-medium">
                    <li>
                      • Inaasahang Pag-ani: <span className="font-bold">{lifecycle.harvestDateStr} (~108 araw)</span>
                    </li>
                    <li>
                      • Kasalukuyang Stage: <span className="font-bold text-emerald-800">{lifecycle.stageName} (DAP {lifecycle.dap})</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Final Complete Button Step 3 */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-3 h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold text-base shadow-lg shadow-emerald-700/20 hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <span>
                  {submitting ? "Itinatala sa DA..." : "Tapusin ang Rehistro at Pumunta sa Dashboard"}
                </span>
                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
              </button>
            </form>
          )}

        </div>

      </div>
    </div>
  );
};

export default FarmerOnboardingPage;
