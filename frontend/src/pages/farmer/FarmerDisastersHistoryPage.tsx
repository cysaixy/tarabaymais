/**
 * FarmerDisastersHistoryPage — Disaster reports history per farm
 * Features: Date filter, CSV export, damage %, status timeline, notes
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
  Clock,
  FileText,
  MapPin,
  TrendingDown,
} from "lucide-react";
import { BottomNav } from "../../components/BottomNav";
import {
  getCasePipeline,
  type DisasterReport,
  type CaseStatus,
} from "../../services/case.service";
import { useFarmSelection } from "../../context/farmSelectionContext";
import { HistoryCard } from "../../components/HistoryCard";
import { HistoryDetailModal } from "../../components/HistoryDetailModal";
import {
  DateRangeFilter,
  filterByDateRange,
  type DateRangePreset,
} from "../../components/DateRangeFilter";
import { exportDisastersToCSV } from "../../utils/csvExport";

export const FarmerDisastersHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedFarm } = useFarmSelection();

  const [disasters, setDisasters] = useState<DisasterReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DateRangePreset>("all");
  const [customRange, setCustomRange] = useState<{
    from: Date;
    to: Date;
  } | null>(null);
  const [selectedDisaster, setSelectedDisaster] =
    useState<DisasterReport | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadDisasters = useCallback(async () => {
    if (!selectedFarm?.id) {
      setDisasters([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const pipeline = await getCasePipeline();
      // Filter by farmId
      const farmDisasters = (pipeline.disasterCases || []).filter(
        (d) => d.farmId === selectedFarm.id,
      );
      setDisasters(farmDisasters);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Hindi nakakuha ng mga ulat kalamidad";
      setError(msg);
      toast.error("Error", { description: msg });
    } finally {
      setLoading(false);
    }
  }, [selectedFarm?.id]);

  useEffect(() => {
    loadDisasters();
  }, [loadDisasters]);

  // Memoized filtered disasters
  const filteredDisasters = useMemo(() => {
    return filterByDateRange(
      disasters.map((d) => ({
        ...d,
        date: d.createdAt.split("T")[0],
        category: "DISASTER" as const,
      })),
      datePreset,
      customRange,
    );
  }, [disasters, datePreset, customRange]);

  // Memoized stats
  const stats = useMemo(() => {
    const total = filteredDisasters.length;
    const totalDamage = filteredDisasters.reduce(
      (sum, d) => sum + Number(d.damagePercentage || 0),
      0,
    );
    const totalLoss = filteredDisasters.reduce(
      (sum, d) => sum + Number(d.estimatedLoss || 0),
      0,
    );
    const byStatus = filteredDisasters.reduce(
      (acc, d) => {
        acc[d.status] = (acc[d.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    return { total, totalDamage, totalLoss, byStatus };
  }, [filteredDisasters]);

  const handleExport = () => {
    if (filteredDisasters.length === 0) {
      toast.info("Walang data", {
        description: "Walang mga ulat kalamidad para i-export",
      });
      return;
    }
    exportDisastersToCSV(
      filteredDisasters.map((d) => ({
        id: d.id,
        disasterType: d.disasterType,
        damagePercentage: d.damagePercentage,
        estimatedLoss: d.estimatedLoss,
        status: d.status,
        notes: d.notes,
        createdAt: d.createdAt,
        farmName: d.farm?.name,
        barangay: d.farm?.barangay,
        municipality: d.farm?.municipality,
      })),
    );
    toast.success("Na-export na!", {
      description: `${filteredDisasters.length} ulat kalamidad nai-save bilang CSV`,
    });
  };

  const openDetail = (disaster: DisasterReport) => {
    setSelectedDisaster(disaster);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedDisaster(null);
  };

  const getStatusConfig = (status: CaseStatus) => {
    switch (status) {
      case "SUBMITTED":
        return {
          label: "Naipadala",
          color: "text-blue-700",
          bg: "bg-blue-100",
          step: 0,
        };
      case "UNDER_REVIEW":
        return {
          label: "Sinusuri",
          color: "text-amber-700",
          bg: "bg-amber-100",
          step: 1,
        };
      case "INSPECTED":
        return {
          label: "Na-inspect",
          color: "text-cyan-700",
          bg: "bg-cyan-100",
          step: 2,
        };
      case "RESOLVED":
        return {
          label: "Naresolba",
          color: "text-emerald-700",
          bg: "bg-emerald-100",
          step: 3,
        };
      case "REJECTED":
        return {
          label: "Tinanggihan",
          color: "text-rose-700",
          bg: "bg-rose-100",
          step: 4,
        };
      default:
        return {
          label: status,
          color: "text-slate-700",
          bg: "bg-slate-100",
          step: 0,
        };
    }
  };

  const mapToHistoryStatus = (
    status: CaseStatus,
  ): "Synced" | "Pending" | "Under Review" | "Resolved" | "Rejected" => {
    switch (status) {
      case "SUBMITTED":
        return "Pending";
      case "UNDER_REVIEW":
        return "Under Review";
      case "INSPECTED":
        return "Under Review";
      case "RESOLVED":
        return "Resolved";
      case "REJECTED":
        return "Rejected";
      default:
        return "Pending";
    }
  };

  const STATUS_TIMELINE = [
    { key: "submitted", label: "Naipadala", step: 0 },
    { key: "review", label: "Sinusuri", step: 1 },
    { key: "inspected", label: "Na-inspect", step: 2 },
    { key: "resolved", label: "Naresolba", step: 3 },
  ] as const;

  const formatCurrency = (amount: string | number | null | undefined) => {
    if (!amount) return "₱0";
    return `₱${Number(amount).toLocaleString("en-PH")}`;
  };

  const locationLabel = selectedFarm
    ? `${selectedFarm.name} • ${selectedFarm.barangay}, ${selectedFarm.municipality}`
    : "Pumili ng sakahan";

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
                Mga Ulat ng Kalamidad
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
              disabled={filteredDisasters.length === 0 || loading}
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
          {/* Farm Context */}
          <div className="rounded-2xl border border-rose-200/80 bg-rose-50/50 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white shrink-0">
              <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-sm text-rose-900 leading-tight">
                Mga Ulat Kalamidad para sa{" "}
                <strong>{selectedFarm?.name || "Sakahan"}</strong>
              </p>
              <p className="text-xs text-rose-700/90 mt-0.5 leading-snug">
                {selectedFarm
                  ? `${selectedFarm.barangay}, ${selectedFarm.municipality}, Cagayan`
                  : "Walang napiling sakahan"}
              </p>
            </div>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-white rounded-2xl p-3 border border-slate-200/80 text-center">
              <p className="text-2xl font-black text-rose-700">{stats.total}</p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                Kabuuan ng Ulat
              </p>
            </div>
            <div className="bg-white rounded-2xl p-3 border border-slate-200/80 text-center">
              <p className="text-2xl font-black text-amber-700">
                {stats.totalDamage.toFixed(1)}%
              </p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                Average Pinsala
              </p>
            </div>
            <div className="bg-white rounded-2xl p-3 border border-slate-200/80 text-center">
              <p className="text-2xl font-black text-red-700">
                {formatCurrency(stats.totalLoss)}
              </p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                Kabuuan Loss
              </p>
            </div>
            <div className="bg-white rounded-2xl p-3 border border-slate-200/80 text-center">
              <p className="text-2xl font-black text-emerald-700">
                {stats.byStatus.RESOLVED || 0}
              </p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                Naresolba
              </p>
            </div>
          </div>

          {/* Status Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {(
              [
                "RESOLVED",
                "INSPECTED",
                "UNDER_REVIEW",
                "SUBMITTED",
                "REJECTED",
              ] as const
            ).map((status) => {
              const count = stats.byStatus[status] || 0;
              const config = getStatusConfig(status);
              return (
                <span
                  key={status}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap flex items-center gap-1 ${config.bg} ${config.color}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />{" "}
                  {config.label} ({count})
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
              LISTAHAN NG ULAT KALAMIDAD ({filteredDisasters.length})
            </h3>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-rose-600" />
              <span>Kinukuha ang mga ulat kalamidad...</span>
            </div>
          ) : error ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-slate-200/80 space-y-2">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
              <p className="text-xs font-bold text-slate-600">
                Hindi nakakuha ng datos
              </p>
              <p className="text-[11px] text-slate-400">{error}</p>
              <button
                onClick={loadDisasters}
                className="mt-2 px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700"
              >
                Subukan Muli
              </button>
            </div>
          ) : filteredDisasters.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-slate-200/80 space-y-1">
              <TrendingDown className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">
                Walang mga ulat kalamidad na naitala
              </p>
              <p className="text-[11px] text-slate-400">
                Gumamit ng <strong>Ulat ng Baha/Bagyo</strong> sa dashboard para
                mag-report
              </p>
            </div>
          ) : (
            <div className="space-y-3 pb-6">
              {filteredDisasters.map((disaster) => {
                const statusConfig = getStatusConfig(disaster.status);
                const historyStatus = mapToHistoryStatus(disaster.status);
                return (
                  <HistoryCard
                    key={disaster.id}
                    id={`dis-${disaster.id}`}
                    title={`${disaster.disasterType} — ${disaster.damagePercentage}% Pinsala`}
                    category="DISASTER"
                    date={disaster.createdAt.split("T")[0]}
                    description={disaster.notes || "Walang dagdag na tala"}
                    detailHighlight={`${disaster.damagePercentage}% Pinsala • ${formatCurrency(disaster.estimatedLoss)} Loss`}
                    status={historyStatus}
                    onClick={() => openDetail(disaster)}
                    expanded={selectedDisaster?.id === disaster.id}
                    onExpand={() => openDetail(disaster)}
                  >
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div className="grid grid-cols-2 gap-3">
                        <div
                          className={`bg-slate-50 rounded-xl p-3 border ${statusConfig.bg}/50`}
                        >
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                            Status
                          </p>
                          <p className="text-sm font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />{" "}
                            <span className={statusConfig.color}>
                              {statusConfig.label}
                            </span>
                          </p>
                        </div>
                        <div className="bg-rose-50 rounded-xl p-3 border border-rose-200/50">
                          <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wide">
                            Pinsala
                          </p>
                          <p className="text-sm font-bold text-rose-800">
                            {disaster.damagePercentage}%
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/50">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                            Tinatayang Loss
                          </p>
                          <p className="text-sm font-bold text-red-700">
                            {formatCurrency(disaster.estimatedLoss)}
                          </p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/50">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                            Uri ng Kalamidad
                          </p>
                          <p className="text-sm font-bold text-slate-800">
                            {disaster.disasterType}
                          </p>
                        </div>
                      </div>
                      {disaster.notes && (
                        <div className="bg-slate-50 rounded-xl p-3">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                            Mga Tala
                          </p>
                          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                            {disaster.notes}
                          </p>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{" "}
                          {disaster.farm?.barangay},{" "}
                          {disaster.farm?.municipality}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />{" "}
                          {new Date(disaster.createdAt).toLocaleDateString(
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
        <BottomNav active="history" />
      </div>

      {/* Detail Modal */}
      <HistoryDetailModal
        isOpen={modalOpen}
        onClose={closeModal}
        title={
          selectedDisaster
            ? `${selectedDisaster.disasterType} — Ulat Kalamidad`
            : ""
        }
        subtitle={
          selectedDisaster
            ? `${selectedDisaster.damagePercentage}% Pinsala • ${formatCurrency(selectedDisaster.estimatedLoss)} Loss`
            : ""
        }
        category="disaster"
        status={
          selectedDisaster
            ? mapToHistoryStatus(selectedDisaster.status)
            : "Pending"
        }
        tabs={[
          {
            id: "details",
            label: "Detalye",
            icon: <FileText className="w-3.5 h-3.5" />,
            content: selectedDisaster ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className={`bg-slate-50 rounded-xl p-3 border ${getStatusConfig(selectedDisaster.status).bg}/50`}
                  >
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Status
                    </p>
                    <p className="text-sm font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />{" "}
                      <span
                        className={
                          getStatusConfig(selectedDisaster.status).color
                        }
                      >
                        {getStatusConfig(selectedDisaster.status).label}
                      </span>
                    </p>
                  </div>
                  <div className="bg-rose-50 rounded-xl p-3 border border-rose-200/50">
                    <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wide">
                      Pinsala
                    </p>
                    <p className="text-sm font-bold text-rose-800">
                      {selectedDisaster.damagePercentage}%
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/50">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Tinatayang Loss
                    </p>
                    <p className="text-sm font-bold text-red-700">
                      {formatCurrency(selectedDisaster.estimatedLoss)}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/50">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Uri ng Kalamidad
                    </p>
                    <p className="text-sm font-bold text-slate-800">
                      {selectedDisaster.disasterType}
                    </p>
                  </div>
                </div>
                {selectedDisaster.notes && (
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Mga Tala
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                      {selectedDisaster.notes}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />{" "}
                    {selectedDisaster.farm?.barangay},{" "}
                    {selectedDisaster.farm?.municipality}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />{" "}
                    {new Date(selectedDisaster.createdAt).toLocaleDateString(
                      "fil-PH",
                      { month: "long", day: "numeric", year: "numeric" },
                    )}
                  </span>
                </div>
              </div>
            ) : null,
          },
          {
            id: "timeline",
            label: "Timeline",
            icon: <Clock className="w-3.5 h-3.5" />,
            content: selectedDisaster ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  {STATUS_TIMELINE.map((step, idx) => {
                    const reached =
                      getStatusConfig(selectedDisaster.status).step >= idx;
                    return (
                      <React.Fragment key={step.key}>
                        <div className="flex flex-col items-center gap-1 flex-1">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${reached ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-400"}`}
                          >
                            {idx + 1}
                          </div>
                          <span
                            className={`text-[9px] font-bold text-center ${reached ? "text-emerald-700" : "text-slate-400"}`}
                          >
                            {step.label}
                          </span>
                        </div>
                        {idx < STATUS_TIMELINE.length - 1 && (
                          <div
                            className={`h-0.5 flex-1 -mt-4 ${getStatusConfig(selectedDisaster.status).step > idx ? "bg-emerald-600" : "bg-slate-200"}`}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    Current Status:{" "}
                    <span
                      className={getStatusConfig(selectedDisaster.status).color}
                    >
                      {getStatusConfig(selectedDisaster.status).label}
                    </span>
                  </p>
                  {selectedDisaster.verifiedBy && (
                    <p className="text-sm text-slate-700">
                      Sinuri ni: {selectedDisaster.verifiedBy.firstName}{" "}
                      {selectedDisaster.verifiedBy.lastName}
                    </p>
                  )}
                </div>
              </div>
            ) : null,
          },
        ]}
      />
    </div>
  );
};

export default FarmerDisastersHistoryPage;
