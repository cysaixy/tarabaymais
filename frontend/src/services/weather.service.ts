/**
 * Weather Service — Open-Meteo integration for Philippine municipalities
 * Free, no API key, 10k calls/day, Filipino language support
 */

// ─── Types ────────────────────────────────────────────────────────────────

export interface WeatherData {
  temperatureCelsius: number;
  feelsLikeCelsius: number;
  conditionLabel: string; // e.g. "Maliwanag, Maulan sa hapon"
  conditionIcon: string; // Lucide icon name
  humidityPercent: number;
  windKph: number;
  daAdvisory: string; // Contextual farming tip from DA
  municipality: string;
  province: string;
  weatherCode: number;
  isCached: boolean;
  lastUpdated: string;
}

interface GeocodeResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number;
  feature_code: string;
  country_code: string;
  admin1_id: number;
  admin1: string; // Province (e.g., "Cagayan")
  admin2_id?: number;
  admin2?: string; // Municipality
  admin3_id?: number;
  admin3?: string;
  admin4_id?: number;
  admin4?: string;
  timezone: string;
  population: number;
  country: string;
  country_id: number;
}

interface GeocodeResponse {
  results?: GeocodeResult[];
}

interface WeatherResponse {
  current?: {
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  current_weather?: {
    temperature: number;
    windspeed: number;
    winddirection: number;
    weathercode: number;
    time: string;
  };
  daily?: {
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
}

interface CachedWeather {
  data: WeatherData;
  timestamp: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CACHE_KEY_PREFIX = "tarabaymais_weather_";
const OPEN_METEO_GEOCODE = "https://geocoding-api.open-meteo.com/v1/search";
const OPEN_METEO_WEATHER = "https://api.open-meteo.com/v1/forecast";

// Weather code → { label, icon, gradient, baseAdvisory }
const WEATHER_MAP: Record<
  number,
  {
    label: string;
    icon: string;
    gradient: string;
    baseAdvisory: string;
  }
> = {
  0: {
    label: "Maliwanag",
    icon: "Sun",
    gradient: "from-amber-400 via-orange-500 to-red-500",
    baseAdvisory:
      "Maaraw — mag-irig ng mais bago mag-alas dos ng hapon upang maiwasan ang pagkatuyo ng lupa.",
  },
  1: {
    label: "Bahagyang maulap",
    icon: "CloudSun",
    gradient: "from-yellow-400 via-amber-500 to-orange-500",
    baseAdvisory:
      "Maliwanag naman pero may kaunting ulap — okay para sa field work, mag-ingat sa init ng hapon.",
  },
  2: {
    label: "Maulap",
    icon: "CloudSun",
    gradient: "from-sky-400 via-blue-500 to-indigo-500",
    baseAdvisory: "Maulap — masamang panahon posibleng dumating, maghanda na.",
  },
  3: {
    label: "Katotohang maulap",
    icon: "Cloud",
    gradient: "from-slate-400 via-slate-500 to-slate-600",
    baseAdvisory:
      "Sobrang maulap — bawasan ang field activity, monitor ang panahon.",
  },
  45: {
    label: "Mahinang paningin",
    icon: "Cloud",
    gradient: "from-gray-300 via-gray-400 to-gray-500",
    baseAdvisory:
      "Mahinang paningin (fog) — ingat sa pagmamaneho ng tractor, huwag mag-spray ng pesticide.",
  },
  48: {
    label: "Mahinang paningin (yelo)",
    icon: "Cloud",
    gradient: "from-cyan-300 via-blue-400 to-indigo-500",
    baseAdvisory:
      "Mahinang paningin na may yelo — delikado sa pananim, check for frost damage.",
  },
  51: {
    label: "Maambon (kaunti)",
    icon: "CloudRain",
    gradient: "from-blue-400 via-blue-600 to-blue-800",
    baseAdvisory:
      "Maambon — check drainage ng sakahan, huwag mag-fertilizer habang umuulan.",
  },
  53: {
    label: "Maambon",
    icon: "CloudRain",
    gradient: "from-blue-500 via-blue-700 to-indigo-800",
    baseAdvisory:
      "Maambon — tiyaking may sapat na drainage, monitor soil moisture.",
  },
  55: {
    label: "Malakas na ambon",
    icon: "CloudRain",
    gradient: "from-blue-600 via-blue-800 to-indigo-900",
    baseAdvisory:
      "Malakas na ambon — posibleng flash flood, alisin ang excess water sa field.",
  },
  56: {
    label: "Yelong ambon (kaunti)",
    icon: "CloudRain",
    gradient: "from-cyan-400 via-blue-600 to-indigo-800",
    baseAdvisory: "Malamig na ambon — protektahan ang binhi at batang pananim.",
  },
  57: {
    label: "Malakas na yelong ambon",
    icon: "CloudRain",
    gradient: "from-cyan-500 via-blue-700 to-indigo-900",
    baseAdvisory:
      "Delikadong malamig na ambon — critical para sa young corn, consider covering.",
  },
  61: {
    label: "Ulan (kaunti)",
    icon: "CloudRain",
    gradient: "from-blue-400 via-blue-600 to-blue-800",
    baseAdvisory:
      "Umuulan nang kaunti — okay para sa natural irrigation, huwag mag-apply ng granular fertilizer.",
  },
  63: {
    label: "Ulan",
    icon: "CloudRain",
    gradient: "from-blue-500 via-blue-700 to-indigo-800",
    baseAdvisory:
      "Umuulan — natural irrigation, check waterlogging sa low-lying areas.",
  },
  65: {
    label: "Malakas na ulan",
    icon: "CloudRain",
    gradient: "from-blue-600 via-blue-800 to-indigo-900",
    baseAdvisory:
      "Malakas na ulan — flash flood risk, ensure drainage open, delay field operations.",
  },
  66: {
    label: "Yelong ulan (kaunti)",
    icon: "CloudRain",
    gradient: "from-indigo-500 via-purple-700 to-purple-900",
    baseAdvisory: "Malamig na ulan — monitor for cold stress sa pananim.",
  },
  67: {
    label: "Malakas na yelong ulan",
    icon: "CloudRain",
    gradient: "from-indigo-600 via-purple-800 to-purple-950",
    baseAdvisory:
      "Matinding malamig na ulan — high risk sa corn, consider protective measures.",
  },
  71: {
    label: "Niyebe (kaunti)",
    icon: "Cloud",
    gradient: "from-blue-200 via-blue-300 to-blue-400",
    baseAdvisory: "Niyebe — irrerelevant sa Pilipinas, probably error.",
  },
  73: {
    label: "Niyebe",
    icon: "Cloud",
    gradient: "from-blue-300 via-blue-400 to-blue-500",
    baseAdvisory: "Niyebe — not applicable sa tropical climate.",
  },
  75: {
    label: "Malakas na niyebe",
    icon: "Cloud",
    gradient: "from-blue-400 via-blue-500 to-blue-600",
    baseAdvisory: "Heavy snow — data error for Philippines.",
  },
  80: {
    label: "Pagsasabog na ulan",
    icon: "CloudRain",
    gradient: "from-sky-400 via-blue-500 to-blue-700",
    baseAdvisory:
      "Pagsasabog na ulan — sudden downpour risk, monitor flash flood.",
  },
  81: {
    label: "Malakas na pagsasabog",
    icon: "CloudRain",
    gradient: "from-sky-500 via-blue-600 to-indigo-800",
    baseAdvisory:
      "Matitinding pagsasabog na ulan — high flash flood risk, stay safe.",
  },
  82: {
    label: "Matinding pagsasabog",
    icon: "CloudRain",
    gradient: "from-blue-600 via-indigo-800 to-purple-900",
    baseAdvisory:
      "Violent rain showers — extreme flash flood danger, evacuate low areas.",
  },
  95: {
    label: "Kulog/Kidlat",
    icon: "CloudRain",
    gradient: "from-purple-600 via-purple-800 to-purple-950",
    baseAdvisory:
      "⚡ KULOG AT KIDLAT — MAG-INGAT! Uwi na sa bahay, huwag tumayo sa bukid!",
  },
  96: {
    label: "Kulog na may yelo",
    icon: "AlertTriangle",
    gradient: "from-red-600 via-red-800 to-red-950",
    baseAdvisory:
      "🌩️ KULOG NA MAY YELO — LUMIKAS AGAD! Delikado sa buhay at pananim!",
  },
  99: {
    label: "Matinding kulog+yelo",
    icon: "AlertTriangle",
    gradient: "from-red-700 via-red-900 to-red-950",
    baseAdvisory:
      "🚨 MATINDING BAGYO NA MAY YELO — EMERGENCY! Sumunod sa evacuation orders!",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function normalizeLocationKey(municipality: string, province: string): string {
  return `${municipality.trim().toLowerCase()},${province.trim().toLowerCase()}`;
}

function getCacheKey(municipality: string, province: string): string {
  return `${CACHE_KEY_PREFIX}${normalizeLocationKey(municipality, province)}`;
}

function isCacheValid(cached: CachedWeather | null): boolean {
  if (!cached) return false;
  return Date.now() - cached.timestamp < CACHE_TTL_MS;
}

function getWeatherInfo(code: number) {
  return (
    WEATHER_MAP[code] ?? {
      label: "Hindi alam",
      icon: "Cloud",
      gradient: "from-slate-400 via-slate-500 to-slate-600",
      baseAdvisory:
        "Walang available na weather data. Monitor ang lokal na balita.",
    }
  );
}

// Generate DA advisory based on weather + crop context
function generateDAAdvisory(
  weatherCode: number,
  temp: number,
  humidity: number,
  cropStage?: string,
): string {
  const info = getWeatherInfo(weatherCode);
  let advisory = info.baseAdvisory;

  // Temperature-based adjustments
  if (temp >= 35) {
    advisory +=
      " 🌡️ Sobrang init (35°C+) — increase irrigation frequency, mulch around plants.";
  } else if (temp <= 18) {
    advisory +=
      " 🌡️ Malamig (≤18°C) — monitor for cold stress, consider row covers.";
  }

  // Humidity-based adjustments
  if (humidity >= 85) {
    advisory +=
      " 💧 Sobrang halumigmig (≥85%) — high fungal risk, scout for leaf diseases daily.";
  } else if (humidity <= 50) {
    advisory +=
      " 💧 Mababang halumigmig (≤50%) — increase irrigation, watch for wilting.";
  }

  // Crop stage specific
  if (cropStage) {
    const stage = cropStage.toLowerCase();
    if (stage.includes("binhi") || stage.includes("seedling")) {
      advisory +=
        " 🌱 Binhi stage — protect from heavy rain/wind, ensure soil moisture.";
    } else if (stage.includes("paglaki") || stage.includes("vegetative")) {
      advisory +=
        " 🌿 Vegetative stage — optimal for fertilizer if no heavy rain forecast.";
    } else if (stage.includes("tasseling") || stage.includes("butil")) {
      advisory +=
        " 🌾 Reproductive stage — critical water period, avoid stress.";
    } else if (stage.includes("pag-ani") || stage.includes("harvest")) {
      advisory +=
        " 🌽 Harvest stage — need dry weather for harvesting, monitor rain forecast.";
    }
  }

  return advisory;
}

// ─── Core Functions ───────────────────────────────────────────────────────

/**
 * Search for municipality coordinates using Open-Meteo Geocoding API
 */
export async function geocodeMunicipality(
  municipality: string,
  province = "Cagayan",
): Promise<GeocodeResult | null> {
  try {
    const params = new URLSearchParams({
      name: municipality,
      country: "Philippines",
      language: "fil",
      count: "10",
      format: "json",
    });

    const response = await fetch(`${OPEN_METEO_GEOCODE}?${params}`);
    if (!response.ok) throw new Error(`Geocoding failed: ${response.status}`);

    const data: GeocodeResponse = await response.json();
    if (!data.results?.length) return null;

    // Filter for exact province match (Cagayan)
    const exactMatch = data.results.find(
      (r) => r.admin1?.toLowerCase() === province.toLowerCase(),
    );
    if (exactMatch) return exactMatch;

    // Fallback: first result in Philippines
    const philippinesResult = data.results.find((r) => r.country_code === "PH");
    if (philippinesResult) return philippinesResult;

    // Last resort: first result
    return data.results[0];
  } catch (error) {
    console.error("[Weather] Geocoding error:", error);
    return null;
  }
}

/**
 * Fetch current weather from Open-Meteo
 */
export async function fetchWeather(
  lat: number,
  lon: number,
): Promise<WeatherResponse | null> {
  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),
      current:
        "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
      daily: "weather_code,temperature_2m_max,temperature_2m_min",
      timezone: "Asia/Manila",
      forecast_days: "1",
    });

    const response = await fetch(`${OPEN_METEO_WEATHER}?${params}`);
    if (!response.ok)
      throw new Error(`Weather fetch failed: ${response.status}`);

    return await response.json();
  } catch (error) {
    console.error("[Weather] Fetch error:", error);
    return null;
  }
}

/**
 * Get weather for a farm location with fallback chain
 * Priority: Municipality → Province → Region Capital → Default
 */
export async function getWeatherForFarm(
  municipality: string,
  province = "Cagayan",
  cropStage?: string,
): Promise<WeatherData> {
  const cacheKey = getCacheKey(municipality, province);

  // 1. Check cache
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed: CachedWeather = JSON.parse(cached);
      if (isCacheValid(parsed)) {
        return { ...parsed.data, isCached: true };
      }
    }
  } catch {
    /* ignore cache errors */
  }

  // 2. Fallback chain
  const locationsToTry = [
    { municipality, province }, // Exact municipality
    { municipality: province, province }, // Province capital
    { municipality: "Tuguegarao", province }, // Regional capital
    { municipality: "Tuguegarao", province: "" }, // Just Tuguegarao
  ];

  let weatherData: WeatherResponse | null = null;
  let resolvedLocation: GeocodeResult | null = null;

  for (const loc of locationsToTry) {
    const geo = await geocodeMunicipality(loc.municipality, loc.province);
    if (geo) {
      resolvedLocation = geo;
      weatherData = await fetchWeather(geo.latitude, geo.longitude);
      if (weatherData) break;
    }
  }

  // 3. Build result or use static fallback
  if (weatherData?.current && resolvedLocation) {
    const current = weatherData.current;
    const info = getWeatherInfo(current.weather_code);

    const result: WeatherData = {
      temperatureCelsius: Math.round(current.temperature_2m),
      feelsLikeCelsius: Math.round(current.apparent_temperature),
      conditionLabel: info.label,
      conditionIcon: info.icon,
      humidityPercent: current.relative_humidity_2m,
      windKph: Math.round(current.wind_speed_10m * 3.6), // m/s → km/h
      daAdvisory: generateDAAdvisory(
        current.weather_code,
        current.temperature_2m,
        current.relative_humidity_2m,
        cropStage,
      ),
      municipality: resolvedLocation.admin2 || resolvedLocation.name,
      province: resolvedLocation.admin1 || province,
      weatherCode: current.weather_code,
      isCached: false,
      lastUpdated: new Date().toISOString(),
    };

    // Cache it
    try {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ data: result, timestamp: Date.now() }),
      );
    } catch {
      /* ignore */
    }

    return result;
  }

  // 4. Static fallback (last resort)
  return getStaticFallback(municipality, province);
}

/**
 * Static fallback when all APIs fail
 */
function getStaticFallback(
  municipality: string,
  province: string,
): WeatherData {
  return {
    temperatureCelsius: 32,
    feelsLikeCelsius: 36,
    conditionLabel: "Maliwanag, Maulan sa hapon",
    conditionIcon: "CloudSun",
    humidityPercent: 78,
    windKph: 12,
    daAdvisory:
      "Maaraw ngayon — mag-irig ng mais bago mag-alas dos ng hapon. (Default Cagayan weather — API unavailable)",
    municipality,
    province,
    weatherCode: 1,
    isCached: false,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get gradient class for weather card background
 */
export function getWeatherGradient(weatherCode: number): string {
  return getWeatherInfo(weatherCode).gradient;
}

/**
 * Get Lucide icon component name for weather code
 */
export function getWeatherIcon(weatherCode: number): string {
  return getWeatherInfo(weatherCode).icon;
}

/**
 * Clear weather cache (for testing or manual refresh)
 */
export function clearWeatherCache(): void {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch {
    /* ignore */
  }
}
