/**
 * FarmMap — Leaflet map for the officer dashboard.
 * Farms as markers colored by health (healthy/watch/critical), disaster layer toggle,
 * popup with farm details, legend, "n sakahan walang lokasyon" badge.
 * Lazy-loaded by the parent page.
 */

import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L, { circleMarker } from "leaflet";
import { HEALTH_COLORS } from "../../lib/growthStageLabels";

export interface FarmFeature {
  type: "Feature";
  properties: {
    id: string;
    name: string;
    barangay: string;
    municipality: string;
    hectares: number;
    growthStage: string | null;
    healthStatus: string;
    openCaseCount: number;
  };
  geometry: { type: "Point"; coordinates: [number, number] };
}

export interface DisasterFeature {
  type: "Feature";
  properties: {
    id: string;
    kind: "disaster";
    disasterType: string;
    estimatedLoss: number;
    farmName: string;
    barangay: string;
  };
  geometry: { type: "Point"; coordinates: [number, number] };
}

interface FarmMapProps {
  farms: FarmFeature[];
  disasters: DisasterFeature[];
  farmsWithoutLocation: number;
}

const HEALTH_MARKER_COLOR: Record<string, string> = {
  healthy: "#059669",
  watch: "#d97706",
  critical: "#dc2626",
};

// Colored circle marker factory (replaces default pin)
const makeHealthMarker = (
  latLng: L.LatLngExpression,
  health: string,
): L.CircleMarker => {
  return circleMarker(latLng, {
    radius: 9,
    fillColor: HEALTH_MARKER_COLOR[health] ?? "#64748b",
    color: "#ffffff",
    weight: 2,
    fillOpacity: 0.9,
  });
};

const makeDisasterMarker = (latLng: L.LatLngExpression): L.CircleMarker => {
  return circleMarker(latLng, {
    radius: 10,
    fillColor: "#f59e0b",
    color: "#ffffff",
    weight: 2,
    fillOpacity: 0.9,
  });
};

export const FarmMap: React.FC<FarmMapProps> = ({
  farms,
  disasters,
  farmsWithoutLocation,
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const [showDisasters, setShowDisasters] = useState(true);
  const boundsSetRef = useRef(false);

  const allFeatures = [...farms, ...(showDisasters ? disasters : [])];
  const validCoords = allFeatures.filter(
    (f) =>
      f.geometry.coordinates[0] != null && f.geometry.coordinates[1] != null,
  );

  // Fit bounds on load / filter change
  useEffect(() => {
    if (!mapRef.current || validCoords.length === 0 || boundsSetRef.current)
      return;
    const bounds = L.latLngBounds(
      validCoords.map((f) =>
        L.latLng(f.geometry.coordinates[1], f.geometry.coordinates[0]),
      ),
    );
    mapRef.current.fitBounds(bounds.pad(0.15));
    boundsSetRef.current = true;
  }, [mapRef, validCoords, showDisasters]);

  // Refit when filters change (reset the flag)
  useEffect(() => {
    if (!mapRef.current) return;
    boundsSetRef.current = false;
  }, [farms.length, disasters.length, showDisasters]);

  const noCoords =
    farms.length === 0 ||
    farms.every(
      (f) =>
        f.geometry.coordinates[0] == null || f.geometry.coordinates[1] == null,
    );

  return (
    <div className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-slate-900">
          Mapa ng mga Sakahan
        </h3>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showDisasters}
              onChange={(e) => setShowDisasters(e.target.checked)}
              className="rounded bg-slate-100 border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Ulat ng Pinsala
          </label>
          {farmsWithoutLocation > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
              {farmsWithoutLocation} sakahan walang lokasyon
            </span>
          )}
        </div>
      </div>

      {noCoords ? (
        <div className="flex-1 flex flex-col items-center justify-center rounded-xl bg-slate-50 border-2 border-dashed border-slate-200">
          <span className="text-slate-400" aria-hidden="true">
            📍
          </span>
          <p className="mt-2 text-sm font-medium text-slate-600">
            Wala pang lokasyon
          </p>
          <p className="text-xs text-slate-400">
            Walang sakahan na may GPS coordinates.
          </p>
        </div>
      ) : (
        <div className="flex-1 relative">
          <MapContainer
            center={[18.1447, 121.8756]}
            zoom={10}
            zoomControl={false}
            className="w-full h-full min-h-85"
          >
            <MapInstanceBridge mapRef={mapRef} />
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />

            {/* Farm markers as colored circles overlaid via useMap */}
            <FarmMarkerLayer farms={farms} />
            {showDisasters && <DisasterMarkerLayer disasters={disasters} />}

            {/* Legend */}
            <div className="absolute bottom-4 left-4 z-20 bg-white/90 backdrop-blur rounded-xl p-3 border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">
                Kondisyon ng Sakahan
              </p>
              <div className="space-y-1">
                {[
                  ["healthy", "Malusog"],
                  ["watch", "Pansin"],
                  ["critical", "Kritikal"],
                ].map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-3 h-3 rounded-full border border-slate-300"
                      style={{ backgroundColor: HEALTH_COLORS[key] }}
                    />
                    <span className="text-slate-700 font-medium">{label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-xs mt-1">
                  <span className="w-3 h-3 rounded-full border-2 border-slate-300 bg-[#f59e0b]/20" />
                  <span className="text-slate-700 font-medium">
                    Ulat ng Pinsala
                  </span>
                </div>
              </div>
            </div>
          </MapContainer>
        </div>
      )}
    </div>
  );
};

function MapInstanceBridge({
  mapRef,
}: {
  mapRef: React.MutableRefObject<L.Map | null>;
}) {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;
    return () => {
      if (mapRef.current === map) mapRef.current = null;
    };
  }, [map, mapRef]);

  return null;
}

/** Renders farm markers as colored circles on the map. */
function FarmMarkerLayer({ farms }: { farms: FarmFeature[] }) {
  const map = useMap();

  useEffect(() => {
    const layers: L.Layer[] = [];
    farms.forEach((f) => {
      const [lng, lat] = f.geometry.coordinates;
      const health = f.properties.healthStatus;
      const open = f.properties.openCaseCount;

      const circle = makeHealthMarker([lat, lng], health);
      circle.bindPopup(
        `<div style="min-width:200px">` +
          `<p style="font-weight:700;font-size:14px">${f.properties.name}</p>` +
          `<p style="font-size:12px;color:#64748b">${f.properties.barangay}, ${f.properties.municipality}</p>` +
          `<p style="font-size:12px;font-weight:700;margin-top:4px">${f.properties.hectares} ha</p>` +
          `<p style="font-size:12px">Yugto: ${f.properties.growthStage ?? "—"}</p>` +
          `<p style="font-size:12px">Kondisyon: <span style="font-weight:700;text-transform:capitalize;color:${HEALTH_COLORS[health]}">${health}</span></p>` +
          (open > 0
            ? `<p style="font-size:12px;font-weight:700;color:#dc2626;margin-top:4px">${open} bukas na kaso</p>`
            : "") +
          `</div>`,
      );
      layers.push(circle);
    });
    layers.forEach((l) => l.addTo(map));
    return () => layers.forEach((l) => l.removeFrom(map));
  }, [farms, map]);

  return null;
}

/** Renders disaster markers on the map. */
function DisasterMarkerLayer({ disasters }: { disasters: DisasterFeature[] }) {
  const map = useMap();

  useEffect(() => {
    const layers: L.Layer[] = [];
    disasters.forEach((d) => {
      const [lng, lat] = d.geometry.coordinates;
      const circle = makeDisasterMarker([lat, lng]);
      circle.bindPopup(
        `<div style="min-width:200px">` +
          `<p style="font-weight:700;font-size:14px">${d.properties.disasterType}</p>` +
          `<p style="font-size:12px;color:#64748b">${d.properties.farmName} &middot; ${d.properties.barangay}</p>` +
          `<p style="font-size:12px;font-weight:700;color:#dc2626;margin-top:4px">&#8369; ${d.properties.estimatedLoss.toLocaleString()}</p>` +
          `</div>`,
      );
      layers.push(circle);
    });
    layers.forEach((l) => l.addTo(map));
    return () => layers.forEach((l) => l.removeFrom(map));
  }, [disasters, map]);

  return null;
}
