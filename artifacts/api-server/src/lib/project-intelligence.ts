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

type Severity = "high" | "medium" | "low";
type ClassifiedEventType = "STRUCTURAL_RESET" | "MAJOR_EXPANSION" | "AMBIGUITY_INCREASE" | "STABILIZATION" | "convention_version";

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
  classifiedEventType: ClassifiedEventType;
  severity: Severity;
}

interface TimelineEvent {
  timestamp: string;
  eventType: string;
  severity: Severity;
  actor: string | null;
  title: string;
  summary: string;
  version: number | null;
}

interface SignificantEvent {
  eventType: ClassifiedEventType;
  severity: Severity;
  version: number | null;
  title: string;
  summary: string;
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

function classifyVersion(
  discs: CodeLabel[], docTypes: CodeLabel[], systems: CodeLabel[],
  ambigs: string[], delta: VersionSnapshot["delta"],
): { eventType: ClassifiedEventType; severity: Severity } {
  if (discs.length === 0 && docTypes.length === 0 && systems.length === 0) {
    return { eventType: "STRUCTURAL_RESET", severity: "high" };
  }
  if (delta) {
    if (delta.disciplinesAdded.length >= 2 || delta.systemsAdded.length >= 2 || delta.docTypesAdded.length >= 2) {
      return { eventType: "MAJOR_EXPANSION", severity: "medium" };
    }
    if (delta.ambiguitiesAdded.length > 0) {
      return { eventType: "AMBIGUITY_INCREASE", severity: "medium" };
    }
    const totalChanges = delta.disciplinesAdded.length + delta.disciplinesRemoved.length +
      delta.docTypesAdded.length + delta.docTypesRemoved.length +
      delta.systemsAdded.length + delta.systemsRemoved.length +
      delta.extraFieldsAdded.length + delta.extraFieldsRemoved.length;
    if (delta.ambiguitiesAdded.length === 0 && totalChanges <= 2) {
      return { eventType: "STABILIZATION", severity: "low" };
    }
  }
  return { eventType: "convention_version", severity: "low" };
}

const EVENT_PRIORITY: Record<string, number> = {
  STRUCTURAL_RESET: 4,
  MAJOR_EXPANSION: 3,
  AMBIGUITY_INCREASE: 2,
  STABILIZATION: 1,
  convention_version: 0,
};

function determineStateLabel(
  fileCount: number, latestAmbiguities: string[], evolutionSnapshots: VersionSnapshot[],
): "stable" | "unstable" | "incomplete" | "untested" {
  if (fileCount === 0) return "untested";
  if (latestAmbiguities.length > 0) return "incomplete";
  if (evolutionSnapshots.length >= 2) {
    const last = evolutionSnapshots[evolutionSnapshots.length - 1];
    const prev = evolutionSnapshots[evolutionSnapshots.length - 2];
    if (last.classifiedEventType === "MAJOR_EXPANSION" || last.classifiedEventType === "STRUCTURAL_RESET" ||
        last.classifiedEventType === "AMBIGUITY_INCREASE" ||
        prev.classifiedEventType === "MAJOR_EXPANSION" || prev.classifiedEventType === "STRUCTURAL_RESET" ||
        prev.classifiedEventType === "AMBIGUITY_INCREASE") {
      return "unstable";
    }
  }
  return "stable";
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

    const classification = classifyVersion(discs, docTypes, systems, ambigs, delta);

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
      classifiedEventType: classification.eventType,
      severity: classification.severity,
    });
  }

  const stateLabel = determineStateLabel(fileCount, latestAmbiguities, evolutionSnapshots);

  let mostSignificantEvent: SignificantEvent | null = null;
  for (const snap of evolutionSnapshots) {
    const priority = EVENT_PRIORITY[snap.classifiedEventType] ?? 0;
    const currentPriority = mostSignificantEvent ? (EVENT_PRIORITY[mostSignificantEvent.eventType] ?? 0) : -1;
    if (priority > currentPriority) {
      const titleMap: Record<string, string> = {
        STRUCTURAL_RESET: `Structural reset at v${snap.version}`,
        MAJOR_EXPANSION: `Major expansion at v${snap.version}`,
        AMBIGUITY_INCREASE: `Ambiguity increase at v${snap.version}`,
        STABILIZATION: `Stabilization at v${snap.version}`,
        convention_version: `Convention v${snap.version} saved`,
      };
      const summaryMap: Record<string, string> = {
        STRUCTURAL_RESET: `Version ${snap.version} cleared all disciplines, document types, and systems to zero. This represents a complete structural reset of the convention.`,
        MAJOR_EXPANSION: `Version ${snap.version} added ${snap.delta?.disciplinesAdded.length ?? 0} disciplines, ${snap.delta?.docTypesAdded.length ?? 0} document types, and ${snap.delta?.systemsAdded.length ?? 0} systems in a single version.`,
        AMBIGUITY_INCREASE: `Version ${snap.version} introduced ${snap.delta?.ambiguitiesAdded.length ?? 0} new unresolved ambiguities requiring team attention.`,
        STABILIZATION: `Version ${snap.version} shows minimal changes with no new ambiguities, indicating the convention is stabilizing.`,
        convention_version: snap.changeSummary || `Version ${snap.version} recorded.`,
      };
      mostSignificantEvent = {
        eventType: snap.classifiedEventType,
        severity: snap.severity,
        version: snap.version,
        title: titleMap[snap.classifiedEventType] || `Convention v${snap.version}`,
        summary: summaryMap[snap.classifiedEventType] || "",
      };
    }
  }

  const parts: string[] = [];
  if (allVersions.length === 0 && !convention) {
    parts.push("No naming convention has been configured for this project.");
  } else {
    if (allVersions.length >= 2) {
      const first = allVersions[0];
      const firstDiscs = (first.acceptedDisciplines as CodeLabel[]) || [];
      const firstDocTypes = (first.acceptedDocTypes as CodeLabel[]) || [];
      parts.push(`Convention evolved from v1 (${firstDiscs.length} disciplines, ${firstDocTypes.length} document types) to v${latestVersion!.conventionVersion} (${latestDiscs.length} disciplines, ${latestDocTypes.length} document types, ${latestSystems.length} systems) across ${allVersions.length} versions.`);
    } else if (allVersions.length === 1) {
      parts.push(`Convention established at v1 with ${latestDiscs.length} disciplines, ${latestDocTypes.length} document types, ${latestSystems.length} systems.`);
    }

    if (mostSignificantEvent) {
      parts.push(`Most significant event: ${mostSignificantEvent.title}. ${mostSignificantEvent.summary}`);
    }

    const stateLabelMap: Record<string, string> = {
      stable: "Current state: STABLE. No active ambiguities and no major structural changes in the latest version.",
      unstable: "Current state: UNSTABLE. Recent versions show major structural changes or ambiguity increases.",
      incomplete: `Current state: INCOMPLETE. ${latestAmbiguities.length} unresolved ambiguities remain in the latest version.`,
      untested: "Current state: UNTESTED. No files have been validated against the current convention.",
    };
    parts.push(stateLabelMap[stateLabel]);

    if (fileCount > 0) {
      parts.push(`Validation status: ${fileCount} files processed against convention.`);
    } else {
      parts.push("Validation status: No files submitted. Convention has not been tested against real documents.");
    }

    if (convention?.userGuidance) {
      parts.push(`Active guidance: "${convention.userGuidance}"`);
    }
  }

  const intelligenceSummary = {
    narrative: parts.join(" "),
    stateLabel,
    conventionConfigured: !!convention,
    hasFiles: fileCount > 0,
    hasActivityLog: activityCount > 0,
    hasAmbiguities: latestAmbiguities.length > 0,
    validationStatus: fileCount > 0 ? "tested" as const : "untested" as const,
  };

  const versionClassMap = new Map<number, { eventType: ClassifiedEventType; severity: Severity }>();
  for (const snap of evolutionSnapshots) {
    versionClassMap.set(snap.version, { eventType: snap.classifiedEventType, severity: snap.severity });
  }

  const timeline: TimelineEvent[] = [];

  for (const v of allVersions) {
    const actor = v.createdById ? userMap.get(v.createdById) ?? null : null;
    const cls = versionClassMap.get(v.conventionVersion);
    timeline.push({
      timestamp: v.createdAt.toISOString(),
      eventType: cls?.eventType ?? "convention_version",
      severity: cls?.severity ?? "low",
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
        severity: "low",
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
    mostSignificantEvent,
    timeline: filteredTimeline,
    conventionEvolution: filteredEvolution,
  };
}
