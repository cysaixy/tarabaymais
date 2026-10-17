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
} from "lucide-react";
import {
  getFarmById,
  updateFarm,
  deleteFarm,
  type Farm,
  type CropCycle,
} from "../../services/farm.service";
import { ApiError } from "../../lib/api";
import { LoadingState } from "../../components/LoadingState";
import { ErrorState } from "../../components/ErrorState";

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

  const [farm, setFarm] = useState<Farm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const cycles: CropCycle[] = (farm?.cropCycles ?? []) as CropCycle[];

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
                  {Number(farm.areaHectares).toFixed(2)} ektarya
                </p>
              </div>

              {/* Crop cycles */}
              <div>
                <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-slate-500">
                  Mga Pananim ({cycles.length})
                </h2>
                {cycles.length === 0 ? (
                  <p className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-medium text-slate-500">
                    Wala pang pananim sa sakahang ito.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {cycles.map((c) => (
                      <li key={c.id} className="rounded-2xl border-2 border-slate-100 bg-white p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 capitalize">{c.variety || c.cropType || "Mais"}</p>
                          <p className="flex items-center gap-1 text-xs font-medium text-slate-500 mt-0.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(c.plantingDate).toLocaleDateString("fil-PH")}
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
