import { db, pool } from "@workspace/db";
import { projectMembersTable, projectsTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const allUsers = await db.select().from(usersTable);
console.log("ALL USERS:");
allUsers.forEach(u => console.log(`  id=${u.id} email=${u.email} name=${u.fullName}`));

const allProjects = await db.select().from(projectsTable);
console.log("\nALL PROJECTS:");
allProjects.forEach(p => console.log(`  id=${p.id} name=${p.name} code=${p.code}`));

const user = allUsers.find(u => u.email === "robertor@rryasociados.com");
if (!user) {
  console.log("\nERROR: user not found");
  await pool.end();
  process.exit(1);
}
console.log(`\nTARGET USER: id=${user.id} email=${user.email}`);

const deleted = await db
  .delete(projectMembersTable)
  .where(eq(projectMembersTable.userId, user.id))
  .returning();
console.log(`\nDeleted ${deleted.length} existing membership(s)`);

for (const project of allProjects) {
  await db.insert(projectMembersTable).values({
    userId: user.id,
    projectId: project.id,
    role: "project_admin",
  });
  console.log(`  Added project_admin → project id=${project.id} (${project.name})`);
}

console.log("\nDONE");
await pool.end();
