import {
  PrismaClient,
  SeverityLevel,
  ActivityType,
  CaseStatus,
} from "@prisma/client";
import { FcmService } from "./fcm.service";
import prisma from "../config/prisma";
import { invalidateAnalyticsCache } from "../controllers/analyticsController";

export interface SyncAction {
  clientRefId: string;
  actionType:
    | "CREATE_OBSERVATION"
    | "CREATE_CROP_ACTIVITY"
    | "CREATE_DISASTER_REPORT";
  payload: any;
  clientTimestamp?: string;
}

export interface SyncResult {
  clientRefId: string;
  serverId?: string;
  status: "SUCCESS" | "FAILED" | "ORPHANED";
  error?: string;
}

export class SyncService {
  /**
   * Process array of offline queued actions safely.
   */
  static async processBatch(userId: string, actions: SyncAction[]) {
    const results: SyncResult[] = [];

    for (const action of actions) {
      try {
        switch (action.actionType) {
          case "CREATE_OBSERVATION": {
            const {
              cropCycleId,
              title,
              description,
              imageUrl,
              aiDiagnosis,
              severity,
              idempotencyKey,
            } = action.payload;

            // Idempotency: if this key was already processed, return success
            // without inserting a duplicate. Handles network drop mid-request.
            if (idempotencyKey) {
              const existing = await prisma.observation.findUnique({
                where: { idempotencyKey },
              });
              if (existing) {
                results.push({
                  clientRefId: action.clientRefId,
                  serverId: existing.id,
                  status: "SUCCESS",
                });
                break;
              }
            }

            // Verify cropCycle exists in PostgreSQL
            const cropCycle = await prisma.cropCycle.findUnique({
              where: { id: cropCycleId },
            });
            if (!cropCycle) {
              results.push({
                clientRefId: action.clientRefId,
                status: "ORPHANED",
                error: "Target crop cycle not found",
              });
              break;
            }

            const observation = await prisma.observation.create({
              data: {
                cropCycleId,
                farmerId: userId,
                title,
                description,
                imageUrl: imageUrl || null,
                aiDiagnosis: aiDiagnosis || null,
                severity: severity || SeverityLevel.LOW,
                ...(idempotencyKey ? { idempotencyKey } : {}),
              },
            });

            // Auto-escalate high or critical severity observations synced offline
            if (
              observation.severity === SeverityLevel.HIGH ||
              observation.severity === SeverityLevel.CRITICAL
            ) {
              const expertRequest = await prisma.expertRequest.create({
                data: {
                  observationId: observation.id,
                  status: CaseStatus.SUBMITTED,
                },
              });

              await FcmService.sendToRole(
                "TECHNICIAN",
                "🚨 Offline Alert Escalation",
                `New ${observation.severity} observation synced: "${observation.title}"`,
                { caseId: expertRequest.id, observationId: observation.id },
              );

              await invalidateAnalyticsCache();
            }
            results.push({
              clientRefId: action.clientRefId,
              serverId: observation.id,
              status: "SUCCESS",
            });
            break;
            //
          }

          case "CREATE_CROP_ACTIVITY": {
            const {
              cropCycleId,
              activityType,
              description,
              costAmount,
              performedAt,
            } = action.payload;

            const cropCycle = await prisma.cropCycle.findUnique({
              where: { id: cropCycleId },
            });
            if (!cropCycle) {
              results.push({
                clientRefId: action.clientRefId,
                status: "ORPHANED",
                error: "Target crop cycle not found",
              });
              break;
            }

            const activity = await prisma.cropActivity.create({
              data: {
                cropCycleId,
                activityType: activityType as ActivityType,
                description,
                costAmount: costAmount ? Number(costAmount) : null,
                performedAt: new Date(
                  performedAt || action.clientTimestamp || Date.now(),
                ),
              },
            });
            results.push({
              clientRefId: action.clientRefId,
              serverId: activity.id,
              status: "SUCCESS",
            });
            break;
            //
          }
          case "CREATE_DISASTER_REPORT": {
            const {
              farmId,
              disasterType,
              damagePercentage,
              estimatedLoss,
              notes,
            } = action.payload;

            const farm = await prisma.farm.findUnique({
              where: { id: farmId },
            });
            if (!farm) {
              results.push({
                clientRefId: action.clientRefId,
                status: "ORPHANED",
                error: "Target farm not found",
              });
              break;
            }

            const report = await prisma.disasterReport.create({
              data: {
                farmId,
                disasterType,
                damagePercentage: Number(damagePercentage),
                estimatedLoss: estimatedLoss ? Number(estimatedLoss) : null,
                notes: notes || null,
                status: CaseStatus.SUBMITTED,
              },
            });

            await invalidateAnalyticsCache();

            results.push({
              clientRefId: action.clientRefId,
              serverId: report.id,
              status: "SUCCESS",
            });
            break;
            //
          }
          default:
            results.push({
              clientRefId: action.clientRefId,
              status: "FAILED",
              error: "Unsupported sync action type",
            });
        }
      } catch (error: any) {
        results.push({
          clientRefId: action.clientRefId,
          status: "FAILED",
          error: error.message,
        });
      }
    }
    return {
      total: actions.length,
      processed: results.filter((r) => r.status === "SUCCESS").length,
      failed: results.filter((r) => r.status !== "SUCCESS").length,
      results,
    };
  }
}
