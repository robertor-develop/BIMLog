import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";

async function run() {
  const hash = await bcrypt.hash("Newstart123$45", 10);

  // Upsert company
  const coRes = await pool.query(
    `INSERT INTO companies (name) VALUES ($1)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    ["RRY Asociados"]
  );

  let companyId: number;
  if (coRes.rows.length > 0) {
    companyId = coRes.rows[0].id;
    console.log("Created company: RRY Asociados");
  } else {
    const existing = await pool.query(
      `SELECT id FROM companies WHERE name = $1`,
      ["RRY Asociados"]
    );
    companyId = existing.rows[0].id;
    console.log("Company already exists: RRY Asociados");
  }

  // Insert user
  const userRes = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, company_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id, full_name, email`,
    ["Roberto Rodriguez", "robertor@rryasociados.com", hash, companyId]
  );

  const user = userRes.rows[0];
  console.log(`OK Ready: ${user.full_name} <${user.email}>`);

  await pool.end();
}

run().catch(err => {
  console.error("ERROR Failed:", err.message);
  process.exit(1);
});
