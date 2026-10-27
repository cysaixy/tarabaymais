import React, { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, useMap, CircleMarker, Popup, Tooltip } from "react-leaflet";
import { MapPin } from "lucide-react";

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
  hasDamage?: boolean;
  damageType?: string;
  openCases?: number;
}

// ── Official Barangays of Alcala, Cagayan with Geographic Coordinates ──────────
export const ALCALA_BARANGAYS: { name: string; lat: number; lng: number }[] = [
  { name: "Centro Norte (Pob.)", lat: 17.9055, lng: 121.6565 },
  { name: "Centro Sur (Pob.)", lat: 17.9008, lng: 121.6558 },
  { name: "Pared", lat: 17.915, lng: 121.648 },
  { name: "Tupang", lat: 17.885, lng: 121.662 },
  { name: "Afusing Bato", lat: 17.925, lng: 121.635 },
  { name: "Afusing Daga", lat: 17.932, lng: 121.628 },
  { name: "Agani", lat: 17.892, lng: 121.67 },
  { name: "Baculod", lat: 17.895, lng: 121.662 },
  { name: "Baybayog", lat: 17.88, lng: 121.64 },
  { name: "Cabuluan", lat: 17.87, lng: 121.65 },
  { name: "Calantac", lat: 17.918, lng: 121.665 },
  { name: "Carallangan", lat: 17.922, lng: 121.672 },
  { name: "Dalaoig", lat: 17.93, lng: 121.675 },
  { name: "Damurog", lat: 17.905, lng: 121.63 },
  { name: "Jurisdiction", lat: 17.898, lng: 121.648 },
  { name: "Malalatan", lat: 17.945, lng: 121.66 },
  { name: "Maraburab", lat: 17.92, lng: 121.685 },
  { name: "Masin", lat: 17.91, lng: 121.645 },
  { name: "Pagbangkeruan", lat: 17.9, lng: 121.67 },
  { name: "Piggatan", lat: 17.89, lng: 121.68 },
  { name: "Pinopoc", lat: 17.935, lng: 121.64 },
  { name: "Pussian", lat: 17.935, lng: 121.665 },
  { name: "San Esteban", lat: 17.88, lng: 121.655 },
  { name: "Tamban", lat: 17.94, lng: 121.645 },
  { name: "Abbeg", lat: 17.912, lng: 121.678 },
];

export const ALCALA_CENTER: [number, number] = [17.9042, 121.656];

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

interface TechnicianLeafletMapProps {
  selectedBarangay: string;
  onSelectBarangay: (barangay: string) => void;
  mapLayer: MapLayerType;
  farms?: FarmMarkerData[];
  /** Map of barangay name (lowercase) → farm count, used to colour markers */
  barangayFarmCounts?: Record<string, number>;
  focusTrigger?: number;
  className?: string;
}

export const TechnicianLeafletMap: React.FC<TechnicianLeafletMapProps> = ({
  selectedBarangay,
  onSelectBarangay,
  mapLayer: _mapLayer,
  farms = [],
  barangayFarmCounts = {},
  focusTrigger = 0,
  className = "",
}) => {
  // Find coordinates of selected barangay
  const selectedLocation = useMemo(() => {
    const foundBg = ALCALA_BARANGAYS.find(
      (b) => b.name.toLowerCase().trim() === selectedBarangay.toLowerCase().trim()
    );
    if (foundBg) return [foundBg.lat, foundBg.lng] as [number, number];

    const foundFarm = farms.find(
      (f) => f.barangay.toLowerCase().trim() === selectedBarangay.toLowerCase().trim()
    );
    if (foundFarm) return [foundFarm.latitude, foundFarm.longitude] as [number, number];

    return ALCALA_CENTER;
  }, [selectedBarangay, farms]);

  return (
    <div className={`relative w-full h-full rounded-2xl overflow-hidden border border-slate-200/90 shadow-2xs ${className}`}>
      <MapContainer
        center={ALCALA_CENTER}
        zoom={12}
        scrollWheelZoom={true}
        className="w-full h-full min-h-[340px] z-10"
      >
        <MapFocusController targetCoords={selectedLocation} focusTrigger={focusTrigger} />

        {/* Real OpenStreetMap / Carto Tile Layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* ── ALCALA BARANGAY MARKERS ── */}
        {ALCALA_BARANGAYS.map((b) => {
          const isSelected =
            b.name.toLowerCase().trim() === selectedBarangay.toLowerCase().trim();

          // Check if this barangay has any registered farms
          const farmCount =
            barangayFarmCounts[b.name.toLowerCase()] ??
            // fallback: count from farm markers array
            farms.filter(
              (f) =>
                f.barangay.toLowerCase().includes(b.name.toLowerCase().split(" ")[0].toLowerCase())
            ).length;
          const hasFarms = farmCount > 0;

          // Green ONLY when there are registered farms; gray otherwise
          const markerColor = isSelected
            ? "#065F46"          // dark green when selected
            : hasFarms
            ? "#10B981"          // green = may registered sakahan
            : "#94A3B8";         // slate-gray = walang sakahan

          const strokeColor = isSelected ? "#FBBF24" : "#FFFFFF";

          return (
            <React.Fragment key={b.name}>
              {/* Outer Glow Ring for Selected Barangay */}
              {isSelected && (
                <CircleMarker
                  center={[b.lat, b.lng]}
                  radius={16}
                  pathOptions={{
                    color: "#FBBF24",
                    fillColor: "#FBBF24",
                    fillOpacity: 0.25,
                    weight: 2.5,
                  }}
                />
              )}

              <CircleMarker
                center={[b.lat, b.lng]}
                radius={isSelected ? 11 : hasFarms ? 8 : 6}
                eventHandlers={{
                  click: () => onSelectBarangay(b.name),
                }}
                pathOptions={{
                  color: strokeColor,
                  fillColor: markerColor,
                  fillOpacity: hasFarms ? 0.95 : 0.65,
                  weight: isSelected ? 2.5 : 1.5,
                }}
              >
                <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
                  <div className="text-xs">
                    <p className="font-bold text-slate-900">{b.name}</p>
                    <p className={hasFarms ? "text-emerald-600 font-semibold" : "text-slate-400"}>
                      {hasFarms ? `${farmCount} sakahan na rehistrado` : "Walang sakahan"}
                    </p>
                  </div>
                </Tooltip>

                <Popup>
                  <div className="p-1 space-y-1 text-xs">
                    <p className="font-bold text-sm text-slate-900">{b.name}</p>
                    <p className="text-slate-500">Munisipyo ng Alcala, Cagayan</p>
                    <p className={hasFarms ? "text-emerald-700 font-semibold" : "text-slate-400"}>
                      {hasFarms
                        ? `✓ ${farmCount} rehistradong sakahan`
                        : "Wala pang rehistradong sakahan"}
                    </p>
                    <div className="pt-1 flex gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectBarangay(b.name)}
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

        {/* ── INDIVIDUAL REGISTERED FARMS (GPS PINS) ── */}
        {farms.map((f) => {
          const isSelected =
            f.barangay.toLowerCase().trim() === selectedBarangay.toLowerCase().trim();

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
              radius={8}
              eventHandlers={{
                click: () => onSelectBarangay(f.barangay),
              }}
              pathOptions={{
                color: isSelected ? "#FBBF24" : "#FFFFFF",
                fillColor: farmColor,
                fillOpacity: 0.95,
                weight: isSelected ? 3 : 2,
              }}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                <div className="text-xs">
                  <p className="font-bold text-slate-900">{f.name}</p>
                  <p className="text-slate-600">{f.hectares} ha &middot; {f.barangay}</p>
                </div>
              </Tooltip>

              <Popup>
                <div className="p-1.5 space-y-1.5 text-xs min-w-[180px]">
                  <div className="border-b border-slate-100 pb-1">
                    <p className="font-black text-sm text-slate-900">{f.name}</p>
                    <p className="text-[11px] text-slate-500">{f.barangay}, Alcala</p>
                  </div>
                  <div className="space-y-0.5 text-slate-700">
                    <p><span className="font-semibold">Sukat:</span> {f.hectares} ha</p>
                    <p><span className="font-semibold">Yugto:</span> {f.growthStage || "Maisan"}</p>
                    <p>
                      <span className="font-semibold">Kalusugan:</span>{" "}
                      <span
                        className="font-bold capitalize"
                        style={{ color: farmColor }}
                      >
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

      {/* Floating Map Controls & Info Overlay */}
      <div className="absolute top-3 left-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 shadow-2xs border border-slate-200 text-xs font-semibold text-slate-800 backdrop-blur-xs">
        <MapPin className="h-3.5 w-3.5 text-emerald-700" />
        <span>Alcala, Cagayan</span>
      </div>

      {/* Floating Dynamic Legend */}
      <div className="absolute bottom-3 right-3 z-20 rounded-xl bg-white/95 p-2.5 shadow-2xs border border-slate-200 text-[11px] text-slate-700 backdrop-blur-xs space-y-1">
        <p className="font-bold text-[10px] text-slate-400 uppercase tracking-widest pb-0.5">Mapa</p>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#10B981] border border-white shadow-xs" />
          <span className="font-medium">May rehistradong sakahan</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#94A3B8] border border-white" />
          <span>Walang sakahan</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#065F46] ring-1 ring-[#FBBF24]" />
          <span>Napiling barangay</span>
        </div>
      </div>
    </div>
  );
};
