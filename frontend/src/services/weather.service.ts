/**
 * Weather Service — Open-Meteo forecast for the farmer's actual farm location.
 * Free, no API key. All values requested in metric units (°C, km/h, mm).
 *
 * Location priority (most accurate first):
 *   1. The farm's own GPS pin
 *   2. The farm's barangay reference point (offline table)
 *   3. The centre of the farm's municipality (offline table)
 *   4. Online geocoding of the municipality name (restricted to Cagayan)
 *   5. Tuguegarao City
 *
 * When offline or the API fails, the last saved forecast is shown and marked
 * as old. We never show made-up weather.
 */

import {
  cagayanBarangays,
  registeredLocationKey,
} from "../data/cagayanBarangays";

// ─── Public types ─────────────────────────────────────────────────────────

export type LocationSource = "farm-gps" | "barangay" | "municipality" | "geocode" | "default";

export interface HourlyPoint {
  time: string; // ISO local time (Asia/Manila)
  temperatureCelsius: number;
  precipitationProbability: number; // %
  precipitationMm: number;
  weatherCode: number;
  isDay: boolean;
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  weatherCode: number;
  maxCelsius: number;
  minCelsius: number;
  precipitationSumMm: number;
  precipitationProbability: number; // max chance during the day, %
  windMaxKph: number;
  gustMaxKph: number;
}

export type PredictionLevel = "danger" | "warning" | "info" | "good";
export type PredictionKind = "storm" | "heavyRain" | "rain" | "wind" | "heat" | "dry";

/** A plain-language forecast insight, e.g. "Uulan bukas ng hapon". */
export interface WeatherPrediction {
  level: PredictionLevel;
  kind: PredictionKind;
  title: string;
  description: string;
}

export interface WeatherData {
  temperatureCelsius: number;
  feelsLikeCelsius: number;
  conditionLabel: string;
  conditionIcon: string; // Lucide icon name
  humidityPercent: number;
  windKph: number;
  gustKph: number;
  precipitationMm: number; // rain in the current 15-min interval
  isDay: boolean;
  daAdvisory: string;
  municipality: string;
  barangay?: string;
  province: string;
  locationSource: LocationSource;
  weatherCode: number;
  hourly: HourlyPoint[]; // next 24 hours from now
  daily: DailyPoint[]; // today + 6 days
  predictions: WeatherPrediction[];
  /** Served from the saved copy (fresh cache, or stale because we're offline). */
  isCached: boolean;
  /** Saved copy is older than the refresh window — show "huling update" warning. */
  isStale: boolean;
  /** When the forecast was fetched from Open-Meteo. */
  lastUpdated: string;
}

export interface FarmLocationInput {
  municipality: string;
  barangay?: string;
  province?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  cropStage?: string;
}

// ─── API response shapes ──────────────────────────────────────────────────

interface ForecastResponse {
  current?: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    precipitation: number;
    is_day: number;
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: (number | null)[];
    precipitation: number[];
    weather_code: number[];
    is_day: number[];
  };
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    precipitation_probability_max: (number | null)[];
    wind_speed_10m_max: number[];
    wind_gusts_10m_max: number[];
  };
}

interface GeocodeResult {
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  country_code: string;
}

interface CachedWeather {
  data: WeatherData;
  timestamp: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 30 * 60 * 1000; // refetch after 30 minutes
const CACHE_KEY_PREFIX = "tarabaymais_weather_v2_";
const OPEN_METEO_GEOCODE = "https://geocoding-api.open-meteo.com/v1/search";
const OPEN_METEO_FORECAST = "https://api.open-meteo.com/v1/forecast";
const TUGUEGARAO = { latitude: 17.6132, longitude: 121.727 };

// Thresholds (PAGASA rainfall/wind categories, simplified for farmers)
const HEAVY_RAIN_MM_DAY = 50; // "malakas" — flooding possible in low areas
const TORRENTIAL_RAIN_MM_DAY = 100; // "matindi" — flood/landslide danger
const STRONG_WIND_KPH = 39; // sustained, Signal No. 1 range starts here
const DAMAGING_GUST_KPH = 62; // gusts that can lodge (pabagsakin) corn
const HOT_DAY_C = 35;
const RAIN_LIKELY_PCT = 60;

// ─── Weather codes (WMO) ──────────────────────────────────────────────────

interface CodeInfo {
  label: string;
  icon: string;
  nightIcon?: string;
  gradient: string;
  baseAdvisory: string;
}

const WEATHER_MAP: Record<number, CodeInfo> = {
  0: {
    label: "Maaraw",
    icon: "Sun",
    nightIcon: "Moon",
    gradient: "from-amber-400 via-orange-500 to-red-500",
    baseAdvisory:
      "Maaraw — mag-irig ng mais sa umaga o hapon, iwasan ang tanghaling tapat.",
  },
  1: {
    label: "Halos maaraw",
    icon: "CloudSun",
    nightIcon: "CloudMoon",
    gradient: "from-yellow-400 via-amber-500 to-orange-500",
    baseAdvisory:
      "Halos maaraw — maganda para sa gawain sa bukid, mag-ingat sa init ng tanghali.",
  },
  2: {
    label: "Bahagyang maulap",
    icon: "CloudSun",
    nightIcon: "CloudMoon",
    gradient: "from-sky-400 via-blue-500 to-indigo-500",
    baseAdvisory: "Bahagyang maulap — maayos para sa gawain sa bukid.",
  },
  3: {
    label: "Makulimlim",
    icon: "Cloud",
    gradient: "from-slate-400 via-slate-500 to-slate-600",
    baseAdvisory: "Makulimlim — bantayan ang hula ng ulan bago mag-abono o mag-spray.",
  },
  45: {
    label: "Maulap at mahamog",
    icon: "CloudFog",
    gradient: "from-gray-300 via-gray-400 to-gray-500",
    baseAdvisory: "Mahamog — huwag munang mag-spray hanggang matuyo ang dahon.",
  },
  48: {
    label: "Makapal na hamog",
    icon: "CloudFog",
    gradient: "from-gray-300 via-gray-400 to-gray-500",
    baseAdvisory: "Makapal na hamog — huwag munang mag-spray, mag-ingat sa pagmamaneho.",
  },
  51: {
    label: "Bahagyang ambon",
    icon: "CloudDrizzle",
    gradient: "from-blue-400 via-blue-600 to-blue-800",
    baseAdvisory: "Maambon — huwag munang mag-abono habang umaambon.",
  },
  53: {
    label: "Ambon",
    icon: "CloudDrizzle",
    gradient: "from-blue-500 via-blue-700 to-indigo-800",
    baseAdvisory: "Maambon — tiyaking maayos ang daluyan ng tubig sa bukid.",
  },
  55: {
    label: "Makapal na ambon",
    icon: "CloudDrizzle",
    gradient: "from-blue-600 via-blue-800 to-indigo-900",
    baseAdvisory: "Makapal na ambon — linisin ang kanal para hindi bumaha sa taniman.",
  },
  61: {
    label: "Mahinang ulan",
    icon: "CloudRain",
    gradient: "from-blue-400 via-blue-600 to-blue-800",
    baseAdvisory: "Mahinang ulan — natural na dilig, huwag munang mag-abono.",
  },
  63: {
    label: "Katamtamang ulan",
    icon: "CloudRain",
    gradient: "from-blue-500 via-blue-700 to-indigo-800",
    baseAdvisory: "Umuulan — bantayan ang pag-ipon ng tubig sa mababang bahagi ng bukid.",
  },
  65: {
    label: "Malakas na ulan",
    icon: "CloudRainWind",
    gradient: "from-blue-600 via-blue-800 to-indigo-900",
    baseAdvisory: "Malakas na ulan — buksan ang daluyan ng tubig, ipagpaliban ang gawain sa bukid.",
  },
  80: {
    label: "Biglaang ulan",
    icon: "CloudRain",
    gradient: "from-sky-400 via-blue-500 to-blue-700",
    baseAdvisory: "Biglaang buhos ng ulan — posibleng umulan anumang oras.",
  },
  81: {
    label: "Malakas na biglaang ulan",
    icon: "CloudRainWind",
    gradient: "from-sky-500 via-blue-600 to-indigo-800",
    baseAdvisory: "Malakas na biglaang ulan — mag-ingat sa biglaang baha.",
  },
  82: {
    label: "Napakalakas na buhos ng ulan",
    icon: "CloudRainWind",
    gradient: "from-blue-600 via-indigo-800 to-purple-900",
    baseAdvisory: "Napakalakas na ulan — panganib ng baha, lumayo sa ilog at mababang lugar.",
  },
  95: {
    label: "May kulog at kidlat",
    icon: "CloudLightning",
    gradient: "from-purple-600 via-purple-800 to-purple-950",
    baseAdvisory: "⚠️ Kulog at kidlat — umuwi muna, huwag manatili sa bukas na bukid.",
  },
  96: {
    label: "Kulog, kidlat at yelo",
    icon: "CloudLightning",
    gradient: "from-red-600 via-red-800 to-red-950",
    baseAdvisory: "⚠️ Kulog na may yelo — sumilong agad, delikado sa tao at pananim.",
  },
  99: {
    label: "Matinding kulog at yelo",
    icon: "CloudLightning",
    gradient: "from-red-700 via-red-900 to-red-950",
    baseAdvisory: "⚠️ Matinding unos — sumilong at sundin ang abiso ng MDRRMO.",
  },
};

export function getWeatherInfo(code: number): CodeInfo {
  return (
    WEATHER_MAP[code] ?? {
      label: "Hindi tiyak",
      icon: "Cloud",
      gradient: "from-slate-400 via-slate-500 to-slate-600",
      baseAdvisory: "Bantayan ang lokal na balita para sa lagay ng panahon.",
    }
  );
}

export function getWeatherIconName(code: number, isDay = true): string {
  const info = getWeatherInfo(code);
  return !isDay && info.nightIcon ? info.nightIcon : info.icon;
}

// ─── Location resolution ──────────────────────────────────────────────────

interface ResolvedLocation {
  latitude: number;
  longitude: number;
  source: LocationSource;
}

const toNumber = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

function resolveOffline(input: FarmLocationInput): ResolvedLocation | null {
  const lat = toNumber(input.latitude);
  const lng = toNumber(input.longitude);
  if (lat !== null && lng !== null && !(lat === 0 && lng === 0)) {
    return { latitude: lat, longitude: lng, source: "farm-gps" };
  }

  if (input.barangay) {
    const key = registeredLocationKey(input.municipality, input.barangay);
    const point = cagayanBarangays.find(
      (b) => registeredLocationKey(b.municipality, b.name) === key,
    );
    if (point) return { latitude: point.lat, longitude: point.lng, source: "barangay" };
  }

  const munKey = input.municipality.trim().toLowerCase();
  const points = cagayanBarangays.filter(
    (b) => b.municipality.toLowerCase() === munKey,
  );
  if (points.length > 0) {
    return {
      latitude: points.reduce((s, p) => s + p.lat, 0) / points.length,
      longitude: points.reduce((s, p) => s + p.lng, 0) / points.length,
      source: "municipality",
    };
  }
  return null;
}

async function geocodeMunicipality(
  municipality: string,
  province: string,
): Promise<ResolvedLocation | null> {
  try {
    const params = new URLSearchParams({
      name: municipality,
      countryCode: "PH",
      count: "10",
      format: "json",
    });
    const response = await fetch(`${OPEN_METEO_GEOCODE}?${params}`);
    if (!response.ok) return null;
    const data: { results?: GeocodeResult[] } = await response.json();
    // Only accept a match inside the farm's province — a same-named town
    // elsewhere in the Philippines would give the wrong weather.
    const match = data.results?.find(
      (r) => r.admin1?.toLowerCase() === province.toLowerCase(),
    );
    return match
      ? { latitude: match.latitude, longitude: match.longitude, source: "geocode" }
      : null;
  } catch {
    return null;
  }
}

async function resolveLocation(input: FarmLocationInput): Promise<ResolvedLocation> {
  return (
    resolveOffline(input) ??
    (await geocodeMunicipality(input.municipality, input.province ?? "Cagayan")) ?? {
      ...TUGUEGARAO,
      source: "default",
    }
  );
}

// ─── Forecast fetch ───────────────────────────────────────────────────────

async function fetchForecast(lat: number, lon: number): Promise<ForecastResponse> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,precipitation,is_day",
    hourly: "temperature_2m,precipitation_probability,precipitation,weather_code,is_day",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max",
    timezone: "Asia/Manila",
    forecast_days: "7",
    // Explicit units so values are never silently converted twice.
    wind_speed_unit: "kmh",
    temperature_unit: "celsius",
    precipitation_unit: "mm",
  });
  const response = await fetch(`${OPEN_METEO_FORECAST}?${params}`);
  if (!response.ok) throw new Error(`Weather fetch failed: ${response.status}`);
  return response.json();
}

// ─── Predictions ──────────────────────────────────────────────────────────

const DAY_NAMES = ["Linggo", "Lunes", "Martes", "Miyerkules", "Huwebes", "Biyernes", "Sabado"];

/** "Ngayon", "Bukas", or the weekday name for a YYYY-MM-DD date. */
export function dayLabel(date: string, todayDate: string): string {
  if (date === todayDate) return "Ngayon";
  const d = new Date(`${date}T00:00:00`);
  const t = new Date(`${todayDate}T00:00:00`);
  const diff = Math.round((d.getTime() - t.getTime()) / 86_400_000);
  if (diff === 1) return "Bukas";
  return DAY_NAMES[d.getDay()] ?? date;
}

/** "Alas-3 ng hapon" style label for an ISO local time. */
export function hourLabel(isoLocal: string): string {
  const hour = Number(isoLocal.slice(11, 13));
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const part =
    hour < 5 ? "madaling-araw" : hour < 12 ? "umaga" : hour < 13 ? "tanghali" : hour < 18 ? "hapon" : "gabi";
  return `${h12} ng ${part}`;
}

export function buildPredictions(
  hourly: HourlyPoint[],
  daily: DailyPoint[],
  todayDate: string,
): WeatherPrediction[] {
  const out: WeatherPrediction[] = [];

  // Thunderstorms in the next 24h
  const storm = hourly.find((h) => h.weatherCode >= 95);
  if (storm) {
    out.push({
      level: "danger",
      kind: "storm",
      title: `Posibleng kulog at kidlat bandang ${hourLabel(storm.time)}`,
      description: "Umuwi bago dumating ito. Huwag sumilong sa ilalim ng puno sa bukid.",
    });
  }

  // Heavy rain days this week
  for (const d of daily) {
    if (d.precipitationSumMm >= HEAVY_RAIN_MM_DAY) {
      const torrential = d.precipitationSumMm >= TORRENTIAL_RAIN_MM_DAY;
      out.push({
        level: torrential ? "danger" : "warning",
        kind: "heavyRain",
        title: `${torrential ? "Napakalakas" : "Malakas"} na ulan ${dayLabel(d.date, todayDate) === "Ngayon" ? "ngayong araw" : dayLabel(d.date, todayDate)} (~${Math.round(d.precipitationSumMm)} mm)`,
        description: torrential
          ? "Panganib ng baha. Anihin na ang hinog na mais kung kaya, linisin ang kanal, at sundin ang abiso ng MDRRMO."
          : "Linisin ang kanal at daluyan ng tubig. Huwag mag-abono 1–2 araw bago nito.",
      });
      break; // the first one is the most urgent; avoid a wall of warnings
    }
  }

  // Strong wind this week
  const windy = daily.find(
    (d) => d.windMaxKph >= STRONG_WIND_KPH || d.gustMaxKph >= DAMAGING_GUST_KPH,
  );
  if (windy) {
    out.push({
      level: windy.gustMaxKph >= DAMAGING_GUST_KPH ? "danger" : "warning",
      kind: "wind",
      title: `Malakas na hangin ${dayLabel(windy.date, todayDate)} (bugso hanggang ${Math.round(windy.gustMaxKph)} km/h)`,
      description:
        "Maaaring mapabagsak ang mais. Bantayan ang abiso ng PAGASA tungkol sa bagyo.",
    });
  }

  // Next likely rain in the coming 24h (if no stronger warning about it)
  if (!storm) {
    const nextRain = hourly.find((h) => h.precipitationProbability >= RAIN_LIKELY_PCT);
    if (nextRain) {
      const isToday = nextRain.time.slice(0, 10) === todayDate;
      out.push({
        level: "info",
        kind: "rain",
        title: `Malamang umulan ${isToday ? "mamayang" : "bukas,"} ${hourLabel(nextRain.time)} (${nextRain.precipitationProbability}%)`,
        description: "Huwag mag-abono o mag-spray bago umulan — maaanod lang ito.",
      });
    }
  }

  // Hot days
  const hot = daily.find((d) => d.maxCelsius >= HOT_DAY_C);
  if (hot) {
    out.push({
      level: "warning",
      kind: "heat",
      title: `Matinding init ${dayLabel(hot.date, todayDate)} (${Math.round(hot.maxCelsius)}°C)`,
      description: "Diligan sa umaga o hapon. Magpahinga sa lilim tuwing tanghali.",
    });
  }

  // Dry window — good for fertilizer, spraying, drying harvest.
  // From 3 PM on, today is nearly over, so start looking from tomorrow.
  const currentHour = hourly[0] ? Number(hourly[0].time.slice(11, 13)) : 0;
  const firstDry = daily.findIndex(
    (d, i) =>
      !(d.date === todayDate && currentHour >= 15) &&
      d.precipitationProbability < 30 &&
      d.precipitationSumMm < 1 &&
      (daily[i + 1]?.precipitationProbability ?? 100) < 40,
  );
  if (firstDry !== -1) {
    const d = daily[firstDry]!;
    out.push({
      level: "good",
      kind: "dry",
      title: `Magandang araw sa gawain sa bukid: ${dayLabel(d.date, todayDate)}`,
      description: "Mababa ang tsansa ng ulan — mainam para mag-abono, mag-spray, o magpatuyo ng ani.",
    });
  }

  // Most serious first, so a compact view can show just the top one.
  const rank: Record<PredictionLevel, number> = { danger: 0, warning: 1, info: 2, good: 3 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

// DA advisory for the current conditions + crop stage
function generateDAAdvisory(
  weatherCode: number,
  temp: number,
  humidity: number,
  rainSoon: boolean,
  cropStage?: string,
): string {
  let advisory = getWeatherInfo(weatherCode).baseAdvisory;

  if (temp >= HOT_DAY_C) {
    advisory += " 🌞 Sobrang init — dalasan ang pagdidilig at maglagay ng mulch.";
  }
  if (humidity >= 85) {
    advisory += " 💧 Mataas na halumigmig — madaling magkasakit ang dahon, suriin araw-araw.";
  }

  if (cropStage) {
    const stage = cropStage.toLowerCase();
    if (stage.includes("binhi") || stage.includes("seedling") || stage.includes("pagsibol")) {
      advisory += " 🌱 Pagsibol — protektahan ang punla sa malakas na ulan at baha.";
    } else if (stage.includes("paglaki") || stage.includes("vegetative")) {
      advisory += rainSoon
        ? " 🌿 Paglaki — ipagpaliban ang pag-abono, uulan sa loob ng 24 oras."
        : " 🌿 Paglaki — magandang panahon para mag-abono ngayon.";
    } else if (stage.includes("tasseling") || stage.includes("butil") || stage.includes("pamumulaklak")) {
      advisory += " 🌾 Pamumulaklak/pagbubutil — kailangan ng sapat na tubig, iwasang matuyuan.";
    } else if (stage.includes("pag-ani") || stage.includes("harvest") || stage.includes("hinog")) {
      advisory += rainSoon
        ? " 🌽 Anihan — uulan, anihin na at itago ang ani sa tuyong lugar."
        : " 🌽 Anihan — tuyo ang panahon, magandang mag-ani at magpatuyo.";
    }
  }
  return advisory;
}

// ─── Build result ─────────────────────────────────────────────────────────

function buildWeatherData(
  res: ForecastResponse,
  input: FarmLocationInput,
  location: ResolvedLocation,
): WeatherData {
  const c = res.current!;
  const nowKey = c.time.slice(0, 13); // "YYYY-MM-DDTHH"
  const todayDate = c.time.slice(0, 10);

  const hourly: HourlyPoint[] = [];
  if (res.hourly) {
    const start = Math.max(
      0,
      res.hourly.time.findIndex((t) => t.slice(0, 13) === nowKey),
    );
    for (let i = start; i < Math.min(start + 24, res.hourly.time.length); i++) {
      hourly.push({
        time: res.hourly.time[i]!,
        temperatureCelsius: res.hourly.temperature_2m[i] ?? 0,
        precipitationProbability: res.hourly.precipitation_probability[i] ?? 0,
        precipitationMm: res.hourly.precipitation[i] ?? 0,
        weatherCode: res.hourly.weather_code[i] ?? 0,
        isDay: (res.hourly.is_day[i] ?? 1) === 1,
      });
    }
  }

  const daily: DailyPoint[] = (res.daily?.time ?? []).map((date, i) => ({
    date,
    weatherCode: res.daily!.weather_code[i] ?? 0,
    maxCelsius: res.daily!.temperature_2m_max[i] ?? 0,
    minCelsius: res.daily!.temperature_2m_min[i] ?? 0,
    precipitationSumMm: res.daily!.precipitation_sum[i] ?? 0,
    precipitationProbability: res.daily!.precipitation_probability_max[i] ?? 0,
    windMaxKph: res.daily!.wind_speed_10m_max[i] ?? 0,
    gustMaxKph: res.daily!.wind_gusts_10m_max[i] ?? 0,
  }));

  const isDay = c.is_day === 1;
  const info = getWeatherInfo(c.weather_code);
  const rainSoon = hourly.some((h) => h.precipitationProbability >= RAIN_LIKELY_PCT);

  return {
    temperatureCelsius: Math.round(c.temperature_2m),
    feelsLikeCelsius: Math.round(c.apparent_temperature),
    conditionLabel: info.label,
    conditionIcon: getWeatherIconName(c.weather_code, isDay),
    humidityPercent: Math.round(c.relative_humidity_2m),
    windKph: Math.round(c.wind_speed_10m),
    gustKph: Math.round(c.wind_gusts_10m),
    precipitationMm: c.precipitation,
    isDay,
    daAdvisory: generateDAAdvisory(
      c.weather_code,
      c.temperature_2m,
      c.relative_humidity_2m,
      rainSoon,
      input.cropStage,
    ),
    municipality: input.municipality || "Tuguegarao City",
    ...(input.barangay ? { barangay: input.barangay } : {}),
    province: input.province ?? "Cagayan",
    locationSource: location.source,
    weatherCode: c.weather_code,
    hourly,
    daily,
    predictions: buildPredictions(hourly, daily, todayDate),
    isCached: false,
    isStale: false,
    lastUpdated: new Date().toISOString(),
  };
}

// ─── Cache ────────────────────────────────────────────────────────────────

function cacheKey(input: FarmLocationInput): string {
  const lat = toNumber(input.latitude);
  const lng = toNumber(input.longitude);
  const where =
    lat !== null && lng !== null
      ? `${lat.toFixed(3)},${lng.toFixed(3)}`
      : `${input.municipality}|${input.barangay ?? ""}`.toLowerCase();
  return `${CACHE_KEY_PREFIX}${where}|${input.cropStage ?? ""}`;
}

function readCache(key: string): CachedWeather | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as CachedWeather) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: WeatherData): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    /* storage full or blocked — non-fatal */
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Current weather + 24-hour and 7-day forecast for a farm.
 * Throws only when there is no network AND no saved forecast.
 */
export async function getWeatherForFarm(
  input: FarmLocationInput,
  { forceRefresh = false }: { forceRefresh?: boolean } = {},
): Promise<WeatherData> {
  const key = cacheKey(input);
  const cached = readCache(key);

  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { ...cached.data, isCached: true, isStale: false };
  }

  try {
    const location = await resolveLocation(input);
    const res = await fetchForecast(location.latitude, location.longitude);
    if (!res.current) throw new Error("Walang current weather sa sagot ng API");
    const data = buildWeatherData(res, input, location);
    writeCache(key, data);
    return data;
  } catch (error) {
    if (cached) {
      // Offline or API down — show the last real forecast, clearly marked as old.
      return { ...cached.data, isCached: true, isStale: true };
    }
    throw error instanceof Error
      ? error
      : new Error("Hindi makuha ang lagay ng panahon");
  }
}

export function getWeatherGradient(weatherCode: number): string {
  return getWeatherInfo(weatherCode).gradient;
}

export function clearWeatherCache(): void {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("tarabaymais_weather_")) localStorage.removeItem(key);
    });
  } catch {
    /* ignore */
  }
}
