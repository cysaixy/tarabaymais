import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// 1. Create a connection pool using your environment variable
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// 2. Instantiate the Prisma driver adapter
const adapter = new PrismaPg(pool);

// 3. Pass the adapter directly into PrismaClient
const prisma = new PrismaClient({ adapter });

export default prisma;
