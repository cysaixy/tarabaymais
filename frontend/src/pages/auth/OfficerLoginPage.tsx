import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Building2,
  ShieldCheck,
  Mail,
  Lock,
  ArrowRight,
  ClipboardList,
  Flame,
  FileCheck2,
  Eye,
  EyeOff,
  UserCheck,
  ChevronLeft,
} from "lucide-react";
import { useAuth } from "../../context/authContext";
import { logIn } from "../../services/auth.service";

export const OfficerLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginAsDemo } = useAuth();

  const [emailOrId, setEmailOrId] = useState("maria.santos@da.region2.gov.ph");
  const [password, setPassword] = useState("Technician@2026");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrId.trim()) {
      toast.error("Kulang ang Kredensyal", {
        description: "Mangyaring ilagay ang opisyal na DA email o Employee ID.",
      });
      return;
    }

    if (!password) {
      toast.error("Kulang ang Password", {
        description: "Pakilagay ang inyong security password o key.",
      });
      return;
    }

    setLoading(true);

    try {
      // If user inputs a real email format, attempt backend/Firebase login
      if (emailOrId.includes("@")) {
        try {
          await logIn(emailOrId.trim(), password);
        } catch {
          // If Firebase is unreachable or credentials belong to mock technician, proceed with demo session
        }
      }

      // Establish technician session
      if (loginAsDemo) {
        loginAsDemo("technician");
      }

      toast.success("Maligayang Pagdating sa Officer Portal!", {
        description:
          "Naka-login bilang Engr. Maria Santos (DA Region II Municipal Technician).",
      });

      navigate("/technician", { replace: true });
    } catch {
      toast.error("Hindi makapasok sa Portal", {
        description:
          "Pakisuri ang inyong kredensyal o makipag-ugnayan sa DA Regional Admin.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = () => {
    if (loginAsDemo) {
      loginAsDemo("technician");
    }
    toast.success("Access Granted: Demo Officer Session", {
      description: "Naka-login bilang Municipal Agricultural Officer (Region II).",
    });
    navigate("/technician", { replace: true });
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 flex flex-col items-center justify-center p-0 md:p-6 lg:p-10 font-sans selection:bg-blue-500/30">
      {/* Responsive Container: Edge-to-Edge on Mobile, Centered Institutional Card on Tablet/Desktop */}
      <div className="w-full md:max-w-4xl lg:max-w-5xl bg-gradient-to-b from-[#091e3a] via-[#0b274c] to-[#04162e] text-white shadow-2xl flex flex-col md:flex-row justify-between overflow-x-hidden md:rounded-[36px] md:border-2 md:border-blue-900/40 min-h-screen md:min-h-[720px] lg:min-h-[760px]">
        
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

            <p className="text-[11px] sm:text-xs md:text-sm lg:text-base text-blue-100/90 font-medium max-w-[290px] sm:max-w-xs md:max-w-md mt-1 leading-snug">
              Sistemang Pamamahala, Pagpapatunay, at Extension Services para sa Maisan ng Lambak ng Cagayan
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
                  <p className="text-xs font-bold text-white">Farmer Case Verification</p>
                  <p className="text-[11px] text-blue-200/80">Suriin ang mga nai-scan na uod, amag, at sakit sa pananim.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-blue-950/50 border border-blue-500/20 rounded-2xl p-3">
                <Flame className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-white">Disaster Damage Indemnification</p>
                  <p className="text-[11px] text-blue-200/80">I-validate ang porsyento ng pinsala ng bagyo at tagtuyot.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-blue-950/50 border border-blue-500/20 rounded-2xl p-3">
                <FileCheck2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-white">Certified DA Region II Agro-Advisory</p>
                  <p className="text-[11px] text-blue-200/80">Magpadala ng opisyal na rekomendasyon diretso sa telepono ng magsasaka.</p>
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
                <UserCheck className="w-5 h-5 stroke-[2.4]" />
              </div>
              <div>
                <h3 className="font-bold text-lg sm:text-xl text-slate-900 tracking-tight">
                  Opisyal na Pagtala (Login)
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                  Ipasok ang inyong DA credentials o Municipal ID.
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="mt-4 sm:mt-6 space-y-3.5 sm:space-y-4">
              {/* Email / Employee ID Input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wide">
                  Email ng Kawani o Employee ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={emailOrId}
                    onChange={(e) => setEmailOrId(e.target.value)}
                    placeholder="pangalan@da.region2.gov.ph"
                    required
                    className="w-full rounded-xl sm:rounded-2xl border-2 border-slate-200 bg-slate-50/80 pl-11 pr-4 py-2.5 sm:py-3 text-sm sm:text-base font-medium text-slate-900 tracking-wide outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Password / Security Key
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">
                    (Demo pre-filled)
                  </span>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full rounded-xl sm:rounded-2xl border-2 border-slate-200 bg-slate-50/80 pl-11 pr-11 py-2.5 sm:py-3 text-sm sm:text-base font-medium text-slate-900 tracking-wide outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showPassword ? "Itago ang password" : "Ipakita ang password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* High-Contrast Tap Target Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 h-13 sm:h-14 rounded-xl sm:rounded-2xl bg-blue-700 hover:bg-blue-800 active:scale-[0.99] text-white font-extrabold text-base shadow-md shadow-blue-700/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <span>{loading ? "Pumapasok..." : "Mag-login sa Technician Portal"}</span>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
              </button>
            </form>
          </div>

          {/* Quick Demo & Farmer Link */}
          <div className="mt-4 sm:mt-6 space-y-2.5">
            {/* Quick Demo Login Box */}
            <div className="rounded-xl sm:rounded-2xl border border-blue-200 bg-blue-50/80 p-3 sm:p-4 text-center">
              <p className="text-[11px] sm:text-xs text-blue-950 font-medium leading-snug">
                Pang-presentasyon o mabilisang pagsusuri?
              </p>

              <button
                type="button"
                onClick={handleQuickDemoLogin}
                className="mt-2 w-full rounded-lg sm:rounded-xl border-2 border-blue-600 bg-white hover:bg-blue-50 active:scale-[0.99] py-2.5 px-3 font-bold text-xs sm:text-sm text-blue-800 transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <UserCheck className="w-4 h-4 text-blue-600" />
                <span>Demo Login: Engr. Maria Santos (DA Region II)</span>
              </button>
            </div>

            {/* Back to Farmer Mobile Portal Link */}
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
