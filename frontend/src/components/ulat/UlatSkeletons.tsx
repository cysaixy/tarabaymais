import React from "react";

/** Loading skeleton for the full UlatView */
export const UlatViewSkeleton: React.FC = () => (
  <div
    aria-busy="true"
    aria-label="Kinukuha ang datos ng ulat..."
    className="flex flex-col lg:grid lg:grid-cols-12 gap-4 items-start w-full animate-pulse"
  >
    {/* Builder skeleton */}
    <div className="w-full lg:col-span-7 bg-white border border-[#dde3d8] rounded-[28px_28px_28px_72px] p-[26px_30px] flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="h-3 w-32 rounded bg-[#e8ebe4]" />
        <div className="h-7 w-3/4 rounded bg-[#e8ebe4]" />
      </div>

      {/* Step 1 */}
      <div className="flex flex-col gap-3">
        <div className="h-4 w-24 rounded bg-[#e8ebe4]" />
        <div className="h-[76px] rounded-[20px] bg-[#e9f8ef] border-2 border-[#c8d0c2]" />
        <div className="h-[56px] rounded-[14px] bg-[#f4f6f2] border border-[#c8d0c2]" />
      </div>

      {/* Step 2 */}
      <div className="flex flex-col gap-2">
        <div className="h-4 w-28 rounded bg-[#e8ebe4]" />
        <div className="flex gap-2">
          <div className="h-8 w-28 rounded-full bg-[#eef3e8]" />
          <div className="h-8 w-24 rounded-full bg-[#eef3e8]" />
          <div className="h-8 w-16 rounded-full bg-[#eef3e8]" />
        </div>
      </div>

      {/* Step 3 */}
      <div className="flex flex-col gap-3">
        <div className="h-4 w-16 rounded bg-[#e8ebe4]" />
        <div className="flex gap-3">
          <div className="flex-[3] h-[60px] rounded-[16px] bg-[#e8ebe4]" />
          <div className="flex-[2] h-[60px] rounded-[16px] bg-[#eef3e8] border border-[#c8d0c2]" />
        </div>
      </div>
    </div>

    {/* Distribution panel skeleton */}
    <div className="w-full lg:col-span-5 bg-[#0a3d2e] rounded-[28px_28px_72px_28px] p-[26px_28px] flex flex-col gap-[18px]">
      <div className="flex flex-col gap-2">
        <div className="h-3 w-36 rounded bg-white/20" />
        <div className="h-6 w-24 rounded bg-white/30" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="flex justify-between">
            <div className="h-4 w-28 rounded bg-white/20" />
            <div className="h-4 w-24 rounded bg-white/10" />
          </div>
          <div className="h-2.5 w-full rounded-full bg-[#1d5a45]">
            <div
              className="h-2.5 rounded-full bg-white/25"
              style={{ width: `${30 + i * 20}%` }}
            />
          </div>
        </div>
      ))}
      <div className="border-t border-[#2a6b53]" />
      <div className="flex justify-between items-center">
        <div className="h-3 w-16 rounded bg-white/20" />
        <div className="h-8 w-32 rounded bg-white/25" />
      </div>
    </div>
  </div>
);

