import { useFarmSelection } from "../context/farmSelectionContext";

export interface FarmContextData {
  farmId: string;
  farmName: string;
  municipality: string;
  barangay: string;
  areaHectares: number;
  cropCycleId: string;
  variety: string;
  plantingDate: string;
  loading: boolean;
  /** true when resolved from the API (even if no active cycle exists) */
  resolved: boolean;
}

/**
 * Backwards-compatible adapter over the shared FarmSelection context.
 *
 * Existing farmer pages import this hook and read a flat `FarmContextData`
 * shape. The authoritative state now lives in `FarmSelectionProvider`; this
 * hook projects the current selection into the legacy shape so those pages
 * keep working and automatically reflect selector changes.
 *
 * New code that needs the farms/cycles lists or setters should use
 * `useFarmSelection()` directly.
 */
export function useFarmContext(): FarmContextData {
  const { selectedFarm, selectedCycle, loading, resolved } = useFarmSelection();

  return {
    farmId: selectedFarm?.id ?? "",
    farmName: selectedFarm?.name ?? "",
    municipality: selectedFarm?.municipality ?? "",
    barangay: selectedFarm?.barangay ?? "",
    areaHectares: selectedFarm ? Number(selectedFarm.areaHectares) : 0,
    cropCycleId: selectedCycle?.id ?? "",
    variety: selectedCycle?.variety || selectedCycle?.cropType || "",
    plantingDate: selectedCycle?.plantingDate ?? "",
    loading,
    resolved,
  };
}

/**
 * Clears the cached farm selection. Called on logout.
 *
 * NOTE: logout happens outside the FarmSelectionProvider (in AuthProvider), so
 * this removes the persisted key directly. The provider's own `clear()` also
 * resets in-memory state while the farmer area is mounted.
 */
export function clearFarmContext(): void {
  localStorage.removeItem("tarabay_active_farm");
}
