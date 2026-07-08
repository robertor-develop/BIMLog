import bcrypt from "bcryptjs";
import { db, pool } from "@workspace/db";
import {
  companiesTable,
  usersTable,
  projectsTable,
  projectMembersTable,
  filesTable,
  namingConventionsTable,
  namingFieldsTable,
  rfisTable,
  submittalsTable,
  activityLogTable,
} from "@workspace/db/schema";

async function seed() {
  console.log("Seeding database...\n");

  // Companies
  const [bimtech] = await db
    .insert(companiesTable)
    .values({ name: "BIMtech Corp" })
    .returning();
  const [dds] = await db
    .insert(companiesTable)
    .values({ name: "DDS Mechanical" })
    .returning();
  console.log(`OK Companies: ${bimtech!.name}, ${dds!.name}`);

  // Users
  const hash = await bcrypt.hash("Demo1234!", 10);

  const [roberto] = await db
    .insert(usersTable)
    .values({ fullName: "Roberto Rodriguez", email: "roberto@bimtechcorp.com", passwordHash: hash, companyId: bimtech!.id })
    .returning();
  const [maria] = await db
    .insert(usersTable)
    .values({ fullName: "Maria Sanchez", email: "maria@bimtechcorp.com", passwordHash: hash, companyId: bimtech!.id })
    .returning();
  const [tom] = await db
    .insert(usersTable)
    .values({ fullName: "Tom Davis", email: "tom@ddsmechanical.com", passwordHash: hash, companyId: dds!.id })
    .returning();
  console.log(`OK Users: ${roberto!.fullName}, ${maria!.fullName}, ${tom!.fullName}`);

  // Project
  const [project] = await db
    .insert(projectsTable)
    .values({
      name: "270 Park Avenue",
      code: "NYC-270",
      description: "Full MEP coordination and BIM management for the new JPMorgan Chase HQ tower, New York",
      status: "active",
      createdById: roberto!.id,
    })
    .returning();
  console.log(`OK Project: ${project!.name} (${project!.code})`);

  // Members
  await db.insert(projectMembersTable).values([
    { projectId: project!.id, userId: roberto!.id, role: "project_admin" },
    { projectId: project!.id, userId: maria!.id,   role: "drafter" },
    { projectId: project!.id, userId: tom!.id,     role: "drafter" },
  ]);
  console.log(`OK Members: 3 added`);

  // Naming Convention
  const [convention] = await db
    .insert(namingConventionsTable)
    .values({ projectId: project!.id, separator: "-", isActive: true })
    .returning();

  const fieldDefs = [
    { label: "Project Code", fieldOrder: 0, allowedValues: ["NYC-270"] },
    { label: "Originator",   fieldOrder: 1, allowedValues: ["BTC", "DDS", "ACM", "PCE"] },
    { label: "Volume",       fieldOrder: 2, allowedValues: ["ARC", "STR", "MEP", "ELE", "PLM", "CIV"] },
    { label: "Level",        fieldOrder: 3, allowedValues: ["B1", "G0", "L1", "L2", "L3", "L4", "L5", "RF", "ZZ"] },
    { label: "Type",         fieldOrder: 4, allowedValues: ["M3", "DR", "SP", "CA", "RP", "SH"] },
    { label: "Role",         fieldOrder: 5, allowedValues: ["A", "S", "M", "E", "P", "X"] },
    { label: "Sequence",     fieldOrder: 6, allowedValues: ["0001","0002","0003","0004","0005","0006","0007","0008","0009","0010"] },
    { label: "Status",       fieldOrder: 7, allowedValues: ["S0","S1","S2","S3","S4","S5","S6"] },
  ];

  await db.insert(namingFieldsTable).values(
    fieldDefs.map(f => ({ ...f, conventionId: convention!.id }))
  );
  console.log(`OK Convention: 8 fields defined`);

  // Files
  const now = new Date();

  const fileDefs = [
    { fileName: "NYC-270-BTC-ARC-L3-M3-A-0001-S3.rvt",  fileType: "rvt", fileSize: 45200000,  status: "active",   uploadedById: maria!.id },
    { fileName: "NYC-270-BTC-MEP-ZZ-M3-X-0001-S2.nwd",  fileType: "nwd", fileSize: 128000000, status: "active",   uploadedById: maria!.id },
    { fileName: "NYC-270-BTC-STR-L1-DR-S-0001-S3.pdf",  fileType: "pdf", fileSize: 2400000,   status: "active",   uploadedById: roberto!.id },
    { fileName: "NYC-270-DDS-MEP-L3-DR-M-0001-S1.dwg",  fileType: "dwg", fileSize: 8700000,   status: "active",   uploadedById: tom!.id },
    { fileName: "NYC-270-DDS-MEP-L4-DR-M-0002-S1.dwg",  fileType: "dwg", fileSize: 9100000,   status: "active",   uploadedById: tom!.id },
    { fileName: "MEP_floor3_FINAL_v2.dwg",               fileType: "dwg", fileSize: 7300000,   status: "rejected", uploadedById: tom!.id },
    { fileName: "coordination_composite_March.nwd",       fileType: "nwd", fileSize: 95000000,  status: "rejected", uploadedById: tom!.id },
    { fileName: "Structure_Level1_latest.rvt",            fileType: "rvt", fileSize: 38500000,  status: "active",   uploadedById: maria!.id },
  ];

  const insertedFiles = await db
    .insert(filesTable)
    .values(fileDefs.map(f => ({ ...f, projectId: project!.id, version: 1 })))
    .returning();
  console.log(`OK Files: ${insertedFiles.length} inserted`);

  // Activity Log
  const activityEntries = insertedFiles.flatMap(f => {
    const uploader    = f.uploadedById === maria!.id ? maria! : f.uploadedById === roberto!.id ? roberto! : tom!;
    const uploaderCo  = f.uploadedById === tom!.id ? dds!.name : bimtech!.name;

    const upload = {
      projectId: project!.id,
      userId: uploader.id,
      userFullName: uploader.fullName,
      userCompanyName: uploaderCo,
      actionType: "UPLOAD",
      entityType: "file",
      entityId: f.id,
      fileNameBefore: null,
      fileNameAfter: f.fileName,
      details: f.status === "rejected"
        ? "File uploaded for validation"
        : "File uploaded and validated successfully",
      createdAt: now,
    };

    if (f.status === "rejected") {
      return [
        upload,
        {
          projectId: project!.id,
          userId: uploader.id,
          userFullName: uploader.fullName,
          userCompanyName: uploaderCo,
          actionType: "REJECT",
          entityType: "file",
          entityId: f.id,
          fileNameBefore: f.fileName,
          fileNameAfter: null,
          details: "Rejected: file name does not comply with naming convention",
          createdAt: new Date(now.getTime() + 1000),
        },
      ];
    }
    return [upload];
  });

  await db.insert(activityLogTable).values(activityEntries);
  console.log(`OK Activity log: ${activityEntries.length} entries`);

  // RFIs
  const rfiDefs = [
    {
      number: "RFI-001",
      subject: "Structural penetration clearance L3",
      status: "open",
      priority: "high",
      createdById: tom!.id,
      assignedToId: roberto!.id,
      dueDate: new Date(now.getTime() + 7 * 86400000),
    },
    {
      number: "RFI-002",
      subject: "MEP chase dimensions Level 4",
      status: "in_review",
      priority: "medium",
      createdById: tom!.id,
      assignedToId: maria!.id,
      dueDate: new Date(now.getTime() + 14 * 86400000),
    },
    {
      number: "RFI-003",
      subject: "Curtain wall anchor detail grid B",
      status: "responded",
      priority: "low",
      createdById: maria!.id,
      assignedToId: roberto!.id,
      dueDate: new Date(now.getTime() - 3 * 86400000),
      respondedAt: new Date(now.getTime() - 1 * 86400000),
      response: "Anchor detail confirmed per structural drawings SD-041.",
    },
    {
      number: "RFI-004",
      subject: "Plumbing stack routing basement",
      status: "closed",
      priority: "medium",
      createdById: roberto!.id,
      assignedToId: tom!.id,
      dueDate: new Date(now.getTime() - 10 * 86400000),
      respondedAt: new Date(now.getTime() - 8 * 86400000),
      response: "Stack rerouted per coordination meeting minutes CM-12.",
    },
  ];

  await db.insert(rfisTable).values(
    rfiDefs.map(r => ({ ...r, projectId: project!.id }))
  );
  console.log(`OK RFIs: ${rfiDefs.length} inserted`);

  // Submittals
  const submittalDefs = [
    {
      number: "SUB-001",
      title: "Mechanical ductwork shop drawings L3",
      submittalType: "shop_drawing",
      status: "under_review",
      specSection: "23 31 00",
      submittedById: tom!.id,
      assignedToId: roberto!.id,
      dueDate: new Date(now.getTime() + 10 * 86400000),
    },
    {
      number: "SUB-002",
      title: "Structural steel connection details",
      submittalType: "shop_drawing",
      status: "approved",
      specSection: "05 12 00",
      submittedById: maria!.id,
      assignedToId: roberto!.id,
      dueDate: new Date(now.getTime() - 5 * 86400000),
    },
    {
      number: "SUB-003",
      title: "MEP coordination composite model",
      submittalType: "product_data",
      status: "pending",
      specSection: "01 31 19",
      submittedById: roberto!.id,
      assignedToId: maria!.id,
      dueDate: new Date(now.getTime() + 21 * 86400000),
    },
  ];

  await db.insert(submittalsTable).values(
    submittalDefs.map(s => ({ ...s, projectId: project!.id }))
  );
  console.log(`OK Submittals: ${submittalDefs.length} inserted`);

  // Summary
  console.log("\nSeed complete:");
  console.log(`   Companies  : 2`);
  console.log(`   Users      : 3  (password: Demo1234!)`);
  console.log(`   Projects   : 1`);
  console.log(`   Members    : 3`);
  console.log(`   Convention : 1  (8 fields)`);
  console.log(`   Files      : ${insertedFiles.length}`);
  console.log(`   Activity   : ${activityEntries.length} entries`);
  console.log(`   RFIs       : ${rfiDefs.length}`);
  console.log(`   Submittals : ${submittalDefs.length}`);

  await pool.end();
}

seed().catch(err => {
  console.error("ERROR Seed failed:", err);
  process.exit(1);
});
