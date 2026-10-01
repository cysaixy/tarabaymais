import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FirebaseError } from "firebase/app";
import type { ConfirmationResult } from "firebase/auth";
import { toast } from "sonner";
import {
  Sprout,
  ShieldCheck,
  Phone,
  ArrowRight,
  UserPlus,
  Building2,
  Camera,
  BookOpen,
  CloudOff,
  KeyRound,
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
import { isMunicipalRole } from "../../context/authContext";

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
      default:
        return "Nabigo ang pag-login. Pakisubukan muli.";
    }
  }
  return "May problemang teknikal. Pakisubukan muli.";
};

export const FarmerLoginPage: React.FC = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("0917 000 0000");
  const [otp, setOtp] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  // Visual phone formatting (0917 000 0000)
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

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
  };

  // ── Step 1: send OTP ──────────────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawPhone = phone.replace(/\D/g, "");
    if (rawPhone.length < 10) {
      toast.error("Kulang ang Numero ng Telepono", {
        description: "Pakilagay ang kumpletong 11-digit mobile number.",
      });
      return;
    }

    setLoading(true);
    try {
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

  // ── Step 2: confirm OTP → verify role via /auth/me ─────────────────────────
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

      // Confirm the backend profile exists and inspect the role.
      try {
        const me = await getMe();
        if (isMunicipalRole(me.role)) {
          // A technician/officer logged in through the farmer portal — send
          // them to their own area instead.
          toast.info("Officer/Technician Account", {
            description: "Inilipat kayo sa Officer Portal.",
          });
          navigate("/officer/dashboard", { replace: true });
          return;
        }
        toast.success("Maligayang Pagbabalik, Magsasaka!", {
          description: "Matagumpay na nakapasok sa Tarabay-Mais Sakahan.",
        });
        navigate("/farmer", { replace: true });
      } catch {
        // Authenticated but no profile yet → finish registration.
        toast.info("Kailangan ng Rehistro", {
          description: "Kumpletuhin muna ang inyong profile.",
        });
        navigate("/onboarding", { replace: true });
      }
    } catch (err) {
      console.error(err);
      toast.error("Maling Code", { description: friendlyAuthError(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    // Reset back to phone step so a fresh verifier + code can be requested.
    clearRecaptchaVerifier();
    setOtp("");
    setConfirmation(null);
    setStep("phone");
    // Ensure any lingering half-session is cleared.
    try {
      if (auth.currentUser) await auth.signOut();
    } catch {
      /* no-op */
    }
  };

  const handleOnboardingClick = () => {
    navigate("/onboarding");
  };

  return (
    <div className="w-full min-h-screen bg-[#03543f] md:bg-slate-950 flex flex-col items-center justify-center p-0 md:p-6 lg:p-10 font-sans selection:bg-emerald-500/30">
      {/* Invisible reCAPTCHA anchor (required by Firebase Phone Auth) */}
      <div id="recaptcha-container" />

      {/* Responsive Container: Mobile Viewport (412x917 edge-to-edge) vs Tablet/Desktop Card (md+) */}
      <div className="w-full md:max-w-4xl lg:max-w-5xl bg-linear-to-b from-[#03543f] to-[#046c4e] text-white shadow-2xl flex flex-col md:flex-row justify-between overflow-x-hidden md:rounded-[36px] md:border-4 md:border-slate-800/80 min-h-screen md:min-h-180 lg:min-h-190">
        {/* ========================================================= */}
        {/* LEFT / TOP PANE (Branding, Context & Highlights)          */}
        {/* ========================================================= */}
        <div className="w-full md:w-1/2 flex flex-col justify-between pt-4 pb-3 sm:py-6 px-4 sm:px-6 lg:px-10 relative">
          {/* Top Header Bar */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm sm:text-base md:text-lg font-bold text-white tracking-tight leading-tight">
                Pagtala sa Sistema
              </h2>
              <p className="text-[11px] sm:text-xs text-emerald-200/90 font-medium mt-0.5">
                Solana, Cagayan • Corn Field
              </p>
            </div>
          </div>

          {/* Main Hero Centerpiece */}
          <div className="my-2 sm:my-4 md:my-auto flex flex-col items-center text-center">
            {/* Seedling Sprout Icon Box */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-24 md:h-24 rounded-2xl md:rounded-3xl bg-emerald-600/80 border-2 border-emerald-300/40 flex items-center justify-center shadow-md backdrop-blur-md mb-2 sm:mb-3 transform transition-transform hover:scale-105">
              <Sprout className="w-8 h-8 sm:w-9 sm:h-9 md:w-14 md:h-14 text-white stroke-[2.2]" />
            </div>

            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
              AI Farming Assistant
            </h1>

            <p className="text-[11px] sm:text-xs md:text-sm lg:text-base text-emerald-100/90 font-medium max-w-70 sm:max-w-xs md:max-w-md mt-0.5 sm:mt-1 leading-snug">
              Sistemang Pantulong sa Magsasaka ng Mais sa Cagayan
            </p>

            {/* DA Accreditation Pill */}
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-950/40 border border-emerald-400/30 px-3 py-1 text-[11px] font-medium text-emerald-200 shadow-inner">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Naka-kabit sa DA Region II & Cagayan OPA</span>
            </div>

            {/* Tablet/Desktop Exclusive Features List */}
            <div className="hidden md:flex flex-col gap-3 mt-8 text-left w-full max-w-sm">
              <div className="flex items-start gap-3 bg-emerald-900/30 border border-emerald-500/20 rounded-xl p-3">
                <Camera className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-white">
                    AI Plant Health Scanner
                  </p>
                  <p className="text-[11px] text-emerald-200/80">
                    Kuhanan ng litrato ang dahon para sa agarang diagnosis.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-emerald-900/30 border border-emerald-500/20 rounded-xl p-3">
                <CloudOff className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-white">
                    Offline-First Resilience
                  </p>
                  <p className="text-[11px] text-emerald-200/80">
                    Naitatala ang gawain kahit walang internet signal sa bukid.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-emerald-900/30 border border-emerald-500/20 rounded-xl p-3">
                <BookOpen className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-white">
                    Grounded DA Region II Techno-Guide
                  </p>
                  <p className="text-[11px] text-emerald-200/80">
                    Akmang gabay ayon sa edad ng mais at klima ng lambak.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Footer Note */}
          <div className="hidden md:block text-[11px] text-emerald-200/70 text-center">
            Republic of the Philippines • Department of Agriculture Region II
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT / BOTTOM PANE (Farmer Login Form & Onboarding)      */}
        {/* ========================================================= */}
        <div className="w-full md:w-1/2 bg-white text-slate-900 rounded-t-[30px] md:rounded-t-none md:rounded-l-[36px] px-5 sm:px-8 lg:px-12 pt-5 pb-6 sm:pt-7 sm:pb-8 shadow-2xl flex flex-col justify-between flex-1">
          <div>
            {/* Header with Phone Icon */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                {step === "phone" ? (
                  <Phone className="w-4 h-4 stroke-[2.4]" />
                ) : (
                  <KeyRound className="w-4 h-4 stroke-[2.4]" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-lg sm:text-xl text-slate-900 tracking-tight">
                  {step === "phone"
                    ? "Mag-login sa Inyong Account"
                    : "Ilagay ang OTP Code"}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                  {step === "phone"
                    ? "Ipasok ang numero ng telepono para padalhan ng code."
                    : `Ipinadala ang 6-digit code sa ${toE164PH(phone)}.`}
                </p>
              </div>
            </div>

            {/* STEP 1: PHONE */}
            {step === "phone" && (
              <form
                onSubmit={handleSendOtp}
                className="mt-3.5 sm:mt-5 space-y-3 sm:space-y-4"
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wide">
                    Numero ng Telepono (Phone Number)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="0917 000 0000"
                    required
                    autoComplete="tel"
                    className="w-full rounded-xl sm:rounded-2xl border-2 border-slate-200 bg-slate-50/80 px-4 py-2.5 sm:py-3 text-base sm:text-lg font-semibold text-slate-900 tracking-wide outline-none transition focus:ring-4 focus:ring-emerald-500/10"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-1.5 h-13 sm:h-14 rounded-xl sm:rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold text-base shadow-md shadow-emerald-700/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
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
                className="mt-3.5 sm:mt-5 space-y-3 sm:space-y-4"
              >
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                      6-Digit OTP Code
                    </label>
                    <button
                      type="button"
                      onClick={handleResend}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                    >
                      Baguhin ang numero
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otp}
                    onChange={handleOtpChange}
                    placeholder="______"
                    required
                    autoFocus
                    className="w-full rounded-xl sm:rounded-2xl border-2 border-slate-200 bg-slate-50/80 px-4 py-2.5 sm:py-3 text-center text-2xl sm:text-3xl font-black tracking-[0.4em] text-slate-900 outline-none transition focus:ring-4 focus:ring-emerald-500/10"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-1.5 h-13 sm:h-14 rounded-xl sm:rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold text-base shadow-md shadow-emerald-700/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <span>{loading ? "Pumapasok..." : "Mag-login sa Sakahan"}</span>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-700 cursor-pointer py-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Bumalik</span>
                </button>
              </form>
            )}
          </div>

          {/* Onboarding & Officer Portal Links */}
          <div className="mt-3 sm:mt-5 space-y-2">
            <div className="rounded-xl sm:rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 sm:p-4 text-center">
              <p className="text-[11px] sm:text-xs text-emerald-950 font-medium leading-snug">
                Bagong magsasaka? Irehistro ang inyong sakahan at taniman ngayon.
              </p>

              <button
                type="button"
                onClick={handleOnboardingClick}
                className="mt-2 sm:mt-2.5 w-full rounded-lg sm:rounded-xl border-2 border-emerald-600 bg-white hover:bg-emerald-50 active:scale-[0.99] py-2.5 px-3 font-bold text-xs sm:text-sm text-emerald-800 transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-emerald-600" />
                <span>Simulan ang Onboarding (Gumawa ng Profile)</span>
              </button>
            </div>

            {/* Dedicated Officer / Technician Portal Link */}
            <div className="text-center pt-0.5">
              <button
                type="button"
                onClick={() => navigate("/officer/login")}
                className="inline-flex items-center gap-1 text-[11px] sm:text-xs text-slate-500 hover:text-emerald-700 font-medium transition-colors cursor-pointer py-1"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Pumunta sa Officer / Technician Portal ➔</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FarmerLoginPage;
