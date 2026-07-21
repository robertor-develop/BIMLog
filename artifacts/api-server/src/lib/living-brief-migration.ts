import { pool } from "@workspace/db";

export async function ensureLivingBriefMirrorSchema(): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS living_brief_documents (
    document_key text PRIMARY KEY,
    content text NOT NULL,
    deployed_source_commit text NOT NULL,
    reconciled_through_commit text NOT NULL,
    source_sha256 text NOT NULL,
    source_changed_at timestamptz NOT NULL,
    mirror_synced_at timestamptz NOT NULL DEFAULT now(),
    synchronization_result text NOT NULL,
    mismatch_detected_at timestamptz,
    version bigint NOT NULL DEFAULT 1,
    CONSTRAINT living_brief_documents_sha256_format CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT living_brief_documents_sync_result CHECK (synchronization_result IN ('current','stale','mismatch','missing'))
  )`);
}
