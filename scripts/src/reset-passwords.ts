import { db, pool } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const hash = await bcrypt.hash("Demo1234!", 10);

await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.email, "roberto@bimtechcorp.com"));
await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.email, "maria@bimtechcorp.com"));
await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.email, "tom@ddsmechanical.com"));

console.log("Passwords reset for all 3 seed users");
await pool.end();
