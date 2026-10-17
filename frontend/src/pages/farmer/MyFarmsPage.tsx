import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Plus, MapPin, Sprout, Tractor } from "lucide-react";
import { listFarms, type Farm, type CropCycle } from "../../services/farm.service";
import { LoadingState } from "../../components/LoadingState";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";

/** Count of ACTIVE crop cycles embedded in the farm payload. */
const activeCycleCount = (farm: Farm): number =>
  (farm.cropCycles ?? []).filter(
    (c) => (c as CropCycle).status === "ACTIVE",
  ).length;

const MyFarmsPage = () => {
  const navigate = useNavigate();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await listFarms();
      setFarms(data);
    } catch (err) {
      console.error("Failed to load farms:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="w-full min-h-screen bg-slate-100 md:bg-slate-950 flex flex-col items-center p-0 md:p-6 lg:p-8 font-sans">
      <div className="w-full md:max-w-3xl bg-slate-50 text-slate-900 shadow-2xl flex flex-col md:rounded-[36px] md:border-2 md:border-emerald-800/40 min-h-screen relative pb-24">
        {/* Header */}
        <header className="w-full bg-[#03543f] text-white px-5 sm:px-8 pt-5 pb-4 flex items-center gap-3 shadow-md">
          <button
            type="button"
            onClick={() => navigate("/farmer")}
            aria-label="Bumalik"
            className="w-11 h-11 rounded-2xl bg-emerald-800/50 hover:bg-emerald-700 flex items-center justify-center shrink-0"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-lg sm:text-2xl font-black tracking-tight leading-tight">
              Mga Sakahan Ko
            </h1>
            <p className="text-xs sm:text-sm text-emerald-200/90 font-medium mt-0.5">
              Lahat ng nakarehistrong sakahan
            </p>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 pt-5 space-y-4">
          {loading ? (
            <LoadingState label="Kinukuha ang mga sakahan..." />
          ) : error ? (
            <ErrorState
              message="Hindi makuha ang listahan ng sakahan. Pakisubukan muli."
              onRetry={load}
            />
          ) : farms.length === 0 ? (
            <EmptyState
              icon={<Tractor className="h-12 w-12" />}
              title="Wala pang sakahan"
              message="Magdagdag ng unang sakahan para masimulan ang pagtatala ng pananim."
              action={
                <button
                  type="button"
                  onClick={() => navigate("/farmer/farms/new")}
                  className="inline-flex min-h-13 items-center gap-2 rounded-2xl bg-emerald-600 px-6 text-base font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
                >
                  <Plus className="h-5 w-5" />
                  Magdagdag ng Sakahan
                </button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {farms.map((farm) => {
                const active = activeCycleCount(farm);
                return (
                  <button
                    key={farm.id}
                    type="button"
                    onClick={() => navigate(`/farmer/farms/${farm.id}`)}
                    className="text-left rounded-3xl border-2 border-slate-100 bg-white p-5 shadow-sm transition-colors hover:border-emerald-300"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-lg font-black text-slate-900 leading-tight">
                        {farm.name}
                      </h2>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${
                          active > 0
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {active > 0 ? `${active} Aktibo` : "Walang aktibo"}
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-sm font-medium text-slate-500">
                      <MapPin className="h-4 w-4 shrink-0" />
                      {farm.barangay}, {farm.municipality}
                    </p>
                    <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-emerald-700">
                      <Sprout className="h-4 w-4" />
                      {Number(farm.areaHectares).toFixed(2)} ektarya
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </main>

        {/* Floating Add button (thumb reach) */}
        {!loading && !error && farms.length > 0 && (
          <button
            type="button"
            onClick={() => navigate("/farmer/farms/new")}
            className="fixed md:absolute bottom-6 right-6 inline-flex min-h-14 items-center gap-2 rounded-2xl bg-emerald-600 px-6 text-base font-black text-white shadow-xl transition-colors hover:bg-emerald-700 z-10"
          >
            <Plus className="h-6 w-6" />
            Magdagdag
          </button>
        )}
      </div>
    </div>
  );
};

export default MyFarmsPage;
