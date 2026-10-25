/**
 * prisma/seed-demo-dashboard.ts
 *
 * Dev-only seed script that populates the local database with realistic demo
 * data for the Officer Portal dashboard. All rows are tagged with a "[DEMO]"
 * name prefix so they can be removed with a single command.
 *
 * Refuses to run when NODE_ENV=production.
 *
 * Usage:
 *   NODE_ENV=development npx tsx prisma/seed-demo-dashboard.ts
 *
 * To remove all demo data:
 *   NODE_ENV=development npx tsx prisma/seed-demo-dashboard.ts --cleanup
 */

import prisma from "../src/config/prisma";
import { computeScanVerdict } from "../src/lib/scanVerdict";

const IS_CLEANUP = process.argv.includes("--cleanup");

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run demo seed in NODE_ENV=production.");
  process.exit(1);
}

const BARANGAYS = [
  "Dabbac Grande",
  "San Antonio",
  "Bunugan",
  "Barsat East",
  "Agaman Norte",
];

// Approximate real coordinates within Baggao, Cagayan
const COORDS: Record<string, [number, number]> = {
  "Dabbac Grande": [18.1447, 121.8756],
  "San Antonio": [18.1300, 121.8900],
  Bunugan: [18.1500, 121.8600],
  "Barsat East": [18.1200, 121.9000],
  "Agaman Norte": [18.1600, 121.8500],
};

const DISASTER_TYPES = ["TYPHOON", "FLOOD", "DROUGHT", "PEST_OUTBREAK"];
const DIAGNOSES = [
  { diseaseDetected: "None", confidence: 0.92, severity: "LOW" },
  { diseaseDetected: "Northern Corn Leaf Blight", confidence: 0.88, severity: "MEDIUM" },
  { diseaseDetected: "Aspergillus Ear Rot", confidence: 0.94, severity: "CRITICAL" },
  { diseaseDetected: "Corn Leaf Aphid", confidence: 0.85, severity: "HIGH" },
  { diseaseDetected: "Common Rust", confidence: 0.81, severity: "MEDIUM" },
  { diseaseDetected: "Stalk Rot", confidence: 0.79, severity: "HIGH" },
];

const CASE_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "INSPECTED", "RESOLVED", "REJECTED"] as const;

const now = new Date();

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function randomDateBetween(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function cleanup() {
  console.log("Cleaning up demo data...");
  await prisma.expertRequest.deleteMany({ where: { observation: { title: { contains: "[DEMO]" } } } });
  await prisma.observation.deleteMany({ where: { title: { contains: "[DEMO]" } } });
  await prisma.plantScan.deleteMany({ where: { farmer: { phone: { contains: "DEMO" } } } });
  await prisma.disasterReport.deleteMany({ where: { farm: { name: { contains: "[DEMO]" } } } });
  await prisma.cropCycle.deleteMany({ where: { farm: { name: { contains: "[DEMO]" } } } });
  await prisma.farm.deleteMany({ where: { name: { contains: "[DEMO]" } } });
  await prisma.user.deleteMany({
    where: { phone: { contains: "DEMO" }, role: "FARMER" },
  });
  console.log("Demo data removed.");
  await prisma.$disconnect();
  process.exit(0);
}

async function main() {
  if (IS_CLEANUP) {
    await cleanup();
    return;
  }

  console.log("Seeding demo dashboard data...");

  // 1. Create demo farmers (25)
  const farmers = await Promise.all(
    BARANGAYS.flatMap((b, bi) =>
      Array.from({ length: 5 }, (_, i) =>
        prisma.user.create({
          data: {
            id: `demo-farmer-${bi}-${i}`,
            firstName: `Demo`,
            lastName: `Farmer ${bi * 5 + i + 1}`,
            phone: `DEMO-${bi * 5 + i + 1}`,
            role: "FARMER",
            farmerProfile: {
              create: {
                rsbsaNumber: `DEMO-RSBSA-${bi * 5 + i + 1}`,
                preferredLanguage: "filipino",
              },
            },
          },
        }),
      ),
    ),
  );
  console.log(`Created ${farmers.length} demo farmers.`);

  // 2. Create farms — control health distribution:
  //    60% healthy (15), 25% watch (6), 15% critical (4) = 25 farms
  const healthAssignments = [
    ...Array(15).fill("healthy"),
    ...Array(6).fill("watch"),
    ...Array(4).fill("critical"),
  ].sort(() => Math.random() - 0.5);

  const farms = await Promise.all(
    farmers.map((farmer, fi) => {
      const barangay = BARANGAYS[fi % BARANGAYS.length];
      const [lat, lng] = COORDS[barangay];
      const health = healthAssignments[fi];
      return prisma.farm.create({
        data: {
          id: `demo-farm-${fi}`,
          farmerId: farmer.id,
          name: `[DEMO] Sakahan ni ${farmer.lastName} ${fi + 1}`,
          municipality: "Baggao",
          barangay,
          areaHectares: Number((0.75 + Math.random() * 4.25).toFixed(2)),
          latitude: lat + (Math.random() - 0.5) * 0.02,
          longitude: lng + (Math.random() - 0.5) * 0.02,
        },
      });
    }),
  );
  console.log(`Created ${farms.length} demo farms.`);

  // 3. Create crop cycles with varied planting dates (all growth stages)
  const plantingOffsets = [-130, -110, -90, -70, -50, -30, -10, 5, 20];
  const cycles = await Promise.all(
    farms.map((farm) => {
      const offset = pick(plantingOffsets);
      return prisma.cropCycle.create({
        data: {
          id: `demo-cycle-${farm.id}`,
          farmId: farm.id,
          cropType: "corn",
          variety: pick(["IPB Var 6", "Pioneer 30Y90", "NK 6410", "Decalb 9091"]),
          plantingDate: daysAgo(Math.abs(offset)),
          expectedHarvestDate: daysAgo(Math.max(0, Math.abs(offset) - 90)),
          areaHectares: farm.areaHectares,
          status: "ACTIVE",
        },
      });
    }),
  );
  console.log(`Created ${cycles.length} demo crop cycles.`);

  // 4. Create PlantScans — multiple per farm, mix healthy/flagged
  //    Use computeScanVerdict for consistency.
  let scanCount = 0;
  for (const farm of farms) {
    const cycle = cycles.find((c) => c.farmId === farm.id);
    const numScans = 2 + Math.floor(Math.random() * 4); // 2-5 scans per farm
    for (let s = 0; s < numScans; s++) {
      const weekOffset = Math.floor(Math.random() * 8); // last 8 weeks
      const weekStart = daysAgo(7 * (7 - weekOffset));
      const d = pick(DIAGNOSES);
      // Bias toward flagged for watch/critical farms
      const isFlagged =
        Math.random() <
        (farm.id.endsWith("0") || farm.id.endsWith("1") || farm.id.endsWith("2")
          ? 0.6
          : 0.35);
      const severity = isFlagged ? pick(["MEDIUM", "HIGH", "CRITICAL"]) : d.severity;
      const verdict = computeScanVerdict({
        diagnosis: isFlagged ? d.diseaseDetected : "None",
        severity,
      });
      await prisma.plantScan.create({
        data: {
          id: `demo-scan-${farm.id}-${s}`,
          farmerId: farm.farmerId,
          cropCycleId: cycle?.id ?? null,
          rawResult: { diagnosis: d.diseaseDetected, confidence: d.confidence },
          diagnosis: d.diseaseDetected,
          confidence: d.confidence,
          severity: severity as any,
          verdict: verdict as any,
          createdAt: randomDateBetween(weekStart, new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000)),
        },
      });
      scanCount++;
    }
  }
  console.log(`Created ${scanCount} demo plant scans.`);

  // 5. Create Observations and ExpertRequests per farm health target.
  //    Healthy (15): only LOW/MEDIUM observations, no open cases.
  //    Watch (6): HIGH/MEDIUM observations, open cases (no critical).
  //    Critical (4): CRITICAL observations, open cases (some overdue >48h).
  const techUser = await prisma.user.upsert({
    where: { id: "demo-tech-1" },
    update: {},
    create: {
      id: "demo-tech-1",
      firstName: "Demo",
      lastName: "Technician",
      phone: "DEMO-TECH-1",
      role: "TECHNICIAN",
    },
  });

  let obsCount = 0;
  let caseCount = 0;
  for (const [fi, farm] of farms.entries()) {
    const cycle = cycles.find((c) => c.farmId === farm.id);
    const health = healthAssignments[fi];
    const numObs = 1 + Math.floor(Math.random() * 3); // 1-3 observations

    for (let j = 0; j < numObs; j++) {
      let severity: string;
      if (health === "healthy") {
        severity = pick(["LOW", "LOW", "MEDIUM"]); // mostly low
      } else if (health === "watch") {
        severity = pick(["MEDIUM", "HIGH", "HIGH"]); // no critical
      } else {
        severity = pick(["CRITICAL", "HIGH", "CRITICAL"]); // critical bias
      }

      const d = pick(DIAGNOSES);
      await prisma.observation.create({
        data: {
          id: `demo-obs-${farm.id}-${j}`,
          cropCycleId: cycle!.id,
          farmerId: farm.farmerId,
          title: `[DEMO] ${d.diseaseDetected === "None" ? "Healthy leaf check" : d.diseaseDetected}`,
          description: `Demo observation for ${farm.barangay}.`,
          imageUrl: null,
          aiDiagnosis: { diseaseDetected: d.diseaseDetected, confidence: d.confidence },
          severity: severity as any,
          scanId: null,
          createdAt: daysAgo(Math.floor(Math.random() * 60)),
        },
      });
      obsCount++;

      // Create an ExpertRequest for HIGH/CRITICAL observations
      if (severity === "HIGH" || severity === "CRITICAL") {
        const isCriticalCase = severity === "CRITICAL";
        const shouldHaveCase = health === "critical" ? 0.9 : health === "watch" ? 0.7 : 0;
        if (Math.random() < shouldHaveCase) {
          const status = pick(CASE_STATUSES);
          let firstResponseAt: Date | null = null;
          let resolvedAt: Date | null = null;
          let assignedTechnicianId: string | null = null;
          let createdAt = daysAgo(Math.floor(Math.random() * 10));

          // Make critical cases more likely to be overdue (>48h)
          const isOverdue = isCriticalCase && Math.random() < 0.6;
          if (isOverdue) {
            createdAt = daysAgo(3); // >48h waiting
          }

          if (status !== "SUBMITTED") {
            firstResponseAt = daysAgo(Math.floor(Math.random() * 10));
            assignedTechnicianId = techUser.id;
          }
          if (status === "RESOLVED") {
            resolvedAt = daysAgo(Math.floor(Math.random() * 5));
          }

          await prisma.expertRequest.create({
            data: {
              id: `demo-case-${farm.id}-${j}`,
              observationId: `demo-obs-${farm.id}-${j}`, // must match observation id
              status: status as any,
              firstResponseAt,
              resolvedAt,
              recommendation: status === "RESOLVED" ? "Apply fungicide and monitor weekly." : null,
              assignedTechnicianId,
              createdAt,
              updatedAt: createdAt,
            },
          });
          caseCount++;
        }
      }
    }
  }
  console.log(`Created ${obsCount} demo observations.`);
  console.log(`Created ${caseCount} demo expert cases.`);

  // 6. Create DisasterReports
  const disasters = await Promise.all(
    farms.slice(0, 10).map(async (farm) => {
      const dt = pick(DISASTER_TYPES);
      const damage = Number((10 + Math.random() * 85).toFixed(2));
      const estimatedLoss = Number((damage * 15000 * Number(farm.areaHectares)).toFixed(2));
      return prisma.disasterReport.create({
        data: {
          id: `demo-disaster-${farm.id}`,
          farmId: farm.id,
          disasterType: dt,
          damagePercentage: damage,
          estimatedLoss,
          status: pick(["SUBMITTED", "UNDER_REVIEW", "RESOLVED"]) as any,
          verifiedById: null,
          notes: `[DEMO] ${dt} damage reported in ${farm.barangay}, Baggao.`,
          createdAt: daysAgo(Math.floor(Math.random() * 45)),
        },
      });
    }),
  );
  await Promise.all(disasters);
  console.log(`Created ${disasters.length} demo disaster reports.`);

  console.log("Demo seed complete.");
  console.log(
    `Farms: ${farms.length} | Cycles: ${cycles.length} | Scans: ${scanCount} | Observations: ${obsCount} | Cases: ${caseCount} | Disasters: ${disasters.length}`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
