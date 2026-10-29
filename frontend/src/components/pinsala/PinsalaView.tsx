import React, { useMemo, useState } from "react";
import type { DisasterReport } from "../../services/case.service";
import type { FilterChipKey, CaseItem } from "./types";
import {
  extractHectares,
  extractFarmerName,
  extractFarmNote,
  formatDamageType,
  mapCaseStatus,
} from "./formatters";
import { StatusChips } from "./StatusChips";
import { SelectedCaseCard } from "./SelectedCaseCard";
import { CaseRow } from "./CaseRow";
import { AffectedAreaPanel } from "./AffectedAreaPanel";
import { BarangayCountCard } from "./BarangayCountCard";
import { PinsalaViewSkeleton } from "./PinsalaSkeletons";

export interface PinsalaViewProps {
  disasterReports: DisasterReport[];
  isLoading?: boolean;
  error?: string | null;
  onVerifyCase: (caseId: string) => Promise<void> | void;
  onApproveCase?: (caseId: string) => Promise<void> | void;
  onRequestDocument?: (caseItem: CaseItem) => void;
  isVerifying?: boolean;
  isApproving?: boolean;
  selectedLocationKey?: string;
}

export const PinsalaView: React.FC<PinsalaViewProps> = ({
  disasterReports,
  isLoading = false,
  error = null,
  onVerifyCase,
  onApproveCase,
  isVerifying = false,
  isApproving = false,
  selectedLocationKey = "",
}) => {
  const [activeFilter, setActiveFilter] = useState<FilterChipKey>("Lahat");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  // 1. Filter by top bar if specified
  const filteredByTopBar = useMemo(() => {
    if (!selectedLocationKey) return disasterReports;
    return disasterReports.filter((r) => {
      if (!r.farm) return true;
      const key = `${r.farm.barangay} · ${r.farm.municipality}`;
      return (
        key.toLowerCase().includes(selectedLocationKey.toLowerCase()) ||
        r.farm.barangay.toLowerCase() === selectedLocationKey.toLowerCase()
      );
    });
  }, [disasterReports, selectedLocationKey]);

  // 2. Map DisasterReport to clean CaseItem
  const allCases: CaseItem[] = useMemo(() => {
    return filteredByTopBar.map((item, index) => {
      const damageType = formatDamageType(item.disasterType);
      const hectares = extractHectares(
        item.notes,
        item.damagePercentage,
        (item.farm as { areaHectares?: string | number } | undefined)?.areaHectares
      );
      const verifiedFarmer = item.farm?.farmer
        ? `${item.farm.farmer.firstName || ""} ${item.farm.farmer.lastName || ""}`.trim()
        : null;
      const farmerName = extractFarmerName(item.farm?.name, item.notes, verifiedFarmer);
      const barangay = item.farm?.barangay || "Centro Norte (Pob.)";
      const status = mapCaseStatus(item.status);
      const farmNote = extractFarmNote(item.notes);

      return {
        id: item.id,
        caseNo: index + 1,
        farmerName,
        barangay,
        damageType,
        hectares,
        status,
        farmNote,
        rawStatus: item.status,
        createdAt: item.createdAt,
      };
    });
  }, [filteredByTopBar]);

  // 3. Compute count for each chip
  const chipCounts = useMemo<Record<FilterChipKey, number>>(() => {
    const counts: Record<FilterChipKey, number> = {
      Lahat: allCases.length,
      Bago: 0,
      Sinusuri: 0,
      "Na-verify": 0,
      Aprubado: 0,
    };

    allCases.forEach((c) => {
      if (counts[c.status] !== undefined) {
        counts[c.status] += 1;
      }
    });

    return counts;
  }, [allCases]);

  // 4. Filter cases according to active status chip
  const casesForActiveChip = useMemo(() => {
    if (activeFilter === "Lahat") return allCases;
    return allCases.filter((c) => c.status === activeFilter);
  }, [allCases, activeFilter]);

  // 5. Selected case logic
  const selectedCase = useMemo(() => {
    if (casesForActiveChip.length === 0) return null;
    const found = casesForActiveChip.find((c) => c.id === selectedCaseId);
    return found || casesForActiveChip[0] || null;
  }, [casesForActiveChip, selectedCaseId]);

  // 6. Other cases (all except selected case)
  const otherCases = useMemo(() => {
    if (!selectedCase) return [];
    return casesForActiveChip.filter((c) => c.id !== selectedCase.id);
  }, [casesForActiveChip, selectedCase]);

  return (
    <div
      style={{
        backgroundColor: "#f4f6f2",
        fontFamily:
          "Figtree, Atkinson Hyperlegible, Inter, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
      className="min-h-full w-full p-6 text-[#14213d]"
    >
      <div className="mx-auto max-w-[1152px] w-full flex flex-col gap-4">
        {/* Header */}
        <header className="flex flex-col gap-3 w-full">
          <h1 className="text-[28px] font-extrabold text-[#14213d] tracking-tight leading-none">
            Mga Kaso ng Pinsala
          </h1>

          <StatusChips
            selected={activeFilter}
            onSelect={(chip) => {
              setActiveFilter(chip);
              setSelectedCaseId(null);
            }}
            counts={chipCounts}
          />
        </header>

        {/* Inline Error Message */}
        {error ? (
          <div
            role="alert"
            className="w-full bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl p-4 text-[14px] font-semibold"
          >
            {error}
          </div>
        ) : null}

        {/* Loading Skeleton */}
        {isLoading ? (
          <PinsalaViewSkeleton />
        ) : (
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:gap-4 lg:items-start w-full">
            {/* Left Column (Columns 1-8 on desktop, gap 10px) */}
            <div className="contents lg:flex lg:flex-col lg:gap-2.5 lg:col-span-8">
              {casesForActiveChip.length === 0 ? (
                <div className="order-1 w-full bg-white border border-[#dde3d8] rounded-[24px] p-8 text-center text-[#4b5563] text-[15px] font-semibold shadow-xs">
                  Walang kaso sa napiling katayuan.
                </div>
              ) : selectedCase ? (
                <div className="order-1 w-full">
                  <SelectedCaseCard
                    selectedCase={selectedCase}
                    onVerify={onVerifyCase}
                    onApprove={onApproveCase || onVerifyCase}
                    isVerifying={isVerifying}
                    isApproving={isApproving}
                  />
                </div>
              ) : null}

              {/* Other Cases: Compact rows */}
              {otherCases.length > 0 ? (
                <div className="order-4 w-full flex flex-col gap-2">
                  <ul role="list" className="flex flex-col gap-2 w-full m-0 p-0">
                    {otherCases.map((item) => (
                      <CaseRow
                        key={item.id}
                        item={item}
                        onSelect={setSelectedCaseId}
                      />
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            {/* Right Column (Columns 9-12 on desktop, gap 16px) */}
            <div className="contents lg:flex lg:flex-col lg:gap-4 lg:col-span-4">
              <div className="order-2 w-full">
                <AffectedAreaPanel cases={casesForActiveChip} />
              </div>
              <div className="order-3 w-full">
                <BarangayCountCard cases={casesForActiveChip} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
