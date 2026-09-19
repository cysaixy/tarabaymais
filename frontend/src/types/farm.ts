/**
 * Farm as returned by the backend.
 *
 * Note: Prisma `Decimal` columns (areaHectares, latitude, longitude) serialize
 * to strings in JSON, so they are typed as `string | number` and should be
 * coerced with Number() for display or math.
 */
export interface Farm {
  id: string;
  farmerId: string;
  name: string;
  municipality: string;
  barangay: string;
  areaHectares: string | number;
  latitude: string | number | null;
  longitude: string | number | null;
  createdAt: string;
  updatedAt: string;
  cropCycles?: unknown[];
}

/** Payload accepted by POST /farm. */
export interface CreateFarmPayload {
  name: string;
  municipality: string;
  barangay: string;
  areaHectares: number;
  latitude?: number | null;
  longitude?: number | null;
}
