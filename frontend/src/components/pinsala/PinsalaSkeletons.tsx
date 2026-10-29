import React from "react";

export const SelectedCaseSkeleton: React.FC = () => {
  return (
    <div
      aria-label="Naglo-load ang napiling kaso"
      className="bg-white border border-[#dde3d8] border-t-[6px] border-t-[#f5c518] rounded-[28px_28px_28px_72px] p-6 sm:p-7 flex flex-col gap-4 animate-pulse shadow-xs"
    >
      <div className="flex flex-col-reverse sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex flex-col gap-2 w-2/3">
          <div className="h-3 w-32 bg-slate-200 rounded-md" />
          <div className="h-8 w-64 bg-slate-200 rounded-md" />
          <div className="h-4 w-48 bg-slate-200 rounded-md" />
        </div>
        <div className="h-7 w-20 bg-slate-200 rounded-full shrink-0" />
      </div>

      <div className="flex flex-wrap items-center gap-4 py-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-200" />
            <div className="h-4 w-20 bg-slate-200 rounded-md" />
          </div>
        ))}
      </div>

      <div className="bg-[#f4f6f2] rounded-[14px] p-[12px_16px] h-16 w-full" />

      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <div className="min-h-[52px] sm:flex-[2] rounded-[14px] bg-slate-200" />
        <div className="min-h-[52px] sm:flex-1 rounded-[14px] bg-slate-200" />
      </div>
    </div>
  );
};

export const CaseRowSkeleton: React.FC = () => {
  return (
    <div className="w-full bg-white border border-[#dde3d8] rounded-[16px] min-h-[60px] px-5 flex items-center animate-pulse shadow-xs">
      <div className="hidden lg:grid grid-cols-[70px_1fr_1.3fr_1.4fr_70px_96px] gap-3 items-center w-full">
        <div className="h-4 w-12 bg-slate-200 rounded-md" />
        <div className="h-4 w-24 bg-slate-200 rounded-md" />
        <div className="h-4 w-28 bg-slate-200 rounded-md" />
        <div className="h-4 w-32 bg-slate-200 rounded-md" />
        <div className="h-4 w-12 bg-slate-200 rounded-md" />
        <div className="h-6 w-16 bg-slate-200 rounded-full justify-self-end" />
      </div>
      <div className="flex lg:hidden flex-col justify-center gap-2 py-3 w-full">
        <div className="flex items-center justify-between w-full">
          <div className="h-4 w-32 bg-slate-200 rounded-md" />
          <div className="h-5 w-16 bg-slate-200 rounded-full" />
        </div>
        <div className="h-3 w-48 bg-slate-200 rounded-md" />
      </div>
    </div>
  );
};

export const DarkPanelSkeleton: React.FC = () => {
  return (
    <div
      aria-label="Naglo-load ang buod ng apektadong taniman"
      className="bg-[#0a3d2e] rounded-[28px_28px_72px_28px] p-[24px_26px] flex flex-col gap-4 animate-pulse shadow-sm"
    >
      <div className="flex flex-col gap-2">
        <div className="h-3 w-36 bg-[#16533f] rounded-md" />
        <div className="h-14 w-28 bg-[#16533f] rounded-md" />
        <div className="h-3 w-20 bg-[#16533f] rounded-md" />
      </div>
      <div className="flex flex-col gap-3 pt-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="flex justify-between">
              <div className="h-4 w-24 bg-[#16533f] rounded-md" />
              <div className="h-4 w-12 bg-[#16533f] rounded-md" />
            </div>
            <div className="h-[10px] w-full rounded-full bg-[#16533f]" />
          </div>
        ))}
      </div>
    </div>
  );
};

export const BarangayCardSkeleton: React.FC = () => {
  return (
    <div
      aria-label="Naglo-load ang datos ng barangay"
      className="bg-white border border-[#dde3d8] rounded-[20px] p-[16px_20px] flex flex-col gap-3 animate-pulse shadow-xs"
    >
      <div className="h-4 w-40 bg-slate-200 rounded-md" />
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex justify-between items-center">
          <div className="h-4 w-28 bg-slate-200 rounded-md" />
          <div className="h-4 w-6 bg-slate-200 rounded-md" />
        </div>
        <div className="flex justify-between items-center">
          <div className="h-4 w-20 bg-slate-200 rounded-md" />
          <div className="h-4 w-6 bg-slate-200 rounded-md" />
        </div>
      </div>
    </div>
  );
};

export const PinsalaViewSkeleton: React.FC = () => {
  return (
    <div className="w-full flex flex-col gap-4">
      {/* Chips skeleton */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar w-full">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="min-h-[44px] w-28 rounded-full bg-slate-200 animate-pulse shrink-0"
          />
        ))}
      </div>

      {/* Grid */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:gap-4 lg:items-start w-full">
        <div className="contents lg:flex lg:flex-col lg:gap-2.5 lg:col-span-8">
          <div className="order-1 w-full">
            <SelectedCaseSkeleton />
          </div>
          <div className="order-4 w-full flex flex-col gap-2">
            {[1, 2, 3, 4].map((i) => (
              <CaseRowSkeleton key={i} />
            ))}
          </div>
        </div>

        <div className="contents lg:flex lg:flex-col lg:gap-4 lg:col-span-4">
          <div className="order-2 w-full">
            <DarkPanelSkeleton />
          </div>
          <div className="order-3 w-full">
            <BarangayCardSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
};

