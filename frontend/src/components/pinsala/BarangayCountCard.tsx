import React, { useMemo } from "react";
import type { CaseItem } from "./types";

export interface BarangayCountCardProps {
  cases: CaseItem[];
}

export const BarangayCountCard: React.FC<BarangayCountCardProps> = ({
  cases,
}) => {
  const barangayCounts = useMemo(() => {
    const countsMap = new Map<string, number>();

    cases.forEach((c) => {
      const bgy = c.barangay?.trim() || "Hindi Natukoy";
      countsMap.set(bgy, (countsMap.get(bgy) || 0) + 1);
    });

    return Array.from(countsMap.entries())
      .map(([barangay, count]) => ({ barangay, count }))
      .sort((a, b) => b.count - a.count);
  }, [cases]);

  return (
    <section
      aria-labelledby="barangay-card-title"
      className="bg-white border border-[#dde3d8] rounded-[20px] p-[16px_20px] flex flex-col gap-2.5 shadow-xs"
    >
      <h3
        id="barangay-card-title"
        className="text-[15px] font-extrabold text-[#14213d]"
      >
        Kaso ayon sa Barangay
      </h3>

      {barangayCounts.length === 0 ? (
        <p className="text-[13px] text-[#4b5563] italic py-1">
          Walang naitalang barangay.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {barangayCounts.map(({ barangay, count }) => (
            <div
              key={barangay}
              className="flex items-center justify-between text-[14px]"
            >
              <span className="font-semibold text-[#374151] truncate pr-2">
                {barangay}
              </span>
              <span className="font-bold text-[#14213d] shrink-0">
                {count}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
