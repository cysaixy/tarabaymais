import { Role } from "@prisma/client";
import { Request, Response } from "express";
import prisma from "../config/prisma";
import { CaseStatus } from "@prisma/client";
import { FcmService } from "../services/fcm.service";
export const getUnifiedCases = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const userRole = req.user!.role;

  try {
    let expertCasesWhere = {};
    let disasterCasesWhere = {};

    if (userRole === Role.FARMER) {
      expertCasesWhere = {
        observation: {
          farmerId: userId,
        },
      };
      disasterCasesWhere = {
        farm: {
          farmerId: userId,
        },
      };
    }

    const [expertRequests, disasterReports] = await Promise.all([
      prisma.expertRequest.findMany({
        where: expertCasesWhere,
        include: {
          observation: {
            include: {
              cropCycle: {
                include: { farm: true },
              },
            },
          },
          assignedTechnician: {
            select: { firstName: true, lastName: true, phone: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.disasterReport.findMany({
        where: disasterCasesWhere,
        include: {
          farm: true,
          verifiedBy: {
            select: { firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return res.status(200).json({
      pipeline: {
        expertCases: expertRequests,
        disasterCases: disasterReports,
      },
    });
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: "Failed to fetch case pipeline", details: error.message });
  }
};

export const updateCaseStatus = async (req: Request, res: Response) => {
  const { caseId } = req.params;
  const { caseType, status, recommendation, assignedTechnicianId } = req.body;

  if (!Object.values(CaseStatus).includes(status)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  try {
    if (caseType === "EXPERT_REQUEST") {
      const updateData = {
        status,
        ...(recommendation !== undefined && {
          recommendation,
        }),
        ...(assignedTechnicianId && {
          assignedTechnician: {
            connect: { id: assignedTechnicianId },
          },
        }),
        ...(status === CaseStatus.RESOLVED && {
          resolvedAt: new Date(),
        }),
      };

      const updated = await prisma.expertRequest.update({
        where: { id: caseId as string },
        data: updateData,
      });

      return res.status(200).json({ updatedCase: updated });
    }

    if (caseType === "DISASTER_REPORT") {
      const updated = await prisma.disasterReport.update({
        where: { id: caseId as string },
        data: {
          status,
          verifiedById: req.user!.id,
        },
      });
      return res.status(200).json({ updatedCase: updated });
    }

    return res.status(400).json({ error: "Invalid caseType specified" });
  } catch (error: any) {
    return res
      .status(400)
      .json({ error: "Failed to update case status", details: error.message });
  }
};

export const createDisasterReport = async (req: Request, res: Response) => {
  const { farmId } = req.params;
  const { disasterType, damagePercentage, estimatedLoss, notes } = req.body;

  try {
    const farm = await prisma.farm.findFirst({
      where: {
        id: farmId as string,
        farmerId: req.user!.id,
      },
    });

    if (!farm) {
      return res.status(404).json({
        error: "Farm not found or access denied",
      });
    }

    const report = await prisma.disasterReport.create({
      data: {
        farmId: farmId as string,
        disasterType,
        damagePercentage: parseFloat(damagePercentage),
        estimatedLoss: estimatedLoss ? parseFloat(estimatedLoss) : null,
        notes: notes || null,
        status: CaseStatus.SUBMITTED,
      },
    });

    return res.status(201).json({ disasterReport: report });
  } catch (error: any) {
    return res.status(400).json({
      error: "Failed to submit disaster report",
      details: error.message,
    });
  }
};

export const resolveExpertCase = async (req: Request, res: Response) => {
  const { caseId } = req.params;
  const { recommendation, status } = req.body;

  try {
    const updatedCase = await prisma.expertRequest.update({
      where: { id: caseId as string },
      data: {
        recommendation,
        status: status || CaseStatus.RESOLVED,
        assignedTechnicianId: req.user!.id,
        resolvedAt: status === CaseStatus.RESOLVED ? new Date() : null,
      },
      include: {
        observation: {
          include: { farmer: true, cropCycle: true },
        },
      },
    });

    await FcmService.sendToUser(
      updatedCase.observation.farmerId,
      "✅ Crop Issue Recommendation Updated",
      `A field technician has responded to your observation: "${updatedCase.observation.title}"`,
      {
        caseId: updatedCase.id,
        type: "CASE_RESOLVED",
      },
    );

    return res.status(200).json({ resolvedCase: updatedCase });
  } catch (error: any) {
    return res
      .status(400)
      .json({ error: "Failed to resolve case", details: error.message });
  }
};
