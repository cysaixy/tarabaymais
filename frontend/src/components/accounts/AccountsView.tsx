import React, { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Search, Users } from "lucide-react";
import {
  getAccounts,
  type AccountRow,
  type AccountStatusFilter,
  type AccountsResponse,
} from "../../services/accounts.service";
import { tagalogRelativeTime } from "../../lib/relativeTime";
import { EmptyState } from "../EmptyState";

const PAGE_SIZE = 50;

const STATUS_CHIPS: { key: AccountStatusFilter; label: string }[] = [
  { key: "all", label: "Lahat" },
  { key: "active", label: "Aktibo" },
  { key: "inactive", label: "Hindi Aktibo" },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("fil-PH", { year: "numeric", month: "short", day: "numeric" });
}

const StatusPill: React.FC<{ active: boolean }> = ({ active }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-extrabold ${
      active ? "bg-[#e9f8ef] text-[#0a6b45]" : "bg-[#fdf0f0] text-[#9b1c1c]"
    }`}
  >
    <span
      className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[#0a6b45]" : "bg-[#9b1c1c]"}`}
      aria-hidden="true"
    />
    {active ? "Aktibo" : "Hindi Aktibo"}
  </span>
);

const locationLabel = (a: AccountRow) =>
  [a.barangay, a.municipality].filter(Boolean).join(", ") || "Walang sakahan";

export const AccountsView: React.FC = () => {
  const [status, setStatus] = useState<AccountStatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AccountsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce typing so we don't query on every keystroke.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAccounts({
        status,
        page,
        pageSize: PAGE_SIZE,
        ...(search ? { search } : {}),
      });
      setData(result);
    } catch {
      setError("Hindi ma-load ang mga account. Subukan muli.");
    } finally {
      setLoading(false);
    }
  }, [status, search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = data?.counts;
  const months = data?.inactivityMonths ?? 6;
  const total = data?.pagination.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const accounts = data?.accounts ?? [];

  return (
    <div
      style={{
        backgroundColor: "#f4f6f2",
        fontFamily:
          "Figtree, Atkinson Hyperlegible, Inter, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
      className="min-h-full w-full p-4 sm:p-6 text-[#14213d]"
    >
      <div className="mx-auto max-w-[1152px] w-full flex flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-extrabold tracking-tight leading-none">
              Mga Account
            </h1>
            <p className="mt-1.5 text-[13px] font-semibold text-[#4b5563]">
              Kusang nagiging <b>Hindi Aktibo</b> ang account na walang gamit nang{" "}
              {months} buwan. Babalik itong Aktibo kapag nag-login muli ang magsasaka.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex min-h-11 items-center gap-2 rounded-[14px] border-2 border-[#dde3d8] bg-white px-4 text-[14px] font-bold hover:bg-[#eef3e8] disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            I-refresh
          </button>
        </header>

        <section className="bg-white border border-[#dde3d8] rounded-[24px] p-4 sm:p-6 flex flex-col gap-4 shadow-xs">
          {/* Filters */}
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div role="tablist" aria-label="Status ng account" className="flex flex-wrap gap-2">
              {STATUS_CHIPS.map(({ key, label }) => {
                const selected = status === key;
                const count = counts?.[key];
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => {
                      setStatus(key);
                      setPage(1);
                    }}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[14px] font-extrabold transition cursor-pointer ${
                      selected
                        ? "bg-[#14213d] text-white"
                        : "bg-[#eef3e8] text-[#14213d] hover:bg-[#e2e9db]"
                    }`}
                  >
                    {label}
                    {count !== undefined && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[12px] ${
                          selected ? "bg-white/20" : "bg-white"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <label className="relative md:ml-auto md:w-80">
              <span className="sr-only">Maghanap</span>
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Pangalan, telepono, o barangay"
                className="w-full min-h-11 rounded-[14px] border-2 border-[#dde3d8] bg-white pl-10 pr-3 text-[14px] font-semibold outline-none focus:border-[#0a6b45]"
              />
            </label>
          </div>

          {/* Body */}
          {error ? (
            <div className="rounded-2xl border-2 border-red-100 bg-red-50 px-4 py-3 text-[14px] font-bold text-[#9b1c1c]">
              {error}
            </div>
          ) : loading && !data ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[14px] font-bold text-[#4b5563]">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Nilo-load ang mga account...
            </div>
          ) : accounts.length === 0 ? (
            <EmptyState
              icon={<Users className="h-12 w-12" />}
              title="Walang account"
              message="Walang tumugmang account sa napiling filter."
            />
          ) : (
            <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-[14px]">
                  <thead>
                    <tr className="border-b-2 border-[#eef3e8] text-[12px] uppercase tracking-[0.06em] text-[#4b5563]">
                      <th className="py-2.5 pr-3 font-bold">Pangalan</th>
                      <th className="py-2.5 pr-3 font-bold">Telepono</th>
                      <th className="py-2.5 pr-3 font-bold">Lokasyon</th>
                      <th className="py-2.5 pr-3 font-bold text-right">Sakahan</th>
                      <th className="py-2.5 pr-3 font-bold">Huling Aktibo</th>
                      <th className="py-2.5 pr-3 font-bold">Nagparehistro</th>
                      <th className="py-2.5 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((a) => (
                      <tr key={a.id} className="border-b border-[#eef3e8] last:border-0">
                        <td className="py-3 pr-3">
                          <p className="font-extrabold">
                            {a.firstName} {a.lastName}
                          </p>
                          {a.rsbsaNumber && (
                            <p className="text-[12px] font-semibold text-[#6b7280]">
                              RSBSA {a.rsbsaNumber}
                            </p>
                          )}
                        </td>
                        <td className="py-3 pr-3 font-semibold tabular-nums">{a.phone}</td>
                        <td className="py-3 pr-3 font-semibold">{locationLabel(a)}</td>
                        <td className="py-3 pr-3 text-right font-bold tabular-nums">{a.farmCount}</td>
                        <td className="py-3 pr-3 font-semibold" title={formatDate(a.lastActiveAt)}>
                          {tagalogRelativeTime(a.lastActiveAt)}
                        </td>
                        <td className="py-3 pr-3 font-semibold text-[#4b5563]">
                          {formatDate(a.createdAt)}
                        </td>
                        <td className="py-3">
                          <StatusPill active={a.isActive} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="md:hidden flex flex-col gap-3">
                {accounts.map((a) => (
                  <li key={a.id} className="rounded-[18px] border border-[#dde3d8] p-4 flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[16px] font-extrabold leading-snug">
                        {a.firstName} {a.lastName}
                      </p>
                      <StatusPill active={a.isActive} />
                    </div>
                    <p className="text-[14px] font-semibold tabular-nums">{a.phone}</p>
                    <p className="text-[14px] font-semibold text-[#4b5563]">
                      {locationLabel(a)} · {a.farmCount} sakahan
                    </p>
                    <p className="text-[13px] font-semibold text-[#6b7280]">
                      Huling aktibo: {tagalogRelativeTime(a.lastActiveAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-3 border-t border-[#eef3e8] pt-4">
              <p className="text-[13px] font-semibold text-[#4b5563]">
                Pahina {page} ng {lastPage} · {total} account
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => p - 1)}
                  className="min-h-11 rounded-[14px] border-2 border-[#dde3d8] px-4 text-[14px] font-bold disabled:opacity-50 cursor-pointer"
                >
                  Nakaraan
                </button>
                <button
                  type="button"
                  disabled={page >= lastPage || loading}
                  onClick={() => setPage((p) => p + 1)}
                  className="min-h-11 rounded-[14px] border-2 border-[#dde3d8] px-4 text-[14px] font-bold disabled:opacity-50 cursor-pointer"
                >
                  Susunod
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
