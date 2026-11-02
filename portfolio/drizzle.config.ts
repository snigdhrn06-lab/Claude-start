import { defineConfig } from "drizzle-kit";

// Used only by `npm run db:generate` to turn src/lib/db/schema.ts into SQL migrations in ./drizzle.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://postgres@localhost:5432/portfolio" },
});
