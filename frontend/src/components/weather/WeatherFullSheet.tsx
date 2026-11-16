import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Droplets, MapPin, Wind, X } from "lucide-react";
import type { WeatherData } from "../../services/weather.service";
import { WeatherGlyph } from "./WeatherGlyph";
import { DailyForecast, HourlyStrip, PredictionList } from "./WeatherForecast";

interface WeatherFullSheetProps {
  weather: WeatherData;
  gradientClass: string;
  locationLabel: string;
  updatedLabel: string;
  /** DA advice block, rendered by the page. */
  advisory?: React.ReactNode;
  onClose: () => void;
}

/**
 * Full forecast: full-screen on phones, centred panel on larger screens.
 * Closes with the X button, the backdrop, or Escape.
 */
export const WeatherFullSheet: React.FC<WeatherFullSheetProps> = ({
  weather,
  gradientClass,
  locationLabel,
  updatedLabel,
  advisory,
  onClose,
}) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Stop the dashboard behind from scrolling while the sheet is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-stretch md:items-center justify-center md:bg-black/60 md:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buong hula ng panahon"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full md:max-w-lg h-full md:h-auto md:max-h-[90vh] overflow-hidden md:rounded-3xl shadow-2xl flex flex-col"
      >
        <div className={`absolute inset-0 bg-linear-to-br ${gradientClass}`} aria-hidden="true" />

        {/* Header */}
        <header className="relative z-10 flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/15">
          <div className="min-w-0 flex-1 text-white">
            <p className="text-[11px] font-black tracking-widest uppercase text-white/80">
              Buong Hula ng Panahon
            </p>
            <p className="text-[13px] font-semibold flex items-center gap-1 truncate">
              <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{locationLabel}</span>
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Isara"
            className="shrink-0 w-12 h-12 rounded-2xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </header>

        {/* Scrollable body */}
        <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4 space-y-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {/* Now summary */}
          <div className="flex items-center gap-3 text-white">
            <WeatherGlyph name={weather.conditionIcon} className="w-12 h-12 shrink-0" />
            <div className="min-w-0">
              <p className="text-4xl font-black leading-none">{weather.temperatureCelsius}°C</p>
              <p className="text-sm font-semibold text-white/90">{weather.conditionLabel}</p>
            </div>
            <div className="ml-auto text-right text-[12px] font-semibold text-white/85 space-y-0.5">
              <p className="flex items-center justify-end gap-1">
                <Wind className="w-3.5 h-3.5" aria-hidden="true" /> {weather.windKph} km/h
              </p>
              <p className="flex items-center justify-end gap-1">
                <Droplets className="w-3.5 h-3.5" aria-hidden="true" /> {weather.humidityPercent}%
              </p>
            </div>
          </div>

          <PredictionList predictions={weather.predictions} />
          <HourlyStrip weather={weather} />
          <DailyForecast weather={weather} />
          {advisory}

          <p className="text-[10px] text-white/60">Na-update: {updatedLabel}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
};
