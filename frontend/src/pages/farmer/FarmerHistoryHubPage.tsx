/**
 * FarmerHistoryHubPage — Main entry point for all history sections
 * Navigation cards to Activities, Observations, Disasters, Sync Queue
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { useFarmSelection } from "../../context/farmSelectionContext";
import {
  AlertTriangle,
  Send,
  Loader2 as IrrigationIcon,
  Database,
  ChevronLeft,
  ChevronRight,
  Home,
  Scan,
  MessageSquare,
  History,
} from "lucide-react";

interface HistorySection {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  route: string;
  badge?: string;
  badgeColor?: string;
}

const SECTIONS: HistorySection[] = [
  {
    id: "activities",
    title: "Mga Gawain",
    description: "Pataba, Patubig, Peste Control, Ani — gastos at petsa",
    icon: <Send className="w-6 h-6 stroke-[2.2]" />,
    color: "text-blue-700",
    bg: "bg-blue-100",
    route: "/farmer/history/activities",
    badgeColor: "bg-blue-600",
  },
  {
    id: "observations",
    title: "Mga Obserbasyon",
    description: "Sakit, peste, AI diagnosis, litrato, severity levels",
    icon: <AlertTriangle className="w-6 h-6 stroke-[2.2]" />,
    color: "text-amber-700",
    bg: "bg-amber-100",
    route: "/farmer/history/observations",
    badgeColor: "bg-amber-600",
  },
  {
    id: "disasters",
    title: "Mga Ulat Kalamidad",
    description: "Baha, Bagyo, Pinsala %, Tinatayang Loss, Status timeline",
    icon: <IrrigationIcon className="w-6 h-6 stroke-[2.2]" />,
    color: "text-rose-700",
    bg: "bg-rose-100",
    route: "/farmer/history/disasters",
    badgeColor: "bg-rose-600",
  },
  {
    id: "sync-queue",
    title: "Offline Sync Queue",
    description: "Mga rekord na nakatabi habang walang signal, manual sync",
    icon: <Database className="w-6 h-6 stroke-[2.2]" />,
    color: "text-emerald-700",
    bg: "bg-emerald-100",
    route: "/farmer/history/sync-queue",
    badgeColor: "bg-emerald-600",
  },
];

export const FarmerHistoryHubPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedFarm } = useFarmSelection();

  const locationLabel = selectedFarm
    ? `${selectedFarm.name} • ${selectedFarm.barangay}, ${selectedFarm.municipality}`
    : "Pumili ng sakahan";

  return (
    <div className="w-full min-h-screen bg-slate-100 md:bg-slate-950 flex flex-col items-center justify-start p-0 md:p-6 lg:p-8 font-sans selection:bg-emerald-500/30">
      <div className="w-full md:max-w-3xl bg-slate-50 text-slate-900 shadow-2xl flex flex-col h-[100dvh] md:h-[92vh] md:max-h-[920px] overflow-hidden md:rounded-[36px] md:border-2 md:border-emerald-800/40 relative">

        {/* Header */}
        <header className="w-full bg-[#03543f] text-white px-4 sm:px-6 pt-4 pb-3 flex justify-between items-center shadow-md shrink-0 z-20">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate("/farmer")}
              className="w-10 h-10 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 border border-emerald-500/30 flex items-center justify-center text-white active:scale-95 transition cursor-pointer"
              title="Bumalik sa Dashboard"
            >
              <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight">
                Kasaysayan ng Sakahan
              </h1>
              <p className="text-[11px] sm:text-xs text-emerald-200/90 font-medium truncate max-w-[280px]">
                {locationLabel}
              </p>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-5 space-y-4 overflow-y-auto">

          {/* Farm Context Card */}
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0">
              <History className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-sm text-emerald-900 leading-tight">
                Kasaysayan para sa <strong>{selectedFarm?.name || "Sakahan"}</strong>
              </p>
              <p className="text-xs text-emerald-700/90 mt-0.5 leading-snug">
                {selectedFarm ? `${selectedFarm.barangay}, ${selectedFarm.municipality}, Cagayan` : "Walang napiling sakahan — pumili sa itaas"}
              </p>
            </div>
          </div>

          {/* Section Cards */}
          <div className="space-y-3">
            {SECTIONS.map(section => (
              <button
                key={section.id}
                type="button"
                onClick={() => navigate(section.route)}
                className="w-full relative group bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex items-center gap-4 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer touch-manipulation"
              >
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${section.bg}`}>
                  {section.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-extrabold text-base text-slate-900 truncate group-hover:text-emerald-700 transition-colors">
                    {section.title}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                    {section.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {section.badge && (
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold text-white ${section.badgeColor}`}>
                      {section.badge}
                    </span>
                  )}
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 transition-all" />
                </div>
              </button>
            ))}
          </div>

          {/* Quick Tips */}
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 space-y-2">
            <p className="text-[10px] font-black text-emerald-900 uppercase tracking-wide flex items-center gap-1">
              <History className="w-3.5 h-3.5" /> Mga Tip
            </p>
            <ul className="text-[11px] text-emerald-800 space-y-1 pl-4 list-disc">
              <li>Gamitin ang <strong>Farm Selector</strong> sa itaas para pumili ng ibang sakahan/pananim</li>
              <li>Bawat seksyon ay may <strong>date filter</strong> (30 araw, season, lahat) at <strong>CSV export</strong></li>
              <li><strong>Offline Sync Queue</strong> ay automatic — naka-sync kapag may signal, o manual dito</li>
              <li>Tap sa anumang record para sa <strong>buong detalye</strong> (litrato, AI diagnosis, timeline)</li>
            </ul>
          </div>

        </main>

        {/* Bottom Nav */}
        <nav className="shrink-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 pt-2 pb-3.5 md:py-2 flex justify-around items-center z-30 shadow-lg">
          <button onClick={() => navigate("/farmer")} className="flex flex-col items-center justify-center min-h-[48px] gap-1 px-3 py-1 text-slate-500 hover:text-emerald-700 font-medium text-[11px] transition cursor-pointer"><Home className="w-5 h-5 stroke-[2]" /><span>Tahanan</span></button>
          <button onClick={() => navigate("/farmer/scanner")} className="flex flex-col items-center justify-center min-h-[48px] gap-1 px-3 py-1 text-slate-500 hover:text-emerald-700 font-medium text-[11px] transition cursor-pointer"><Scan className="w-5 h-5 stroke-[2]" /><span>Scanner</span></button>
          <button onClick={() => navigate("/farmer/chat")} className="flex flex-col items-center justify-center min-h-[48px] gap-1 px-3 py-1 text-slate-500 hover:text-emerald-700 font-medium text-[11px] transition cursor-pointer"><MessageSquare className="w-5 h-5 stroke-[2]" /><span>AI Chat</span></button>
          <button onClick={() => navigate("/farmer/history")} className="flex flex-col items-center justify-center min-h-[48px] gap-1 px-3 py-1 rounded-2xl bg-emerald-50 text-emerald-800 font-bold text-[11px] transition cursor-pointer relative"><History className="w-5 h-5 text-emerald-700 stroke-[2.4]" /><span>History</span></button>
        </nav>

      </div>
    </div>
  );
};

export default FarmerHistoryHubPage;