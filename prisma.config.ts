import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Prisma 7 reads connection URLs from here, not from schema.prisma.
// Load Next's .env.local first (Prisma doesn't read it automatically),
// then fall back to .env.
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations use the DIRECT (non-pooled, port 5432) connection.
    // The runtime client uses the pooled DATABASE_URL via the adapter
    // in shared/api/prisma.ts.
    url: env("DIRECT_URL"),
  },
});
