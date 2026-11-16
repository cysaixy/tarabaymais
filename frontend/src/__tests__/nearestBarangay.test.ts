import { describe, expect, it } from "vitest";
import { CAGAYAN_LOCATION_DATA } from "../data/cagayanLocations";
import {
  findNearestBarangay,
  nearestBarangayCandidateCount,
} from "../lib/nearestBarangay";

describe("findNearestBarangay", () => {
  it("has barangay points that match the form dropdowns", () => {
    expect(nearestBarangayCandidateCount).toBeGreaterThan(0);
  });

  it("returns a municipality/barangay pair that exists in the dropdown", () => {
    const result = findNearestBarangay(17.621, 121.738); // Annafunan East, Tuguegarao
    expect(result).not.toBeNull();
    expect(result!.municipality).toBe("Tuguegarao City");
    expect(CAGAYAN_LOCATION_DATA[result!.municipality]).toContain(result!.barangay);
  });

  it("returns null for points far outside Cagayan", () => {
    expect(findNearestBarangay(14.6, 121.0)).toBeNull(); // Manila
  });
});
