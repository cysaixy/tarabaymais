/**
 * GlobalFilterProvider — global filter state for the Officer Portal dashboard.
 *
 * State: barangay, date range (7d / 30d / this season / custom with from/to).
 * Synced to URL query params so a refresh or shared link keeps the view.
 *
 * Shape:
 *   { barangay, range: "7d" | "30d" | "season" | "custom", from?, to? }
 *
 * Derived `from`/`to` ISO dates are computed from the range and exposed for
 * API consumption.
 */

import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FilterContext,
  type FilterContextType,
  type FilterState,
} from "./filterContextValue";

const DEFAULT_BARANGAY = "";
const DEFAULT_RANGE: "7d" | "30d" | "season" | "custom" = "30d";

const toISO = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const daysAgo = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() - n);
  return r;
};

export const GlobalFilterProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Initialize from URL ────────────────────────────────────────────
  const [state, setState] = useState<FilterState>(() => {
    const barangay = searchParams.get("barangay") ?? DEFAULT_BARANGAY;
    const range =
      (searchParams.get("range") as FilterState["range"]) ?? DEFAULT_RANGE;
    const from = searchParams.get("from") ?? null;
    const to = searchParams.get("to") ?? null;
    return { barangay, range, from, to };
  });

  // ── Sync state to URL on change ────────────────────────────────────
  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    if (state.barangay) next.set("barangay", state.barangay);
    else next.delete("barangay");
    next.set("range", state.range);
    if (state.from) next.set("from", state.from);
    else next.delete("from");
    if (state.to) next.set("to", state.to);
    else next.delete("to");
    setSearchParams(next, { replace: true });
  }, [state, searchParams, setSearchParams]);

  // ── Derived API dates ──────────────────────────────────────────────
  const { apiFrom, apiTo } = (() => {
    const now = new Date();
    const end = state.to ? new Date(state.to) : now;
    let start: Date;
    switch (state.range) {
      case "7d":
        start = daysAgo(end, 7);
        break;
      case "30d":
        start = daysAgo(end, 30);
        break;
      case "season":
        start = daysAgo(end, 90);
        break;
      case "custom":
        start = state.from ? new Date(state.from) : daysAgo(end, 30);
        break;
    }
    return {
      apiFrom: state.range === "custom" && state.from ? state.from : toISO(start),
      apiTo: state.range === "custom" && state.to ? state.to : toISO(end),
    };
  })();

  // ── Actions ────────────────────────────────────────────────────────
  const setBarangay = useCallback((v: string) => {
    setState((prev) => ({ ...prev, barangay: v }));
  }, []);

  const setRange = useCallback((v: FilterContextType["range"]) => {
    setState((prev) => ({ ...prev, range: v, from: null, to: null }));
  }, []);

  const setCustomRange = useCallback((from: string, to: string) => {
    setState((prev) => ({ ...prev, range: "custom", from, to }));
  }, []);

  const value: FilterContextType = {
    ...state,
    setBarangay,
    setRange,
    setCustomRange,
    apiFrom,
    apiTo,
  };

  return (
    <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
  );
};
