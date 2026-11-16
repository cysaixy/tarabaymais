import React from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  CloudLightning,
  CloudRain,
  CloudRainWind,
  Droplets,
  Info,
  Thermometer,
  Wind,
} from "lucide-react";
import {
  dayLabel,
  getWeatherIconName,
  getWeatherInfo,
  type PredictionKind,
  type PredictionLevel,
  type WeatherData,
  type WeatherPrediction,
} from "../../services/weather.service";
import { WeatherGlyph } from "./WeatherGlyph";

const LEVEL_STYLE: Record<PredictionLevel, { box: string; icon: string; label: string }> = {
  danger: { box: "border-l-red-600 bg-red-50", icon: "text-red-700", label: "MAG-INGAT" },
  warning: { box: "border-l-amber-500 bg-amber-50", icon: "text-amber-700", label: "BANTAYAN" },
  info: { box: "border-l-blue-500 bg-blue-50", icon: "text-blue-700", label: "HULA" },
  good: { box: "border-l-emerald-600 bg-emerald-50", icon: "text-emerald-700", label: "MAGANDANG BALITA" },
};

const KIND_ICON: Record<PredictionKind, React.ElementType> = {
  storm: CloudLightning,
  heavyRain: CloudRainWind,
  rain: CloudRain,
  wind: Wind,
  heat: Thermometer,
  dry: CheckCircle2,
};

const SectionTitle: React.FC<{ icon?: React.ElementType; children: React.ReactNode }> = ({
  icon: Icon,
  children,
}) => (
  <h3 className="text-[11px] font-black tracking-widest uppercase text-white/85 flex items-center gap-1.5">
    {Icon && <Icon className="w-3.5 h-3.5" aria-hidden="true" />}
    {children}
  </h3>
);

/** "3PM" style short hour for the hourly strip. */
function shortHour(isoLocal: string, index: number): string {
  if (index === 0) return "Ngayon";
  const hour = Number(isoLocal.slice(11, 13));
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}${hour < 12 ? "AM" : "PM"}`;
}

/** Rain-chance colour so a farmer can scan for wet hours/days at a glance. */
function rainTone(pct: number): string {
  if (pct >= 70) return "text-blue-100 font-black";
  if (pct >= 40) return "text-sky-100 font-bold";
  return "text-white/70 font-semibold";
}

// ─── Predictions ──────────────────────────────────────────────────────────

const PredictionItem: React.FC<{ p: WeatherPrediction; compact?: boolean }> = ({ p, compact }) => {
  const style = LEVEL_STYLE[p.level];
  const Icon = KIND_ICON[p.kind] ?? Info;
  return (
    <li className={`rounded-2xl border-l-4 ${style.box} px-3.5 py-3 flex gap-3 shadow-sm`}>
      <Icon className={`w-6 h-6 shrink-0 mt-0.5 ${style.icon}`} aria-hidden="true" />
      <div className="min-w-0">
        <p className={`text-[10px] font-black tracking-wider ${style.icon}`}>{style.label}</p>
        <p className="text-[15px] font-extrabold text-slate-900 leading-snug">{p.title}</p>
        {!compact && (
          <p className="text-[13px] font-medium text-slate-700 leading-snug mt-0.5">
            {p.description}
          </p>
        )}
      </div>
    </li>
  );
};

/** All predictions (already sorted most-serious first by the service). */
export const PredictionList: React.FC<{ predictions: WeatherPrediction[] }> = ({ predictions }) =>
  predictions.length === 0 ? null : (
    <section aria-label="Hula ng panahon" className="space-y-2">
      <SectionTitle>Hula para sa Sakahan</SectionTitle>
      <ul className="space-y-2">
        {predictions.map((p, i) => (
          <PredictionItem key={`${p.kind}-${i}`} p={p} />
        ))}
      </ul>
    </section>
  );

/** Only the most urgent prediction, title only — for the dashboard card. */
export const TopPrediction: React.FC<{ predictions: WeatherPrediction[] }> = ({ predictions }) => {
  const top = predictions[0];
  if (!top) return null;
  return (
    <ul aria-label="Pinakamahalagang hula">
      <PredictionItem p={top} compact />
    </ul>
  );
};

// ─── Hourly ───────────────────────────────────────────────────────────────

export const HourlyStrip: React.FC<{ weather: WeatherData; showTitle?: boolean }> = ({
  weather,
  showTitle = true,
}) => {
  // Every 3 hours keeps the strip readable on small phones.
  const hourly = weather.hourly.filter((_, i) => i % 3 === 0).slice(0, 8);
  if (hourly.length === 0) return null;
  return (
    <section aria-label="Susunod na 24 oras" className="space-y-2">
      {showTitle && <SectionTitle icon={Clock}>Susunod na 24 Oras</SectionTitle>}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
        {hourly.map((h, i) => (
          <div
            key={h.time}
            className="snap-start shrink-0 w-[64px] rounded-2xl bg-white/15 backdrop-blur-sm py-2 flex flex-col items-center gap-0.5 text-white"
          >
            <span className="text-[11px] font-bold text-white/85">{shortHour(h.time, i)}</span>
            <WeatherGlyph name={getWeatherIconName(h.weatherCode, h.isDay)} className="w-6 h-6" />
            <span className="text-[15px] font-black">{Math.round(h.temperatureCelsius)}°</span>
            <span className={`text-[11px] flex items-center gap-0.5 ${rainTone(h.precipitationProbability)}`}>
              <Droplets className="w-3 h-3" aria-hidden="true" />
              {h.precipitationProbability}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};

// ─── Daily ────────────────────────────────────────────────────────────────

export const DailyForecast: React.FC<{ weather: WeatherData }> = ({ weather }) => {
  if (weather.daily.length === 0) return null;
  const todayDate = weather.daily[0]!.date;
  const weekMin = Math.min(...weather.daily.map((d) => d.minCelsius));
  const weekMax = Math.max(...weather.daily.map((d) => d.maxCelsius));
  const span = Math.max(1, weekMax - weekMin);

  return (
    <section aria-label="Hula sa 7 araw" className="space-y-2">
      <SectionTitle icon={CalendarDays}>Hula sa 7 Araw</SectionTitle>
      <ul className="rounded-2xl bg-white/15 backdrop-blur-sm divide-y divide-white/10 text-white">
        {weather.daily.map((d) => {
          const left = ((d.minCelsius - weekMin) / span) * 100;
          const width = ((d.maxCelsius - d.minCelsius) / span) * 100;
          return (
            <li
              key={d.date}
              className="grid grid-cols-[76px_28px_44px_1fr] items-center gap-2 px-3 py-2.5"
            >
              <span className="text-[14px] font-extrabold">{dayLabel(d.date, todayDate)}</span>
              <span title={getWeatherInfo(d.weatherCode).label}>
                <WeatherGlyph name={getWeatherIconName(d.weatherCode)} className="w-6 h-6" />
              </span>
              <span className={`text-[12px] flex items-center gap-0.5 ${rainTone(d.precipitationProbability)}`}>
                <Droplets className="w-3 h-3" aria-hidden="true" />
                {d.precipitationProbability}%
              </span>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[13px] font-semibold text-white/75 w-7 text-right tabular-nums">
                  {Math.round(d.minCelsius)}°
                </span>
                <div className="relative h-1.5 flex-1 rounded-full bg-white/20" aria-hidden="true">
                  <div
                    className="absolute h-full rounded-full bg-linear-to-r from-sky-200 to-amber-300"
                    style={{ left: `${left}%`, width: `${Math.max(width, 6)}%` }}
                  />
                </div>
                <span className="text-[13px] font-black w-7 tabular-nums">
                  {Math.round(d.maxCelsius)}°
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[10px] text-white/60">
        % = tsansa ng ulan. Pinagmulan: Open-Meteo. Para sa bagyo, sundin ang PAGASA at MDRRMO.
      </p>
    </section>
  );
};
