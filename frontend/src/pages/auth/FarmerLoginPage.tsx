import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Sprout,
  ShieldCheck,
  Phone,
  ArrowRight,
  UserPlus,
  RefreshCw,
  Building2,
  Camera,
  BookOpen,
  CloudOff,
} from "lucide-react";
import { useAuth } from "../../context/authContext";

export const FarmerLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginWithPhonePin, loginAsDemo } = useAuth();

  const [phone, setPhone] = useState("0917 584 9201");
  const [pin, setPin] = useState("1234");
  const [loading, setLoading] = useState(false);

  // Formatting phone number visually
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

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    setPin(raw);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const rawPhone = phone.replace(/\D/g, "");

    if (rawPhone.length < 10) {
      toast.error("Kulang ang Numero ng Telepono", {
        description: "Pakilagay ang kumpletong 11-digit mobile number.",
      });
      setLoading(false);
      return;
    }

    if (pin.length !== 4) {
      toast.error("Kulang ang 4-Digit PIN Code", {
        description: "Mangyaring ilagay ang inyong 4-digit security PIN.",
      });
      setLoading(false);
      return;
    }

    try {
      if (loginWithPhonePin) {
        const success = await loginWithPhonePin(phone, pin);
        if (success) {
          toast.success("Maligayang Pagbabalik, Magsasaka!", {
            description: "Matagumpay na nakapasok sa Tarabay-Mais Sakahan.",
          });
          navigate("/farmer", { replace: true });
          return;
        }
      }

      // Fallback demo login
      if (loginAsDemo) {
        loginAsDemo("farmer");
        toast.success("Maligayang Pagbabalik!", {
          description: "Naka-login bilang Mang Juan Dela Cruz (Solana, Cagayan).",
        });
        navigate("/farmer", { replace: true });
      }
    } catch (err) {
      console.error(err);
      toast.error("May problemang teknikal", {
        description: "Pakisubukan muli o mag-onboard kung bago.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQueueClick = () => {
    toast.info("Offline Sync Queue", {
      description:
        "May 2 nakatagong ulat/obserbasyon sa telepono na handang i-sync sa DA kapag nagkaroon ng signal.",
    });
  };

  const handleOnboardingClick = () => {
    navigate("/onboarding");
  };

  return (
    <div className="w-full min-h-screen bg-[#03543f] md:bg-slate-950 flex flex-col items-center justify-center p-0 md:p-6 lg:p-10 font-sans selection:bg-emerald-500/30">
      {/* Responsive Container: Mobile Viewport (412x917 edge-to-edge) vs Tablet/Desktop Card (md+) */}
      <div className="w-full md:max-w-4xl lg:max-w-5xl bg-gradient-to-b from-[#03543f] to-[#046c4e] text-white shadow-2xl flex flex-col md:flex-row justify-between overflow-x-hidden md:rounded-[36px] md:border-4 md:border-slate-800/80 min-h-screen md:min-h-[720px] lg:min-h-[760px]">
        
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

            {/* Offline Queue Badge */}
            <button
              onClick={handleQueueClick}
              type="button"
              className="bg-[#f59e0b] hover:bg-[#d97706] active:scale-95 text-amber-950 font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              title="Tingnan ang naka-queue na ulat"
            >
              <RefreshCw className="w-3 h-3 animate-spin-slow" />
              <span>2 Queue</span>
            </button>
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

            <p className="text-[11px] sm:text-xs md:text-sm lg:text-base text-emerald-100/90 font-medium max-w-[280px] sm:max-w-xs md:max-w-md mt-0.5 sm:mt-1 leading-snug">
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
                  <p className="text-xs font-bold text-white">AI Plant Health Scanner</p>
                  <p className="text-[11px] text-emerald-200/80">Kuhanan ng litrato ang dahon para sa agarang diagnosis.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-emerald-900/30 border border-emerald-500/20 rounded-xl p-3">
                <CloudOff className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-white">Offline-First Resilience</p>
                  <p className="text-[11px] text-emerald-200/80">Naitatala ang gawain kahit walang internet signal sa bukid.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-emerald-900/30 border border-emerald-500/20 rounded-xl p-3">
                <BookOpen className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-white">Grounded DA Region II Techno-Guide</p>
                  <p className="text-[11px] text-emerald-200/80">Akmang gabay ayon sa edad ng mais at klima ng lambak.</p>
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
                <Phone className="w-4 h-4 stroke-[2.4]" />
              </div>
              <div>
                <h3 className="font-bold text-lg sm:text-xl text-slate-900 tracking-tight">
                  Mag-login sa Inyong Account
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                  Ipasok ang inyong numero ng telepono at PIN code.
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="mt-3.5 sm:mt-5 space-y-3 sm:space-y-4">
              {/* Phone Input */}
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
                  className="w-full rounded-xl sm:rounded-2xl border-2 border-slate-200 bg-slate-50/80 px-4 py-2.5 sm:py-3 text-base sm:text-lg font-semibold text-slate-900 tracking-wide outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 placeholder:text-slate-400"
                />
              </div>

              {/* 4-Digit PIN Input */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    4-Digit PIN Code
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">
                    (Demo: kahit anong 4 digits)
                  </span>
                </div>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={pin}
                  onChange={handlePinChange}
                  placeholder="••••"
                  required
                  className="w-full rounded-xl sm:rounded-2xl border-2 border-slate-200 bg-slate-50/80 px-4 py-2.5 sm:py-3 text-center text-2xl sm:text-3xl font-black tracking-[0.4em] text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 placeholder:text-slate-300"
                />
              </div>

              {/* Oversized High-Contrast Tap Target Button (52px to 56px) */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-1.5 h-13 sm:h-14 rounded-xl sm:rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold text-base shadow-md shadow-emerald-700/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <span>{loading ? "Pumapasok..." : "Mag-login sa Sakahan"}</span>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
              </button>
            </form>
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
                onClick={() => {
                  if (loginAsDemo) loginAsDemo("technician");
                  toast.info("Technician / Officer Portal", {
                    description:
                      "Pumapasok bilang Municipal Agricultural Technician.",
                  });
                  navigate("/technician");
                }}
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
