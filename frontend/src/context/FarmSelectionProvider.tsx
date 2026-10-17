import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  listFarms,
  listCropCycles,
  type Farm,
  type CropCycle,
} from "../services/farm.service";
import {
  FarmSelectionContext,
  FARM_SELECTION_KEY,
  type FarmSelectionValue,
  type PersistedSelection,
} from "./farmSelectionContext";

/** Reads the persisted selection, tolerating a missing/corrupt value. */
const readPersisted = (): PersistedSelection | null => {
  try {
    const raw = localStorage.getItem(FARM_SELECTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSelection;
    return parsed.farmId ? parsed : null;
  } catch {
    return null;
  }
};

const persist = (farm: Farm, cycle: CropCycle | null): void => {
  const value: PersistedSelection = {
    farmId: farm.id,
    cropCycleId: cycle?.id ?? "",
    farmName: farm.name,
    municipality: farm.municipality,
    barangay: farm.barangay,
    areaHectares: Number(farm.areaHectares),
    variety: cycle?.variety || cycle?.cropType || "Mais",
    plantingDate: cycle?.plantingDate ?? "",
  };
  localStorage.setItem(FARM_SELECTION_KEY, JSON.stringify(value));
};

/** Prefers the most recently planted ACTIVE cycle, else the newest of any status. */
const pickDefaultCycle = (cycles: CropCycle[]): CropCycle | null => {
  if (cycles.length === 0) return null;
  const plantedTime = (c: CropCycle) => {
    const t = new Date(c.plantingDate).getTime();
    return Number.isNaN(t) ? 0 : t;
  };
  const sorted = [...cycles].sort((a, b) => plantedTime(b) - plantedTime(a));
  return sorted.find((c) => c.status === "ACTIVE") ?? sorted[0];
};

export const FarmSelectionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [cycles, setCycles] = useState<CropCycle[]>([]);
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<CropCycle | null>(null);

  const [loading, setLoading] = useState(true);
  const [cyclesLoading, setCyclesLoading] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [error, setError] = useState(false);

  // Guards against stale async writes when the farm changes quickly.
  const cycleReqId = useRef(0);

  /**
   * Loads the crop cycles for a farm and selects one. When `preferredCycleId`
   * is given (restoring a persisted selection) it wins; otherwise the default
   * ACTIVE/newest cycle is chosen.
   */
  const loadCyclesFor = useCallback(
    async (farm: Farm, preferredCycleId?: string) => {
      const reqId = ++cycleReqId.current;
      setCyclesLoading(true);
      try {
        // Reuse cycles embedded in the farm payload when present.
        const list =
          farm.cropCycles && farm.cropCycles.length > 0
            ? farm.cropCycles
            : await listCropCycles(farm.id);
        if (reqId !== cycleReqId.current) return; // superseded

        setCycles(list);
        const chosen =
          (preferredCycleId && list.find((c) => c.id === preferredCycleId)) ||
          pickDefaultCycle(list);
        setSelectedCycle(chosen);
        persist(farm, chosen);
      } catch {
        if (reqId !== cycleReqId.current) return;
        setCycles([]);
        setSelectedCycle(null);
      } finally {
        if (reqId === cycleReqId.current) setCyclesLoading(false);
      }
    },
    [],
  );

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError(false);
    const persisted = readPersisted();
    try {
      const all = await listFarms();
      setFarms(all);

      if (all.length === 0) {
        setSelectedFarm(null);
        setSelectedCycle(null);
        setCycles([]);
        return;
      }

      const farm =
        (persisted && all.find((f) => f.id === persisted.farmId)) || all[0];
      setSelectedFarm(farm);
      await loadCyclesFor(farm, persisted?.cropCycleId);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setResolved(true);
    }
  }, [loadCyclesFor]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const selectFarm = useCallback(
    (farmId: string) => {
      const farm = farms.find((f) => f.id === farmId);
      if (!farm || farm.id === selectedFarm?.id) return;
      setSelectedFarm(farm);
      setSelectedCycle(null);
      void loadCyclesFor(farm);
    },
    [farms, selectedFarm, loadCyclesFor],
  );

  const selectCycle = useCallback(
    (cropCycleId: string) => {
      const cycle = cycles.find((c) => c.id === cropCycleId) ?? null;
      setSelectedCycle(cycle);
      if (selectedFarm) persist(selectedFarm, cycle);
    },
    [cycles, selectedFarm],
  );

  const clear = useCallback(() => {
    localStorage.removeItem(FARM_SELECTION_KEY);
    setFarms([]);
    setCycles([]);
    setSelectedFarm(null);
    setSelectedCycle(null);
  }, []);

  const value: FarmSelectionValue = {
    farms,
    cycles,
    selectedFarm,
    selectedCycle,
    loading,
    cyclesLoading,
    resolved,
    error,
    selectFarm,
    selectCycle,
    refresh: bootstrap,
    clear,
  };

  return (
    <FarmSelectionContext.Provider value={value}>
      {children}
    </FarmSelectionContext.Provider>
  );
};
