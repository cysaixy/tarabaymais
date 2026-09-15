import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import prisma from "../config/prisma";

export interface ExportFilters {
  type?: "disater-claims" | "barangay-summary";
  format?: "xlsx" | "csv";
  startDate?: string;
  endDate?: string;
  barangay?: string;
}

export class ExportService {
  /**
   * Generates a detailed Disaster Claims export workbook.
   */
  static async generateDisasterClaimsReport(
    filters: ExportFilters,
  ): Promise<Buffer> {
    const { startDate, endDate, barangay } = filters;

    const whereClause: any = {};

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate);
      if (endDate) whereClause.createdAt.lte = new Date(endDate);
    }

    if (barangay) {
      whereClause.cropCycle = {
        farm: { barangay: { equals: barangay, mode: "insensitive" } },
      };
    }

    const reports = await prisma.disasterReport.findMany({
      where: whereClause,
      include: {
        farm: {
          include: {
            farmer: true,
            cropCycles: {
              where: { status: "ACTIVE" },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Tarabay-Mais System";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Disaster Reports");

    // Define Worksheet Columns based on DisasterReport model
    worksheet.columns = [
      { header: "Report ID", key: "id", width: 36 },
      { header: "Farmer Name", key: "farmerName", width: 25 },
      { header: "Contact Number", key: "phone", width: 16 },
      { header: "Farm Name", key: "farmName", width: 20 },
      { header: "Barangay", key: "barangay", width: 20 },
      { header: "Municipality", key: "municipality", width: 20 },
      { header: "Disaster Type", key: "disasterType", width: 18 },
      { header: "Crop Variety", key: "variety", width: 15 },
      { header: "Damage (%)", key: "damagePercentage", width: 15 },
      { header: "Estimated Loss (PHP)", key: "estimatedLoss", width: 22 },
      { header: "Status", key: "status", width: 15 },
      { header: "Submission Date", key: "createdAt", width: 18 },
    ];

    // Style Header Row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "1E40AF" }, // Dark Blue
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };

    // Populate Rows
    reports.forEach((report) => {
      const farm = report.farm;
      const farmer = farm.farmer;
      const activeCropCycle = farm.cropCycles[0];

      worksheet.addRow({
        id: report.id,
        farmerName: `${farmer.firstName} ${farmer.lastName}`,
        phone: farmer.phone,
        farmName: farm.name,
        barangay: farm.barangay,
        municipality: farm.municipality,
        disasterType: report.disasterType,
        variety: activeCropCycle?.variety || "N/A",
        damagePercentage: Number(report.damagePercentage || 0),
        estimatedLoss: Number(report.estimatedLoss || 0),
        status: report.status,
        createdAt: report.createdAt.toISOString().split("T")[0],
      });
    });

    // Format Number & Currency Columns
    worksheet.getColumn("damagePercentage").numFmt = '0.00"%"';
    worksheet.getColumn("estimatedLoss").numFmt = "₱#,##0.00";

    if (filters.format === "csv") {
      const csvBuffer = await workbook.csv.writeBuffer();
      return Buffer.from(csvBuffer);
    }

    const xlsxBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(xlsxBuffer);
  }

  /**
   * Generates a Barangay-level aggregated damage summary report.
   */
  static async generateBarangaySummaryReport(
    filters: ExportFilters,
  ): Promise<Buffer> {
    const summaryData = await prisma.$queryRaw<
      Array<{
        barangay: string;
        total_reports: bigint;
        avg_damage_pct: number;
        total_financial_loss: number;
      }>
    >`
      SELECT 
        f.barangay,
        COUNT(dr.id) AS total_reports,
        COALESCE(AVG(dr.damage_percentage), 0) AS avg_damage_pct,
        COALESCE(SUM(dr.estimated_loss), 0) AS total_financial_loss
      FROM disaster_reports dr
      JOIN farms f ON dr.farm_id = f.id
      GROUP BY f.barangay
      ORDER BY total_financial_loss DESC;
    `;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Barangay Summary");

    worksheet.columns = [
      { header: "Barangay", key: "barangay", width: 25 },
      { header: "Total Disaster Reports", key: "totalReports", width: 22 },
      { header: "Avg Damage (%)", key: "avgDamagePct", width: 18 },
      {
        header: "Total Est. Financial Loss (PHP)",
        key: "totalLoss",
        width: 30,
      },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "065F46" }, // Dark Green
    };

    summaryData.forEach((row) => {
      worksheet.addRow({
        barangay: row.barangay,
        totalReports: Number(row.total_reports),
        avgDamagePct: Number(row.avg_damage_pct),
        totalLoss: Number(row.total_financial_loss),
      });
    });

    worksheet.getColumn("avgDamagePct").numFmt = '0.00"%"';
    worksheet.getColumn("totalLoss").numFmt = "₱#,##0.00";

    if (filters.format === "csv") {
      const csvBuffer = await workbook.csv.writeBuffer();
      return Buffer.from(csvBuffer);
    }

    const xlsxBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(xlsxBuffer);
  }
}
