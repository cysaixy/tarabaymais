import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Tractor,
  Sprout,
  Loader2,
  ChevronDown,
  MapPin,
  Leaf,
} from "lucide-react";
import { useFarmSelection } from "../context/farmSelectionContext";
import { EmptyState } from "./EmptyState";
import type { CropCycle } from "../services/farm.service";

const STATUS_LABEL: Record<CropCycle["status"], string> = {
  ACTIVE: "Aktibo",
  HARVESTED: "Naani",
  FAILED: "Nabigo",
  CANCELLED: "Kinansela",
};

const STATUS_COLOR: Record<CropCycle["status"], string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  HARVESTED: "bg-amber-100 text-amber-800 border-amber-200",
  FAILED: "bg-red-100 text-red-700 border-red-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
};

const formatPlantDate = (date: string): string =>
  new Date(date).toLocaleDateString("fil-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

interface FarmCycleSelectorProps {
  /** When true, only the farm dropdown is shown (e.g. disaster report). */
  farmOnly?: boolean;
  /** Optional heading above the selector. */
  label?: string;
  className?: string;
}

/**
 * Shared farm + crop-cycle picker backed by the app-wide FarmSelection context.
 * Large, phone-friendly card-style selectors with 56px+ tap targets.
 */
export const FarmCycleSelector: React.FC<FarmCycleSelectorProps> = ({
  farmOnly = false,
  label,
  className = "",
}) => {
  const navigate = useNavigate();
  const {
    farms,
    cycles,
    selectedFarm,
    selectedCycle,
    loading,
    cyclesLoading,
    resolved,
    selectFarm,
    selectCycle,
  } = useFarmSelection();

  if (loading && !resolved) {
    return (
      <div className="flex items-center gap-3 rounded-3xl border-2 border-slate-100 bg-white px-5 py-5 text-sm font-semibold text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
        <span>Kinukuha ang mga sakahan...</span>
      </div>
    );
  }

  if (farms.length === 0) {
    return (
      <EmptyState
        icon={<Tractor className="h-12 w-12" />}
        title="Wala pang sakahan"
        message="Magdagdag muna ng sakahan para makapagtala."
        action={
          <button
            type="button"
            onClick={() => navigate("/farmer/farms/new")}
            className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-emerald-600 px-6 text-base font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            Magdagdag ng Sakahan
          </button>
        }
      />
    );
  }

  const needsCycle = !farmOnly && !cyclesLoading && cycles.length === 0;

  return (
    <div
      className={`rounded-3xl border-2 border-emerald-100 bg-white p-4 sm:p-5 space-y-4 shadow-sm ${className}`}
    >
      {/* ── Section heading ── */}
      {label && (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Leaf className="h-3.5 w-3.5 text-emerald-700" />
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-emerald-800">
            {label}
          </p>
        </div>
      )}

      {/* ── Farm Picker ── */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500">
          <Tractor className="h-3.5 w-3.5 text-emerald-600" />
          Sakahan
        </label>

        {/* Visual display card (non-interactive) */}
        {selectedFarm && (
          <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-200 px-4 py-3 pointer-events-none select-none">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-black text-base text-slate-900 leading-tight truncate">
                  {selectedFarm.name}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                  <p className="text-xs text-slate-500 font-medium truncate">
                    {selectedFarm.barangay}, {selectedFarm.municipality}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-[11px] font-black text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-full whitespace-nowrap">
                🌱 {Number(selectedFarm.areaHectares).toFixed(1)} ha
              </span>
            </div>
          </div>
        )}

        {/* Native select — absolutely positioned over the visual card for tap/click */}
        <div className="relative">
          <select
            className="w-full min-h-14 rounded-2xl border-2 border-emerald-300 bg-white pl-4 pr-10 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 appearance-none cursor-pointer shadow-sm"
            value={selectedFarm?.id ?? ""}
            onChange={(e) => selectFarm(e.target.value)}
            aria-label="Piliin ang sakahan"
          >
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} — {f.barangay}, {f.municipality}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-600 stroke-[2.5]" />
        </div>
      </div>

      {/* ── Crop Cycle Picker ── */}
      {!farmOnly && (
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500">
            <Sprout className="h-3.5 w-3.5 text-emerald-600" />
            Pananim (Crop Cycle)
          </label>

          {cyclesLoading ? (
            <div className="flex items-center gap-3 rounded-2xl border-2 border-slate-100 bg-white px-4 py-4 text-sm font-semibold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              Kinukuha ang mga pananim...
            </div>
          ) : needsCycle ? (
            <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 px-4 py-4 text-sm font-semibold text-amber-800 flex items-start gap-2">
              <span className="text-lg leading-none">🌱</span>
              <div>
                <p className="font-bold text-amber-900">Wala pang pananim</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Magdagdag ng crop cycle sa detalye ng sakahan.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Visual display card */}
              {selectedCycle && (
                <div className="rounded-2xl bg-slate-50 border-2 border-slate-200 px-4 py-3 pointer-events-none select-none">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-base text-slate-900 leading-tight">
                        🌽{" "}
                        {selectedCycle.variety ||
                          selectedCycle.cropType ||
                          "Mais"}
                      </p>
                      {selectedCycle.plantingDate && (
                        <p className="text-xs text-slate-500 font-medium mt-1">
                          Itinarak:{" "}
                          {formatPlantDate(selectedCycle.plantingDate)}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 text-[11px] font-black px-2.5 py-1 rounded-full border ${STATUS_COLOR[selectedCycle.status]}`}
                    >
                      {STATUS_LABEL[selectedCycle.status]}
                    </span>
                  </div>
                </div>
              )}

              {/* Native select */}
              <div className="relative">
                <select
                  className="w-full min-h-14 rounded-2xl border-2 border-slate-300 bg-white pl-4 pr-10 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 appearance-none cursor-pointer shadow-sm"
                  value={selectedCycle?.id ?? ""}
                  onChange={(e) => selectCycle(e.target.value)}
                  aria-label="Piliin ang pananim"
                >
                  {cycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.variety || c.cropType || "Mais"} •{" "}
                      {STATUS_LABEL[c.status]}
                      {c.plantingDate
                        ? ` • ${formatPlantDate(c.plantingDate)}`
                        : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 stroke-[2.5]" />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default FarmCycleSelector;
