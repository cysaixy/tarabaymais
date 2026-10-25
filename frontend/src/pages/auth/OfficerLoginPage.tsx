import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FirebaseError } from "firebase/app";
import type { ConfirmationResult } from "firebase/auth";
import { toast } from "sonner";
import {
  Building2,
  ShieldCheck,
  Phone,
  ArrowRight,
  ClipboardList,
  Flame,
  FileCheck2,
  KeyRound,
  UserCheck,
  ChevronLeft,
} from "lucide-react";
import {
  sendOtp,
  confirmOtp,
  getMe,
  toE164PH,
} from "../../services/auth.service";
import {
  getRecaptchaVerifier,
  clearRecaptchaVerifier,
  auth,
} from "../../firebase";
import { useAuth, isMunicipalRole } from "../../context/authContext";
import { OtpInput } from "../../components/OtpInput";

type Step = "phone" | "otp";

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
        return "Nabigo ang pag-login. Pakisubukan muli.";
    }
  }
  return "May problemang teknikal. Pakisubukan muli.";
};

export const OfficerLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, role, loading: authLoading } = useAuth();

  // If already authenticated with a valid profile, skip login screen immediately
  useEffect(() => {
    if (!authLoading && user && profile && role) {
      navigate(isMunicipalRole(role) ? "/officer/dashboard" : "/farmer", {
        replace: true,
      });
    }
  }, [authLoading, user, profile, role, navigate]);

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(
    null,
  );
  const [loading, setLoading] = useState(false);


  // ── Step 1: send OTP ──────────────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawPhone = phone.replace(/\D/g, "");
    if (rawPhone.length < 10) {
      toast.error("Kulang ang Numero ng Telepono", {
        description: "Pakilagay ang opisyal na mobile number ng kawani.",
      });
      return;
    }

    setLoading(true);
    try {
      // Clear any prior / errored recaptcha verifier so retries work seamlessly
      clearRecaptchaVerifier();
      const verifier = getRecaptchaVerifier();
      const result = await sendOtp(phone, verifier);
      setConfirmation(result);
      setStep("otp");
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
      setLoading(false);
    }
  };

  // ── Step 2: confirm OTP → enforce municipal role ──────────────────────────
  const handleConfirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmation) return;
    if (otp.length !== 6) {
      toast.error("Kulang ang OTP Code", {
        description: "Mangyaring ilagay ang kumpletong 6-digit code.",
      });
      return;
    }

    setLoading(true);
    try {
      await confirmOtp(confirmation, otp);
      clearRecaptchaVerifier();

      let me;
      try {
        me = await getMe();
      } catch {
        // Authenticated but no backend profile — officer accounts must be
        // provisioned by the DA admin, not self-registered here.
        await auth.signOut();
        toast.error("Walang Opisyal na Rekord", {
          description:
            "Walang profile ang account na ito. Makipag-ugnayan sa DA Regional Admin.",
        });
        setLoading(false);
        return;
      }

      if (!isMunicipalRole(me.role)) {
        // A farmer tried the officer portal — deny and sign out.
        await auth.signOut();
        toast.error("Bawal ang Pagpasok", {
          description:
            "Para sa Technician/Officer lamang ang portal na ito. Gamitin ang Farmer Portal.",
        });
        setLoading(false);
        return;
      }

      toast.success("Maligayang Pagdating sa Officer Portal!", {
        description: `Naka-login bilang ${me.firstName} ${me.lastName} (${me.role}).`,
      });
      navigate("/officer/dashboard", { replace: true });
    } catch (err) {
      console.error(err);
      toast.error("Maling Code", { description: friendlyAuthError(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    clearRecaptchaVerifier();
    setOtp("");
    setConfirmation(null);
    setStep("phone");
    try {
      if (auth.currentUser) await auth.signOut();
    } catch {
      /* no-op */
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 flex flex-col items-center justify-center p-0 md:p-6 lg:p-10 font-sans selection:bg-blue-500/30">
      {/* Invisible reCAPTCHA anchor (required by Firebase Phone Auth) */}
      <div id="recaptcha-container" />

      {/* Responsive Container: Edge-to-Edge on Mobile, Centered Institutional Card on Tablet/Desktop */}
      <div className="w-full md:max-w-4xl lg:max-w-5xl bg-linear-to-b from-[#091e3a] via-[#0b274c] to-[#04162e] text-white shadow-2xl flex flex-col md:flex-row justify-between overflow-x-hidden md:rounded-[36px] md:border-2 md:border-blue-900/40 min-h-screen md:min-h-180 lg:min-h-190">
        {/* ========================================================= */}
        {/* LEFT / TOP PANE (Institutional Branding & Capabilities)   */}
        {/* ========================================================= */}
        <div className="w-full md:w-1/2 flex flex-col justify-between pt-4 pb-4 sm:py-6 px-4 sm:px-6 lg:px-10 relative">
          {/* Top Header Bar */}
          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="inline-flex items-center gap-1.5 text-xs text-blue-200/90 hover:text-white bg-blue-900/50 hover:bg-blue-800/60 px-3 py-1.5 rounded-full border border-blue-400/30 transition cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Farmer Portal</span>
            </button>

            {/* Region II Badge */}
            <div className="bg-blue-600/90 text-white font-black text-[11px] px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
              <Building2 className="w-3.5 h-3.5" />
              <span>DA Region II</span>
            </div>
          </div>

          {/* Main Hero Centerpiece */}
          <div className="my-3 sm:my-6 md:my-auto flex flex-col items-center text-center">
            {/* Government Shield / Building Icon */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-24 md:h-24 rounded-2xl md:rounded-3xl bg-blue-600/80 border-2 border-blue-300/40 flex items-center justify-center shadow-lg backdrop-blur-md mb-2 sm:mb-3 transform transition-transform hover:scale-105">
              <Building2 className="w-8 h-8 sm:w-9 sm:h-9 md:w-14 md:h-14 text-white stroke-[2.2]" />
            </div>

            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
              Officer & Technician Portal
            </h1>

            <p className="text-[11px] sm:text-xs md:text-sm lg:text-base text-blue-100/90 font-medium max-w-72.5 sm:max-w-xs md:max-w-md mt-1 leading-snug">
              Sistemang Pamamahala, Pagpapatunay, at Extension Services para sa
              Maisan ng Lambak ng Cagayan
            </p>

            {/* DA Accreditation Pill */}
            <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-blue-950/60 border border-blue-400/30 px-3.5 py-1 text-[11px] font-semibold text-blue-200 shadow-inner">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Department of Agriculture • Municipal Agriculture Office</span>
            </div>

            {/* Tablet/Desktop Capability Features */}
            <div className="hidden md:flex flex-col gap-3 mt-8 text-left w-full max-w-sm">
              <div className="flex items-start gap-3 bg-blue-950/50 border border-blue-500/20 rounded-2xl p-3">
                <ClipboardList className="w-5 h-5 text-blue-300 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-white">
                    Farmer Case Verification
                  </p>
                  <p className="text-[11px] text-blue-200/80">
                    Suriin ang mga nai-scan na uod, amag, at sakit sa pananim.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-blue-950/50 border border-blue-500/20 rounded-2xl p-3">
                <Flame className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-white">
                    Disaster Damage Indemnification
                  </p>
                  <p className="text-[11px] text-blue-200/80">
                    I-validate ang porsyento ng pinsala ng bagyo at tagtuyot.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-blue-950/50 border border-blue-500/20 rounded-2xl p-3">
                <FileCheck2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-white">
                    Certified DA Region II Agro-Advisory
                  </p>
                  <p className="text-[11px] text-blue-200/80">
                    Magpadala ng opisyal na rekomendasyon diretso sa telepono ng
                    magsasaka.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Footer Note */}
          <div className="hidden md:block text-[11px] text-blue-200/70 text-center">
            Republic of the Philippines • Department of Agriculture Region II
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT / BOTTOM PANE (Official Technician Login Form)       */}
        {/* ========================================================= */}
        <div className="w-full md:w-1/2 bg-white text-slate-900 rounded-t-[30px] md:rounded-t-none md:rounded-l-[36px] px-5 sm:px-8 lg:px-12 pt-5 pb-6 sm:pt-7 sm:pb-8 shadow-2xl flex flex-col justify-between flex-1">
          <div>
            {/* Form Header */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
                {step === "phone" ? (
                  <UserCheck className="w-5 h-5 stroke-[2.4]" />
                ) : (
                  <KeyRound className="w-5 h-5 stroke-[2.4]" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-lg sm:text-xl text-slate-900 tracking-tight">
                  {step === "phone"
                    ? "Opisyal na Pagtala (Login)"
                    : "Ilagay ang OTP Code"}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                  {step === "phone"
                    ? "Ipasok ang nakarehistrong mobile number ng kawani."
                    : `Ipinadala ang 6-digit code sa ${toE164PH(phone)}.`}
                </p>
              </div>
            </div>

            {/* STEP 1: PHONE */}
            {step === "phone" && (
              <form
                onSubmit={handleSendOtp}
                className="mt-4 sm:mt-6 space-y-3.5 sm:space-y-4"
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wide">
                    Numero ng Telepono ng Kawani
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+63917 000 0000"
                      required
                      autoComplete="tel"
                      className="w-full rounded-xl sm:rounded-2xl border-2 border-slate-200 bg-slate-50/80 pl-11 pr-4 py-2.5 sm:py-3 text-sm sm:text-base font-medium text-slate-900 tracking-wide outline-none transition focus:ring-4 focus:ring-blue-500/10"
                    />
                    <Phone className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 h-13 sm:h-14 rounded-xl sm:rounded-2xl bg-blue-700 hover:bg-blue-800 active:scale-[0.99] text-white font-extrabold text-base shadow-md shadow-blue-700/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <span>{loading ? "Nagpapadala..." : "Padalhan ng OTP Code"}</span>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                </button>
              </form>
            )}

            {/* STEP 2: OTP */}
            {step === "otp" && (
              <form
                onSubmit={handleConfirmOtp}
                className="mt-4 sm:mt-6 space-y-3.5 sm:space-y-4"
              >
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                      6-Digit OTP Code
                    </span>
                    <button
                      type="button"
                      onClick={handleResend}
                      className="text-[11px] font-bold text-blue-700 hover:text-blue-800 cursor-pointer"
                    >
                      Baguhin ang numero
                    </button>
                  </div>
                  <OtpInput
                    value={otp}
                    onChange={setOtp}
                    disabled={loading}
                    autoFocus
                    accent="blue"
                    ariaLabel="6-digit OTP code"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full mt-2 h-13 sm:h-14 rounded-xl sm:rounded-2xl bg-blue-700 hover:bg-blue-800 active:scale-[0.99] text-white font-extrabold text-base shadow-md shadow-blue-700/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <span>
                    {loading ? "Pumapasok..." : "Mag-login sa Technician Portal"}
                  </span>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-700 cursor-pointer py-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Bumalik</span>
                </button>
              </form>
            )}
          </div>

          {/* Farmer Link */}
          <div className="mt-4 sm:mt-6 space-y-2.5">
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="inline-flex items-center gap-1 text-[11px] sm:text-xs text-slate-500 hover:text-blue-700 font-medium transition-colors cursor-pointer py-1"
              >
                <span>Isa ka bang magsasaka? Pumunta sa Farmer Portal ➔</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfficerLoginPage;
