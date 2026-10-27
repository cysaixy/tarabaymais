import { User, FarmerProfile, Role } from "@prisma/client";
import { DecodedIdToken } from "firebase-admin/auth";

export type UserWithProfile = User & { farmerProfile: FarmerProfile | null };

declare global {
  namespace Express {
    interface Request {
      firebaseUser?: DecodedIdToken;
      user?: UserWithProfile;
    }
  }
}
