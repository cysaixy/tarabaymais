import React, { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FirebaseError } from "firebase/app";
import type { ConfirmationResult } from "firebase/auth";
import { toast } from "sonner";
import {
  ChevronLeft,
  ArrowRight,
  CheckCircle2,
  Layers,
  Calendar,
  Phone,
  KeyRound,
} from "lucide-react";
import { OtpInput } from "../../components/OtpInput";
import { useAuth, isMunicipalRole } from "../../context/authContext";
import {
  sendOtp,
  confirmOtp,
  registerProfile,
  toE164PH,
} from "../../services/auth.service";
import {
  getRecaptchaVerifier,
  clearRecaptchaVerifier,
  auth,
} from "../../firebase";
import { createFarm, createCropCycle } from "../../services/farm.service";

import {
  CAGAYAN_LOCATION_DATA,
  CAGAYAN_MUNICIPALITIES,
} from "../../data/cagayanLocations";

const CORN_VARIETIES = [
  "Pioneer 30T60 (Yellow Hybrid)",
  "NK8840 (Syngenta Hybrid)",
  "Dekalb 9118S (Bayer Hybrid)",
  "Bioseed 9909 (Yellow Hybrid)",
  "IPB Var 6 (White Corn)",
  "Lagkitan (Traditional White Glutinous)",
];

type Step = 0 | 1 | 2 | 3; // 0 = auth (phone/OTP), 1 = profile, 2 = farm, 3 = crop

const friendlyAuthError = (err: unknown): string => {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "auth/invalid-phone-number":
        return "Hindi wasto ang numero ng telepono.";
      case "auth/invalid-verification-code":
        return "Maling OTP code. Pakisubukan muli.";
      case "auth/code-expired":
        return "Nag-expire na ang code. Humiling ng bago.";
      case "auth/too-many-requests":
        return "Masyadong maraming subok. Pakisubukan mamaya.";
      case "auth/operation-not-allowed":
        return "Naka-disable ang Phone Auth o hindi pa na-add ang test phone number sa Firebase Console.";
      default:
        return "Nabigo ang pagpapatunay. Pakisubukan muli.";
    }
  }
  return "May problemang teknikal. Pakisubukan muli.";
};

export const FarmerOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, role, loading: authLoading, refreshProfile } = useAuth();

  // If already authenticated with a valid profile, skip onboarding and route to dashboard immediately
  useEffect(() => {
    if (!authLoading && user && profile && role) {
      navigate(isMunicipalRole(role) ? "/officer/dashboard" : "/farmer", {
        replace: true,
      });
    }
  }, [authLoading, user, profile, role, navigate]);

  const [step, setStep] = useState<Step>(0);
  const [submitting, setSubmitting] = useState(false);
  const createdFarmRef = useRef<string | null>(null);

  // ── Step 0 State: Phone Auth ──────────────────────────────────────────────
  const [authSubStep, setAuthSubStep] = useState<"phone" | "otp">("phone");
  const [otp, setOtp] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(
    null,
  );

  // ── Step 1 State: Farmer Profile ──────────────────────────────────────────
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [rsbsaNumber, setRsbsaNumber] = useState("");
  const [municipality, setMunicipality] = useState("Solana");
  const [barangay, setBarangay] = useState("");

  const availableBarangays = useMemo(() => {
    return CAGAYAN_LOCATION_DATA[municipality] || [];
  }, [municipality]);

  const handleMunicipalityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextMun = e.target.value;
    setMunicipality(nextMun);
    setBarangay("");
  };

  // ── Step 2 State: Farm Information ────────────────────────────────────────
  const [farmName, setFarmName] = useState("");
  const [ownership, setOwnership] = useState<"owned" | "rented" | "arb">(
    "owned",
  );
  const [scope, setScope] = useState<"medium" | "above_medium">("medium");
  const [areaHectares, setAreaHectares] = useState<string>("2.5");

  // ── Step 3 State: Crop Cycle ──────────────────────────────────────────────
  const [cropType] = useState("Corn / Yellow Hybrid Corn (Mais)");
  const [variety, setVariety] = useState(CORN_VARIETIES[0]);
  const [plantingDate, setPlantingDate] = useState("2026-08-04");

  // ── Phone formatting supporting 09XX XXX XXXX as well as +639XX... ──────────
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, "");
    if (raw.startsWith("63") && raw.length > 2) {
      raw = "0" + raw.slice(2);
    }
    raw = raw.slice(0, 11);

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
      return { dap: 0, harvestDateStr: "---", stageName: "Pagsisimula" };
    }

    const today = new Date();
    const diffTime = today.getTime() - planted.getTime();
    const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

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
    if (diffDays >= 16 && diffDays <= 45) stageName = "Vegetative Stage";
    else if (diffDays >= 46 && diffDays <= 65)
      stageName = "Tasseling / Pamumulaklak";
    else if (diffDays >= 66 && diffDays <= 85)
      stageName = "Silking & Grain Filling / Pagkakaroon ng Butil";
    else if (diffDays >= 86 && diffDays <= 108)
      stageName = "Maturity / Pagkahinog";
    else if (diffDays > 108) stageName = "Harvest Ready / Handa nang Anihin";

    return { dap: diffDays, harvestDateStr, stageName };
  }, [plantingDate]);

  // ── Navigation Back ───────────────────────────────────────────────────────
  const handleBack = () => {
    if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
    else if (step === 1) {
      // Going back from profile means abandoning the authenticated session.
      void auth.signOut();
      setStep(0);
      setAuthSubStep("phone");
    } else {
      navigate("/login");
    }
  };

  // ── Step 0a: send OTP ─────────────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawPhone = phone.replace(/\D/g, "");
    if (rawPhone.length < 10) {
      toast.error("Kulang ang Telepono", {
        description: "Mangyaring ilagay ang kumpletong mobile number.",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Clear any prior / errored recaptcha verifier so retries work seamlessly
      clearRecaptchaVerifier();
      const verifier = getRecaptchaVerifier();
      const result = await sendOtp(phone, verifier);
      setConfirmation(result);
      setAuthSubStep("otp");
      toast.success("Naipadala ang OTP Code", {
        description: `Ipinadala sa ${toE164PH(phone)}. Ilagay ang 6-digit code.`,
      });
    } catch (err) {
      console.error(err);
      clearRecaptchaVerifier();
      toast.error("Hindi maipadala ang code", {
        description: friendlyAuthError(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step 0b: confirm OTP → advance to profile ─────────────────────────────
  const handleConfirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmation) return;
    if (otp.length !== 6) {
      toast.error("Kulang ang OTP Code", {
        description: "Mangyaring ilagay ang kumpletong 6-digit code.",
      });
      return;
    }

    setSubmitting(true);
    try {
      await confirmOtp(confirmation, otp);
      clearRecaptchaVerifier();
      toast.success("Napatunayan ang Numero", {
        description: "Ipagpatuloy ang pagpapatala ng inyong profile.",
      });
      setStep(1);
    } catch (err) {
      console.error(err);
      toast.error("Maling Code", { description: friendlyAuthError(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendReset = async () => {
    clearRecaptchaVerifier();
    setOtp("");
    setConfirmation(null);
    setAuthSubStep("phone");
    try {
      if (auth.currentUser) await auth.signOut();
    } catch {
      /* no-op */
    }
  };

  // ── Step 1 Next ───────────────────────────────────────────────────────────
  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Kulang ang Pangalan", {
        description: "Mangyaring ilagay ang pangalan at apelyido.",
      });
      return;
    }
    if (!barangay.trim()) {
      toast.error("Kulang ang Barangay", {
        description: "Mangyaring pumili ng inyong barangay.",
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
        description: "Mangyaring ilagay ang pangalan ng bukid.",
      });
      return;
    }
    const numArea = parseFloat(areaHectares);
    if (isNaN(numArea) || numArea <= 0) {
      toast.error("Maling Sukat ng Ektarya", {
        description: "Ang sukat ay dapat positibong numero (hal. 2.5).",
      });
      return;
    }
    setStep(3);
  };

  // ── Step 3 Complete: register profile + farm + crop cycle ─────────────────
  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitting) return;

    if (!auth.currentUser) {
      toast.error("Nawala ang Session", {
        description: "Mangyaring ulitin ang pagpapatunay ng numero.",
      });
      setStep(0);
      setAuthSubStep("phone");
      return;
    }

    setSubmitting(true);
    const numArea = parseFloat(areaHectares) || 2.5;

    try {
      // Step A: create the backend User + FarmerProfile (UID derived from token).
      await registerProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: toE164PH(phone),
        rsbsaNumber: rsbsaNumber.trim() || undefined,
        preferredLanguage: "filipino",
      });

      // Step B: create the farm (or reuse if a previous attempt already created it).
      let currentFarmId = createdFarmRef.current;
      if (!currentFarmId) {
        const farm = await createFarm({
          name: farmName.trim(),
          municipality,
          barangay: barangay.trim(),
          areaHectares: numArea,
        });
        currentFarmId = farm.id;
        createdFarmRef.current = farm.id;
      }

      // Step C: create the first crop cycle for that farm.
      await createCropCycle(currentFarmId, {
        cropType: "corn",
        variety,
        plantingDate,
        areaHectares: numArea,
      });

      // Request "persistent" storage so the browser never evicts IndexedDB
      // (where Firebase stores the auth token) under storage pressure.
      if (navigator.storage?.persist) {
        navigator.storage.persist().then((granted) => {
          console.log("[Onboarding] Storage persistence granted:", granted);
        }).catch(() => {/* silently ignore if not supported */});
      }

      // Refresh the auth context so guards see the new FARMER profile.
      await refreshProfile();

      toast.success("Maligayang Pagdating sa Tarabay-Mais!", {
        description: `Matagumpay na nairehistro ang sakahan sa ${barangay || municipality}.`,
      });
      navigate("/farmer", { replace: true });
    } catch (err) {
      console.error(err);
      toast.error("Hindi Makumpleto ang Rehistro", {
        description:
          "May problema sa pagtatala sa server. Pakisuri ang koneksyon at subukang muli.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabel =
    step === 0
      ? "PAGPAPATUNAY NG NUMERO"
      : step === 1
        ? "HAKBANG 1 NG 3: PROFILE"
        : step === 2
          ? "HAKBANG 2 NG 3: SAKAHAN"
          : "HAKBANG 3 NG 3: SIKLO NG TANIM";

  return (
    <div className="w-full min-h-screen bg-[#03543f] md:bg-slate-950 flex flex-col items-center justify-center p-0 md:p-6 lg:p-10 font-sans selection:bg-emerald-500/30">
      {/* Invisible reCAPTCHA anchor (required by Firebase Phone Auth) */}
      <div id="recaptcha-container" />

      <div className="w-full md:max-w-4xl lg:max-w-5xl bg-linear-to-b from-[#03543f] to-[#046c4e] text-white shadow-2xl flex flex-col md:flex-row justify-between overflow-x-hidden md:rounded-[36px] md:border-4 md:border-slate-800/80 min-h-screen md:min-h-180 lg:min-h-190">
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
                  {step === 0 && "Pagpapatunay ng Numero"}
                  {step === 1 && "Profile ng Magsasaka"}
                  {step === 2 && "Rehistro ng Sakahan"}
                  {step === 3 && "Siklo ng Tanim na Mais"}
                </h2>
                <p className="text-[11px] sm:text-xs text-emerald-200/90 font-medium">
                  {step === 0
                    ? "Cagayan Valley • Corn Farming System"
                    : `${municipality}, Cagayan • Corn Field`}
                </p>
              </div>
            </div>
          </div>

          {/* Progress Header and Step Description */}
          <div className="my-3 sm:my-5 md:my-auto">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-emerald-200">
                {stepLabel}
              </span>

              {/* 3 Capsules (profile/farm/crop) */}
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

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-3">
              {step === 0 && "Patunayan ang Telepono"}
              {step === 1 && "Impormasyon ng Magsasaka"}
              {step === 2 && "Impormasyon ng Sakahan"}
              {step === 3 && "Siklo ng Tanim na Mais"}
            </h1>

            <p className="text-xs sm:text-sm text-emerald-100/90 font-medium mt-1 leading-relaxed max-w-md">
              {step === 0 &&
                "Padadalhan namin ng one-time code ang inyong numero para patunayan ang pagkakakilanlan."}
              {step === 1 &&
                "Ipasok ang inyong pangalan at RSBSA (kung mayroon) para sa opisyal na rekord ng DA."}
              {step === 2 &&
                "Sukat, uri ng pagmamay-ari, at lokasyon ng inyong bukid ng mais."}
              {step === 3 &&
                "Bariedad ng mais at petsa ng pagtatanim para sa pagkwenta ng stage."}
            </p>
          </div>

          <div className="hidden md:block text-[11px] text-emerald-200/70">
            Republic of the Philippines • Department of Agriculture Region II
          </div>
        </div>

        {/* ========================================================= */}
        {/* BOTTOM / RIGHT PANE (Interactive Forms per Step)          */}
        {/* ========================================================= */}
        <div className="w-full md:w-1/2 bg-white text-slate-900 rounded-t-[30px] md:rounded-t-none md:rounded-l-[36px] px-5 sm:px-8 lg:px-12 pt-6 pb-6 sm:pt-8 sm:pb-8 shadow-2xl flex flex-col justify-between flex-1">
          {/* STEP 0: PHONE AUTH */}
          {step === 0 && (
            <>
              {authSubStep === "phone" && (
                <form
                  onSubmit={handleSendOtp}
                  className="flex flex-col justify-between flex-1 space-y-4"
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                        <Phone className="w-5 h-5 stroke-[2.4]" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-slate-900">
                          Numero ng Telepono
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Padadalhan ng 6-digit code.
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Numero ng Telepono
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={handlePhoneChange}
                        placeholder="0917 000 0000"
                        required
                        autoComplete="tel"
                        className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full mt-4 h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold text-base shadow-lg shadow-emerald-700/20 hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <span>{submitting ? "Nagpapadala..." : "Padalhan ng OTP Code"}</span>
                    <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                  </button>
                </form>
              )}

              {authSubStep === "otp" && (
                <form
                  onSubmit={handleConfirmOtp}
                  className="flex flex-col justify-between flex-1 space-y-4"
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                        <KeyRound className="w-5 h-5 stroke-[2.4]" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-slate-900">
                          Ilagay ang OTP Code
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Ipinadala sa {toE164PH(phone)}.
                        </p>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-slate-700">
                          6-Digit OTP Code
                        </span>
                        <button
                          type="button"
                          onClick={handleResendReset}
                          className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                        >
                          Baguhin ang numero
                        </button>
                      </div>
                      <OtpInput
                        value={otp}
                        onChange={setOtp}
                        disabled={submitting}
                        autoFocus
                        accent="emerald"
                        ariaLabel="6-digit OTP code"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || otp.length !== 6}
                    className="w-full mt-4 h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold text-base shadow-lg shadow-emerald-700/20 hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <span>{submitting ? "Pinapatunayan..." : "Patunayan at Magpatuloy"}</span>
                    <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                  </button>
                </form>
              )}
            </>
          )}

          {/* STEP 1: FARMER PROFILE FORM */}
          {step === 1 && (
            <form
              onSubmit={handleStep1Submit}
              className="flex flex-col justify-between flex-1 space-y-4"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Pangalan (First Name)
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Juan"
                      required
                      className="w-full rounded-2xl border-2 px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Apelyido (Last Name)
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Dela Cruz"
                      required
                      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/80 px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    RSBSA Number (Opsyonal)
                  </label>
                  <input
                    type="text"
                    value={rsbsaNumber}
                    onChange={(e) => setRsbsaNumber(e.target.value)}
                    placeholder="02-15-01-000-000123"
                    className="w-full rounded-2xl border-2 px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Bayan (Municipality)
                    </label>
                    <select
                      value={municipality}
                      onChange={handleMunicipalityChange}
                      className="w-full rounded-2xl border-2 bg-slate-50/80 px-3.5 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white"
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
                    <select
                      value={barangay}
                      onChange={(e) => setBarangay(e.target.value)}
                      required
                      className="w-full rounded-2xl border-2 bg-slate-50/80 px-3.5 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white"
                    >
                      <option value="" disabled>
                        Pumili ng Barangay
                      </option>
                      {availableBarangays.map((bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

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
            <form
              onSubmit={handleStep2Submit}
              className="flex flex-col justify-between flex-1 space-y-4"
            >
              <div className="space-y-3.5">
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
                    className="w-full rounded-2xl border-2 px-4 py-2.5 text-base font-semibold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white"
                  />
                </div>

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
                    className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/80 px-4 py-2 text-base font-bold text-slate-900 outline-none transition"
                  />
                </div>
              </div>

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
            <form
              onSubmit={handleStep3Submit}
              className="flex flex-col justify-between flex-1 space-y-4"
            >
              <div className="space-y-3.5">
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

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bariedad ng Mais (Corn Variety)
                  </label>
                  <select
                    value={variety}
                    onChange={(e) => setVariety(e.target.value)}
                    className="w-full rounded-2xl border-2 px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white"
                  >
                    {CORN_VARIETIES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Petsa ng Pagtatanim (Planting Date)
                  </label>
                  <div className="relative flex items-center">
                    <Calendar className="w-5 h-5 text-emerald-600 absolute left-4 pointer-events-none stroke-2" />
                    <input
                      type="date"
                      value={plantingDate}
                      onChange={(e) => setPlantingDate(e.target.value)}
                      required
                      className="w-full rounded-2xl border-2 pl-12 pr-4 py-2.5 text-base font-semibold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-300 bg-emerald-50/90 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-xs sm:text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                    <span>Kalkulado ng Lifecycle Engine:</span>
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-emerald-950 font-medium">
                    <li>
                      • Inaasahang Pag-ani:{" "}
                      <span className="font-bold">
                        {lifecycle.harvestDateStr} (~108 araw)
                      </span>
                    </li>
                    <li>
                      • Kasalukuyang Stage:{" "}
                      <span className="font-bold text-emerald-800">
                        {lifecycle.stageName} (DAP {lifecycle.dap})
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-3 h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold text-base shadow-lg shadow-emerald-700/20 hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <span>
                  {submitting
                    ? "Itinatala sa DA..."
                    : "Tapusin ang Rehistro at Pumunta sa Dashboard"}
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
