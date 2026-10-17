import React from "react";
import { useNavigate } from "react-router-dom";
import { Tractor, Sprout, Loader2 } from "lucide-react";
import { useFarmSelection } from "../context/farmSelectionContext";
import { EmptyState } from "./EmptyState";
import type { CropCycle } from "../services/farm.service";

const STATUS_LABEL: Record<CropCycle["status"], string> = {
  ACTIVE: "Aktibo",
  HARVESTED: "Naani",
  FAILED: "Nabigo",
  CANCELLED: "Kinansela",
};

const cycleLabel = (c: CropCycle): string => {
  const name = c.variety || c.cropType || "Mais";
  const planted = c.plantingDate
    ? new Date(c.plantingDate).toLocaleDateString("fil-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";
  return `${name} • ${STATUS_LABEL[c.status]}${planted ? ` • ${planted}` : ""}`;
};

const selectClass =
  "w-full min-h-[48px] rounded-2xl border-2 border-emerald-200 bg-white px-3.5 pr-9 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 appearance-none cursor-pointer disabled:opacity-60";

interface FarmCycleSelectorProps {
  /** When true, only the farm dropdown is shown (e.g. disaster report). */
  farmOnly?: boolean;
  /** Optional heading above the selector. */
  label?: string;
  className?: string;
}

/**
 * Shared farm + crop-cycle picker backed by the app-wide FarmSelection context.
 * Every page that needs a farmId/cropCycleId renders this so the selection is
 * consistent and persisted. Compact dropdown pair, emerald theme, 48px targets.
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
      <div className="flex items-center gap-2 rounded-2xl border-2 border-slate-100 bg-white px-4 py-4 text-sm font-semibold text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
        Kinukuha ang mga sakahan...
      </div>
    );
  }

  // No farm at all → empty state with an action to create one.
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
            className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-emerald-600 px-6 text-base font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 active:bg-emerald-800"
          >
            Magdagdag ng Sakahan
          </button>
        }
      />
    );
  }

  // Farm exists but no crop cycle (and we need one) → empty state.
  const needsCycle = !farmOnly && !cyclesLoading && cycles.length === 0;

  return (
    <div className={`rounded-3xl border-2 border-emerald-100 bg-emerald-50/40 p-4 space-y-3 ${className}`}>
      {label && (
        <p className="text-xs font-black uppercase tracking-wide text-emerald-800">
          {label}
        </p>
      )}

      {/* Farm dropdown */}
      <div>
        <label className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-700">
          <Tractor className="h-4 w-4 text-emerald-600" />
          Sakahan
        </label>
        <div className="relative">
          <select
            className={selectClass}
            value={selectedFarm?.id ?? ""}
            onChange={(e) => selectFarm(e.target.value)}
          >
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} — {f.barangay}, {f.municipality}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">▼</span>
        </div>
      </div>

      {/* Cycle dropdown (hidden in farmOnly mode) */}
      {!farmOnly && (
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Sprout className="h-4 w-4 text-emerald-600" />
            Pananim (Crop Cycle)
          </label>

          {cyclesLoading ? (
            <div className="flex items-center gap-2 rounded-2xl border-2 border-slate-100 bg-white px-3.5 py-3 text-sm font-semibold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              Kinukuha ang mga pananim...
            </div>
          ) : needsCycle ? (
            <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/60 px-3.5 py-3 text-sm font-semibold text-amber-800">
              Wala pang pananim sa sakahang ito. Magdagdag ng crop cycle sa
              detalye ng sakahan.
            </div>
          ) : (
            <div className="relative">
              <select
                className={selectClass}
                value={selectedCycle?.id ?? ""}
                onChange={(e) => selectCycle(e.target.value)}
              >
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {cycleLabel(c)}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">▼</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FarmCycleSelector;
