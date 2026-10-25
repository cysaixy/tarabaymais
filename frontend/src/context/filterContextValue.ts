import { createContext } from "react";

export interface FilterState {
  barangay: string;
  range: "7d" | "30d" | "season" | "custom";
  from: string | null;
  to: string | null;
}

export interface FilterContextType extends FilterState {
  setBarangay: (value: string) => void;
  setRange: (value: FilterState["range"]) => void;
  setCustomRange: (from: string, to: string) => void;
  /** Derived API from/to (Asia/Manila dates) */
  apiFrom: string | null;
  apiTo: string | null;
}

export const FilterContext = createContext<FilterContextType | undefined>(
  undefined,
);
