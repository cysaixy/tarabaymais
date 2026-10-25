import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChevronLeft, Save, MapPin, RefreshCw } from "lucide-react";
import { ApiError } from "../../lib/api";
import { createFarm } from "../../services/farm.service";
import { queueOfflineAction } from "../../services/sync.service";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import {
  CAGAYAN_LOCATION_DATA,
  CAGAYAN_MUNICIPALITIES,
} from "../../data/cagayanLocations";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

interface FieldErrors {
  [key: string]: string[] | undefined;
}

const labelClass = "mb-1.5 block text-sm font-bold text-slate-700";
const inputClass =
  "w-full min-h-[52px] rounded-2xl border-2 border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";

// Approximate center of Cagayan Valley
const CAGAYAN_CENTER: [number, number] = [17.6137, 121.7271];

/** Mini-map that lets the farmer drag a pin to set coordinates. */
function LocationPicker({
  value,
  onChange,
}: {
  value: { latitude: number; longitude: number } | null;
  onChange: (v: { latitude: number; longitude: number }) => void;
}) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  return (
    <div className="w-full min-h-50 rounded-2xl border-2 border-slate-200 bg-white overflow-hidden">
      <MapContainer
        center={value ? [value.latitude, value.longitude] : CAGAYAN_CENTER}
        zoom={value ? 13 : 10}
        className="w-full h-full"
      >
        <LocationMapController
          mapRef={mapRef}
          markerRef={markerRef}
          value={value}
          onChange={onChange}
        />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
      </MapContainer>
    </div>
  );
}

function LocationMapController({
  mapRef,
  markerRef,
  value,
  onChange,
}: {
  mapRef: React.MutableRefObject<L.Map | null>;
  markerRef: React.MutableRefObject<L.Marker | null>;
  value: { latitude: number; longitude: number } | null;
  onChange: (value: { latitude: number; longitude: number }) => void;
}) {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;

    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      if (mapRef.current === map) mapRef.current = null;
    };
  }, [map, mapRef, markerRef]);

  useEffect(() => {
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      map.setView(CAGAYAN_CENTER, 10);
      return;
    }

    const position: L.LatLngExpression = [value.latitude, value.longitude];
    if (markerRef.current) {
      markerRef.current.setLatLng(position);
    } else {
      const marker = L.marker(position, { draggable: true });
      marker.on("dragend", () => {
        const currentPosition = marker.getLatLng();
        onChange({
          latitude: currentPosition.lat,
          longitude: currentPosition.lng,
        });
      });
      marker.addTo(map);
      markerRef.current = marker;
    }
    map.setView(position, 13);
  }, [map, markerRef, onChange, value]);

  return null;
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
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locating, setLocating] = useState(false);
  const isOffline = useNetworkStatus();

  const availableBarangays = useMemo(() => {
    return municipality ? CAGAYAN_LOCATION_DATA[municipality] || [] : [];
  }, [municipality]);

  const err = (field: string) => fieldErrors[field]?.[0];

  const handleUseMyLocation = async () => {
    if (!navigator.geolocation) {
      toast.error("Hindi available ang Geolocation sa browser na ito.");
      return;
    }
    setLocating(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation!.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });
      setLocation({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      toast.success("Lokasyon na-set mula sa GPS.");
    } catch {
      toast.error("Hindi makuha ang GPS lokasyon. Maaari pumindot sa mapa.");
    } finally {
      setLocating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    const payload = {
      name: name.trim(),
      municipality: municipality.trim(),
      barangay: barangay.trim(),
      areaHectares: Number(areaHectares),
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
    };

    // When offline, queue for later sync instead of calling the API directly.
    if (isOffline) {
      try {
        await queueOfflineAction({
          actionType: "CREATE_FARM",
          payload,
          displayTitle: "I-rehistro ang Sakahan",
        });
        toast.success("Na-queue ang sakahan para sa i-sync.", {
          description: "I-i-sync ang sakahan kapag bumalik ang koneksyon.",
        });
        navigate("/farmer/farms", { replace: true });
      } catch {
        toast.error("Hindi ma-queue ang sakahan. Subukan muli.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    try {
      await createFarm(payload);
      toast.success("Naidagdag ang sakahan!", {
        description: `Matagumpay na nairehistro ${name.trim()}.`,
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

          {/* Location capture (optional) */}
          <div>
            <label className={labelClass}>Lokasyon (Opsyonal)</label>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={locating}
                className={`flex w-full items-center justify-center gap-2 min-h-13 rounded-xl border-2 ${
                  locating
                    ? "border-dashed border-slate-300 bg-slate-100 text-slate-500"
                    : "border-emerald-500 bg-emerald-50 text-emerald-700"
                } px-4 text-base font-semibold transition hover:bg-emerald-100 disabled:opacity-60 cursor-pointer`}
              >
                <MapPin className="h-5 w-5" aria-hidden="true" />
                {locating
                  ? "Naghahanap ng GPS..."
                  : "Gamitin ang aking Lokasyon"}
              </button>
              {location && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2">
                  <MapPin
                    className="h-4 w-4 text-emerald-600"
                    aria-hidden="true"
                  />
                  <span className="text-sm text-emerald-700">
                    GPS: {location.latitude.toFixed(4)},{" "}
                    {location.longitude.toFixed(4)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLocation(null)}
                    className="text-emerald-500 hover:text-emerald-700"
                    aria-label="Alisin ang lokasyon"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              )}
              <LocationPicker value={location} onChange={setLocation} />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Opsyonal na lokasyon para sa mapa ng opisyal. Maaari ring pumindot
              sa mapa upang itakda ang pin.
            </p>
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
