import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChevronLeft, Save } from "lucide-react";
import { ApiError } from "../../lib/api";
import { createFarm } from "../../services/farm.service";
import {
  CAGAYAN_LOCATION_DATA,
  CAGAYAN_MUNICIPALITIES,
} from "../../data/cagayanLocations";

interface FieldErrors {
  [key: string]: string[] | undefined;
}

const labelClass = "mb-1.5 block text-sm font-bold text-slate-700";
const inputClass =
  "w-full min-h-[52px] rounded-2xl border-2 border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";

const AddFarmPage = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [name, setName] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [barangay, setBarangay] = useState("");
  const [areaHectares, setAreaHectares] = useState("");

  const availableBarangays = useMemo(() => {
    return municipality ? CAGAYAN_LOCATION_DATA[municipality] || [] : [];
  }, [municipality]);

  const err = (field: string) => fieldErrors[field]?.[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      await createFarm({
        name: name.trim(),
        municipality: municipality.trim(),
        barangay: barangay.trim(),
        areaHectares: Number(areaHectares),
      });
      toast.success("Naidagdag ang sakahan!", {
        description: `Matagumpay na nairehistro ang ${name.trim()}.`,
      });
      navigate("/farmer/farms", { replace: true });
    } catch (err) {
      console.error("Create farm failed:", err);
      if (err instanceof ApiError) {
        setError(err.message || "Hindi naidagdag ang sakahan.");
        if (err.details && typeof err.details === "object") {
          setFieldErrors(err.details as FieldErrors);
        }
      } else {
        setError("Hindi naidagdag ang sakahan. Pakisubukan muli.");
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-100 md:bg-slate-950 flex flex-col items-center p-0 md:p-6 lg:p-8 font-sans">
      <div className="w-full md:max-w-xl bg-slate-50 text-slate-900 shadow-2xl flex flex-col md:rounded-[36px] md:border-2 md:border-emerald-800/40 min-h-screen relative pb-10">
        <header className="w-full bg-[#03543f] text-white px-5 sm:px-8 pt-5 pb-4 flex items-center gap-3 shadow-md">
          <button
            type="button"
            onClick={() => navigate("/farmer/farms")}
            aria-label="Bumalik"
            className="w-11 h-11 rounded-2xl bg-emerald-800/50 hover:bg-emerald-700 flex items-center justify-center shrink-0"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-lg sm:text-2xl font-black tracking-tight leading-tight">
              Magdagdag ng Sakahan
            </h1>
            <p className="text-xs sm:text-sm text-emerald-200/90 font-medium mt-0.5">
              Irehistro ang bagong sakahan
            </p>
          </div>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex-1 px-5 sm:px-8 pt-6 space-y-5"
        >
          <div>
            <label className={labelClass}>Pangalan ng Sakahan</label>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Hal. Sakahan sa Hilaga"
            />
            {err("name") && (
              <p className="mt-1 text-sm font-semibold text-red-600">
                {err("name")}
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>Munisipyo</label>
            <select
              className={inputClass}
              value={municipality}
              onChange={(e) => {
                setMunicipality(e.target.value);
                setBarangay("");
              }}
              required
            >
              <option value="" disabled>
                Pumili ng Munisipyo
              </option>
              {CAGAYAN_MUNICIPALITIES.map((mun) => (
                <option key={mun} value={mun}>
                  {mun}
                </option>
              ))}
            </select>
            {err("municipality") && (
              <p className="mt-1 text-sm font-semibold text-red-600">
                {err("municipality")}
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>Barangay</label>
            <select
              className={inputClass}
              value={barangay}
              onChange={(e) => setBarangay(e.target.value)}
              required
              disabled={!municipality}
            >
              <option value="" disabled>
                {municipality
                  ? "Pumili ng Barangay"
                  : "Pumili muna ng Munisipyo"}
              </option>
              {availableBarangays.map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
            {err("barangay") && (
              <p className="mt-1 text-sm font-semibold text-red-600">
                {err("barangay")}
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>Laki (ektarya)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              className={inputClass}
              value={areaHectares}
              onChange={(e) => setAreaHectares(e.target.value)}
              required
              placeholder="Hal. 2.5"
            />
            {err("areaHectares") && (
              <p className="mt-1 text-sm font-semibold text-red-600">
                {err("areaHectares")}
              </p>
            )}
          </div>

          {error && (
            <p className="rounded-2xl bg-red-50 border-2 border-red-100 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-lg font-black text-white shadow-md transition-colors hover:bg-emerald-700 disabled:opacity-60"
            >
              <Save className="h-5 w-5" />
              {submitting ? "Isinasave..." : "I-save ang Sakahan"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/farmer/farms")}
              className="inline-flex min-h-13 items-center justify-center rounded-2xl bg-slate-100 text-base font-bold text-slate-600 transition-colors hover:bg-slate-200"
            >
              Kanselahin
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddFarmPage;
