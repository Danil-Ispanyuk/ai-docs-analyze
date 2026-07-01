import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 connects through a driver adapter. The runtime client uses the
// pooled DATABASE_URL. This client is for schema/migrations-driven access only
// and bypasses RLS — never use it for per-user reads/writes (use the Supabase
// client for those).
//
// Reuse a single instance across dev hot reloads to avoid exhausting connections.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
