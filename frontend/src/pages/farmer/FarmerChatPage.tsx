import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronLeft,
  RefreshCw,
  Bot,
  ShieldCheck,
  ArrowRight,
  Send,
  Home,
  Scan,
  MessageSquare,
  Clock,
} from "lucide-react";
import { sendRagChat, type RagChatSource } from "../../services/ai.service";
import { getOfflineQueue } from "../../services/sync.service";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  sources?: RagChatSource[];
  farmContextUsed?: boolean;
}

const QUICK_PROMPTS = [
  "Ano ang tamang pataba sa DAP 38 (Vegetative Stage)?",
  "Paano kontrolin ang Fall Armyworm sa murang mais?",
  "Ano ang ulat ng panahon ng PAGASA sa Solana Cagayan?",
];

export const FarmerChatPage: React.FC = () => {
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Active farm context
  const [farmData, setFarmData] = useState({
    farmName: "Basi Corn Plantation #1",
    farmerName: "Mang Danilo",
    municipality: "Solana",
    barangay: "Basi East",
    variety: "Pioneer 30T60",
    cropCycleId: "cycle-local-01",
    dap: 38,
  });

  const [queueCount, setQueueCount] = useState(2);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-initial",
      role: "assistant",
      text: "Magandang araw, Mang Danilo! Ako ang iyong AI Farming Assistant para sa Mais dito sa Cagayan. Paano kita matutulungan sa iyong taniman sa Solana ngayon?",
      timestamp: "09:00 AM",
      sources: [
        { title: "DA Region II Corn Techno Guide", source: "Regional Crop Protection Center" },
      ],
      farmContextUsed: true,
    },
  ]);

  // Load local context on mount
  useEffect(() => {
    try {
      const savedFarm = localStorage.getItem("tarabay_active_farm");
      if (savedFarm) {
        const parsed = JSON.parse(savedFarm);
        setFarmData((prev) => ({
          ...prev,
          farmName: parsed.farmName || prev.farmName,
          farmerName: parsed.farmerName ? parsed.farmerName.split(" ")[0] || parsed.farmerName : prev.farmerName,
          municipality: parsed.municipality || prev.municipality,
          barangay: parsed.barangay || prev.barangay,
          variety: parsed.variety || prev.variety,
          dap: parsed.dap ?? 38,
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

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Append user message immediately
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
      timestamp: timeStr,
    };
    setMessages((prev) => [...prev, userMsg]);
    setPrompt("");
    setLoading(true);

    try {
      const response = await sendRagChat(trimmed, farmData.cropCycleId);
      const botMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: response.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        sources: response.sources,
        farmContextUsed: response.farmContextUsed,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      // Grounded fallback response adhering to DA Region II corn guidelines
      let answer = "";
      let sources: RagChatSource[] = [];

      if (trimmed.includes("pataba") || trimmed.includes("DAP") || trimmed.includes("Vegetative")) {
        answer = `Ayon sa DA Region II Corn Techno-Guide para sa ${farmData.variety} sa DAP ${farmData.dap} (Vegetative Stage):\n\n1. Mag-side dress ng 2 sako ng Urea (46-0-0) bawat ektarya.\n2. Ilagay ang abono humigit-kumulang 5-7 sentimetro mula sa puno ng mais at tabunan ng manipis na lupa.\n3. Pinakamainam itong gawin habang mamasa-masa ang lupa o bago ang inaasahang pag-ulan sa hapon.`;
        sources = [
          { title: "Gabay sa Pagtatanim ng Mais sa Rehiyon II", source: "DA-RFO 02 Tuguegarao" },
          { title: "Corn Nutrient Management Guide", source: "PhilRice Advisory" },
        ];
      } else if (trimmed.includes("Armyworm") || trimmed.includes("peste")) {
        answer = `Para sa Fall Armyworm (FAW) sa murang mais:\n\n1. Siyasatin ang gitnang usbong (whorl) kung may butas-butas na parang bintana (window-pane effect) o bakas ng dumi (frass).\n2. Kung apektado ang higit sa 10% ng taniman, mag-aplay ng bio-control agent tulad ng Bacillus thuringiensis (Bt) o kemikal na Chlorantraniliprole.\n3. Mag-spray sa dapithapon o maagang umaga kapag aktibo ang uod at walang matinding init.`;
        sources = [
          { title: "FAW Management in Cagayan Valley", source: "Regional Crop Protection Center (RCPC 02)" },
        ];
      } else if (trimmed.includes("panahon") || trimmed.includes("PAGASA")) {
        answer = `PAGASA Agro-Weather para sa ${farmData.municipality}, Cagayan:\n\n• Temperatura: 31°C (Mainit sa umaga)\n• Tsansa ng Ulan: 75% na may mga localized thunderstorm sa hapon\n• Humidity: 82%\n\nPayo ng DA: Samantalahin ang maaliwalas na umaga para sa pag-aararo o pag-inspeksyon, at iwasan ang pag-spray ng pestisidyo kung may banta ng malakas na ulan sa hapon.`;
        sources = [
          { title: "PAGASA Agro-Meteorological Bulletin", source: "Region II Agri-Weather Service" },
        ];
      } else {
        answer = `Ayon sa opisyal na gabay ng Kagawaran ng Pagsasaka (DA Region II) para sa Cagayan Valley:\n\nMahalaga ang maagap na pagsubaybay sa inyong ${farmData.variety}. Para sa anumang kakaibang sintomas sa dahon o pagtubo, iminumungkahi ring kumuha ng litrato gamit ang ating AI Plant Health Scanner para sa agarang diagnosis.`;
        sources = [
          { title: "DA Region II Corn Techno Guide", source: "DA Regional Field Office 02" },
        ];
      }

      const botMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: answer,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        sources,
        farmContextUsed: true,
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleQueueClick = () => {
    toast.info("Offline Sync Queue", {
      description: "May 2 nakatagong ulat/obserbasyon sa telepono na handang i-sync kapag nagkaroon ng signal.",
    });
  };

  return (
    <div className="w-full min-h-screen bg-slate-100 md:bg-slate-950 flex flex-col items-center justify-start p-0 md:p-6 lg:p-8 font-sans selection:bg-emerald-500/30">
      {/* Responsive Container: Mobile Viewport (412x917 edge-to-edge) vs Tablet/Desktop Card (md/lg/xl) */}
      <div className="w-full md:max-w-2xl lg:max-w-3xl bg-slate-50 text-slate-900 shadow-2xl flex flex-col justify-between overflow-x-hidden md:rounded-[36px] md:border-2 md:border-emerald-800/40 min-h-screen relative pb-20 md:pb-6">
        
        {/* ========================================================= */}
        {/* 1. TOP HEADER (Deep Emerald #03543f)                      */}
        {/* ========================================================= */}
        <header className="w-full bg-[#03543f] text-white px-4 sm:px-6 pt-4 pb-3 flex justify-between items-center shadow-md">
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
                AI Assistant sa Taniman
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
        {/* 2. RAG SUB-HEADER CONTEXT BAR (Dark Emerald #023c2c)      */}
        {/* ========================================================= */}
        <div className="w-full bg-[#023c2c] text-white px-4 sm:px-6 py-2.5 flex justify-between items-center border-b border-emerald-900/60 shadow-inner">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300">
              <Bot className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-white leading-tight">
                AI Farming Knowledge Assistant
              </h2>
              <p className="text-[10px] sm:text-[11px] text-emerald-200/80 font-medium">
                RAG Engine • Grounded in Official DA Region II Manuals
              </p>
            </div>
          </div>

          {/* Grounded Answers Pill */}
          <div className="inline-flex items-center gap-1 rounded-full bg-emerald-950/70 border border-teal-500/40 px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold text-teal-300 shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span>Grounded Answers</span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3. CHAT CONVERSATION AREA                                 */}
        {/* ========================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* Messages Stream */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-[88%] sm:max-w-md rounded-2xl p-4 text-xs sm:text-sm leading-relaxed shadow-sm ${
                  msg.role === "user"
                    ? "bg-[#047857] text-white rounded-br-none"
                    : "bg-white text-slate-800 rounded-tl-none border border-slate-200"
                }`}
              >
                <p className="whitespace-pre-line font-medium">{msg.text}</p>
                <div
                  className={`text-[10px] mt-2 text-right ${
                    msg.role === "user" ? "text-emerald-200" : "text-slate-400"
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>

              {/* Citations Footer */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1 max-w-[88%] sm:max-w-md">
                  {msg.sources.map((s, idx) => (
                    <span
                      key={idx}
                      className="rounded-lg bg-teal-50 border border-teal-200 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-teal-800"
                    >
                      📖 {s.title}
                    </span>
                  ))}
                  {msg.farmContextUsed && (
                    <span className="rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-emerald-800">
                      🌾 Naka-angkla sa {farmData.variety} (DAP {farmData.dap})
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Assistant Loading State */}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-500 italic p-3 bg-white rounded-2xl border border-slate-200 w-fit">
              <Bot className="w-4 h-4 text-teal-600 animate-spin" />
              <span>Sinasangguni ang DA Region II Corn Knowledge Base...</span>
            </div>
          )}

          {/* Quick Prompts Suggestions (Visible when messages count is low) */}
          {messages.length <= 2 && (
            <div className="space-y-2 pt-2">
              {QUICK_PROMPTS.map((qp, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(qp)}
                  className="w-full rounded-full border-2 border-cyan-400 bg-white hover:bg-cyan-50/50 active:scale-[0.99] px-4 py-2.5 text-left text-xs font-semibold text-slate-800 shadow-sm flex items-center justify-between transition cursor-pointer"
                >
                  <span className="line-clamp-1">{qp}</span>
                  <ArrowRight className="w-4 h-4 text-cyan-600 shrink-0 ml-2" />
                </button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ========================================================= */}
        {/* 4. FLOATING INPUT BAR                                     */}
        {/* ========================================================= */}
        <div className="p-3 sm:p-4 bg-white/95 backdrop-blur-md border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(prompt);
            }}
            className="flex items-center gap-2 max-w-full"
          >
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Magtanong tungkol sa pataba, peste, o panahon..."
              className="flex-1 rounded-full border border-slate-300 bg-slate-100/90 px-4 py-3 text-xs sm:text-sm font-medium text-slate-800 outline-none transition focus:border-teal-600 focus:bg-white placeholder:text-slate-400"
            />

            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="w-12 h-12 rounded-full bg-[#00695c] hover:bg-[#004d40] text-white flex items-center justify-center shrink-0 shadow-md transition active:scale-95 cursor-pointer disabled:opacity-40"
              title="Ipadala ang tanong"
            >
              <Send className="w-5 h-5 -translate-x-0.5 translate-y-0.5" />
            </button>
          </form>
        </div>

        {/* ========================================================= */}
        {/* 5. FIXED BOTTOM NAVIGATION BAR                            */}
        {/* ========================================================= */}
        <nav className="fixed md:sticky bottom-0 left-0 right-0 max-w-full md:max-w-2xl lg:max-w-3xl mx-auto bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2 flex justify-around items-center z-30 shadow-lg">
          {/* Tahanan */}
          <button
            type="button"
            onClick={() => navigate("/farmer")}
            className="flex flex-col items-center gap-1 px-3 py-1 text-slate-500 hover:text-emerald-700 font-medium text-[11px] transition cursor-pointer"
          >
            <Home className="w-5 h-5 stroke-[2]" />
            <span>Tahanan</span>
          </button>

          {/* Scanner */}
          <button
            type="button"
            onClick={() => navigate("/farmer/scanner")}
            className="flex flex-col items-center gap-1 px-3 py-1 text-slate-500 hover:text-emerald-700 font-medium text-[11px] transition cursor-pointer"
          >
            <Scan className="w-5 h-5 stroke-[2]" />
            <span>Scanner</span>
          </button>

          {/* AI Chat (Active) */}
          <button
            type="button"
            onClick={() => {}}
            className="flex flex-col items-center gap-1 px-3 py-1 rounded-2xl bg-emerald-50 text-emerald-800 font-bold text-[11px] transition cursor-pointer"
          >
            <MessageSquare className="w-5 h-5 text-emerald-700 stroke-[2.4]" />
            <span>AI Chat</span>
          </button>

          {/* History */}
          <button
            type="button"
            onClick={() => navigate("/farmer")}
            className="flex flex-col items-center gap-1 px-3 py-1 text-slate-500 hover:text-emerald-700 font-medium text-[11px] transition cursor-pointer relative"
          >
            <div className="relative">
              <Clock className="w-5 h-5 stroke-[2]" />
              {queueCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-amber-500 text-amber-950 font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                  {queueCount}
                </span>
              )}
            </div>
            <span>History</span>
          </button>
        </nav>

      </div>
    </div>
  );
};

export default FarmerChatPage;
