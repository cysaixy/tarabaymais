/**
 * BarangayTable — sortable barangay table for the Buod tab.
 * Columns: barangay, farms, ha, open cases, risk, disasters.
 * Clicking a row sets the global barangay filter.
 * Mini progress bar for risk score.
 */

import React, { useMemo, useState } from "react";
import { useFilter } from "../../context/useFilter";

interface BarangayRow {
  barangay: string;
  farms: number;
  hectares: number;
  openCases: number;
  riskScore: number;
  disasterCount: number;
}

interface BarangayTableProps {
  data: BarangayRow[];
}

type SortKey =
  | "barangay"
  | "farms"
  | "hectares"
  | "openCases"
  | "riskScore"
  | "disasterCount";

interface BarangayTableState {
  sortKey: SortKey;
  sortDir: "asc" | "desc";
}

export const BarangayTable: React.FC<BarangayTableProps> = ({ data }) => {
  const { setBarangay } = useFilter();
  const [sortState, setSortState] = useState<BarangayTableState>({
    sortKey: "riskScore",
    sortDir: "desc",
  });

  const rows = useMemo(() => {
    return [...data].sort((a, b) => {
      const direction = sortState.sortDir === "asc" ? 1 : -1;

      if (sortState.sortKey === "barangay") {
        return a.barangay.localeCompare(b.barangay) * direction;
      }

      const av = a[sortState.sortKey];
      const bv = b[sortState.sortKey];
      return (av - bv) * direction;
    });
  }, [data, sortState]);

  const fmtHa = (v: number) =>
    v.toLocaleString(undefined, { maximumFractionDigits: 2 });

  const handleSort = (key: SortKey) => {
    setSortState((prev) => {
      if (prev.sortKey === key) {
        return {
          sortKey: key,
          sortDir: prev.sortDir === "asc" ? "desc" : "asc",
        };
      }
      return { sortKey: key, sortDir: "asc" };
    });
  };

  const handleRowClick = (row: BarangayRow) => {
    setBarangay(row.barangay);
  };

  const riskColor = (score: number) => {
    if (score >= 60) return "#dc2626";
    if (score >= 30) return "#d97706";
    return "#059669";
  };

  return (
    <div className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm flex flex-col h-full">
      <h3 className="mb-4 text-lg font-bold text-slate-900">
        Buod Ayon sa Barangay
      </h3>
      <div className="flex-1 overflow-hidden flex flex-col">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th
                onClick={() => handleSort("barangay")}
                className="cursor-pointer py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider pr-4"
              >
                Barangay
              </th>
              <th
                onClick={() => handleSort("farms")}
                className="cursor-pointer py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right pr-4 tabular-nums"
              >
                Sakahan
              </th>
              <th
                onClick={() => handleSort("hectares")}
                className="cursor-pointer py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right pr-4 tabular-nums"
              >
                Ektarya
              </th>
              <th
                onClick={() => handleSort("openCases")}
                className="cursor-pointer py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right pr-4 tabular-nums"
              >
                Bukas na Kaso
              </th>
              <th
                onClick={() => handleSort("riskScore")}
                className="cursor-pointer py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right pr-4 tabular-nums"
              >
                Risk
              </th>
              <th
                onClick={() => handleSort("disasterCount")}
                className="cursor-pointer py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right tabular-nums"
              >
                Pinsala
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr
                key={row.barangay}
                onClick={() => handleRowClick(row)}
                className="cursor-pointer hover:bg-slate-50 transition group"
              >
                <td className="py-3 text-base font-semibold text-slate-900 pr-4 truncate max-w-35">
                  {row.barangay}
                </td>
                <td className="py-3 text-right text-base font-semibold text-slate-800 tabular-nums pr-4">
                  {row.farms}
                </td>
                <td className="py-3 text-right text-base font-semibold text-slate-800 tabular-nums pr-4">
                  {fmtHa(row.hectares)}
                </td>
                <td className="py-3 text-right text-base font-semibold text-slate-800 tabular-nums pr-4">
                  {row.openCases}
                </td>
                <td className="py-3 text-right pr-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-bold tabular-nums"
                      style={{ color: riskColor(row.riskScore) }}
                    >
                      {row.riskScore}
                    </span>
                    <div className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          backgroundColor: riskColor(row.riskScore),
                          width: `${Math.min(100, row.riskScore)}%`,
                        }}
                      />
                    </div>
                  </div>
                </td>
                <td className="py-3 text-right text-base font-semibold text-slate-800 tabular-nums">
                  {row.disasterCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
