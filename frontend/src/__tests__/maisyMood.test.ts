import { describe, expect, it } from "vitest";
import { findCornAlert, resolveMaisyState } from "../lib/maisyMood";
import type { ObservationRecord } from "../services/observation.service";
import type { WeatherData, WeatherPrediction } from "../services/weather.service";

const NOW = new Date("2026-11-16T10:00:00+08:00").getTime();
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

const obs = (severity: ObservationRecord["severity"], age: number, condition = "Corn Borer"): ObservationRecord => ({
  id: `${severity}-${age}`,
  cropCycleId: "c1",
  farmerId: "f1",
  title: "Scan",
  description: "",
  severity,
  aiDiagnosis: { condition },
  createdAt: daysAgo(age),
});

const weather = (over: Partial<WeatherData> = {}, predictions: WeatherPrediction[] = []): WeatherData => ({
  temperatureCelsius: 30, feelsLikeCelsius: 33, conditionLabel: "Halos maaraw", conditionIcon: "CloudSun",
  humidityPercent: 70, windKph: 8, gustKph: 15, precipitationMm: 0, isDay: true, daAdvisory: "",
  municipality: "Solana", province: "Cagayan", locationSource: "barangay", weatherCode: 1,
  hourly: [], daily: [], predictions, isCached: false, isStale: false, lastUpdated: daysAgo(0),
  ...over,
});

const p = (kind: WeatherPrediction["kind"], level: WeatherPrediction["level"]): WeatherPrediction => ({
  kind, level, title: `T-${kind}`, description: `D-${kind}`,
});

describe("findCornAlert", () => {
  it("keeps serious alerts for 14 days and medium ones for 7", () => {
    expect(findCornAlert([obs("HIGH", 10)], NOW)?.severity).toBe("HIGH");
    expect(findCornAlert([obs("HIGH", 20)], NOW)).toBeNull();
    expect(findCornAlert([obs("MEDIUM", 5)], NOW)?.severity).toBe("MEDIUM");
    expect(findCornAlert([obs("MEDIUM", 9)], NOW)).toBeNull();
    expect(findCornAlert([obs("LOW", 1)], NOW)).toBeNull();
  });

  it("prefers the most serious alert", () => {
    expect(findCornAlert([obs("MEDIUM", 1), obs("CRITICAL", 3)], NOW)?.severity).toBe("CRITICAL");
  });
});

describe("resolveMaisyState", () => {
  it("shows sick Maisy with the disease name for a serious corn problem, even in a storm", () => {
    const s = resolveMaisyState(weather({}, [p("storm", "danger")]), [obs("HIGH", 2, "Northern Leaf Blight")], NOW);
    expect(s.mood).toBe("sick");
    expect(s.message).toContain("Northern Leaf Blight");
    expect(s.action).toBe("observations");
  });

  it("dangerous weather beats a mild corn problem", () => {
    expect(resolveMaisyState(weather({}, [p("heavyRain", "danger")]), [obs("MEDIUM", 1)], NOW).mood).toBe("storm");
  });

  it("shows umbrella Maisy when rain is expected", () => {
    const s = resolveMaisyState(weather({}, [p("rain", "info")]), [], NOW);
    expect(s.mood).toBe("rain");
    expect(s.action).toBe("forecast");
  });

  it("shows umbrella Maisy while it is raining now", () => {
    expect(resolveMaisyState(weather({ weatherCode: 63 }), [], NOW).mood).toBe("rain");
  });

  it("shows sunglasses Maisy on hot days", () => {
    expect(resolveMaisyState(weather({ temperatureCelsius: 36 }), [], NOW).mood).toBe("hot");
  });

  it("shows night Maisy after dark when nothing is wrong", () => {
    expect(resolveMaisyState(weather({ isDay: false }), [], NOW).mood).toBe("night");
  });

  it("shows happy Maisy on a good dry day", () => {
    expect(resolveMaisyState(weather({}, [p("dry", "good")]), [], NOW).mood).toBe("happy");
  });

  it("falls back to the default greeting without weather", () => {
    const s = resolveMaisyState(null, [], NOW);
    expect(s.mood).toBe("default");
    expect(s.action).toBeUndefined();
  });
});
