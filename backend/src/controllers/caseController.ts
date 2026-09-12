import { Role } from "@prisma/client";
import { Request, Response } from "express";
import prisma from "../config/prisma";
import { CaseStatus } from "@prisma/client";
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
