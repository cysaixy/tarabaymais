// scripts/provisionAdminUser.ts
import { auth } from "../config/firebase";

async function provisionUser(uid: string, role: "technician" | "officer") {
  // Set custom claims in Firebase Auth Token
  await auth.setCustomUserClaims(uid, { role: role.toUpperCase() });
  console.log(
    `Successfully assigned custom claim '${role.toUpperCase()}' to UID: ${uid}`,
  );
}

// Example usage: npx ts-node scripts/provisionAdminUser.ts <FIREBASE_UID> technician
const [, , uid, role] = process.argv;
if (uid && (role === "technician" || role === "officer")) {
  provisionUser(uid, role as "technician" | "officer");
} else {
  console.error(
    "Usage: npx ts-node scripts/provisionAdminUser.ts <UID> <technician|officer>",
  );
}
