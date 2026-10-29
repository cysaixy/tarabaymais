import React from "react";

export const ThreadItemSkeleton: React.FC<{ isSelected?: boolean }> = ({
  isSelected = false,
}) => {
  if (isSelected) {
    return (
      <div
        aria-label="Naglo-load ang napiling konsultasyon"
        className="bg-white border border-[#dde3d8] border-l-[6px] border-l-[#0a6b45] rounded-[24px_24px_24px_56px] p-[18px_20px] flex flex-col gap-3 shadow-xs animate-pulse w-full min-w-[280px] lg:min-w-0 shrink-0 lg:shrink"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-slate-200" />
            <div className="h-4 w-28 bg-slate-200 rounded-md" />
          </div>
          <div className="h-5 w-14 bg-slate-200 rounded-full" />
        </div>
        <div className="h-5 w-36 bg-slate-200 rounded-md" />
        <div className="h-4 w-44 bg-slate-200 rounded-md" />
        <div className="h-3 w-24 bg-slate-200 rounded-md" />
      </div>
    );
  }

  return (
    <div
      aria-label="Naglo-load ang thread"
      className="bg-white border border-[#dde3d8] rounded-[16px] p-[12px_16px] flex flex-col gap-2 shadow-2xs animate-pulse w-full min-w-[260px] lg:min-w-0 shrink-0 lg:shrink"
    >
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 bg-slate-200 rounded-md" />
        <div className="h-5 w-12 bg-slate-200 rounded-full" />
      </div>
      <div className="h-4 w-32 bg-slate-200 rounded-md" />
      <div className="h-3 w-40 bg-slate-200 rounded-md" />
    </div>
  );
};

export const ConversationPanelSkeleton: React.FC = () => {
  return (
    <div
      aria-label="Naglo-load ang usapan"
      className="flex flex-col rounded-[28px] overflow-hidden bg-white border border-[#dde3d8] shadow-xs animate-pulse w-full min-h-[500px]"
    >
      {/* Contact bar skeleton */}
      <div className="bg-[#0a3d2e] px-[18px] py-[10px] flex items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#16533f]" />
          <div className="flex flex-col gap-1.5">
            <div className="h-4 w-28 bg-[#16533f] rounded-md" />
            <div className="h-3 w-36 bg-[#16533f] rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-11 w-20 bg-[#16533f] rounded-[10px]" />
          <div className="h-11 w-20 bg-[#16533f] rounded-[10px]" />
          <div className="h-11 w-20 bg-[#16533f] rounded-[10px]" />
        </div>
      </div>

      {/* Messages skeleton */}
      <div className="p-6 flex flex-col gap-5 flex-1">
        <div className="h-6 w-56 bg-slate-200 rounded-md" />

        <div className="flex flex-col gap-2 max-w-[70%]">
          <div className="h-3 w-16 bg-slate-200 rounded-md" />
          <div className="h-16 w-full bg-slate-200 rounded-[18px_18px_18px_4px]" />
        </div>

        <div className="flex flex-col gap-2 max-w-[70%] ml-auto items-end">
          <div className="h-3 w-10 bg-slate-200 rounded-md" />
          <div className="h-14 w-full bg-slate-200 rounded-[18px_18px_4px_18px]" />
        </div>
      </div>

      {/* Suggestion + reply skeleton */}
      <div className="p-6 pt-0 flex flex-col gap-3">
        <div className="h-20 w-full bg-amber-50 rounded-[16px]" />
        <div className="h-13 w-full bg-slate-200 rounded-[14px]" />
      </div>
    </div>
  );
};

export const KonsultasyonViewSkeleton: React.FC = () => {
  return (
    <div className="w-full flex flex-col gap-4">
      {/* Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar w-full">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="min-h-[44px] w-28 rounded-full bg-slate-200 animate-pulse shrink-0"
          />
        ))}
      </div>

      {/* Grid */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 items-start w-full">
        <div className="w-full lg:col-span-4 flex flex-row lg:flex-col gap-2.5 overflow-x-auto lg:overflow-visible no-scrollbar pb-2 lg:pb-0">
          <ThreadItemSkeleton isSelected={true} />
          <ThreadItemSkeleton isSelected={false} />
          <ThreadItemSkeleton isSelected={false} />
        </div>

        <div className="w-full lg:col-span-8">
          <ConversationPanelSkeleton />
        </div>
      </div>
    </div>
  );
};

