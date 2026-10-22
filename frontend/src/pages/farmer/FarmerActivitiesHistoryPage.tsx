/**
 * FarmerActivitiesHistoryPage — Activities history per farm/crop cycle
 * Features: Date filter, CSV export, detail view with cost breakdown
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronLeft,
  Calendar,
  Download,
  Loader2,
  Send,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { BottomNav } from "../../components/BottomNav";
import {
  listActivities,
  type CropActivity,
} from "../../services/activity.service";
import { useFarmSelection } from "../../context/farmSelectionContext";
import { HistoryCard } from "../../components/HistoryCard";
import { HistoryDetailModal } from "../../components/HistoryDetailModal";
import {
  DateRangeFilter,
  filterByDateRange,
  type DateRangePreset,
} from "../../components/DateRangeFilter";
import {
  exportActivitiesToCSV,
  type ActivityForExport,
} from "../../utils/csvExport";

export const FarmerActivitiesHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedFarm, selectedCycle } = useFarmSelection();
  const cropCycleId = selectedCycle?.id;

  const [activities, setActivities] = useState<CropActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DateRangePreset>("all");
  const [customRange, setCustomRange] = useState<{
    from: Date;
    to: Date;
  } | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<CropActivity | null>(
    null,
  );
  const [modalOpen, setModalOpen] = useState(false);

  const loadActivities = useCallback(async () => {
    if (!cropCycleId) {
      setActivities([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await listActivities(cropCycleId);
      setActivities(data);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Hindi nakakuha ng mga gawain";
      setError(msg);
      toast.error("Error", { description: msg });
    } finally {
      setLoading(false);
    }
  }, [cropCycleId]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // Memoized filtered activities
  const filteredActivities = useMemo(() => {
    return filterByDateRange(
      activities.map((a) => ({
        ...a,
        date: a.performedAt.split("T")[0],
        category: a.activityType as
          | "FERTILIZER"
          | "PEST_CONTROL"
          | "IRRIGATION"
          | "OTHER",
      })),
      datePreset,
      customRange,
      selectedCycle?.plantingDate,
    );
  }, [activities, datePreset, customRange, selectedCycle?.plantingDate]);

  // Memoized stats
  const stats = useMemo(() => {
    const total = filteredActivities.length;
    const totalCost = filteredActivities.reduce(
      (sum, a) => sum + Number(a.costAmount || 0),
      0,
    );
    const byType = filteredActivities.reduce(
      (acc, a) => {
        acc[a.activityType] = (acc[a.activityType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    return { total, totalCost, byType };
  }, [filteredActivities]);

  const handleExport = () => {
    if (filteredActivities.length === 0) {
      toast.info("Walang data", {
        description: "Walang mga gawain para i-export",
      });
      return;
    }
    const exportData: ActivityForExport[] = filteredActivities.map((a) => ({
      id: a.id,
      activityType: a.activityType,
      description: a.description,
      costAmount: a.costAmount ?? null,
      performedAt: a.performedAt,
      createdAt: a.createdAt,
      cropCycleId: a.cropCycleId,
      farmName: selectedFarm?.name,
      variety: selectedCycle?.variety,
    }));
    exportActivitiesToCSV(exportData);
    toast.success("Na-export na!", {
      description: `${filteredActivities.length} gawain nai-save bilang CSV`,
    });
  };

  const openDetail = (activity: CropActivity) => {
    setSelectedActivity(activity);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedActivity(null);
  };

  const formatCurrency = (amount: string | number | null | undefined) => {
    if (!amount) return "₱0";
    return `₱${Number(amount).toLocaleString("en-PH")}`;
  };

  const getTypeConfig = (type: string) => {
    switch (type) {
      case "FERTILIZER":
        return {
          label: "Pataba",
          icon: <Send className="w-4 h-4" />,
          color: "text-blue-600",
          bg: "bg-blue-100",
        };
      case "PEST_CONTROL":
        return {
          label: "Peste Control",
          icon: <AlertTriangle className="w-4 h-4" />,
          color: "text-red-600",
          bg: "bg-red-100",
        };
      case "IRRIGATION":
        return {
          label: "Patubig",
          icon: <Loader2 className="w-4 h-4" />,
          color: "text-cyan-600",
          bg: "bg-cyan-100",
        };
      default:
        return {
          label: type,
          icon: <Loader2 className="w-4 h-4" />,
          color: "text-slate-600",
          bg: "bg-slate-100",
        };
    }
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
                Mga Gawain sa Sakahan
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
              disabled={filteredActivities.length === 0 || loading}
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
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0">
              <Send className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-sm text-emerald-900 leading-tight">
                Mga Gawain para sa{" "}
                <strong>
                  {selectedCycle?.variety || selectedCycle?.cropType || "Mais"}
                </strong>
              </p>
              <p className="text-xs text-emerald-700/90 mt-0.5 leading-snug">
                {selectedCycle
                  ? `Itinarak: ${new Date(selectedCycle.plantingDate).toLocaleDateString("fil-PH", { month: "long", day: "numeric", year: "numeric" })} • DAP: ${Math.floor((Date.now() - new Date(selectedCycle.plantingDate).getTime()) / (1000 * 60 * 60 * 24))}`
                  : "Walang napiling pananim"}
              </p>
            </div>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-white rounded-2xl p-3 border border-slate-200/80 text-center">
              <p className="text-2xl font-black text-emerald-700">
                {stats.total}
              </p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                Kabuuan ng Gawain
              </p>
            </div>
            <div className="bg-white rounded-2xl p-3 border border-slate-200/80 text-center">
              <p className="text-2xl font-black text-blue-700">
                {formatCurrency(stats.totalCost)}
              </p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                Total na Gastos
              </p>
            </div>
            <div className="bg-white rounded-2xl p-3 border border-slate-200/80 text-center">
              <p className="text-2xl font-black text-amber-700">
                {Object.keys(stats.byType).length}
              </p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                Uri ng Gawain
              </p>
            </div>
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

          {/* Activity Type Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {["FERTILIZER", "PEST_CONTROL", "IRRIGATION"].map((type) => {
              const count = stats.byType[type] || 0;
              const config = getTypeConfig(type);
              return (
                <span
                  key={type}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap flex items-center gap-1 ${config.bg} ${config.color}`}
                >
                  {config.icon} {config.label} ({count})
                </span>
              );
            })}
          </div>

          {/* List */}
          <div className="pt-2">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
              LISTAHAN NG GAWAIN ({filteredActivities.length})
            </h3>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              <span>Kinukuha ang mga gawain...</span>
            </div>
          ) : error ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-slate-200/80 space-y-2">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
              <p className="text-xs font-bold text-slate-600">
                Hindi nakakuha ng datos
              </p>
              <p className="text-[11px] text-slate-400">{error}</p>
              <button
                onClick={loadActivities}
                className="mt-2 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700"
              >
                Subukan Muli
              </button>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-slate-200/80 space-y-1">
              <Loader2 className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">
                Walang mga gawain na naitala
              </p>
              <p className="text-[11px] text-slate-400">
                Magsimula sa pag-record ng pataba, patubig, o peste control
              </p>
            </div>
          ) : (
            <div className="space-y-3 pb-6">
              {filteredActivities.map((activity) => {
                const typeConfig = getTypeConfig(activity.activityType);
                return (
                  <HistoryCard
                    key={activity.id}
                    id={`act-${activity.id}`}
                    title={`${typeConfig.label} — ${activity.description.slice(0, 40)}${activity.description.length > 40 ? "..." : ""}`}
                    category={
                      activity.activityType as
                        | "FERTILIZER"
                        | "PEST_CONTROL"
                        | "IRRIGATION"
                        | "OTHER"
                    }
                    date={activity.performedAt.split("T")[0]}
                    description={activity.description}
                    detailHighlight={formatCurrency(activity.costAmount)}
                    status="Synced"
                    onClick={() => openDetail(activity)}
                    expanded={selectedActivity?.id === activity.id}
                    onExpand={() => openDetail(activity)}
                  >
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 rounded-xl p-3">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                            Uri ng Gawain
                          </p>
                          <p className="text-sm font-bold text-slate-900 flex items-center gap-1">
                            {typeConfig.icon} {typeConfig.label}
                          </p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                            Gastos
                          </p>
                          <p className="text-sm font-bold text-emerald-700">
                            {formatCurrency(activity.costAmount)}
                          </p>
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                          Buong Paglalarawan
                        </p>
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                          {activity.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Nai-record:{" "}
                          {new Date(activity.createdAt).toLocaleDateString(
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
          selectedActivity
            ? `${getTypeConfig(selectedActivity.activityType).label} — Gawain`
            : ""
        }
        subtitle={
          selectedActivity
            ? `DAP ${Math.floor((Date.now() - new Date(selectedCycle?.plantingDate || "").getTime()) / (1000 * 60 * 60 * 24))} • ${new Date(selectedActivity.performedAt).toLocaleDateString("fil-PH", { month: "long", day: "numeric", year: "numeric" })}`
            : ""
        }
        category="activity"
        status="Synced"
        tabs={[
          {
            id: "details",
            label: "Detalye",
            icon: <FileText className="w-3.5 h-3.5" />,
            content: selectedActivity ? (
              <div className="space-y-3">
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Buong Paglalarawan
                  </p>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {selectedActivity.description}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200/50">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                      Gastos
                    </p>
                    <p className="text-xl font-black text-emerald-800">
                      {formatCurrency(selectedActivity.costAmount)}
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 border border-blue-200/50">
                    <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">
                      Uri
                    </p>
                    <p className="text-sm font-bold text-blue-800 flex items-center gap-1">
                      {(() => {
                        const tc = getTypeConfig(
                          selectedActivity!.activityType,
                        );
                        return (
                          <>
                            {tc.icon} {tc.label}
                          </>
                        );
                      })()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Petsa ng Gawain:{" "}
                    {new Date(selectedActivity.performedAt).toLocaleDateString(
                      "fil-PH",
                      { month: "long", day: "numeric", year: "numeric" },
                    )}
                  </span>
                </div>
              </div>
            ) : null,
          },
        ]}
      />
    </div>
  );
};

export default FarmerActivitiesHistoryPage;
