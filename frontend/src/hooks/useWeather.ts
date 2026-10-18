/**
 * useWeather Hook — Reactive weather data for farmer dashboard
 * Handles loading, error, caching, and auto-refresh
 */

import { useState, useEffect, useCallback } from "react";
import { getWeatherForFarm, getWeatherGradient, getWeatherIcon, clearWeatherCache, type WeatherData } from "../services/weather.service";

interface UseWeatherOptions {
  municipality: string;
  province?: string;
  cropStage?: string;
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
  isUsingFallback: boolean;
}

export function useWeather({
  municipality,
  province = "Cagayan",
  cropStage,
  autoRefresh = false,
  refreshIntervalMs = 30 * 60 * 1000, // 30 min default
}: UseWeatherOptions): UseWeatherReturn {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = useCallback(async () => {
    if (!municipality) {
      setError("Walang municipality na nakapili");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getWeatherForFarm(municipality, province, cropStage);
      setWeather(data);
      if (data.isCached) {
        setError(null); // Cached data is fine
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Hindi nakakuha ng weather data";
      setError(msg);
      console.error("[useWeather] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [municipality, province, cropStage]);

  // Initial fetch
  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchWeather, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchWeather, refreshIntervalMs]);

  // Refresh function for manual trigger
  const refresh = useCallback(async () => {
    // Clear cache for this location to force fresh fetch
    clearWeatherCache();
    await fetchWeather();
  }, [fetchWeather]);

  const gradientClass = weather ? getWeatherGradient(weather.weatherCode) : "from-slate-400 via-slate-500 to-slate-600";
  const iconName = weather ? getWeatherIcon(weather.weatherCode) : "Cloud";
  const isUsingFallback = weather?.conditionLabel.includes("Default") ?? false;

  return {
    weather,
    loading,
    error,
    gradientClass,
    iconName,
    refresh,
    isUsingFallback,
  };
}