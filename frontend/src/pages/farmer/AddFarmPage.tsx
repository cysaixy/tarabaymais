import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../lib/api";
import { createFarm } from "../../services/farm.service";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500";

const labelClass = "mb-1 block text-xs font-medium text-slate-400";

interface FieldErrors {
  [key: string]: string[] | undefined;
}

const AddFarmPage = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [name, setName] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [barangay, setBarangay] = useState("");
  const [areaHectares, setAreaHectares] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      await createFarm({
        name: name.trim(),
        municipality: municipality.trim(),
        barangay: barangay.trim(),
        areaHectares: Number(areaHectares),
        latitude: latitude.trim() === "" ? null : Number(latitude),
        longitude: longitude.trim() === "" ? null : Number(longitude),
      });
      navigate("/farmer/farms", { replace: true });
    } catch (err) {
      console.error("Create farm failed:", err);
      if (err instanceof ApiError) {
        setError(err.message || "Failed to register farm.");
        if (err.details && typeof err.details === "object") {
          setFieldErrors(err.details as FieldErrors);
        }
      } else {
        setError("Failed to register farm. Please try again.");
      }
      setSubmitting(false);
    }
  };

  const err = (field: string) => fieldErrors[field]?.[0];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-wide text-teal-400">
          Farmer
        </p>
        <h1 className="mt-1 text-3xl font-bold text-white">Register a Farm</h1>
        <p className="mt-2 text-slate-400">
          Add a new farm to your account so you can track crops and request
          support.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-xl border border-slate-800 bg-slate-900/60 p-6"
      >
        <div>
          <label className={labelClass}>Farm name</label>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. North Rice Field"
          />
          {err("name") && (
            <p className="mt-1 text-xs text-red-400">{err("name")}</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Municipality</label>
            <input
              className={inputClass}
              value={municipality}
              onChange={(e) => setMunicipality(e.target.value)}
              required
            />
            {err("municipality") && (
              <p className="mt-1 text-xs text-red-400">{err("municipality")}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Barangay</label>
            <input
              className={inputClass}
              value={barangay}
              onChange={(e) => setBarangay(e.target.value)}
              required
            />
            {err("barangay") && (
              <p className="mt-1 text-xs text-red-400">{err("barangay")}</p>
            )}
          </div>
        </div>

        <div>
          <label className={labelClass}>Area (hectares)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className={inputClass}
            value={areaHectares}
            onChange={(e) => setAreaHectares(e.target.value)}
            required
            placeholder="e.g. 2.5"
          />
          {err("areaHectares") && (
            <p className="mt-1 text-xs text-red-400">{err("areaHectares")}</p>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Location (optional)
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Latitude</label>
              <input
                type="number"
                step="any"
                className={inputClass}
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="e.g. 14.5995"
              />
              {err("latitude") && (
                <p className="mt-1 text-xs text-red-400">{err("latitude")}</p>
              )}
            </div>
            <div>
              <label className={labelClass}>Longitude</label>
              <input
                type="number"
                step="any"
                className={inputClass}
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="e.g. 120.9842"
              />
              {err("longitude") && (
                <p className="mt-1 text-xs text-red-400">{err("longitude")}</p>
              )}
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-teal-500 px-5 py-2.5 font-medium text-slate-950 transition hover:bg-teal-400 disabled:opacity-60"
          >
            {submitting ? "Registering..." : "Register farm"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/farmer/farms")}
            className="rounded-lg bg-slate-800 px-5 py-2.5 font-medium text-slate-200 transition hover:bg-slate-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
};

export default AddFarmPage;
