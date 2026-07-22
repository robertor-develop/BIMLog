import crypto from "node:crypto";
import { pool } from "@workspace/db";
import {
  COORDINATOR_ACTION_MODULES,
  authorizeCoordinatorModule,
  authorizeCoordinatorProject,
  parseRegisterQuery,
  type CoordinatorActionModule,
  type CoordinatorBuiltInView,
  type RegisterQuery,
} from "./coordinator-action-register";
import { waitForCoordinatorSavedViewMigration } from "./coordinator-saved-view-migration";

const MAX_SAVED_VIEWS = 50;
const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} _.,:/()&+\-'#]{0,63}$/u;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,100}$/;

export type CoordinatorSavedViewConfig = {
  schemaVersion: 1;
  builtInView: CoordinatorBuiltInView;
  modules: CoordinatorActionModule[];
  lensStatuses: string[];
  originalStatuses: string[];
  presentationStatuses: string[];
  deadline: RegisterQuery["deadline"];
  dueFrom: string | null;
  dueTo: string | null;
  overdue: boolean;
  meetingId: number | null;
  search: string | null;
  responsibleCompany: string | null;
  responsiblePerson: string | null;
  floor: string | null;
  discipline: string | null;
  timezone: string;
};

export class CoordinatorSavedViewError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public messageEs: string,
  ) {
    super(message);
    this.name = "CoordinatorSavedViewError";
  }
}

type ScopeInput = {
  userId: number;
  projectId: number;
  superAdminAccess?: string;
  superAdminReason?: string;
};

function hash(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizeName(value: unknown): { name: string; normalized: string } {
  const name = String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!NAME_PATTERN.test(name))
    throw new CoordinatorSavedViewError(
      400,
      "SAVED_VIEW_NAME_INVALID",
      "View names must contain 1-64 safe characters.",
      "Los nombres de vista deben contener entre 1 y 64 caracteres seguros.",
    );
  return { name, normalized: name.toLocaleLowerCase("en-US") };
}

function idempotencyKey(value: unknown): string {
  const key = String(value ?? "").trim();
  if (!IDEMPOTENCY_PATTERN.test(key))
    throw new CoordinatorSavedViewError(
      400,
      "SAVED_VIEW_IDEMPOTENCY_INVALID",
      "A valid idempotency key is required.",
      "Se requiere una clave de idempotencia válida.",
    );
  return key;
}

function stableViewId(value: unknown): string {
  const id = String(value ?? "").trim();
  if (!/^[A-Za-z0-9-]{8,100}$/.test(id))
    throw new CoordinatorSavedViewError(404, "SAVED_VIEW_NOT_FOUND", "Saved view not found.", "No se encontró la vista guardada.");
  return id;
}

function expectedVersion(value: unknown): number {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version <= 0)
    throw new CoordinatorSavedViewError(
      400,
      "SAVED_VIEW_VERSION_INVALID",
      "A positive expectedVersion is required.",
      "Se requiere un expectedVersion positivo.",
    );
  return version;
}

function moduleOrder(modules: CoordinatorActionModule[]): CoordinatorActionModule[] {
  const selected = new Set(modules);
  return COORDINATOR_ACTION_MODULES.filter((module) => selected.has(module));
}

export function normalizeSavedViewConfig(value: unknown): CoordinatorSavedViewConfig {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new CoordinatorSavedViewError(
      400,
      "SAVED_VIEW_CONFIG_INVALID",
      "Saved-view configuration is invalid.",
      "La configuración de la vista guardada no es válida.",
    );
  const raw = value as Record<string, unknown>;
  if (Buffer.byteLength(JSON.stringify(raw), "utf8") > 4096)
    throw new CoordinatorSavedViewError(413, "SAVED_VIEW_CONFIG_TOO_LARGE", "Saved-view configuration is too large.", "La configuración de la vista guardada es demasiado grande.");
  if (raw.schemaVersion !== undefined && Number(raw.schemaVersion) !== 1)
    throw new CoordinatorSavedViewError(
      400,
      "SAVED_VIEW_SCHEMA_UNSUPPORTED",
      "Saved-view schemaVersion is unsupported.",
      "La versión del esquema de la vista guardada no es compatible.",
    );
  const query = parseRegisterQuery({
    page: 1,
    pageSize: 25,
    modules: raw.modules,
    lensStatuses: raw.lensStatuses,
    originalStatuses: raw.originalStatuses,
    presentationStatuses: raw.presentationStatuses,
    deadline: raw.deadline,
    dueFrom: raw.dueFrom,
    dueTo: raw.dueTo,
    overdue: raw.overdue,
    meetingId: raw.meetingId,
    builtInView: raw.builtInView,
    search: raw.search,
    responsibleCompany: raw.responsibleCompany,
    responsiblePerson: raw.responsiblePerson,
    floor: raw.floor,
    discipline: raw.discipline,
    timezone: raw.timezone,
  });
  const config: CoordinatorSavedViewConfig = {
    schemaVersion: 1,
    builtInView: query.builtInView,
    modules: moduleOrder(query.modules),
    lensStatuses: [...query.lensStatuses].sort(),
    originalStatuses: [...query.originalStatuses].sort(),
    presentationStatuses: [...query.presentationStatuses].sort(),
    deadline: query.deadline,
    dueFrom: query.dueFrom,
    dueTo: query.dueTo,
    overdue: query.overdueOnly,
    meetingId: query.meetingId,
    search: query.search,
    responsibleCompany: query.responsibleCompany,
    responsiblePerson: query.responsiblePerson,
    floor: query.floor,
    discipline: query.discipline,
    timezone: query.timezone,
  };
  if (Buffer.byteLength(JSON.stringify(config), "utf8") > 4096)
    throw new CoordinatorSavedViewError(
      413,
      "SAVED_VIEW_CONFIG_TOO_LARGE",
      "Saved-view configuration is too large.",
      "La configuración de la vista guardada es demasiado grande.",
    );
  return config;
}

async function authorizeScope(input: ScopeInput, modules: CoordinatorActionModule[]) {
  const access = await authorizeCoordinatorProject(input);
  const decisions = await Promise.all(
    moduleOrder(modules).map(async (module) => ({
      module,
      ...(await authorizeCoordinatorModule(module, {
        access,
        userId: input.userId,
        projectId: input.projectId,
      })),
    })),
  );
  const denied = decisions.find((decision) => !decision.allowed);
  if (denied)
    throw new CoordinatorSavedViewError(
      403,
      "SAVED_VIEW_MODULE_UNAVAILABLE",
      "A referenced source module is not currently authorized.",
      "Un módulo de origen referenciado no está autorizado actualmente.",
    );
}

function serialize(row: Record<string, any>) {
  return {
    id: String(row.id),
    projectId: Number(row.project_id),
    name: String(row.name),
    configuration: row.configuration as CoordinatorSavedViewConfig,
    version: Number(row.version),
    isDefault: row.is_default === true,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    deleted: row.deleted_at != null,
  };
}

async function operationReceipt(
  client: any,
  input: ScopeInput,
  key: string,
  requestFingerprint: string,
) {
  const result = await client.query(
    `SELECT operation,request_fingerprint,saved_view_id,result_version,result_state,result_snapshot
     FROM coordinator_saved_view_operations WHERE user_id=$1 AND project_id=$2 AND idempotency_key=$3`,
    [input.userId, input.projectId, key],
  );
  const receipt = result.rows[0];
  if (!receipt) return null;
  if (receipt.request_fingerprint !== requestFingerprint)
    throw new CoordinatorSavedViewError(
      409,
      "SAVED_VIEW_IDEMPOTENCY_CONFLICT",
      "This idempotency key was already used for a different request.",
      "Esta clave de idempotencia ya se utilizó para una solicitud diferente.",
    );
  return receipt.result_snapshot
    ? { view: receipt.result_snapshot, idempotent: true }
    : null;
}

async function insertReceipt(
  client: any,
  input: ScopeInput,
  values: {
    operation: "create" | "update" | "delete";
    key: string;
    requestFingerprint: string;
    savedViewId: string;
    resultVersion: number;
    resultState: "active" | "deleted";
    resultSnapshot: ReturnType<typeof serialize>;
  },
) {
  await client.query(
    `INSERT INTO coordinator_saved_view_operations
      (id,project_id,user_id,saved_view_id,operation,idempotency_key,request_fingerprint,result_version,result_state,result_snapshot)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
    [
      crypto.randomUUID(),
      input.projectId,
      input.userId,
      values.savedViewId,
      values.operation,
      values.key,
      values.requestFingerprint,
      values.resultVersion,
      values.resultState,
      JSON.stringify(values.resultSnapshot),
    ],
  );
}

export async function listCoordinatorSavedViews(input: ScopeInput) {
  await waitForCoordinatorSavedViewMigration();
  await authorizeScope(input, []);
  const result = await pool.query(
    `SELECT * FROM coordinator_saved_views
     WHERE user_id=$1 AND project_id=$2 AND deleted_at IS NULL
     ORDER BY is_default DESC,lower(name) ASC,id ASC LIMIT $3`,
    [input.userId, input.projectId, MAX_SAVED_VIEWS],
  );
  const parsed = result.rows.map((row) => ({ row, config: normalizeSavedViewConfig(row.configuration) }));
  const modules = parsed.flatMap((entry) => entry.config.modules);
  await authorizeScope(input, modules);
  return { views: parsed.map((entry) => serialize({ ...entry.row, configuration: entry.config })), limit: MAX_SAVED_VIEWS };
}

export async function createCoordinatorSavedView(
  input: ScopeInput & { name: unknown; configuration: unknown; isDefault?: unknown; idempotencyKey: unknown },
) {
  await waitForCoordinatorSavedViewMigration();
  const named = normalizeName(input.name);
  const configuration = normalizeSavedViewConfig(input.configuration);
  await authorizeScope(input, configuration.modules);
  const makeDefault = input.isDefault === true;
  const key = idempotencyKey(input.idempotencyKey);
  const configurationFingerprint = hash(configuration);
  const requestFingerprint = hash({ operation: "create", name: named.name, configurationFingerprint, makeDefault });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`coordinator-saved-views:${input.userId}:${input.projectId}`]);
    const receipt = await operationReceipt(client, input, key, requestFingerprint);
    if (receipt) { await client.query("COMMIT"); return receipt; }
    const count = await client.query(
      "SELECT count(*)::int count FROM coordinator_saved_views WHERE user_id=$1 AND project_id=$2 AND deleted_at IS NULL",
      [input.userId, input.projectId],
    );
    if (Number(count.rows[0]?.count ?? 0) >= MAX_SAVED_VIEWS)
      throw new CoordinatorSavedViewError(409, "SAVED_VIEW_LIMIT_REACHED", "The personal saved-view limit has been reached.", "Se alcanzó el límite de vistas personales guardadas.");
    const duplicate = await client.query(
      `SELECT normalized_name,configuration_fingerprint FROM coordinator_saved_views
       WHERE user_id=$1 AND project_id=$2 AND deleted_at IS NULL
         AND (normalized_name=$3 OR configuration_fingerprint=$4) LIMIT 1`,
      [input.userId, input.projectId, named.normalized, configurationFingerprint],
    );
    if (duplicate.rows[0])
      throw new CoordinatorSavedViewError(409, "SAVED_VIEW_DUPLICATE", "A view with this name or configuration already exists.", "Ya existe una vista con este nombre o configuración.");
    if (makeDefault)
      await client.query(
        `UPDATE coordinator_saved_views SET is_default=false,version=version+1,updated_at=now()
         WHERE user_id=$1 AND project_id=$2 AND deleted_at IS NULL AND is_default=true`,
        [input.userId, input.projectId],
      );
    const id = crypto.randomUUID();
    const inserted = await client.query(
      `INSERT INTO coordinator_saved_views
        (id,project_id,user_id,name,normalized_name,configuration,configuration_fingerprint,is_default)
       VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8) RETURNING *`,
      [id, input.projectId, input.userId, named.name, named.normalized, JSON.stringify(configuration), configurationFingerprint, makeDefault],
    );
    const view = serialize(inserted.rows[0]);
    await insertReceipt(client, input, { operation: "create", key, requestFingerprint, savedViewId: id, resultVersion: 1, resultState: "active", resultSnapshot: view });
    await client.query("COMMIT");
    return { view, idempotent: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateCoordinatorSavedView(
  input: ScopeInput & {
    savedViewId: string;
    name?: unknown;
    configuration?: unknown;
    isDefault?: unknown;
    expectedVersion: unknown;
    idempotencyKey: unknown;
  },
) {
  input.savedViewId = stableViewId(input.savedViewId);
  await waitForCoordinatorSavedViewMigration();
  await authorizeScope(input, []);
  const currentResult = await pool.query(
    `SELECT * FROM coordinator_saved_views WHERE id=$1 AND user_id=$2 AND project_id=$3 AND deleted_at IS NULL`,
    [input.savedViewId, input.userId, input.projectId],
  );
  const current = currentResult.rows[0];
  if (!current)
    throw new CoordinatorSavedViewError(404, "SAVED_VIEW_NOT_FOUND", "Saved view not found.", "No se encontró la vista guardada.");
  const named = input.name === undefined ? { name: current.name, normalized: current.normalized_name } : normalizeName(input.name);
  const configuration = input.configuration === undefined ? normalizeSavedViewConfig(current.configuration) : normalizeSavedViewConfig(input.configuration);
  await authorizeScope(input, configuration.modules);
  const version = expectedVersion(input.expectedVersion);
  const makeDefault = input.isDefault === undefined ? current.is_default === true : input.isDefault === true;
  const key = idempotencyKey(input.idempotencyKey);
  const configurationFingerprint = hash(configuration);
  const requestFingerprint = hash({ operation: "update", savedViewId: input.savedViewId, version, name: named.name, configurationFingerprint, makeDefault });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`coordinator-saved-views:${input.userId}:${input.projectId}`]);
    const receipt = await operationReceipt(client, input, key, requestFingerprint);
    if (receipt) { await client.query("COMMIT"); return receipt; }
    const locked = await client.query(
      `SELECT * FROM coordinator_saved_views WHERE id=$1 AND user_id=$2 AND project_id=$3 AND deleted_at IS NULL FOR UPDATE`,
      [input.savedViewId, input.userId, input.projectId],
    );
    if (!locked.rows[0])
      throw new CoordinatorSavedViewError(404, "SAVED_VIEW_NOT_FOUND", "Saved view not found.", "No se encontró la vista guardada.");
    if (Number(locked.rows[0].version) !== version)
      throw new CoordinatorSavedViewError(409, "SAVED_VIEW_VERSION_CONFLICT", "This view changed; reload before saving.", "Esta vista cambió; vuelva a cargar antes de guardar.");
    const duplicate = await client.query(
      `SELECT id FROM coordinator_saved_views WHERE user_id=$1 AND project_id=$2 AND id<>$3 AND deleted_at IS NULL
       AND (normalized_name=$4 OR configuration_fingerprint=$5) LIMIT 1`,
      [input.userId, input.projectId, input.savedViewId, named.normalized, configurationFingerprint],
    );
    if (duplicate.rows[0])
      throw new CoordinatorSavedViewError(409, "SAVED_VIEW_DUPLICATE", "A view with this name or configuration already exists.", "Ya existe una vista con este nombre o configuración.");
    if (makeDefault)
      await client.query(
        `UPDATE coordinator_saved_views SET is_default=false,version=version+1,updated_at=now()
         WHERE user_id=$1 AND project_id=$2 AND id<>$3 AND deleted_at IS NULL AND is_default=true`,
        [input.userId, input.projectId, input.savedViewId],
      );
    const updated = await client.query(
      `UPDATE coordinator_saved_views SET name=$4,normalized_name=$5,configuration=$6::jsonb,
       configuration_fingerprint=$7,is_default=$8,version=version+1,updated_at=now()
       WHERE id=$1 AND user_id=$2 AND project_id=$3 RETURNING *`,
      [input.savedViewId, input.userId, input.projectId, named.name, named.normalized, JSON.stringify(configuration), configurationFingerprint, makeDefault],
    );
    const resultVersion = Number(updated.rows[0].version);
    const view = serialize(updated.rows[0]);
    await insertReceipt(client, input, { operation: "update", key, requestFingerprint, savedViewId: input.savedViewId, resultVersion, resultState: "active", resultSnapshot: view });
    await client.query("COMMIT");
    return { view, idempotent: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteCoordinatorSavedView(
  input: ScopeInput & { savedViewId: string; expectedVersion: unknown; idempotencyKey: unknown },
) {
  input.savedViewId = stableViewId(input.savedViewId);
  await waitForCoordinatorSavedViewMigration();
  await authorizeScope(input, []);
  const currentResult = await pool.query(
    `SELECT * FROM coordinator_saved_views WHERE id=$1 AND user_id=$2 AND project_id=$3`,
    [input.savedViewId, input.userId, input.projectId],
  );
  const current = currentResult.rows[0];
  if (!current)
    throw new CoordinatorSavedViewError(404, "SAVED_VIEW_NOT_FOUND", "Saved view not found.", "No se encontró la vista guardada.");
  const configuration = normalizeSavedViewConfig(current.configuration);
  await authorizeScope(input, configuration.modules);
  const version = expectedVersion(input.expectedVersion);
  const key = idempotencyKey(input.idempotencyKey);
  const requestFingerprint = hash({ operation: "delete", savedViewId: input.savedViewId, version });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`coordinator-saved-views:${input.userId}:${input.projectId}`]);
    const receipt = await operationReceipt(client, input, key, requestFingerprint);
    if (receipt) { await client.query("COMMIT"); return receipt; }
    const locked = await client.query(
      `SELECT * FROM coordinator_saved_views WHERE id=$1 AND user_id=$2 AND project_id=$3 FOR UPDATE`,
      [input.savedViewId, input.userId, input.projectId],
    );
    if (!locked.rows[0] || locked.rows[0].deleted_at)
      throw new CoordinatorSavedViewError(404, "SAVED_VIEW_NOT_FOUND", "Saved view not found.", "No se encontró la vista guardada.");
    if (Number(locked.rows[0].version) !== version)
      throw new CoordinatorSavedViewError(409, "SAVED_VIEW_VERSION_CONFLICT", "This view changed; reload before deleting.", "Esta vista cambió; vuelva a cargar antes de eliminar.");
    const deleted = await client.query(
      `UPDATE coordinator_saved_views SET deleted_at=now(),is_default=false,version=version+1,updated_at=now()
       WHERE id=$1 AND user_id=$2 AND project_id=$3 RETURNING *`,
      [input.savedViewId, input.userId, input.projectId],
    );
    const resultVersion = Number(deleted.rows[0].version);
    const view = serialize(deleted.rows[0]);
    await insertReceipt(client, input, { operation: "delete", key, requestFingerprint, savedViewId: input.savedViewId, resultVersion, resultState: "deleted", resultSnapshot: view });
    await client.query("COMMIT");
    return { view, idempotent: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
