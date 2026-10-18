/**
 * FarmerObservationsHistoryPage — Observations history per farm/crop cycle
 * Features: Date filter, photo gallery with full-screen viewer, AI diagnosis display
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronLeft,
  Calendar,
  Download,
  Loader2,
  AlertTriangle,
  Image as ImageIcon,
  Search,
  Home,
  Scan,
  MessageSquare,
  Clock,
  FileText,
  Sparkles,
} from "lucide-react";
import {
  listObservations,
  type ObservationRecord,
} from "../../services/observation.service";
import { useFarmSelection } from "../../context/farmSelectionContext";
import { HistoryCard } from "../../components/HistoryCard";
import {
  HistoryDetailModal,
  ImageViewer,
} from "../../components/HistoryDetailModal";
import {
  DateRangeFilter,
  filterByDateRange,
  type DateRangePreset,
} from "../../components/DateRangeFilter";
import { exportObservationsToCSV } from "../../utils/csvExport";

export const FarmerObservationsHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedFarm, selectedCycle } = useFarmSelection();
  const cropCycleId = selectedCycle?.id;

  const [observations, setObservations] = useState<ObservationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DateRangePreset>("all");
  const [customRange, setCustomRange] = useState<{
    from: Date;
    to: Date;
  } | null>(null);
  const [selectedObservation, setSelectedObservation] =
    useState<ObservationRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);

  const loadObservations = useCallback(async () => {
    if (!cropCycleId) {
      setObservations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await listObservations(cropCycleId);
      setObservations(data);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Hindi nakakuha ng mga obserbasyon";
      setError(msg);
      toast.error("Error", { description: msg });
    } finally {
      setLoading(false);
    }
  }, [cropCycleId]);

  useEffect(() => {
    loadObservations();
  }, [loadObservations]);

  // Memoized filtered observations
  const filteredObservations = useMemo(() => {
    return filterByDateRange(
      observations.map((o) => ({
        ...o,
        date: o.createdAt.split("T")[0],
        category: "OBSERVATION" as const,
      })),
      datePreset,
      customRange,
      selectedCycle?.plantingDate,
    );
  }, [observations, datePreset, customRange, selectedCycle?.plantingDate]);

  // Memoized stats
  const stats = useMemo(() => {
    const total = filteredObservations.length;
    const bySeverity = filteredObservations.reduce(
      (acc, o) => {
        acc[o.severity] = (acc[o.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    const withPhotos = filteredObservations.filter((o) => o.imageUrl).length;
    const withAI = filteredObservations.filter(
      (o) => o.aiDiagnosis?.condition,
    ).length;
    return { total, bySeverity, withPhotos, withAI };
  }, [filteredObservations]);

  const handleExport = () => {
    if (filteredObservations.length === 0) {
      toast.info("Walang data", {
        description: "Walang mga obserbasyon para i-export",
      });
      return;
    }
    exportObservationsToCSV(
      filteredObservations.map((o) => ({
        id: o.id,
        title: o.title,
        description: o.description,
        severity: o.severity,
        createdAt: o.createdAt,
        imageUrl: o.imageUrl,
        aiDiagnosis: o.aiDiagnosis,
        farmName: selectedFarm?.name,
        variety: selectedCycle?.variety,
      })),
    );
    toast.success("Na-export na!", {
      description: `${filteredObservations.length} obserbasyon nai-save bilang CSV`,
    });
  };

  const openDetail = (observation: ObservationRecord) => {
    setSelectedObservation(observation);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedObservation(null);
  };

  const openImageViewer = (observation: ObservationRecord, index = 0) => {
    if (observation.imageUrl) {
      setImageViewerIndex(index);
      setImageViewerOpen(true);
    }
  };

  const closeImageViewer = () => {
    setImageViewerOpen(false);
  };

  const getSeverityConfig = (
    severity: string,
  ): {
    label: string;
    color: string;
    bg: string;
    icon: React.ReactNode;
  } => {
    switch (severity) {
      case "LOW":
        return {
          label: "Mababa",
          color: "text-emerald-700",
          bg: "bg-emerald-100",
          icon: <AlertTriangle className="w-3.5 h-3.5" />,
        };
      case "MEDIUM":
        return {
          label: "Katamtaman",
          color: "text-amber-700",
          bg: "bg-amber-100",
          icon: <AlertTriangle className="w-3.5 h-3.5" />,
        };
      case "HIGH":
        return {
          label: "Mataas",
          color: "text-orange-700",
          bg: "bg-orange-100",
          icon: <AlertTriangle className="w-3.5 h-3.5" />,
        };
      case "CRITICAL":
        return {
          label: "Kritikal",
          color: "text-red-700",
          bg: "bg-red-100",
          icon: <AlertTriangle className="w-3.5 h-3.5" />,
        };
      default:
        return {
          label: severity,
          color: "text-slate-700",
          bg: "bg-slate-100",
          icon: <AlertTriangle className="w-3.5 h-3.5" />,
        };
    }
  };

  const locationLabel = selectedFarm
    ? `${selectedFarm.name} • ${selectedFarm.barangay}, ${selectedFarm.municipality}`
    : "Pumili ng sakahan";

  // Pre-compute severity config for modal to avoid TypeScript issues with inline calls
  const severityConfig = selectedObservation
    ? getSeverityConfig(selectedObservation.severity)
    : null;

  return (
    <div className="w-full min-h-screen bg-slate-100 md:bg-slate-950 flex flex-col items-center justify-start p-0 md:p-6 lg:p-8 font-sans selection:bg-emerald-500/30">
      <div className="w-full md:max-w-3xl bg-slate-50 text-slate-900 shadow-2xl flex flex-col h-dvh md:h-[92vh] md:max-h-230 overflow-hidden md:rounded-[36px] md:border-2 md:border-emerald-800/40 relative">
        {/* Header */}
        <header className="w-full bg-[#03543f] text-white px-4 sm:px-6 pt-4 pb-3 flex justify-between items-center shadow-md shrink-0 z-20">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate("/farmer/history")}
              className="w-10 h-10 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 border border-emerald-500/30 flex items-center justify-center text-white active:scale-95 transition cursor-pointer"
              title="Bumalik sa History Hub"
            >
              <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight">
                Mga Obserbasyon sa Pananim
              </h1>
              <p className="text-[11px] sm:text-xs text-emerald-200/90 font-medium truncate max-w-70">
                {locationLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={filteredObservations.length === 0 || loading}
              className="px-3.5 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50"
              aria-label="I-export bilang CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Farm/Cycle Context */}
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center text-white shrink-0">
              <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-sm text-amber-900 leading-tight">
                Mga Obserbasyon para sa{" "}
                <strong>
                  {selectedCycle?.variety || selectedCycle?.cropType || "Mais"}
                </strong>
              </p>
              <p className="text-xs text-amber-700/90 mt-0.5 leading-snug">
                {selectedCycle
                  ? `Itinarak: ${new Date(selectedCycle.plantingDate).toLocaleDateString("fil-PH", { month: "long", day: "numeric", year: "numeric" })}`
                  : "Walang napiling pananim"}
              </p>
            </div>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-white rounded-2xl p-3 border border-slate-200/80 text-center">
              <p className="text-2xl font-black text-amber-700">
                {stats.total}
              </p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                Kabuuan
              </p>
            </div>
            <div className="bg-white rounded-2xl p-3 border border-slate-200/80 text-center">
              <p className="text-2xl font-black text-blue-700">
                {stats.withPhotos}
              </p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                May Litrato
              </p>
            </div>
            <div className="bg-white rounded-2xl p-3 border border-slate-200/80 text-center">
              <p className="text-2xl font-black text-emerald-700">
                {stats.withAI}
              </p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                AI Diagnosis
              </p>
            </div>
            <div className="bg-white rounded-2xl p-3 border border-slate-200/80 text-center">
              <p className="text-2xl font-black text-red-700">
                {stats.bySeverity.CRITICAL || 0}
              </p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                Kritikal
              </p>
            </div>
          </div>

          {/* Severity Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((severity) => {
              const count = stats.bySeverity[severity] || 0;
              const config = getSeverityConfig(severity);
              return (
                <span
                  key={severity}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap flex items-center gap-1 ${config.bg} ${config.color}`}
                >
                  {config.icon} {config.label} ({count})
                </span>
              );
            })}
          </div>

          {/* Date Filter */}
          <div className="flex items-center justify-between gap-2">
            <DateRangeFilter
              value={datePreset}
              onChange={setDatePreset}
              customRange={customRange}
              onCustomChange={setCustomRange}
            />
            {customRange && (
              <span className="text-[10px] text-slate-500 px-2 py-1 bg-slate-100 rounded-full">
                {customRange.from.toLocaleDateString("fil-PH", {
                  month: "short",
                  day: "numeric",
                })}{" "}
                –{" "}
                {customRange.to.toLocaleDateString("fil-PH", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
          </div>

          {/* List */}
          <div className="pt-2">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
              LISTAHAN NG OBSERBASYON ({filteredObservations.length})
            </h3>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
              <span>Kinukuha ang mga obserbasyon...</span>
            </div>
          ) : error ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-slate-200/80 space-y-2">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
              <p className="text-xs font-bold text-slate-600">
                Hindi nakakuha ng datos
              </p>
              <p className="text-[11px] text-slate-400">{error}</p>
              <button
                onClick={loadObservations}
                className="mt-2 px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700"
              >
                Subukan Muli
              </button>
            </div>
          ) : filteredObservations.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-slate-200/80 space-y-1">
              <ImageIcon className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">
                Walang mga obserbasyon na naitala
              </p>
              <p className="text-[11px] text-slate-400">
                Gumamit ng <strong>Suriin ang Halaman</strong> o{" "}
                <strong>I-report ang Sintomas</strong> sa dashboard
              </p>
            </div>
          ) : (
            <div className="space-y-3 pb-6">
              {filteredObservations.map((observation) => {
                const severityConfig = getSeverityConfig(observation.severity);
                const hasPhoto = !!observation.imageUrl;
                const hasAI = !!observation.aiDiagnosis?.condition;

                return (
                  <HistoryCard
                    key={observation.id}
                    id={`obs-${observation.id}`}
                    title={observation.title}
                    category="OBSERVATION"
                    date={observation.createdAt.split("T")[0]}
                    description={observation.description}
                    detailHighlight={`${severityConfig.label} Severity ${hasPhoto ? "📷" : ""}${hasAI ? " 🤖" : ""}`}
                    status="Synced"
                    onClick={() => openDetail(observation)}
                    expanded={selectedObservation?.id === observation.id}
                    onExpand={() => openDetail(observation)}
                  >
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      {/* Photo Preview */}
                      {hasPhoto && (
                        <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-100">
                          <img
                            src={observation.imageUrl!}
                            alt={observation.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openImageViewer(observation);
                            }}
                            className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg hover:bg-white transition"
                            aria-label="I-zoom ang litrato"
                          >
                            <Search className="w-4 h-4 text-slate-700" />
                          </button>
                          <div className="absolute top-2 left-2 flex gap-1">
                            <span className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                              AI
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div
                          className={`bg-slate-50 rounded-xl p-3 border ${severityConfig.bg}/50`}
                        >
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                            Severity
                          </p>
                          <p className="text-sm font-bold flex items-center gap-1">
                            {severityConfig.icon}{" "}
                            <span className={severityConfig.color}>
                              {severityConfig.label}
                            </span>
                          </p>
                        </div>
                        <div
                          className={`bg-slate-50 rounded-xl p-3 border ${hasAI ? "bg-emerald-50 border-emerald-200/50" : "bg-slate-50 border-slate-200/50"}`}
                        >
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                            AI Diagnosis
                          </p>
                          <p className="text-sm font-bold flex items-center gap-1">
                            {hasAI ? (
                              <>
                                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-emerald-800">
                                  {observation.aiDiagnosis?.condition}
                                </span>
                              </>
                            ) : (
                              <span className="text-slate-500">
                                Hindi na-scan
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                          Buong Paglalarawan
                        </p>
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                          {observation.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Nai-record:{" "}
                          {new Date(observation.createdAt).toLocaleDateString(
                            "fil-PH",
                            { month: "long", day: "numeric", year: "numeric" },
                          )}
                        </span>
                      </div>
                    </div>
                  </HistoryCard>
                );
              })}
            </div>
          )}
        </main>

        {/* Bottom Nav */}
        <nav className="shrink-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 pt-2 pb-3.5 md:py-2 flex justify-around items-center z-30 shadow-lg">
          <button
            onClick={() => navigate("/farmer")}
            className="flex flex-col items-center justify-center min-h-12 gap-1 px-3 py-1 text-slate-500 hover:text-emerald-700 font-medium text-[11px] transition cursor-pointer"
          >
            <Home className="w-5 h-5 stroke-2" />
            <span>Tahanan</span>
          </button>
          <button
            onClick={() => navigate("/farmer/scanner")}
            className="flex flex-col items-center justify-center min-h-12 gap-1 px-3 py-1 text-slate-500 hover:text-emerald-700 font-medium text-[11px] transition cursor-pointer"
          >
            <Scan className="w-5 h-5 stroke-2" />
            <span>Scanner</span>
          </button>
          <button
            onClick={() => navigate("/farmer/chat")}
            className="flex flex-col items-center justify-center min-h-12 gap-1 px-3 py-1 text-slate-500 hover:text-emerald-700 font-medium text-[11px] transition cursor-pointer"
          >
            <MessageSquare className="w-5 h-5 stroke-2" />
            <span>AI Chat</span>
          </button>
          <button
            onClick={() => navigate("/farmer/history")}
            className="flex flex-col items-center justify-center min-h-12 gap-1 px-3 py-1 rounded-2xl bg-emerald-50 text-emerald-800 font-bold text-[11px] transition cursor-pointer relative"
          >
            <Clock className="w-5 h-5 text-emerald-700 stroke-[2.4]" />
            <span>History</span>
          </button>
        </nav>
      </div>

      {/* Detail Modal */}
      <HistoryDetailModal
        isOpen={modalOpen}
        onClose={closeModal}
        title={selectedObservation?.title || ""}
        subtitle={
          selectedObservation && severityConfig
            ? `${severityConfig.label} Severity • ${new Date(selectedObservation.createdAt).toLocaleDateString("fil-PH", { month: "long", day: "numeric", year: "numeric" })}`
            : ""
        }
        category="observation"
        status="Synced"
        tabs={[
          {
            id: "details",
            label: "Detalye",
            icon: <FileText className="w-3.5 h-3.5" />,
            content:
              selectedObservation && severityConfig ? (
                <div className="space-y-3">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Buong Paglalarawan
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                      {selectedObservation.description}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      className={`bg-slate-50 rounded-xl p-3 border ${severityConfig.bg}/50`}
                    >
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                        Severity
                      </p>
                      <p className="text-sm font-bold flex items-center gap-1">
                        {severityConfig.icon}
                        <span className={severityConfig.color}>
                          {severityConfig.label}
                        </span>
                      </p>
                    </div>
                    <div
                      className={`bg-slate-50 rounded-xl p-3 border ${selectedObservation.aiDiagnosis?.condition ? "bg-emerald-50 border-emerald-200/50" : "bg-slate-50 border-slate-200/50"}`}
                    >
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                        AI Diagnosis
                      </p>
                      <p className="text-sm font-bold flex items-center gap-1">
                        {selectedObservation.aiDiagnosis?.condition ? (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-800">
                              {selectedObservation.aiDiagnosis.condition}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-500">Hindi na-scan</span>
                        )}
                      </p>
                    </div>
                  </div>
                  {selectedObservation.imageUrl && (
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-100">
                      <img
                        src={selectedObservation.imageUrl}
                        alt={selectedObservation.title}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => {
                          closeModal();
                          setTimeout(
                            () => openImageViewer(selectedObservation!),
                            100,
                          );
                        }}
                        className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg hover:bg-white transition"
                        aria-label="I-zoom ang litrato"
                      >
                        <Search className="w-4 h-4 text-slate-700" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Nai-record:{" "}
                      {new Date(
                        selectedObservation.createdAt,
                      ).toLocaleDateString("fil-PH", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              ) : null,
          },
          {
            id: "photos",
            label: "Mga Litrato",
            icon: <ImageIcon className="w-3.5 h-3.5" />,
            disabled: !selectedObservation?.imageUrl,
            content: selectedObservation?.imageUrl ? (
              <div className="space-y-3">
                <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-100">
                  <img
                    src={selectedObservation.imageUrl}
                    alt={selectedObservation.title}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => {
                      closeModal();
                      setTimeout(
                        () => openImageViewer(selectedObservation!),
                        100,
                      );
                    }}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition"
                    aria-label="I-zoom ang litrato"
                  >
                    <Search className="w-8 h-8 text-white" />
                  </button>
                </div>
                <p className="text-xs text-slate-500 text-center">
                  Tap para i-zoom • Swipe para mag-navigate
                </p>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                <p>Walang litrato para sa obserbasyong ito</p>
              </div>
            ),
          },
          {
            id: "timeline",
            label: "Timeline",
            icon: <Clock className="w-3.5 h-3.5" />,
            content: selectedObservation ? (
              <div className="space-y-3 border-l-2 border-slate-200 pl-4">
                <div className="relative">
                  <div className="absolute -left-1.5 top-0 w-2 h-2 rounded-full bg-amber-600 border-2 border-white" />
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Nai-record
                  </p>
                  <p className="text-sm text-slate-700">
                    {new Date(selectedObservation.createdAt).toLocaleString(
                      "fil-PH",
                      {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      },
                    )}
                  </p>
                </div>
                {selectedObservation.aiDiagnosis?.condition && (
                  <div className="relative">
                    <div className="absolute -left-1.5 top-0 w-2 h-2 rounded-full bg-emerald-600 border-2 border-white" />
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">
                      AI Diagnosis
                    </p>
                    <p className="text-sm text-emerald-800">
                      {selectedObservation.aiDiagnosis.condition}
                    </p>
                    <p className="text-[10px] text-emerald-600/80">
                      Kumpyansa:{" "}
                      {selectedObservation.aiDiagnosis.confidence
                        ? Math.round(
                            (selectedObservation.aiDiagnosis
                              .confidence as number) * 100,
                          ) + "%"
                        : "N/A"}
                    </p>
                  </div>
                )}
                {selectedObservation.imageUrl && (
                  <div className="relative">
                    <div className="absolute -left-1.5 top-0 w-2 h-2 rounded-full bg-blue-600 border-2 border-white" />
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">
                      Litrato Na-upload
                    </p>
                  </div>
                )}
              </div>
            ) : null,
          },
        ]}
      />

      {/* Full-Screen Image Viewer */}
      {imageViewerOpen && selectedObservation?.imageUrl && (
        <ImageViewer
          images={[selectedObservation.imageUrl]}
          initialIndex={imageViewerIndex}
          onClose={closeImageViewer}
          alt={selectedObservation.title}
        />
      )}
    </div>
  );
};

export default FarmerObservationsHistoryPage;
