import { db } from "@workspace/db";
import {
  projectsTable, namingConventionsTable, namingConventionVersionsTable,
  namingFieldsTable, filesTable, activityLogTable, usersTable,
} from "@workspace/db/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

interface Filters {
  from?: string;
  to?: string;
  versionFrom?: number;
  versionTo?: number;
}

interface CodeLabel { code: string; label: string }
interface KeyLabel { key: string; label: string }

interface VersionSnapshot {
  version: number;
  createdAt: string;
  actorId: number | null;
  actorName: string | null;
  changeSummary: string | null;
  analysisSummary: string | null;
  userGuidance: string | null;
  disciplines: CodeLabel[];
  docTypes: CodeLabel[];
  systems: CodeLabel[];
  extraFields: KeyLabel[];
  ambiguities: string[];
  counts: {
    disciplines: number;
    docTypes: number;
    systems: number;
    extraFields: number;
    ambiguities: number;
  };
  delta: {
    disciplinesAdded: string[];
    disciplinesRemoved: string[];
    docTypesAdded: string[];
    docTypesRemoved: string[];
    systemsAdded: string[];
    systemsRemoved: string[];
    extraFieldsAdded: string[];
    extraFieldsRemoved: string[];
    ambiguitiesAdded: string[];
    ambiguitiesResolved: string[];
  } | null;
}

interface TimelineEvent {
  timestamp: string;
  eventType: string;
  actor: string | null;
  title: string;
  summary: string;
  version: number | null;
}

function codeDiff(prev: CodeLabel[], curr: CodeLabel[]): { added: string[]; removed: string[] } {
  const prevCodes = new Set(prev.map(d => d.code));
  const currCodes = new Set(curr.map(d => d.code));
  return {
    added: [...currCodes].filter(c => !prevCodes.has(c)),
    removed: [...prevCodes].filter(c => !currCodes.has(c)),
  };
}

function keyDiff(prev: KeyLabel[], curr: KeyLabel[]): { added: string[]; removed: string[] } {
  const prevKeys = new Set(prev.map(d => d.key));
  const currKeys = new Set(curr.map(d => d.key));
  return {
    added: [...currKeys].filter(k => !prevKeys.has(k)),
    removed: [...prevKeys].filter(k => !currKeys.has(k)),
  };
}

function strDiff(prev: string[], curr: string[]): { added: string[]; resolved: string[] } {
  const prevSet = new Set(prev);
  const currSet = new Set(curr);
  return {
    added: curr.filter(a => !prevSet.has(a)),
    resolved: prev.filter(a => !currSet.has(a)),
  };
}

export async function getProjectIntelligence(projectId: number, filters: Filters = {}) {
  const [projectRows, conventionRows, versionRows, fileCountResult, activityCountResult] = await Promise.all([
    db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1),
    db.select().from(namingConventionsTable).where(eq(namingConventionsTable.projectId, projectId)).limit(1),
    db.select().from(namingConventionVersionsTable)
      .where(eq(namingConventionVersionsTable.projectId, projectId))
      .orderBy(namingConventionVersionsTable.conventionVersion),
    db.select({ count: sql<number>`count(*)::int` }).from(filesTable).where(eq(filesTable.projectId, projectId)),
    db.select({ count: sql<number>`count(*)::int` }).from(activityLogTable).where(eq(activityLogTable.projectId, projectId)),
  ]);

  const project = projectRows[0];
  if (!project) return null;

  const convention = conventionRows[0] || null;
  const allVersions = versionRows;
  const fileCount = fileCountResult[0]?.count ?? 0;
  const activityCount = activityCountResult[0]?.count ?? 0;

  let fields: Array<{ label: string; fieldOrder: number; allowedValues: string[] }> = [];
  if (convention) {
    fields = (await db.select().from(namingFieldsTable)
      .where(eq(namingFieldsTable.conventionId, convention.id))
      .orderBy(namingFieldsTable.fieldOrder)) as typeof fields;
  }

  const userIds = new Set<number>();
  allVersions.forEach(v => { if (v.createdById) userIds.add(v.createdById); });
  const userMap = new Map<number, string>();
  if (userIds.size > 0) {
    const userRows = await db.select({ id: usersTable.id, fullName: usersTable.fullName })
      .from(usersTable)
      .where(sql`${usersTable.id} IN (${sql.join([...userIds].map(id => sql`${id}`), sql`, `)})`);
    userRows.forEach(u => userMap.set(u.id, u.fullName));
  }

  const latestVersion = allVersions.length > 0 ? allVersions[allVersions.length - 1] : null;

  const latestDiscs = (latestVersion?.acceptedDisciplines ?? []) as CodeLabel[];
  const latestDocTypes = (latestVersion?.acceptedDocTypes ?? []) as CodeLabel[];
  const latestSystems = (latestVersion?.acceptedSystems ?? []) as CodeLabel[];
  const latestAmbiguities = (latestVersion?.ambiguities ?? []) as string[];

  const currentState = {
    conventionVersion: latestVersion?.conventionVersion ?? convention?.conventionVersion ?? 0,
    separator: convention?.separator ?? null,
    companyCodes: convention?.companyCode ?? "",
    enforceUppercase: convention?.enforceUppercase ?? true,
    isActive: convention?.isActive ?? false,
    disciplines: latestDiscs,
    docTypes: latestDocTypes,
    systems: latestSystems,
    unresolvedAmbiguityCount: latestAmbiguities.length,
    unresolvedAmbiguities: latestAmbiguities,
    fileCount,
    activityCount,
    totalVersions: allVersions.length,
    fieldOrder: fields.map(f => f.label),
    userGuidance: convention?.userGuidance ?? null,
    lastChangeDate: latestVersion ? latestVersion.createdAt.toISOString() : null,
    lastChangeSummary: latestVersion?.changeSummary ?? null,
  };

  const parts: string[] = [];
  if (allVersions.length === 0 && !convention) {
    parts.push("No naming convention has been configured for this project.");
  } else {
    parts.push(`Convention has evolved through ${allVersions.length} version${allVersions.length !== 1 ? "s" : ""}.`);
    if (allVersions.length >= 2) {
      const first = allVersions[0];
      const firstDiscs = (first.acceptedDisciplines as CodeLabel[]) || [];
      const firstDocTypes = (first.acceptedDocTypes as CodeLabel[]) || [];
      parts.push(`Started with ${firstDiscs.length} discipline${firstDiscs.length !== 1 ? "s" : ""} and ${firstDocTypes.length} document type${firstDocTypes.length !== 1 ? "s" : ""}.`);
      parts.push(`Current state: ${latestDiscs.length} discipline${latestDiscs.length !== 1 ? "s" : ""}, ${latestDocTypes.length} document type${latestDocTypes.length !== 1 ? "s" : ""}, ${latestSystems.length} system${latestSystems.length !== 1 ? "s" : ""}.`);
    } else if (allVersions.length === 1) {
      parts.push(`Current state: ${latestDiscs.length} discipline${latestDiscs.length !== 1 ? "s" : ""}, ${latestDocTypes.length} document type${latestDocTypes.length !== 1 ? "s" : ""}, ${latestSystems.length} system${latestSystems.length !== 1 ? "s" : ""}.`);
    }
    if (latestAmbiguities.length > 0) {
      parts.push(`${latestAmbiguities.length} unresolved ambiguit${latestAmbiguities.length !== 1 ? "ies" : "y"} remain${latestAmbiguities.length === 1 ? "s" : ""} in the latest version.`);
    } else if (allVersions.length > 0) {
      parts.push("No unresolved ambiguities in the latest version.");
    }
    if (fileCount > 0) {
      parts.push(`${fileCount} file${fileCount !== 1 ? "s" : ""} uploaded and processed.`);
    } else {
      parts.push("No files have been uploaded yet. File validation will begin when documents are submitted.");
    }
    if (latestVersion?.changeSummary) {
      const truncated = latestVersion.changeSummary.length > 200 ? latestVersion.changeSummary.slice(0, 200) + "..." : latestVersion.changeSummary;
      parts.push(`Latest change: ${truncated}`);
    }
    if (convention?.userGuidance) {
      parts.push(`Active guidance: "${convention.userGuidance}"`);
    }
  }

  const intelligenceSummary = {
    narrative: parts.join(" "),
    conventionConfigured: !!convention,
    hasFiles: fileCount > 0,
    hasActivityLog: activityCount > 0,
    hasAmbiguities: latestAmbiguities.length > 0,
  };

  const timeline: TimelineEvent[] = [];

  for (const v of allVersions) {
    const actor = v.createdById ? userMap.get(v.createdById) ?? null : null;
    timeline.push({
      timestamp: v.createdAt.toISOString(),
      eventType: "convention_version",
      actor,
      title: `Convention v${v.conventionVersion} ${v.conventionVersion === 1 ? "created" : "saved"}`,
      summary: v.changeSummary || `Version ${v.conventionVersion} recorded.`,
      version: v.conventionVersion,
    });
  }

  if (activityCount > 0) {
    const activities = await db.select().from(activityLogTable)
      .where(eq(activityLogTable.projectId, projectId))
      .orderBy(activityLogTable.createdAt);
    for (const a of activities) {
      timeline.push({
        timestamp: a.createdAt.toISOString(),
        eventType: a.actionType,
        actor: a.userFullName,
        title: `${a.entityType ?? "action"}: ${a.actionType}`,
        summary: a.details ?? "",
        version: null,
      });
    }
  }

  timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let filteredTimeline = timeline;
  if (filters.from) {
    const fromDate = new Date(filters.from + "T00:00:00.000Z");
    filteredTimeline = filteredTimeline.filter(e => new Date(e.timestamp) >= fromDate);
  }
  if (filters.to) {
    const toDate = new Date(filters.to + "T23:59:59.999Z");
    filteredTimeline = filteredTimeline.filter(e => new Date(e.timestamp) <= toDate);
  }
  if (filters.versionFrom != null) {
    filteredTimeline = filteredTimeline.filter(e => e.version == null || e.version >= filters.versionFrom!);
  }
  if (filters.versionTo != null) {
    filteredTimeline = filteredTimeline.filter(e => e.version == null || e.version <= filters.versionTo!);
  }

  const evolutionSnapshots: VersionSnapshot[] = [];
  for (let i = 0; i < allVersions.length; i++) {
    const v = allVersions[i];
    const discs = (v.acceptedDisciplines ?? []) as CodeLabel[];
    const docTypes = (v.acceptedDocTypes ?? []) as CodeLabel[];
    const systems = (v.acceptedSystems ?? []) as CodeLabel[];
    const extras = (v.acceptedExtraFields ?? []) as KeyLabel[];
    const ambigs = (v.ambiguities ?? []) as string[];

    let delta: VersionSnapshot["delta"] = null;
    if (i > 0) {
      const prev = allVersions[i - 1];
      const prevDiscs = (prev.acceptedDisciplines ?? []) as CodeLabel[];
      const prevDocTypes = (prev.acceptedDocTypes ?? []) as CodeLabel[];
      const prevSystems = (prev.acceptedSystems ?? []) as CodeLabel[];
      const prevExtras = (prev.acceptedExtraFields ?? []) as KeyLabel[];
      const prevAmbigs = (prev.ambiguities ?? []) as string[];

      const dd = codeDiff(prevDiscs, discs);
      const dt = codeDiff(prevDocTypes, docTypes);
      const ds = codeDiff(prevSystems, systems);
      const de = keyDiff(prevExtras, extras);
      const da = strDiff(prevAmbigs, ambigs);

      delta = {
        disciplinesAdded: dd.added,
        disciplinesRemoved: dd.removed,
        docTypesAdded: dt.added,
        docTypesRemoved: dt.removed,
        systemsAdded: ds.added,
        systemsRemoved: ds.removed,
        extraFieldsAdded: de.added,
        extraFieldsRemoved: de.removed,
        ambiguitiesAdded: da.added,
        ambiguitiesResolved: da.resolved,
      };
    }

    evolutionSnapshots.push({
      version: v.conventionVersion,
      createdAt: v.createdAt.toISOString(),
      actorId: v.createdById,
      actorName: v.createdById ? userMap.get(v.createdById) ?? null : null,
      changeSummary: v.changeSummary,
      analysisSummary: v.analysisSummary,
      userGuidance: v.userGuidance,
      disciplines: discs,
      docTypes: docTypes,
      systems: systems,
      extraFields: extras,
      ambiguities: ambigs,
      counts: {
        disciplines: discs.length,
        docTypes: docTypes.length,
        systems: systems.length,
        extraFields: extras.length,
        ambiguities: ambigs.length,
      },
      delta,
    });
  }

  let filteredEvolution = evolutionSnapshots;
  if (filters.versionFrom != null) {
    filteredEvolution = filteredEvolution.filter(e => e.version >= filters.versionFrom!);
  }
  if (filters.versionTo != null) {
    filteredEvolution = filteredEvolution.filter(e => e.version <= filters.versionTo!);
  }
  if (filters.from) {
    const fromDate = new Date(filters.from + "T00:00:00.000Z");
    filteredEvolution = filteredEvolution.filter(e => new Date(e.createdAt) >= fromDate);
  }
  if (filters.to) {
    const toDate = new Date(filters.to + "T23:59:59.999Z");
    filteredEvolution = filteredEvolution.filter(e => new Date(e.createdAt) <= toDate);
  }

  return {
    project: {
      id: project.id,
      name: project.name,
      code: project.code,
      status: project.status,
      description: project.description,
      createdAt: project.createdAt.toISOString(),
    },
    currentState,
    intelligenceSummary,
    timeline: filteredTimeline,
    conventionEvolution: filteredEvolution,
  };
}
