import React, { useMemo, useState } from "react";
import type { ExpertCase } from "../../services/case.service";
import type { ConsultFilterKey, ConsultationItem } from "./types";
import { parseLegacyCaseDescription } from "../../lib/parseLegacyCaseDescription";
import { parseFarmerMessage, parseSubject } from "./messageParser";
import { StatusChips } from "./StatusChips";
import { ThreadList } from "./ThreadList";
import { FarmerContactBar } from "./FarmerContactBar";
import { MessageList } from "./MessageList";
import { MaisySuggestion } from "./MaisySuggestion";
import { ReplyBox } from "./ReplyBox";
import { KonsultasyonViewSkeleton } from "./KonsultasyonSkeletons";

export interface KonsultasyonViewProps {
  expertCases: ExpertCase[];
  isLoading?: boolean;
  error?: string | null;
  onSendReply: (caseId: string, reply: string) => Promise<void> | void;
  isSendingReply?: boolean;
  selectedLocationKey?: string;
}

export const KonsultasyonView: React.FC<KonsultasyonViewProps> = ({
  expertCases,
  isLoading = false,
  error = null,
  onSendReply,
  isSendingReply = false,
  selectedLocationKey = "",
}) => {
  const [activeFilter, setActiveFilter] = useState<ConsultFilterKey>("Lahat");
  const [selectedConsultationId, setSelectedConsultationId] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState("");

  // 1. Filter by top bar if location selected
  const casesMatchingLocation = useMemo(() => {
    if (!selectedLocationKey) return expertCases;
    return expertCases.filter((c) => {
      const bgy = c.observation?.cropCycle?.farm?.barangay;
      const muni = c.observation?.cropCycle?.farm?.municipality;
      if (!bgy) return true;
      const key = `${bgy} · ${muni || ""}`;
      return (
        key.toLowerCase().includes(selectedLocationKey.toLowerCase()) ||
        bgy.toLowerCase() === selectedLocationKey.toLowerCase()
      );
    });
  }, [expertCases, selectedLocationKey]);

  // 2. Map ExpertCase records into clean ConsultationItem shape
  const allConsultations: ConsultationItem[] = useMemo(() => {
    return casesMatchingLocation.map((c) => {
      const parsedLegacy = parseLegacyCaseDescription(c.observation?.description);
      const parsedSub = parseSubject(c.observation?.title);

      let farmerName = "";
      if (c.observation?.farmer?.firstName || c.observation?.farmer?.lastName) {
        farmerName = `${c.observation.farmer.firstName || ""} ${c.observation.farmer.lastName || ""}`.trim();
      } else if (c.observation?.cropCycle?.farm?.farmer?.firstName || c.observation?.cropCycle?.farm?.farmer?.lastName) {
        farmerName = `${c.observation.cropCycle.farm.farmer.firstName || ""} ${c.observation.cropCycle.farm.farmer.lastName || ""}`.trim();
      } else if (parsedLegacy.farmerName) {
        farmerName = parsedLegacy.farmerName;
      } else if (c.observation?.cropCycle?.farm?.name) {
        const cleanedFarm = c.observation.cropCycle.farm.name.replace(/^(\[DEMO\]\s*)?Sakahan ni\s*/i, "").trim();
        if (cleanedFarm) farmerName = cleanedFarm;
      }
      if (!farmerName) farmerName = "Magsasaka";

      const phone =
        c.observation?.farmer?.phone ||
        c.observation?.cropCycle?.farm?.farmer?.phone ||
        "";
      const barangay =
        c.observation?.cropCycle?.farm?.barangay ||
        parsedLegacy.barangay ||
        "Centro Norte (Pob.)";

      const isAnswered = Boolean(c.recommendation) || c.status === "RESOLVED";
      const status: "Bago" | "Sinagot" = isAnswered ? "Sinagot" : "Bago";

      const hasTechnicianRequest =
        parsedSub.hasTechnicianRequest || parsedLegacy.requestedTechnicianHelp;

      // Messages
      const messages: ConsultationItem["messages"] = [];

      const rawFarmerText = parsedLegacy.message || c.observation?.description || "";
      if (rawFarmerText.trim()) {
        const parsedMsg = parseFarmerMessage(rawFarmerText);
        messages.push({
          id: `msg-farmer-${c.id}`,
          from: "farmer",
          text: parsedMsg.cleanText || rawFarmerText,
          tag: parsedMsg.tag,
          sentAt: c.createdAt || null,
        });
      }

      if (c.recommendation && c.recommendation.trim()) {
        messages.push({
          id: `msg-officer-${c.id}`,
          from: "officer",
          text: c.recommendation.trim(),
          sentAt: c.resolvedAt || c.createdAt || null,
        });
      }

      const maisySuggestion =
        c.observation?.aiDiagnosis?.recommendedAction ||
        "Batay sa yugto ng paglago ng mais, regular na inspeksyunin ang usbong at panatilihin ang sapat na moisture sa lupa.";

      return {
        id: c.id,
        farmerName,
        phone,
        barangay,
        subject: parsedSub.cleanSubject,
        hasTechnicianRequest,
        status,
        messages,
        maisySuggestion,
        rawStatus: c.status,
        createdAt: c.createdAt,
      };
    });
  }, [casesMatchingLocation]);

  // 3. Compute chip counts
  const chipCounts = useMemo<Record<ConsultFilterKey, number>>(() => {
    const counts: Record<ConsultFilterKey, number> = {
      Bago: 0,
      Sinagot: 0,
      Lahat: allConsultations.length,
    };

    allConsultations.forEach((item) => {
      if (counts[item.status] !== undefined) {
        counts[item.status] += 1;
      }
    });

    return counts;
  }, [allConsultations]);

  // 4. Filter according to active chip
  const filteredConsultations = useMemo(() => {
    if (activeFilter === "Lahat") return allConsultations;
    return allConsultations.filter((item) => item.status === activeFilter);
  }, [allConsultations, activeFilter]);

  // 5. Select default consultation
  const activeConsultation = useMemo(() => {
    if (filteredConsultations.length === 0) return null;
    const found = filteredConsultations.find((item) => item.id === selectedConsultationId);
    return found || filteredConsultations[0] || null;
  }, [filteredConsultations, selectedConsultationId]);

  const handleSend = async () => {
    if (!activeConsultation || !replyInput.trim() || isSendingReply) return;
    await onSendReply(activeConsultation.id, replyInput.trim());
    setReplyInput("");
  };

  return (
    <div
      style={{
        backgroundColor: "#f4f6f2",
        fontFamily:
          "Figtree, Atkinson Hyperlegible, Inter, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
      className="min-h-full w-full p-6 text-[#14213d]"
    >
      <div className="mx-auto max-w-[1152px] w-full flex flex-col gap-4">
        {/* Header */}
        <header className="flex flex-col gap-3 w-full">
          <h1 className="text-[28px] font-extrabold text-[#14213d] tracking-tight leading-none">
            Mga Konsultasyon
          </h1>

          <StatusChips
            selected={activeFilter}
            onSelect={(chip) => {
              setActiveFilter(chip);
              setSelectedConsultationId(null);
            }}
            counts={chipCounts}
          />
        </header>

        {/* Inline error alert */}
        {error ? (
          <div
            role="alert"
            className="w-full bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl p-4 text-[14px] font-semibold"
          >
            {error}
          </div>
        ) : null}

        {/* Loading state */}
        {isLoading ? (
          <KonsultasyonViewSkeleton />
        ) : filteredConsultations.length === 0 ? (
          /* Empty state for filter: Show message in left column, hide right panel */
          <div className="w-full lg:grid lg:grid-cols-12 gap-4 items-start">
            <div className="lg:col-span-4 w-full bg-white border border-[#dde3d8] rounded-[24px] p-8 text-center text-[#4b5563] text-[15px] font-semibold shadow-xs">
              Walang konsultasyon sa napiling katayuan.
            </div>
          </div>
        ) : (
          /* Main 12-column grid */
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 items-start w-full">
            {/* Left column (columns 1-4): Thread List */}
            <div className="w-full lg:col-span-4 flex flex-col gap-2.5">
              <ThreadList
                threads={filteredConsultations}
                selectedId={activeConsultation?.id || null}
                onSelect={(id) => {
                  setSelectedConsultationId(id);
                  setReplyInput("");
                }}
              />
            </div>

            {/* Right column (columns 5-12): Conversation Panel */}
            {activeConsultation ? (
              <div className="w-full lg:col-span-8 flex flex-col rounded-[28px] overflow-hidden bg-white border border-[#dde3d8] shadow-xs">
                {/* a) Farmer Contact Bar (Compact) */}
                <FarmerContactBar consultation={activeConsultation} />

                {/* b) Messages List */}
                <MessageList
                  subject={activeConsultation.subject}
                  messages={activeConsultation.messages}
                />

                {/* c) Maisy Suggestion + Reply Box */}
                <div className="px-5 sm:px-7 pt-4 pb-6 flex flex-col gap-3 border-t border-slate-100">
                  <MaisySuggestion
                    suggestion={activeConsultation.maisySuggestion}
                    onUseSuggestion={(text) => setReplyInput(text)}
                  />

                  <ReplyBox
                    value={replyInput}
                    onChange={setReplyInput}
                    onSend={handleSend}
                    isSending={isSendingReply}
                  />
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};
