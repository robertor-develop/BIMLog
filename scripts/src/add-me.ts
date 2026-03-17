import { db, pool } from "@workspace/db";
import { projectMembersTable, projectsTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const user = await db.select().from(usersTable).where(eq(usersTable.email, "robertor@rryasociados.com")).limit(1);
const project = await db.select().from(projectsTable).limit(1);

if (user[0] && project[0]) {
  await db.insert(projectMembersTable).values({
    userId: user[0].id,
    projectId: project[0].id,
    role: "project_admin"
  }).onConflictDoNothing();
  console.log(`Added ${user[0].fullName} to ${project[0].name}`);
}

await pool.end();
