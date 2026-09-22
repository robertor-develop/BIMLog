import { createHash } from "node:crypto";

export type EdtQueryResult<Row = Record<string, unknown>> = { rows: Row[]; rowCount?: number | null };
export type EdtTransactionClient = {
  query<Row = Record<string, unknown>>(sql: string, values?: readonly unknown[]): Promise<EdtQueryResult<Row>>;
  release?: () => void;
};
export type EdtTransactionHost = { connect(): Promise<EdtTransactionClient> };

export class EdtEngineConflict extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a],[b]) => a.localeCompare(b)).map(([key,item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function edtFingerprint(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export function deterministicEdtId(namespace: string, identity: string): string {
  const hex = createHash("sha256").update(`${namespace}\0${identity}`).digest("hex").slice(0, 32);
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20)}`;
}

export async function withEdtTransaction<T>(work: (client: EdtTransactionClient) => Promise<T>, host?: EdtTransactionHost): Promise<T> {
  const resolvedHost: EdtTransactionHost = host ?? ((await import("@workspace/db")).pool as unknown as EdtTransactionHost);
  const client = await resolvedHost.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* preserve the original failure */ }
    throw error;
  } finally {
    client.release?.();
  }
}
