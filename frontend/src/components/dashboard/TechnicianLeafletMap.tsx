import React, { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, useMap, CircleMarker, Popup, Tooltip } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import { MapPin, AlertTriangle, CheckCircle2 } from "lucide-react";
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
  damagePercentage?: number;
  damageStatus?: string;
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
      {
        key: string;
        name: string;
        municipality: string;
        lat: number;
        lng: number;
        count: number;
        hasCritical: boolean;
        hasWatch: boolean;
        criticalCount: number;
        watchCount: number;
      }
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
          hasCritical: false,
          hasWatch: false,
          criticalCount: 0,
          watchCount: 0,
        };
      }
      // Running average of coordinates
      const g = groups[key];
      g.lat = (g.lat * g.count + farm.latitude) / (g.count + 1);
      g.lng = (g.lng * g.count + farm.longitude) / (g.count + 1);
      g.count++;
      if (farm.healthStatus === "critical") {
        g.hasCritical = true;
        g.criticalCount++;
      } else if (farm.healthStatus === "watch" || farm.healthStatus === "sinusuri") {
        g.hasWatch = true;
        g.watchCount++;
      }
    }

    return Object.values(groups);
  }, [farms]);

  // Displace co-located farms (e.g. without GPS) so each pin is separately clickable
  const positionedFarms = useMemo(() => {
    const coordCounts: Record<string, number> = {};
    const coordIndices: Record<string, number> = {};

    farms.forEach((f) => {
      const coordKey = `${f.latitude.toFixed(4)},${f.longitude.toFixed(4)}`;
      coordCounts[coordKey] = (coordCounts[coordKey] || 0) + 1;
    });

    return farms.map((f) => {
      const coordKey = `${f.latitude.toFixed(4)},${f.longitude.toFixed(4)}`;
      const totalAtCoord = coordCounts[coordKey] || 1;

      if (totalAtCoord <= 1) return f;

      const idx = coordIndices[coordKey] || 0;
      coordIndices[coordKey] = idx + 1;

      // Gentle radial spread (~160m) so pins do not completely overlap
      const angle = (idx / totalAtCoord) * 2 * Math.PI;
      const radiusDeg = 0.0018;
      const latOffset = Math.sin(angle) * radiusDeg;
      const lngOffset = Math.cos(angle) * radiusDeg;

      return {
        ...f,
        latitude: f.latitude + latOffset,
        longitude: f.longitude + lngOffset,
      };
    });
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

          const markerColor = b.hasCritical
            ? "#DC2626"
            : b.hasWatch
            ? "#F97316"
            : isSelected
            ? "#065F46"
            : "#10B981";
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
                radius={isSelected ? 13 : 10}
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
                    <p className="text-emerald-700 font-semibold">
                      {farmCount} sakahan · {b.municipality}
                    </p>
                    {b.hasCritical && (
                      <p className="text-red-600 font-bold text-[10px] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600 inline-block" />
                        <span>{b.criticalCount} may kritikal na pinsala</span>
                      </p>
                    )}
                    {!b.hasCritical && b.hasWatch && (
                      <p className="text-orange-600 font-bold text-[10px] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
                        <span>{b.watchCount} sinusuri ang ulat</span>
                      </p>
                    )}
                  </div>
                </Tooltip>
                <Popup>
                  <div className="p-1.5 space-y-1 text-xs">
                    <p className="font-bold text-sm text-slate-900">{b.name}</p>
                    <p className="text-slate-500">{b.municipality}, Cagayan</p>
                    <p className="text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{farmCount} rehistradong sakahan</span>
                    </p>
                    {b.hasCritical && (
                      <p className="text-red-600 font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-600 inline-block shrink-0" />
                        <span>May {b.criticalCount} sakahan na may kritikal na pinsala</span>
                      </p>
                    )}
                    {b.hasWatch && !b.hasCritical && (
                      <p className="text-orange-600 font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-orange-500 inline-block shrink-0" />
                        <span>May {b.watchCount} sakahan na sinusuri ang ulat</span>
                      </p>
                    )}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => onSelectLocation(b.key)}
                        className="rounded-lg bg-[#065F46] text-white px-2.5 py-1 text-xs font-bold shadow-xs hover:bg-emerald-800 transition cursor-pointer"
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
        {positionedFarms.map((f) => {
          const locationKey = registeredLocationKey(
            f.municipality,
            f.barangay,
          );
          const isSelected = locationKey === selectedLocationKey;
          const noGps = f.noGps === true;

          const isCritical = f.healthStatus === "critical";
          const isWatch = f.healthStatus === "watch" || f.healthStatus === "sinusuri";
          const farmColor = isCritical ? "#DC2626" : isWatch ? "#F97316" : "#059669";

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
                  {isCritical && (
                    <p className="text-red-600 font-bold text-[10px] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-600 inline-block shrink-0" />
                      <span>Kritikal na Pinsala{f.damagePercentage ? ` (${f.damagePercentage}%)` : ""}</span>
                    </p>
                  )}
                  {!isCritical && isWatch && (
                    <p className="text-orange-600 font-bold text-[10px] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block shrink-0" />
                      <span>Sinusuri ang Ulat</span>
                    </p>
                  )}
                  {noGps && (
                    <p className="text-amber-600 text-[10px] flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                      <span>Tinatayang lokasyon (walang GPS)</span>
                    </p>
                  )}
                </div>
              </Tooltip>
              <Popup>
                <div className="p-1.5 space-y-1.5 text-xs min-w-[200px]">
                  <div className="border-b border-slate-100 pb-1">
                    <p className="font-black text-sm text-slate-900">{f.name}</p>
                    <p className="text-[11px] text-slate-500">{f.barangay}, {f.municipality}</p>
                    {noGps && (
                      <p className="text-[10px] text-amber-600 font-medium mt-0.5 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                        <span>Walang exact na GPS &mdash; ipinapakita sa gitna ng barangay</span>
                      </p>
                    )}
                  </div>
                  <div className="space-y-0.5 text-slate-700">
                    <p><span className="font-semibold">Sukat:</span> {f.hectares} ha</p>
                    <p><span className="font-semibold">Yugto:</span> {f.growthStage || "Maisan"}</p>
                    <p>
                      <span className="font-semibold">Kalagayan:</span>{" "}
                      <span className="font-bold capitalize" style={{ color: farmColor }}>
                        {isCritical
                          ? "Kritikal na Pinsala"
                          : isWatch
                            ? "Sinusuri ang Ulat"
                            : "Malusog"}
                      </span>
                    </p>
                    {f.damageType && (
                      <p>
                        <span className="font-semibold">Ulat ng Pinsala:</span>{" "}
                        <span className="font-semibold text-slate-900">
                          {f.damageType}
                          {f.damagePercentage ? ` (${f.damagePercentage}% sira)` : ""}
                        </span>
                      </p>
                    )}
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
          <span className="h-2.5 w-2.5 rounded-full bg-[#059669] border border-white shadow-xs" />
          <span className="font-medium">Malusog / Walang Pinsala</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#F97316] border border-white shadow-xs" />
          <span className="font-medium">Sinusuri ang Ulat (Orange)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#DC2626] border border-white shadow-xs" />
          <span className="font-medium">Kritikal na Pinsala (Pula)</span>
        </div>
        <div className="flex items-center gap-2 pt-0.5 border-t border-slate-100">
          <span className="h-2.5 w-2.5 rounded-full bg-[#10B981] border border-white shadow-xs" />
          <span>Barangay Centro</span>
        </div>
      </div>
    </div>
  );
};
