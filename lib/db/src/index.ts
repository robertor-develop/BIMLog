import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString = process.env.PROD_DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "PROD_DATABASE_URL is not set. Refusing to start.\n" +
    "This application must connect to the production database (Neon). There is " +
    "NO silent fallback to DATABASE_URL — falling back would risk connecting to " +
    "the wrong database and losing user data. Set PROD_DATABASE_URL in this " +
    "environment's secrets (it must be present in BOTH the workspace and the " +
    "deployment secret scopes).",
  );
}
console.log("[DB] Connecting to:", connectionString.replace(/:\/\/.*@/, "://***@"));
export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });

export * from "./schema";
