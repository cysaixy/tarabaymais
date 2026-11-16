import {
  cagayanBarangays,
  registeredLocationKey,
} from "../data/cagayanBarangays";
import { CAGAYAN_LOCATION_DATA } from "../data/cagayanLocations";

export interface DetectedLocation {
  /** Spelled exactly as in the Munisipyo dropdown. */
  municipality: string;
  /** Spelled exactly as in the Barangay dropdown. */
  barangay: string;
  distanceKm: number;
}

/** Beyond this distance from any known barangay point we don't guess (likely outside Cagayan). */
const MAX_DISTANCE_KM = 8;

/**
 * Barangay reference points that also exist in the form dropdowns, carrying
 * the dropdown spelling so the selects accept the auto-filled values.
 */
const candidates = (() => {
  const dropdown = new Map<string, { municipality: string; barangay: string }>();
  for (const [municipality, barangays] of Object.entries(CAGAYAN_LOCATION_DATA)) {
    for (const barangay of barangays) {
      dropdown.set(registeredLocationKey(municipality, barangay), {
        municipality,
        barangay,
      });
    }
  }
  return cagayanBarangays.flatMap((point) => {
    const match = dropdown.get(
      registeredLocationKey(point.municipality, point.name),
    );
    return match ? [{ ...match, lat: point.lat, lng: point.lng }] : [];
  });
})();

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Finds the closest known barangay to a GPS point. Works fully offline.
 * Returns null when the point is too far from every known barangay.
 */
export function findNearestBarangay(
  latitude: number,
  longitude: number,
): DetectedLocation | null {
  let best: DetectedLocation | null = null;
  for (const c of candidates) {
    const distanceKm = haversineKm(latitude, longitude, c.lat, c.lng);
    if (!best || distanceKm < best.distanceKm) {
      best = { municipality: c.municipality, barangay: c.barangay, distanceKm };
    }
  }
  return best && best.distanceKm <= MAX_DISTANCE_KM ? best : null;
}

/** Number of barangay points usable for autofill (exposed for tests/diagnostics). */
export const nearestBarangayCandidateCount = candidates.length;
