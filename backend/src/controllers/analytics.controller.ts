import { Request, Response } from "express";
import { ExportService, ExportFilters } from "../services/export.service";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { z } from "zod";

// ── Input schema ──────────────────────────────────────────────────────────────

const exportQuerySchema = z.object({
  type: z
    .enum(["disaster-claims", "barangay-summary"])
    .default("disaster-claims"),
  format: z.enum(["xlsx", "csv"]).default("xlsx"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  barangay: z.string().optional(),
});

// ── Controller ────────────────────────────────────────────────────────────────

/** GET /api/v1/analytics-report/export */
export const exportAnalyticsReport = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const parseResult = exportQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      throw ApiError.badRequest(
        "Invalid query parameters",
        parseResult.error.flatten().fieldErrors,
      );
    }

    const parsedFilters = parseResult.data;

    const filters: ExportFilters = {
      type: parsedFilters.type,
      format: parsedFilters.format,
      ...(parsedFilters.startDate !== undefined && {
        startDate: parsedFilters.startDate,
      }),
      ...(parsedFilters.endDate !== undefined && {
        endDate: parsedFilters.endDate,
      }),
      ...(parsedFilters.barangay !== undefined && {
        barangay: parsedFilters.barangay,
      }),
    };

    let fileBuffer: Buffer;
    let fileName: string;

    if (filters.type === "barangay-summary") {
      fileBuffer = await ExportService.generateBarangaySummaryReport(filters);
      fileName = `TarabayMais_Barangay_Summary_${Date.now()}`;
    } else {
      fileBuffer = await ExportService.generateDisasterClaimsReport(filters);
      fileName = `TarabayMais_Disaster_Claims_${Date.now()}`;
    }

    if (filters.format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}.csv"`,
      );
    } else {
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}.xlsx"`,
      );
    }

    res.status(200).send(fileBuffer);
  },
);
