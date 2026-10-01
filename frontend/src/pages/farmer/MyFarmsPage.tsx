import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listFarms } from "../../services/farm.service";
import type { Farm } from "../../services/farm.service";

const MyFarmsPage = () => {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await listFarms();
        if (active) setFarms(data);
      } catch (err) {
        console.error("Failed to load farms:", err);
        if (active) setError("Could not load your farms. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-teal-400">
            Farmer
          </p>
          <h1 className="mt-1 text-3xl font-bold text-white">My Farms</h1>
          <p className="mt-2 text-slate-400">
            Farms registered under your account.
          </p>
        </div>
        <Link
          to="/farmer/farms/new"
          className="shrink-0 rounded-lg bg-teal-500 px-4 py-2.5 font-medium text-slate-950 transition hover:bg-teal-400"
        >
          + Add Farm
        </Link>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-teal-500" />
          <span className="text-sm">Loading farms...</span>
        </div>
      )}

      {!loading && error && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {!loading && !error && farms.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center">
          <p className="text-slate-300">You haven't registered any farms yet.</p>
          <Link
            to="/farmer/farms/new"
            className="mt-4 inline-block rounded-lg bg-teal-500 px-4 py-2.5 font-medium text-slate-950 transition hover:bg-teal-400"
          >
            Register your first farm
          </Link>
        </div>
      )}

      {!loading && !error && farms.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {farms.map((farm) => (
            <div
              key={farm.id}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"
            >
              <h2 className="text-lg font-semibold text-white">{farm.name}</h2>
              <p className="mt-1 text-sm text-slate-400">
                {farm.barangay}, {farm.municipality}
              </p>
              <dl className="mt-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Area</dt>
                  <dd className="text-teal-300">
                    {Number(farm.areaHectares).toFixed(2)} ha
                  </dd>
                </div>
                {farm.latitude != null && farm.longitude != null && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Coordinates</dt>
                    <dd className="text-slate-300">
                      {Number(farm.latitude).toFixed(4)},{" "}
                      {Number(farm.longitude).toFixed(4)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          ))}
        </div>
      )}
    </main>
  );
};

export default MyFarmsPage;
