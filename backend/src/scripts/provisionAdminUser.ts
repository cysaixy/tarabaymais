// scripts/provisionAdminUser.ts
import { Role } from "@prisma/client";
import { auth } from "../config/firebase";
import prisma from "../config/prisma";

type ProvisionRole = "technician" | "officer";

async function provisionUser(uid: string, role: ProvisionRole): Promise<void> {
  const databaseRole = role === "technician" ? Role.TECHNICIAN : Role.OFFICER;

  await auth.setCustomUserClaims(uid, {
    role: databaseRole,
  });

  const user = await prisma.user.update({
    where: {
      id: uid,
    },
    data: {
      role: databaseRole,
    },
  });

  console.log(`Successfully assigned ${databaseRole} to Firebase UID ${uid}.`);
  console.log(`Database user updated: ${user.id}`);
}

const [, , uid, role] = process.argv;

if (!uid || (role !== "technician" && role !== "officer")) {
  console.error(
    "Usage: npx tsx src/scripts/provisionAdminUser.ts <UID> <technician|officer>",
  );
  process.exit(1);
}

provisionUser(uid, role)
  .catch((error) => {
    console.error("Failed to provision user:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// npx tsx src/scripts/provisionAdminUser.ts <UID> <technician|officer>
