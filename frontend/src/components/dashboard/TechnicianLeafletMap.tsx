import React, { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, useMap, CircleMarker, Popup, Tooltip } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import { MapPin } from "lucide-react";
import { registeredLocationKey } from "../../data/cagayanBarangays";

export type MapLayerType = "TANIMAN" | "PINSALA" | "KONSULTASYON";

export interface FarmMarkerData {
  id: string;
  name: string;
  barangay: string;
  municipality: string;
  hectares: number;
  growthStage?: string | null;
  healthStatus?: "healthy" | "watch" | "critical" | string;
  latitude: number;
  longitude: number;
  noGps?: boolean;
  damageType?: string;
  openCases?: number;
}

const CAGAYAN_DEFAULT: [number, number] = [17.9, 121.65];

// ── Controllers ───────────────────────────────────────────────────────────────

interface MapFocusControllerProps {
  targetCoords: [number, number] | null;
  focusTrigger: number;
}

function MapFocusController({ targetCoords, focusTrigger }: MapFocusControllerProps) {
  const map = useMap();
  const lastTriggerRef = useRef(focusTrigger);

  useEffect(() => {
    if (focusTrigger > 0 && focusTrigger !== lastTriggerRef.current && targetCoords) {
      lastTriggerRef.current = focusTrigger;
      map.flyTo(targetCoords, 14, { duration: 1.2 });
    }
  }, [focusTrigger, targetCoords, map]);

  return null;
}

interface MapFitBoundsProps {
  bounds: LatLngBoundsExpression | null;
}

/** Fits the map to show all farm markers on first load */
function MapFitBounds({ bounds }: MapFitBoundsProps) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (bounds && !fitted.current) {
      fitted.current = true;
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 });
    }
  }, [bounds, map]);

  return null;
}

// ── Main component ─────────────────────────────────────────────────────────────

interface TechnicianLeafletMapProps {
  selectedLocationKey: string;
  onSelectLocation: (locationKey: string) => void;
  farms?: FarmMarkerData[];
  /** Map of barangay name (lowercase) → farm count, used to colour markers */
  barangayFarmCounts?: Record<string, number>;
  focusTrigger?: number;
  className?: string;
}

export const TechnicianLeafletMap: React.FC<TechnicianLeafletMapProps> = ({
  selectedLocationKey,
  onSelectLocation,
  farms = [],
  barangayFarmCounts = {},
  focusTrigger = 0,
  className = "",
}) => {
  // ── Compute barangay aggregate markers from actual farm data ─────────────
  // Groups all farms by barangay, computes centroid, works for ANY municipality.
  const barangayGroups = useMemo(() => {
    const groups: Record<
      string,
      { key: string; name: string; municipality: string; lat: number; lng: number; count: number }
    > = {};

    for (const farm of farms) {
      const key = registeredLocationKey(farm.municipality, farm.barangay);
      if (!groups[key]) {
        groups[key] = {
          key,
          name: farm.barangay,
          municipality: farm.municipality,
          lat: farm.latitude,
          lng: farm.longitude,
          count: 0,
        };
      }
      // Running average of coordinates
      const g = groups[key];
      g.lat = (g.lat * g.count + farm.latitude) / (g.count + 1);
      g.lng = (g.lng * g.count + farm.longitude) / (g.count + 1);
      g.count++;
    }

    return Object.values(groups);
  }, [farms]);

  // ── Derive target coords for focus / flyTo ───────────────────────────────
  const selectedLocation = useMemo(() => {
    const bg = barangayGroups.find((g) => g.key === selectedLocationKey);
    if (bg) return [bg.lat, bg.lng] as [number, number];

    const farm = farms.find(
      (f) =>
        registeredLocationKey(f.municipality, f.barangay) ===
        selectedLocationKey,
    );
    if (farm) return [farm.latitude, farm.longitude] as [number, number];

    return null;
  }, [selectedLocationKey, barangayGroups, farms]);

  // ── Compute map bounds to auto-fit all markers ───────────────────────────
  const mapBounds = useMemo((): LatLngBoundsExpression | null => {
    if (farms.length === 0) return null;
    const lats = farms.map((f) => f.latitude);
    const lngs = farms.map((f) => f.longitude);
    return [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ];
  }, [farms]);

  // ── Derive display label ─────────────────────────────────────────────────
  const locationLabel = useMemo(() => {
    if (farms.length === 0) return "Cagayan";
    const municipalities = [...new Set(farms.map((f) => f.municipality).filter(Boolean))];
    if (municipalities.length === 1) return municipalities[0];
    if (municipalities.length <= 3) return municipalities.join(", ");
    return `${municipalities.length} munisipalidad`;
  }, [farms]);

  return (
    <div className={`relative w-full h-full rounded-2xl overflow-hidden border border-slate-200/90 shadow-2xs ${className}`}>
      <MapContainer
        center={CAGAYAN_DEFAULT}
        zoom={10}
        scrollWheelZoom={true}
        className="w-full h-full min-h-[340px] z-10"
      >
        {/* Auto-fit to farm locations on first load */}
        <MapFitBounds bounds={mapBounds} />

        {/* Fly-to on "Ipakita" button press */}
        <MapFocusController targetCoords={selectedLocation} focusTrigger={focusTrigger} />

        {/* OpenStreetMap tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* ── BARANGAY AGGREGATE MARKERS (derived from real farm data) ── */}
        {barangayGroups.map((b) => {
          const isSelected = b.key === selectedLocationKey;
          const farmCount = barangayFarmCounts[b.key] ?? b.count;

          const markerColor = isSelected ? "#065F46" : "#10B981";
          const strokeColor = isSelected ? "#FBBF24" : "#FFFFFF";

          return (
            <React.Fragment key={b.key}>
              {isSelected && (
                <CircleMarker
                  center={[b.lat, b.lng]}
                  radius={18}
                  pathOptions={{
                    color: "#FBBF24",
                    fillColor: "#FBBF24",
                    fillOpacity: 0.2,
                    weight: 2,
                  }}
                />
              )}
              <CircleMarker
                center={[b.lat, b.lng]}
                radius={isSelected ? 12 : 9}
                eventHandlers={{ click: () => onSelectLocation(b.key) }}
                pathOptions={{
                  color: strokeColor,
                  fillColor: markerColor,
                  fillOpacity: 0.95,
                  weight: isSelected ? 2.5 : 1.5,
                }}
              >
                <Tooltip direction="top" offset={[0, -8]} opacity={0.97}>
                  <div className="text-xs">
                    <p className="font-bold text-slate-900">{b.name}</p>
                    <p className="text-emerald-600 font-semibold">
                      {farmCount} sakahan · {b.municipality}
                    </p>
                  </div>
                </Tooltip>
                <Popup>
                  <div className="p-1 space-y-1 text-xs">
                    <p className="font-bold text-sm text-slate-900">{b.name}</p>
                    <p className="text-slate-500">{b.municipality}, Cagayan</p>
                    <p className="text-emerald-700 font-semibold">
                      ✓ {farmCount} rehistradong sakahan
                    </p>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => onSelectLocation(b.key)}
                        className="rounded-lg bg-[#065F46] text-white px-2.5 py-1 text-xs font-bold shadow-xs hover:bg-emerald-800 transition"
                      >
                        Piliin ang Barangay
                      </button>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            </React.Fragment>
          );
        })}

        {/* ── INDIVIDUAL FARM PINS ── */}
        {farms.map((f) => {
          const locationKey = registeredLocationKey(
            f.municipality,
            f.barangay,
          );
          const isSelected = locationKey === selectedLocationKey;
          const noGps = f.noGps === true;

          const farmColor =
            f.healthStatus === "critical"
              ? "#DC2626"
              : f.healthStatus === "watch"
              ? "#D97706"
              : "#059669";

          return (
            <CircleMarker
              key={f.id}
              center={[f.latitude, f.longitude]}
              radius={noGps ? 6 : 7}
              eventHandlers={{ click: () => onSelectLocation(locationKey) }}
              pathOptions={{
                color: isSelected ? "#FBBF24" : noGps ? farmColor : "#FFFFFF",
                fillColor: farmColor,
                fillOpacity: noGps ? 0.55 : 0.95,
                weight: isSelected ? 3 : noGps ? 1 : 1.5,
                dashArray: noGps ? "4 3" : undefined,
              }}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                <div className="text-xs">
                  <p className="font-bold text-slate-900">{f.name}</p>
                  <p className="text-slate-600">{f.hectares} ha · {f.barangay}, {f.municipality}</p>
                  {noGps && (
                    <p className="text-amber-600 text-[10px]">⚠ Tinatayang lokasyon (walang GPS)</p>
                  )}
                </div>
              </Tooltip>
              <Popup>
                <div className="p-1.5 space-y-1.5 text-xs min-w-[190px]">
                  <div className="border-b border-slate-100 pb-1">
                    <p className="font-black text-sm text-slate-900">{f.name}</p>
                    <p className="text-[11px] text-slate-500">{f.barangay}, {f.municipality}</p>
                    {noGps && (
                      <p className="text-[10px] text-amber-600 font-medium mt-0.5">
                        ⚠ Walang exact na GPS — ipinapakita sa gitna ng barangay
                      </p>
                    )}
                  </div>
                  <div className="space-y-0.5 text-slate-700">
                    <p><span className="font-semibold">Sukat:</span> {f.hectares} ha</p>
                    <p><span className="font-semibold">Yugto:</span> {f.growthStage || "Maisan"}</p>
                    <p>
                      <span className="font-semibold">Kalusugan:</span>{" "}
                      <span className="font-bold capitalize" style={{ color: farmColor }}>
                        {f.healthStatus || "Malusog"}
                      </span>
                    </p>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Location label */}
      <div className="absolute top-3 left-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 shadow-2xs border border-slate-200 text-xs font-semibold text-slate-800 backdrop-blur-xs">
        <MapPin className="h-3.5 w-3.5 text-emerald-700" />
        <span>{locationLabel}</span>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 z-20 rounded-xl bg-white/95 p-2.5 shadow-2xs border border-slate-200 text-[11px] text-slate-700 backdrop-blur-xs space-y-1">
        <p className="font-bold text-[10px] text-slate-400 uppercase tracking-widest pb-0.5">Mapa</p>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#10B981] border border-white shadow-xs" />
          <span className="font-medium">Barangay (may sakahan)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#059669] border-2 border-white" />
          <span>Individual na sakahan</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#065F46] ring-1 ring-[#FBBF24]" />
          <span>Napiling barangay</span>
        </div>
      </div>
    </div>
  );
};
