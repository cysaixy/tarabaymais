import React from "react";

export interface CaseStatusItem {
  status: "Sinusuri" | "Nainspeksyon" | "Aprubado";
  count: number;
}

export interface StatusPanelProps {
  items: CaseStatusItem[];
  openCount: number;
  isLoading?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  Sinusuri: "#d99a1d",
  Nainspeksyon: "#7c3aed",
  Aprubado: "#0a6b45",
};

export const StatusPanelSkeleton: React.FC = () => (
  <div
    className="w-full bg-white border border-[#dde3d8] rounded-[20px] p-5 shadow-2xs space-y-4"
    role="status"
    aria-busy="true"
    aria-label="Ikinakarga ang katayuan ng mga kaso..."
  >
    <div className="h-4 w-36 bg-slate-200 rounded animate-pulse" />
    <div className="h-10 w-24 bg-slate-200 rounded-lg animate-pulse" />
    <div className="h-[18px] w-full bg-slate-200 rounded-full animate-pulse" />
    <div className="space-y-2 pt-2">
      <div className="h-3 w-32 bg-slate-200 rounded animate-pulse" />
      <div className="h-3 w-36 bg-slate-200 rounded animate-pulse" />
      <div className="h-3 w-28 bg-slate-200 rounded animate-pulse" />
    </div>
  </div>
);

/**
 * StatusPanel — Katayuan ng mga Kaso with stacked horizontal bar & legend (Columns 1-4 of Row B)
 */
export const StatusPanel: React.FC<StatusPanelProps> = ({
  items,
  openCount,
  isLoading = false,
}) => {
  if (isLoading) return <StatusPanelSkeleton />;

  const total = items.reduce((sum, item) => sum + item.count, 0) || 1;

  return (
    <article className="w-full bg-white border border-[#dde3d8] rounded-[20px] p-5 shadow-2xs flex flex-col justify-between">
      <div>
        <h2 className="text-[16px] font-extrabold text-slate-900 leading-none">
          Katayuan ng mga Kaso
        </h2>

        {/* BIG OPEN CASE COUNT */}
        <div className="flex items-baseline mt-2">
          <span
            className="text-[40px] font-black text-[#9a4a05] leading-none tracking-tight"
            aria-label={`${openCount} bukas na kaso`}
          >
            {openCount}
          </span>
          <span className="text-[14px] font-bold text-[#4b5563] ml-1.5 leading-none">
            bukas
          </span>
        </div>
      </div>

      {/* 18px TALL FULLY ROUNDED STACKED BAR */}
      <div className="my-4">
        <div
          className="flex w-full h-[18px] rounded-full overflow-hidden gap-0.5 bg-slate-100 p-0.5"
          role="img"
          aria-label={`Barangay case distribution: ${items.map((i) => `${i.status}: ${i.count}`).join(", ")}`}
        >
          {items.map((seg) => {
            const pct = Math.max((seg.count / total) * 100, seg.count > 0 ? 5 : 0);
            return (
              <div
                key={seg.status}
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  backgroundColor: STATUS_COLORS[seg.status] || "#94a3b8",
                }}
                title={`${seg.status}: ${seg.count}`}
              />
            );
          })}
        </div>
      </div>

      {/* VERTICALLY STACKED LEGEND (13px with 10px rounded square) */}
      <div className="space-y-2 pt-1">
        {items.map((seg) => (
          <div key={seg.status} className="flex items-center justify-between text-[13px]">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-[3px] shrink-0"
                style={{ backgroundColor: STATUS_COLORS[seg.status] || "#94a3b8" }}
                aria-hidden="true"
              />
              <span className="font-semibold text-slate-700">{seg.status}</span>
            </div>
            <span className="font-extrabold text-slate-900">{seg.count}</span>
          </div>
        ))}
      </div>
    </article>
  );
};
