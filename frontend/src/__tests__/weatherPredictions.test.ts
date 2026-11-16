import { describe, expect, it } from "vitest";
import {
  buildPredictions,
  dayLabel,
  type DailyPoint,
  type HourlyPoint,
} from "../services/weather.service";

const TODAY = "2026-11-16";

const hour = (time: string, over: Partial<HourlyPoint> = {}): HourlyPoint => ({
  time,
  temperatureCelsius: 28,
  precipitationProbability: 10,
  precipitationMm: 0,
  weatherCode: 1,
  isDay: true,
  ...over,
});

const day = (date: string, over: Partial<DailyPoint> = {}): DailyPoint => ({
  date,
  weatherCode: 1,
  maxCelsius: 31,
  minCelsius: 23,
  precipitationSumMm: 0,
  precipitationProbability: 10,
  windMaxKph: 10,
  gustMaxKph: 20,
  ...over,
});

const week = (over: Record<number, Partial<DailyPoint>> = {}) =>
  Array.from({ length: 7 }, (_, i) =>
    day(`2026-11-${String(16 + i).padStart(2, "0")}`, over[i] ?? {}),
  );

describe("dayLabel", () => {
  it("names today, tomorrow and weekdays", () => {
    expect(dayLabel("2026-11-16", TODAY)).toBe("Ngayon");
    expect(dayLabel("2026-11-17", TODAY)).toBe("Bukas");
    expect(dayLabel("2026-11-19", TODAY)).toBe("Huwebes");
  });
});

describe("buildPredictions", () => {
  it("warns about heavy rain with the day and amount", () => {
    const p = buildPredictions([], week({ 2: { precipitationSumMm: 72, precipitationProbability: 90 } }), TODAY);
    const rain = p.find((x) => x.kind === "heavyRain");
    expect(rain?.level).toBe("warning");
    expect(rain?.title).toContain("Miyerkules");
    expect(rain?.title).toContain("72 mm");
  });

  it("escalates torrential rain to danger", () => {
    const p = buildPredictions([], week({ 1: { precipitationSumMm: 140 } }), TODAY);
    expect(p.find((x) => x.kind === "heavyRain")?.level).toBe("danger");
  });

  it("flags damaging wind gusts", () => {
    const p = buildPredictions([], week({ 3: { gustMaxKph: 80, windMaxKph: 45 } }), TODAY);
    expect(p.find((x) => x.kind === "wind")?.level).toBe("danger");
  });

  it("predicts the next rainy hour", () => {
    const hours = [hour("2026-11-16T13:00"), hour("2026-11-16T15:00", { precipitationProbability: 75 })];
    const rain = buildPredictions(hours, week({ 0: { precipitationProbability: 75 } }), TODAY).find((x) => x.kind === "rain");
    expect(rain?.title).toBe("Malamang umulan mamayang 3 ng hapon (75%)");
  });

  it("puts thunderstorm warnings first", () => {
    const hours = [hour("2026-11-16T16:00", { weatherCode: 95, precipitationProbability: 80 })];
    const p = buildPredictions(hours, week(), TODAY);
    expect(p[0]?.kind).toBe("storm");
    expect(p.some((x) => x.kind === "rain")).toBe(false);
  });

  it("suggests a dry day for field work", () => {
    const p = buildPredictions([], week({ 0: { precipitationProbability: 80, precipitationSumMm: 5 } }), TODAY);
    const dry = p.find((x) => x.kind === "dry");
    expect(dry?.level).toBe("good");
    expect(dry?.title).toContain("Bukas");
  });

  it("does not suggest a dry day during a rainy week", () => {
    const rainy = Object.fromEntries(
      Array.from({ length: 7 }, (_, i) => [i, { precipitationProbability: 85, precipitationSumMm: 12 }]),
    );
    expect(buildPredictions([], week(rainy), TODAY).some((x) => x.kind === "dry")).toBe(false);
  });
});

describe("buildPredictions — time of day", () => {
  it("does not recommend today for field work in the evening", () => {
    const evening = [hour("2026-11-16T21:00", { isDay: false })];
    const dry = buildPredictions(evening, week(), TODAY).find((x) => x.kind === "dry");
    expect(dry?.title).toContain("Bukas");
  });
});
