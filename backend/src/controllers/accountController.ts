import { Request, Response } from "express";
import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import prisma from "../config/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/ApiError";
import { INACTIVITY_MONTHS, runInactivitySweep } from "../lib/inactivity";

const listAccountsSchema = z.object({
  status: z.enum(["all", "active", "inactive"]).default("all"),
  role: z.enum(["farmer", "technician", "officer", "all"]).default("farmer"),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

const ROLE_BY_PARAM: Record<string, Role> = {
  farmer: Role.FARMER,
  technician: Role.TECHNICIAN,
  officer: Role.OFFICER,
};

/** GET /api/v1/officer/accounts — DA view of registered accounts and their activity status. */
export const listAccounts = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const parsed = listAccountsSchema.safeParse(req.query);
    if (!parsed.success) {
      throw ApiError.badRequest(
        "Invalid query parameters",
        parsed.error.flatten().fieldErrors,
      );
    }
    const { status, role, search, page, pageSize } = parsed.data;

    // Make sure statuses are current even if the daily sweep hasn't run yet.
    await runInactivitySweep();

    const baseWhere: Prisma.UserWhereInput = {};
    const roleFilter = ROLE_BY_PARAM[role];
    if (roleFilter) baseWhere.role = roleFilter;
    if (search) {
      baseWhere.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        {
          farms: {
            some: { barangay: { contains: search, mode: "insensitive" } },
          },
        },
        {
          farms: {
            some: { municipality: { contains: search, mode: "insensitive" } },
          },
        },
      ];
    }

    const where: Prisma.UserWhereInput = { ...baseWhere };
    if (status === "active") where.isActive = true;
    if (status === "inactive") where.isActive = false;

    const [users, total, activeCount, inactiveCount] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: [{ isActive: "asc" }, { lastActiveAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isActive: true,
          lastActiveAt: true,
          createdAt: true,
          farmerProfile: { select: { rsbsaNumber: true } },
          farms: {
            select: { municipality: true, barangay: true },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      prisma.user.count({ where }),
      prisma.user.count({ where: { ...baseWhere, isActive: true } }),
      prisma.user.count({ where: { ...baseWhere, isActive: false } }),
    ]);

    const accounts = users.map((u) => {
      const firstFarm = u.farms[0];
      return {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        role: u.role,
        isActive: u.isActive,
        lastActiveAt: u.lastActiveAt.toISOString(),
        createdAt: u.createdAt.toISOString(),
        rsbsaNumber: u.farmerProfile?.rsbsaNumber ?? null,
        farmCount: u.farms.length,
        municipality: firstFarm?.municipality ?? null,
        barangay: firstFarm?.barangay ?? null,
      };
    });

    sendSuccess(res, 200, {
      data: {
        accounts,
        counts: {
          all: activeCount + inactiveCount,
          active: activeCount,
          inactive: inactiveCount,
        },
        pagination: { page, pageSize, total },
        inactivityMonths: INACTIVITY_MONTHS,
      },
    });
  },
);
