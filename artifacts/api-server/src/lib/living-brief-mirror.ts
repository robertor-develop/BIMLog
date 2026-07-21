import { pool } from "@workspace/db";
import { livingBriefSourceIdentity, loadLivingBriefSource, resolveDeployedSourceCommit, sha256 } from "./living-brief-source";

export type MirrorStatus = "Current" | "Stale" | "Mismatch" | "Missing";

export type MirrorRow = {
  document_key: string;
  content: string;
  deployed_source_commit: string;
  reconciled_through_commit: string;
  source_sha256: string;
  source_changed_at: Date;
  mirror_synced_at: Date;
  synchronization_result: string;
  mismatch_detected_at: Date | null;
  version: string | number;
};

const LOCK_KEY = 10472917;

type MirrorClient = {
  query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
  release(): void;
};

export function assertKnownDocumentKey(key: string, knownKeys: ReadonlySet<string>): void {
  if (!knownKeys.has(key)) throw new Error(`Unknown Living Brief document key: ${key}`);
}

export function mirrorStatus(row: MirrorRow | undefined, expected: { sha256: string; reconciledThroughCommit: string; deployedSourceCommit: string }): MirrorStatus {
  if (!row) return "Missing";
  if (sha256(row.content) !== row.source_sha256 || row.source_sha256 !== expected.sha256) return "Mismatch";
  if (row.deployed_source_commit !== expected.deployedSourceCommit || row.reconciled_through_commit !== expected.reconciledThroughCommit) return "Stale";
  if (row.synchronization_result === "missing") return "Missing";
  if (row.synchronization_result === "stale") return "Stale";
  return row.synchronization_result === "current" ? "Current" : "Mismatch";
}

async function lock(client: MirrorClient): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK_KEY]);
}

async function selectRows(client: MirrorClient): Promise<MirrorRow[]> {
  const result = await client.query<MirrorRow>("SELECT * FROM living_brief_documents ORDER BY document_key FOR UPDATE");
  return result.rows;
}

export async function synchronizeLivingBriefMirror(): Promise<void> {
  const source = loadLivingBriefSource();
  const sourceIdentity = livingBriefSourceIdentity(source);
  const deployedSourceCommit = resolveDeployedSourceCommit(source.manifest);
  const knownKeys = new Set(source.catalog.map((entry) => entry.key));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await lock(client);
    if (livingBriefSourceIdentity(loadLivingBriefSource()) !== sourceIdentity) throw new Error("Living Brief source changed concurrently during synchronization");
    const existing = await selectRows(client);
    for (const row of existing) assertKnownDocumentKey(row.document_key, knownKeys);
    const byKey = new Map(existing.map((row) => [row.document_key, row]));
    for (const document of source.documents) {
      const row = byKey.get(document.key);
      if (!row) {
        const legacy = await client.query<{ value: string; updated_at: Date }>(
          "SELECT value, updated_at FROM platform_settings WHERE key=$1 LIMIT 1",
          [`living_brief_doc:${document.file}`],
        );
        const legacyContent = legacy.rows[0]?.value;
        const legacyMismatch = legacyContent !== undefined && sha256(legacyContent) !== document.sha256;
        const mirrorContent = legacyMismatch ? legacyContent : document.content;
        await client.query(
          `INSERT INTO living_brief_documents
            (document_key, content, deployed_source_commit, reconciled_through_commit, source_sha256,
             source_changed_at, mirror_synced_at, synchronization_result, mismatch_detected_at, version)
           VALUES ($1,$2,$3,$4,$5,$6,now(),$7,CASE WHEN $7='mismatch' THEN now() ELSE NULL END,1)`,
          [
            document.key,
            mirrorContent,
            legacyMismatch ? "legacy-unverified" : deployedSourceCommit,
            document.reconciledThroughCommit,
            document.sha256,
            document.sourceChangedAt,
            legacyMismatch ? "mismatch" : "current",
          ],
        );
        continue;
      }
      const status = mirrorStatus(row, {
        sha256: document.sha256,
        reconciledThroughCommit: document.reconciledThroughCommit,
        deployedSourceCommit,
      });
      if (status === "Current") continue;
      const synchronizationResult = status.toLowerCase();
      if (row.synchronization_result === synchronizationResult && (status !== "Mismatch" || row.mismatch_detected_at)) continue;
      await client.query(
        `UPDATE living_brief_documents
         SET synchronization_result=$2,
             mismatch_detected_at=CASE WHEN $2='mismatch' THEN COALESCE(mismatch_detected_at, now()) ELSE mismatch_detected_at END
         WHERE document_key=$1`,
        [document.key, synchronizationResult],
      );
    }
    if (livingBriefSourceIdentity(loadLivingBriefSource()) !== sourceIdentity) throw new Error("Living Brief source changed concurrently during synchronization");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function readLivingBriefMirrorRows(): Promise<Map<string, MirrorRow>> {
  const result = await pool.query<MirrorRow>("SELECT * FROM living_brief_documents ORDER BY document_key");
  return new Map(result.rows.map((row) => [row.document_key, row]));
}

export async function reconcileLivingBriefMirror(expectedCurrentHashes: Record<string, string>): Promise<void> {
  const source = loadLivingBriefSource();
  const sourceIdentity = livingBriefSourceIdentity(source);
  const deployedSourceCommit = resolveDeployedSourceCommit(source.manifest);
  const knownKeys = new Set(source.catalog.map((entry) => entry.key));
  for (const key of Object.keys(expectedCurrentHashes)) assertKnownDocumentKey(key, knownKeys);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await lock(client);
    if (livingBriefSourceIdentity(loadLivingBriefSource()) !== sourceIdentity) throw new Error("Living Brief source changed concurrently during reconciliation");
    const existing = await selectRows(client);
    for (const row of existing) assertKnownDocumentKey(row.document_key, knownKeys);
    const byKey = new Map(existing.map((row) => [row.document_key, row]));
    for (const document of source.documents) {
      const row = byKey.get(document.key);
      if (!row) throw new Error(`Mirror row is missing for ${document.key}; restart synchronization first`);
      if (expectedCurrentHashes[document.key] !== sha256(row.content)) {
        throw new Error(`Mirror changed concurrently for ${document.key}`);
      }
    }
    for (const document of source.documents) {
      await client.query(
        `UPDATE living_brief_documents
         SET content=$2, deployed_source_commit=$3, reconciled_through_commit=$4, source_sha256=$5,
             source_changed_at=$6, mirror_synced_at=now(), synchronization_result='current',
             mismatch_detected_at=NULL, version=version+1
         WHERE document_key=$1`,
        [document.key, document.content, deployedSourceCommit, document.reconciledThroughCommit, document.sha256, document.sourceChangedAt],
      );
    }
    if (livingBriefSourceIdentity(loadLivingBriefSource()) !== sourceIdentity) throw new Error("Living Brief source changed concurrently during reconciliation");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
