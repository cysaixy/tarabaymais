/**
 * Leaflet + Vite fix.
 *
 * Vite bundles Leaflet's CSS but the marker image URLs inside it are relative
 * and break in production. Import the marker assets and override the default
 * icon options so markers render correctly in dev and production.
 *
 * Import this once in main.tsx before any map component mounts.
 */
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import icon2xUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: icon2xUrl,
  iconUrl: iconUrl,
  shadowUrl: shadowUrl,
});
