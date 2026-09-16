import { Request, Response } from "express";
import { ExportService, ExportFilters } from "../services/export.service";

export const exportAnalyticsReport = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      type = "disaster-claims",
      format = "xlsx",
      startDate,
      endDate,
      barangay,
    } = req.query;

    const filters: ExportFilters = {
      type: type as "disaster-claims" | "barangay-summary",
      format: format as "xlsx" | "csv",
      startDate: startDate as string,
      endDate: endDate as string,
      barangay: barangay as string,
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
  } catch (error: any) {
    console.error("Export Generation Error:", error);
    res.status(500).json({
      error: "Failed to generate export file",
      details: error.message,
    });
  }
};
