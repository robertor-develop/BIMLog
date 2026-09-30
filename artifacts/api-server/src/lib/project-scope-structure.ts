import { FinancialControlError } from "./financial-control-contract";

export type ProjectDiscipline = { id: string; code: string; name: string };
export type ProjectBuilding = { id: string; code: string; name: string; sequence: number };
export type ProjectLevel = { id: string; buildingId: string; code: string; name: string; sequence: number; kind: "basement" | "ground" | "level" | "roof" | "custom" };
export type ProjectLocationRef = { buildingId: string; levelId: string };

const text = (value: unknown, field: string, max: number) => {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > max) throw new FinancialControlError(400, "PROJECT_SCOPE_VALUE_INVALID", `${field} is required and must not exceed ${max} characters.`);
  return normalized;
};

export function normalizeProjectDisciplines(input: unknown, legacy?: Record<string, unknown>): ProjectDiscipline[] {
  const rows = Array.isArray(input) ? input : [];
  if (!rows.length && legacy?.disciplineId) rows.push({ id: legacy.disciplineId, code: legacy.disciplineCode, name: legacy.disciplineName });
  if (rows.length > 50) throw new FinancialControlError(400, "PROJECT_DISCIPLINE_LIMIT", "A project supports at most 50 selected disciplines.");
  const ids = new Set<string>();
  return rows.map((row: any, index) => {
    const item = { id: text(row?.id, `projectDisciplines[${index}].id`, 100), code: text(row?.code, `projectDisciplines[${index}].code`, 64).toUpperCase(), name: text(row?.name, `projectDisciplines[${index}].name`, 200) };
    if (ids.has(item.id)) throw new FinancialControlError(400, "PROJECT_DISCIPLINE_DUPLICATE", "A project discipline may be selected only once.");
    ids.add(item.id);
    return item;
  });
}

export function primaryDiscipline(disciplines: ProjectDiscipline[], legacy?: Record<string, unknown>) {
  return disciplines[0] ?? { id: String(legacy?.disciplineId ?? ""), code: String(legacy?.disciplineCode ?? ""), name: String(legacy?.disciplineName ?? "") };
}

export function addProjectDisciplineInContext(input: { current: ProjectDiscipline[]; created: unknown; authorized: boolean }) {
  if (!input.authorized) throw new FinancialControlError(403, "PROJECT_DISCIPLINE_CREATE_DENIED", "You do not have authority to add a discipline to this company catalog.");
  const created = normalizeProjectDisciplines([input.created])[0]!;
  const duplicate = input.current.find(row => row.id === created.id || row.code.toLowerCase() === created.code.toLowerCase());
  if (duplicate) throw new FinancialControlError(409, "PROJECT_DISCIPLINE_DUPLICATE", `${duplicate.code} is already selected for this project.`);
  const selected = normalizeProjectDisciplines([...input.current, created]);
  return { selected, selectedId: created.id };
}

const kinds = new Set(["basement", "ground", "level", "roof", "custom"]);
export function normalizeProjectLocations(input: { buildings?: unknown; levels?: unknown }) {
  const buildings = (Array.isArray(input.buildings) ? input.buildings : []).map((row: any, index) => ({ id: text(row?.id, `scopeStructure.buildings[${index}].id`, 100), code: text(row?.code, `scopeStructure.buildings[${index}].code`, 40).toUpperCase(), name: text(row?.name, `scopeStructure.buildings[${index}].name`, 160), sequence: Number.isSafeInteger(Number(row?.sequence)) ? Number(row.sequence) : index + 1 }));
  const buildingIds = new Set(buildings.map(row => row.id));
  if (buildingIds.size !== buildings.length) throw new FinancialControlError(400, "PROJECT_BUILDING_DUPLICATE", "Building IDs must be unique within the project.");
  const levels = (Array.isArray(input.levels) ? input.levels : []).map((row: any, index) => {
    const kind = String(row?.kind ?? "custom").toLowerCase();
    const level = { id: text(row?.id, `scopeStructure.levels[${index}].id`, 100), buildingId: text(row?.buildingId, `scopeStructure.levels[${index}].buildingId`, 100), code: text(row?.code, `scopeStructure.levels[${index}].code`, 40).toUpperCase(), name: text(row?.name, `scopeStructure.levels[${index}].name`, 160), sequence: Number.isSafeInteger(Number(row?.sequence)) ? Number(row.sequence) : index + 1, kind: (kinds.has(kind) ? kind : "custom") as ProjectLevel["kind"] };
    if (!buildingIds.has(level.buildingId)) throw new FinancialControlError(400, "PROJECT_LEVEL_BUILDING_INVALID", "Every level must reference a building in this project.");
    return level;
  });
  if (new Set(levels.map(row => row.id)).size !== levels.length) throw new FinancialControlError(400, "PROJECT_LEVEL_DUPLICATE", "Level IDs must be unique within the project.");
  return { buildings: [...buildings].sort((a, b) => a.sequence - b.sequence || a.code.localeCompare(b.code, undefined, { numeric: true })), levels: [...levels].sort((a, b) => buildings.findIndex(row => row.id === a.buildingId) - buildings.findIndex(row => row.id === b.buildingId) || a.sequence - b.sequence || a.code.localeCompare(b.code, undefined, { numeric: true })) };
}
