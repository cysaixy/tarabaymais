import type { WeatherData } from "../services/weather.service";
import type { ObservationRecord } from "../services/observation.service";

export type MaisyMood = "default" | "happy" | "rain" | "storm" | "hot" | "sick" | "night";

export type MaisyAction = "forecast" | "observations";

export interface MaisyState {
  mood: MaisyMood;
  message: string;
  /** What tapping Maisy's button does; undefined = no button. */
  action?: MaisyAction;
  actionLabel?: string;
}

export const MAISY_IMAGES: Record<MaisyMood, string> = {
  default: "/assets/maisy/maisy-default.png",
  happy: "/assets/maisy/maisy-happy.png",
  rain: "/assets/maisy/maisy-rain.png",
  storm: "/assets/maisy/maisy-storm.png",
  hot: "/assets/maisy/maisy-hot.png",
  sick: "/assets/maisy/maisy-sick.png",
  night: "/assets/maisy/maisy-night.png",
};

const DAY_MS = 86_400_000;

/** Latest observation that still matters: HIGH/CRITICAL within 14 days, MEDIUM within 7. */
export function findCornAlert(
  observations: ObservationRecord[],
  now = Date.now(),
): ObservationRecord | null {
  const recent = observations
    .filter((o) => {
      const age = now - new Date(o.createdAt).getTime();
      if (o.severity === "HIGH" || o.severity === "CRITICAL") return age <= 14 * DAY_MS;
      if (o.severity === "MEDIUM") return age <= 7 * DAY_MS;
      return false;
    })
    .sort((a, b) => {
      const rank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;
      return rank[a.severity] - rank[b.severity] ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  return recent[0] ?? null;
}

function conditionName(o: ObservationRecord): string {
  const c = o.aiDiagnosis?.condition;
  return typeof c === "string" && c.trim() ? c.trim() : o.title;
}

/**
 * Picks Maisy's look and message. Priority:
 * serious corn problem → dangerous weather → mild corn problem → rain → heat →
 * night → good dry day → default.
 */
export function resolveMaisyState(
  weather: WeatherData | null,
  observations: ObservationRecord[],
  now = Date.now(),
): MaisyState {
  const alert = findCornAlert(observations, now);
  const predictions = weather?.predictions ?? [];
  const has = (kind: string, level?: string) =>
    predictions.find((p) => p.kind === kind && (!level || p.level === level));

  if (alert && (alert.severity === "HIGH" || alert.severity === "CRITICAL")) {
    return {
      mood: "sick",
      message: `May problema sa mais mo: ${conditionName(alert)}. Sundin ang payo at hintayin ang technician.`,
      action: "observations",
      actionLabel: "Tingnan ang ulat",
    };
  }

  const danger = predictions.find((p) => p.level === "danger");
  if (danger) {
    return {
      mood: "storm",
      message: `Mag-ingat! ${danger.title}. ${danger.description}`,
      action: "forecast",
      actionLabel: "Tingnan ang hula",
    };
  }

  if (alert) {
    return {
      mood: "sick",
      message: `Bantayan ang mais mo — ${conditionName(alert)}. Kuhanan muli ng litrato kung lumala.`,
      action: "observations",
      actionLabel: "Tingnan ang ulat",
    };
  }

  const rain = has("heavyRain") ?? has("rain");
  if (rain || (weather && weather.weatherCode >= 51 && weather.weatherCode < 95)) {
    return {
      mood: "rain",
      message: rain
        ? `${rain.title}. ${rain.description}`
        : "Umuulan ngayon — huwag munang mag-abono o mag-spray.",
      action: "forecast",
      actionLabel: "Tingnan ang hula",
    };
  }

  const heat = has("heat");
  if (heat || (weather && weather.temperatureCelsius >= 35)) {
    return {
      mood: "hot",
      message: heat
        ? `${heat.title}. ${heat.description}`
        : "Napakainit ngayon! Diligan ang mais sa umaga o hapon, at uminom ng tubig.",
      action: "forecast",
      actionLabel: "Tingnan ang hula",
    };
  }

  if (weather && !weather.isDay) {
    return {
      mood: "night",
      message: "Magandang gabi! Magpahinga ka na — titingnan ko ang panahon para bukas.",
      action: "forecast",
      actionLabel: "Hula bukas",
    };
  }

  const dry = has("dry");
  if (dry) {
    return {
      mood: "happy",
      message: `${dry.title}! ${dry.description}`,
      action: "forecast",
      actionLabel: "Tingnan ang hula",
    };
  }

  return {
    mood: "default",
    message: "Mabuhay! Ako si Maisy, handang tumulong sa 'yo ngayong araw!",
  };
}
