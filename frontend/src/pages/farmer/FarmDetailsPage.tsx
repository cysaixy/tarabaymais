import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronLeft,
  MapPin,
  Sprout,
  Pencil,
  Trash2,
  Save,
  X,
  Calendar,
  Plus,
} from "lucide-react";
import {
  getFarmById,
  updateFarm,
  deleteFarm,
  createCropCycle,
  listCropCycles,
  type Farm,
  type CropCycle,
} from "../../services/farm.service";
import { ApiError } from "../../lib/api";
import { LoadingState } from "../../components/LoadingState";
import { ErrorState } from "../../components/ErrorState";
import { useFarmSelection } from "../../context/farmSelectionContext";

interface FieldErrors {
  [key: string]: string[] | undefined;
}

const STATUS_LABEL: Record<CropCycle["status"], string> = {
  ACTIVE: "Aktibo",
  HARVESTED: "Naani na",
  FAILED: "Nabigo",
  CANCELLED: "Kinansela",
};

const STATUS_STYLE: Record<CropCycle["status"], string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  HARVESTED: "bg-amber-100 text-amber-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

const labelClass = "mb-1.5 block text-sm font-bold text-slate-700";
const inputClass =
  "w-full min-h-[52px] rounded-2xl border-2 border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";

const FarmDetailsPage = () => {
  const { farmId = "" } = useParams();
  const navigate = useNavigate();

  // Keep the shared selection in sync when cycles change here.
  const { refresh: refreshSelection } = useFarmSelection();

  const [farm, setFarm] = useState<Farm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Add crop cycle form ────────────────────────────────────────────────
  const [showCycleForm, setShowCycleForm] = useState(false);
  const [cycleSaving, setCycleSaving] = useState(false);
  const [cycleVariety, setCycleVariety] = useState("");
  const [cyclePlantingDate, setCyclePlantingDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [cycleHarvestDate, setCycleHarvestDate] = useState("");
  const [cycleArea, setCycleArea] = useState("");
  const [cycleError, setCycleError] = useState<string | null>(null);
  const [cycleFieldErrors, setCycleFieldErrors] = useState<FieldErrors>({});

  const [name, setName] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [barangay, setBarangay] = useState("");
  const [areaHectares, setAreaHectares] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const fieldErr = (f: string) => fieldErrors[f]?.[0];

  const hydrateForm = useCallback((f: Farm) => {
    setName(f.name);
    setMunicipality(f.municipality);
    setBarangay(f.barangay);
    setAreaHectares(String(Number(f.areaHectares)));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getFarmById(farmId);
      if (!data) {
        setError(true);
      } else {
        setFarm(data);
        hydrateForm(data);
      }
    } catch (err) {
      console.error("Failed to load farm:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [farmId, hydrateForm]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farm) return;
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const updated = await updateFarm(farm.id, {
        name: name.trim(),
        municipality: municipality.trim(),
        barangay: barangay.trim(),
        areaHectares: Number(areaHectares),
      });
      // Keep the crop cycles from the previous payload (PATCH returns the farm
      // without the nested cycles).
      setFarm({ ...updated, cropCycles: farm.cropCycles });
      setEditing(false);
      toast.success("Na-update ang sakahan!");
    } catch (err) {
      console.error("Update farm failed:", err);
      if (err instanceof ApiError) {
        setFormError(err.message || "Hindi na-update ang sakahan.");
        if (err.details && typeof err.details === "object") {
          setFieldErrors(err.details as FieldErrors);
        }
      } else {
        setFormError("Hindi na-update ang sakahan. Pakisubukan muli.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!farm) return;
    setDeleting(true);
    try {
      const { deletedCropCycles } = await deleteFarm(farm.id);
      toast.success("Natanggal ang sakahan", {
        description:
          deletedCropCycles > 0
            ? `Kasama ang ${deletedCropCycles} crop cycle.`
            : undefined,
      });
      navigate("/farmer/farms", { replace: true });
    } catch (err) {
      console.error("Delete farm failed:", err);
      const description =
        err instanceof ApiError
          ? err.message
          : "Pakisubukan muli o i-check ang koneksyon.";
      toast.error("Hindi natanggal ang sakahan", { description });
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const resetCycleForm = useCallback(() => {
    setCycleVariety("");
    setCyclePlantingDate(new Date().toISOString().split("T")[0]);
    setCycleHarvestDate("");
    setCycleArea("");
    setCycleError(null);
    setCycleFieldErrors({});
  }, []);

  const handleAddCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farm) return;
    setCycleSaving(true);
    setCycleError(null);
    setCycleFieldErrors({});
    try {
      await createCropCycle(farm.id, {
        cropType: "corn",
        variety: cycleVariety.trim() || undefined,
        plantingDate: cyclePlantingDate,
        expectedHarvestDate: cycleHarvestDate || undefined,
        areaHectares: Number(cycleArea),
      });

      // Re-fetch this farm's cycles so the list + remaining area update, and
      // refresh the shared selection so the cycle appears in every selector.
      const freshCycles = await listCropCycles(farm.id);
      setFarm((prev) => (prev ? { ...prev, cropCycles: freshCycles } : prev));
      void refreshSelection();

      toast.success("Naidagdag ang pananim!", {
        description: "Available na ito sa mga selector ng pananim.",
      });
      resetCycleForm();
      setShowCycleForm(false);
    } catch (err) {
      console.error("Create crop cycle failed:", err);
      if (err instanceof ApiError) {
        // The backend area-cap error carries { remainingHectares, ... } in
        // details; surface a clear message either way.
        const details = err.details as
          | { remainingHectares?: number }
          | undefined;
        const remaining =
          details && typeof details.remainingHectares === "number"
            ? ` May natitira pang ${details.remainingHectares.toFixed(2)} ektarya.`
            : "";
        setCycleError((err.message || "Hindi naidagdag ang pananim.") + remaining);
        if (
          err.details &&
          typeof err.details === "object" &&
          !("remainingHectares" in (err.details as object))
        ) {
          setCycleFieldErrors(err.details as FieldErrors);
        }
      } else {
        setCycleError("Hindi naidagdag ang pananim. Pakisubukan muli.");
      }
    } finally {
      setCycleSaving(false);
    }
  };

  const cycles: CropCycle[] = (farm?.cropCycles ?? []) as CropCycle[];

  // Remaining plantable area = farm area − sum of ACTIVE cycle areas.
  const farmArea = farm ? Number(farm.areaHectares) : 0;
  const activeArea = cycles
    .filter((c) => c.status === "ACTIVE")
    .reduce((sum, c) => sum + Number(c.areaHectares), 0);
  const remainingArea = Math.max(0, farmArea - activeArea);

  const cycleFieldErr = (f: string) => cycleFieldErrors[f]?.[0];

  return (
    <div className="w-full min-h-screen bg-slate-100 md:bg-slate-950 flex flex-col items-center p-0 md:p-6 lg:p-8 font-sans">
      <div className="w-full md:max-w-2xl bg-slate-50 text-slate-900 shadow-2xl flex flex-col md:rounded-[36px] md:border-2 md:border-emerald-800/40 min-h-screen relative pb-10">
        <header className="w-full bg-[#03543f] text-white px-5 sm:px-8 pt-5 pb-4 flex items-center gap-3 shadow-md">
          <button
            type="button"
            onClick={() => navigate("/farmer/farms")}
            aria-label="Bumalik"
            className="w-11 h-11 rounded-2xl bg-emerald-800/50 hover:bg-emerald-700 flex items-center justify-center shrink-0"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-black tracking-tight leading-tight truncate">
              {farm ? farm.name : "Detalye ng Sakahan"}
            </h1>
            <p className="text-xs sm:text-sm text-emerald-200/90 font-medium mt-0.5">
              Detalye ng sakahan
            </p>
          </div>
        </header>

        <main className="flex-1 px-5 sm:px-8 pt-6 space-y-5">
          {loading ? (
            <LoadingState label="Kinukuha ang sakahan..." />
          ) : error || !farm ? (
            <ErrorState
              message="Hindi makita ang sakahang ito. Maaaring natanggal na."
              onRetry={load}
            />
          ) : editing ? (
            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className={labelClass}>Pangalan ng Sakahan</label>
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
                {fieldErr("name") && <p className="mt-1 text-sm font-semibold text-red-600">{fieldErr("name")}</p>}
              </div>
              <div>
                <label className={labelClass}>Munisipyo</label>
                <input className={inputClass} value={municipality} onChange={(e) => setMunicipality(e.target.value)} required />
                {fieldErr("municipality") && <p className="mt-1 text-sm font-semibold text-red-600">{fieldErr("municipality")}</p>}
              </div>
              <div>
                <label className={labelClass}>Barangay</label>
                <input className={inputClass} value={barangay} onChange={(e) => setBarangay(e.target.value)} required />
                {fieldErr("barangay") && <p className="mt-1 text-sm font-semibold text-red-600">{fieldErr("barangay")}</p>}
              </div>
              <div>
                <label className={labelClass}>Laki (ektarya)</label>
                <input type="number" step="0.01" min="0" inputMode="decimal" className={inputClass} value={areaHectares} onChange={(e) => setAreaHectares(e.target.value)} required />
                {fieldErr("areaHectares") && <p className="mt-1 text-sm font-semibold text-red-600">{fieldErr("areaHectares")}</p>}
              </div>

              {formError && (
                <p className="rounded-2xl bg-red-50 border-2 border-red-100 px-4 py-3 text-sm font-semibold text-red-700">{formError}</p>
              )}

              <div className="flex flex-col gap-3">
                <button type="submit" disabled={saving} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-lg font-black text-white shadow-md transition-colors hover:bg-emerald-700 disabled:opacity-60">
                  <Save className="h-5 w-5" />
                  {saving ? "Isinasave..." : "I-save ang Pagbabago"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setFormError(null);
                    setFieldErrors({});
                    hydrateForm(farm);
                  }}
                  className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-slate-100 text-base font-bold text-slate-600 transition-colors hover:bg-slate-200"
                >
                  <X className="h-5 w-5" />
                  Kanselahin
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Summary card */}
              <div className="rounded-3xl border-2 border-slate-100 bg-white p-5 shadow-sm space-y-3">
                <p className="flex items-center gap-1.5 text-base font-medium text-slate-600">
                  <MapPin className="h-5 w-5 shrink-0 text-slate-400" />
                  {farm.barangay}, {farm.municipality}
                </p>
                <p className="flex items-center gap-1.5 text-base font-bold text-emerald-700">
                  <Sprout className="h-5 w-5" />
                  {farmArea.toFixed(2)} ektarya (kabuuan)
                </p>
                <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-3.5 py-2.5 text-sm">
                  <span className="font-semibold text-slate-600">Natitirang mataniman</span>
                  <span className="font-black text-emerald-700">
                    {remainingArea.toFixed(2)} / {farmArea.toFixed(2)} ha
                  </span>
                </div>
              </div>

              {/* Crop cycles */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">
                    Mga Pananim ({cycles.length})
                  </h2>
                  {!showCycleForm && (
                    <button
                      type="button"
                      onClick={() => setShowCycleForm(true)}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
                    >
                      <Plus className="h-4 w-4" />
                      Magdagdag
                    </button>
                  )}
                </div>

                {/* Add crop cycle form */}
                {showCycleForm && (
                  <form
                    onSubmit={handleAddCycle}
                    className="mb-3 rounded-3xl border-2 border-emerald-100 bg-emerald-50/40 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black text-emerald-800">
                        Bagong Pananim (Crop Cycle)
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCycleForm(false);
                          resetCycleForm();
                        }}
                        className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-slate-500 hover:bg-slate-100"
                        aria-label="Isara"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700">
                        Uri / Variety (hal. Hybrid, IPB Var 6)
                      </label>
                      <input
                        className={inputClass}
                        value={cycleVariety}
                        onChange={(e) => setCycleVariety(e.target.value)}
                        placeholder="Opsyonal — default: Mais"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700">
                        Petsa ng Pagtatanim
                      </label>
                      <input
                        type="date"
                        className={inputClass}
                        value={cyclePlantingDate}
                        max={new Date().toISOString().split("T")[0]}
                        onChange={(e) => setCyclePlantingDate(e.target.value)}
                        required
                      />
                      {cycleFieldErr("plantingDate") && (
                        <p className="mt-1 text-sm font-semibold text-red-600">
                          {cycleFieldErr("plantingDate")}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700">
                        Inaasahang Petsa ng Ani (opsyonal)
                      </label>
                      <input
                        type="date"
                        className={inputClass}
                        value={cycleHarvestDate}
                        onChange={(e) => setCycleHarvestDate(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700">
                        Laki ng Taniman (ektarya)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        inputMode="decimal"
                        className={inputClass}
                        value={cycleArea}
                        onChange={(e) => setCycleArea(e.target.value)}
                        required
                        placeholder={`Hal. 1.5 — natitira: ${remainingArea.toFixed(2)} ha`}
                      />
                      {cycleFieldErr("areaHectares") && (
                        <p className="mt-1 text-sm font-semibold text-red-600">
                          {cycleFieldErr("areaHectares")}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] font-medium text-slate-500">
                        Natitirang mataniman: {remainingArea.toFixed(2)} ha sa {farmArea.toFixed(2)} ha
                      </p>
                    </div>

                    {cycleError && (
                      <p className="rounded-2xl bg-red-50 border-2 border-red-100 px-4 py-3 text-sm font-semibold text-red-700">
                        {cycleError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={cycleSaving}
                      className="inline-flex w-full min-h-13 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-black text-white shadow-md transition-colors hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <Plus className="h-5 w-5" />
                      {cycleSaving ? "Idinadagdag..." : "Idagdag ang Pananim"}
                    </button>
                  </form>
                )}

                {cycles.length === 0 ? (
                  <p className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-medium text-slate-500">
                    Wala pang pananim sa sakahang ito. Magdagdag ng isa para
                    makapagtala ng gawain at obserbasyon.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {cycles.map((c) => (
                      <li key={c.id} className="rounded-2xl border-2 border-slate-100 bg-white p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 capitalize">{c.variety || c.cropType || "Mais"}</p>
                          <p className="flex items-center gap-2 text-xs font-medium text-slate-500 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {new Date(c.plantingDate).toLocaleDateString("fil-PH")}
                            </span>
                            <span className="flex items-center gap-1 text-emerald-700 font-bold">
                              <Sprout className="h-3.5 w-3.5" />
                              {Number(c.areaHectares).toFixed(2)} ha
                            </span>
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${STATUS_STYLE[c.status]}`}>
                          {STATUS_LABEL[c.status]}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-black text-white shadow-md transition-colors hover:bg-emerald-700"
                >
                  <Pencil className="h-5 w-5" />
                  I-edit ang Sakahan
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl border-2 border-red-200 bg-red-50 text-base font-bold text-red-700 transition-colors hover:bg-red-100"
                >
                  <Trash2 className="h-5 w-5" />
                  Tanggalin ang Sakahan
                </button>
              </div>
            </>
          )}
        </main>

        {/* Delete confirmation */}
        {confirmDelete && farm && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                  <Trash2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Tanggalin ang sakahan?</h3>
                  <p className="text-sm font-medium text-slate-500">Hindi na ito maibabalik.</p>
                </div>
              </div>
              <p className="text-sm font-medium text-slate-600">
                Matatanggal din ang lahat ng pananim (crop cycles) na nakatala sa{" "}
                <span className="font-bold">{farm.name}</span>.
              </p>
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-red-600 text-base font-black text-white transition-colors hover:bg-red-700 disabled:opacity-60"
                >
                  <Trash2 className="h-5 w-5" />
                  {deleting ? "Tinatanggal..." : "Oo, tanggalin"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-100 text-base font-bold text-slate-600 transition-colors hover:bg-slate-200"
                >
                  Huwag na
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FarmDetailsPage;
