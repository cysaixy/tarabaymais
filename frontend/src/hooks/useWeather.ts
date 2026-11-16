/**
 * useWeather Hook — current weather + forecast for the selected farm.
 * Handles loading, errors, offline (stale saved forecast) and auto-refresh.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getWeatherForFarm,
  getWeatherGradient,
  type FarmLocationInput,
  type WeatherData,
} from "../services/weather.service";

interface UseWeatherOptions extends FarmLocationInput {
  autoRefresh?: boolean;
  refreshIntervalMs?: number;
}

interface UseWeatherReturn {
  weather: WeatherData | null;
  loading: boolean;
  error: string | null;
  gradientClass: string;
  iconName: string;
  refresh: () => Promise<void>;
  /** Showing a saved forecast because the latest one couldn't be fetched. */
  isStale: boolean;
}

export function useWeather({
  municipality,
  barangay,
  province = "Cagayan",
  latitude,
  longitude,
  cropStage,
  autoRefresh = false,
  refreshIntervalMs = 30 * 60 * 1000,
}: UseWeatherOptions): UseWeatherReturn {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (forceRefresh = false) => {
      const id = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const data = await getWeatherForFarm(
          {
            municipality,
            province,
            ...(barangay ? { barangay } : {}),
            ...(latitude !== undefined ? { latitude } : {}),
            ...(longitude !== undefined ? { longitude } : {}),
            ...(cropStage ? { cropStage } : {}),
          },
          { forceRefresh },
        );
        // Ignore results from an older request (e.g. farm switched mid-fetch).
        if (id === requestId.current) setWeather(data);
      } catch {
        if (id === requestId.current) {
          setError(
            typeof navigator !== "undefined" && !navigator.onLine
              ? "Walang koneksyon at wala pang naka-save na hula ng panahon."
              : "Hindi makuha ang lagay ng panahon. Subukan muli.",
          );
        }
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [municipality, barangay, province, latitude, longitude, cropStage],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => void load(), refreshIntervalMs);
    // Fetch fresh data as soon as the connection comes back.
    const onOnline = () => void load(true);
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
    };
  }, [autoRefresh, load, refreshIntervalMs]);

  const refresh = useCallback(() => load(true), [load]);

  return {
    weather,
    loading,
    error,
    gradientClass: weather
      ? getWeatherGradient(weather.weatherCode)
      : "from-slate-400 via-slate-500 to-slate-600",
    iconName: weather?.conditionIcon ?? "Cloud",
    refresh,
    isStale: weather?.isStale ?? false,
  };
}
