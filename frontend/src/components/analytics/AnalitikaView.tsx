import React from "react";
import { StatBar } from "./StatBar";
import { DamageHeroChart, type DamageReportDatePoint } from "./DamageHeroChart";
import { ResponsePanel, type WeeklyResponsePoint } from "./ResponsePanel";
import { StatusPanel, type CaseStatusItem } from "./StatusPanel";
import { StageStrip } from "./StageStrip";
import { BarangayStrips, type BarangayAnalyticsItem } from "./BarangayStrips";
import type { StageData } from "../dashboard/PanahonNgMaisCard";

export interface AnalitikaViewProps {
  stats: {
    farmCount: number;
    activeHectares: number;
    openCases: number;
    avgResponseHours: number;
    responseDelta?: { value: number; percent: number };
  };
  damageReportsByDate: DamageReportDatePoint[];
  damageReportTotal: number;
  responseByWeek: WeeklyResponsePoint[];
  statusBreakdown: CaseStatusItem[];
  stageHectares: StageData[];
  barangays: BarangayAnalyticsItem[];
  periodLabel?: string;
  dateRangeLabel?: string;
  isLoading?: boolean;
  error?: string | Error | null;
}

/**
 * AnalitikaView — Non-uniform, asymmetrical dashboard analytics view
 */
export const AnalitikaView: React.FC<AnalitikaViewProps> = ({
  stats,
  damageReportsByDate,
  damageReportTotal,
  responseByWeek,
  statusBreakdown,
  stageHectares,
  barangays,
  periodLabel,
  dateRangeLabel,
  isLoading = false,
  error = null,
}) => {
  const activePeriodLabel = dateRangeLabel || periodLabel || "30 araw";
  return (
    <div className="w-full bg-[#f4f6f2] min-h-full py-6 px-4 sm:px-6">
      <div className="w-full max-w-[1152px] mx-auto space-y-4">
        {/* PAGE TITLE (NO DUPLICATE HEADER CONTROLS) */}
        <div>
          <h1 className="text-[28px] font-extrabold text-slate-900 leading-tight">
            Analitika
          </h1>
        </div>

        {/* INLINE ERROR ALERT (accessible, non-intrusive) */}
        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm font-semibold flex items-center gap-2"
          >
            <span className="font-bold text-amber-700">Pansin:</span>
            <span>
              {typeof error === "string"
                ? error
                : error?.message ?? "Hindi ma-load ang ilang datos ng analitika."}
            </span>
          </div>
        )}

        {/* 1) STAT BAR (One Pill Container) */}
        <StatBar
          farmCount={stats.farmCount}
          activeHectares={stats.activeHectares}
          openCases={stats.openCases}
          avgResponseHours={stats.avgResponseHours}
          responseDelta={stats.responseDelta}
          isLoading={isLoading}
        />

        {/* 2) ROW A: 12-Column Grid (Hero Damage Chart 1-8, Oras ng Tugon 9-12) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8">
            <DamageHeroChart
              data={damageReportsByDate}
              totalReports={damageReportTotal}
              periodLabel={activePeriodLabel}
              isLoading={isLoading}
            />
          </div>
          <div className="lg:col-span-4">
            <ResponsePanel
              data={responseByWeek}
              avgResponseHours={stats.avgResponseHours}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* 3) ROW B: 12-Column Grid, align-items: start (Katayuan 1-4, Taniman ayon sa Yugto 5-12) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-4">
            <StatusPanel
              items={statusBreakdown}
              openCount={stats.openCases}
              isLoading={isLoading}
            />
          </div>
          <div className="lg:col-span-8">
            <StageStrip
              stages={stageHectares}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* 4) ROW C: Buod Ayon sa Barangay (Replaces Table) */}
        <div className="pt-2">
          <BarangayStrips
            barangays={barangays}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
};
