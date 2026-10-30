import { pool } from "@workspace/db";

export type ProcoreIntakeState = {
  goal: string;
  needed: string;
  destinationProjectId: number;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  selectedSources: Array<{ ref: string; fileId: string; projectRef: string; versionId: string; versionLabel: string; name: string; mimeType: string | null }>;
  updatedAt: string | null;
};
type Queryable = { query(text: string, values?: unknown[]): Promise<{ rows: any[] }> };
let ready: Promise<void> | null = null;

export async function ensureProcoreIntakeStateSchema(client: Queryable = pool): Promise<void> {
  ready ??= client.query(`CREATE TABLE IF NOT EXISTS procore_intake_states(
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    goal text NOT NULL DEFAULT '',
    needed text NOT NULL DEFAULT '',
    destination_project_id integer NOT NULL,
    messages jsonb NOT NULL DEFAULT '[]'::jsonb,
    selected_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(user_id, company_id, project_id)
  )`).then(() => undefined);
  await ready;
}

function normalize(input: Partial<ProcoreIntakeState>, projectId: number): Omit<ProcoreIntakeState, "updatedAt"> {
  const messages = Array.isArray(input.messages) ? input.messages.slice(-30).flatMap((m) =>
    m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
      ? [{ role: m.role, content: m.content.slice(0, 2000) }] : []) : [];
  const selectedSources = Array.isArray(input.selectedSources) ? input.selectedSources.slice(0, 100).flatMap((s) =>
    s && [s.ref,s.fileId,s.projectRef,s.versionId,s.versionLabel,s.name].every((v) => typeof v === "string" && v.length <= 500)
      ? [{ ref:s.ref,fileId:s.fileId,projectRef:s.projectRef,versionId:s.versionId,versionLabel:s.versionLabel,name:s.name,mimeType:typeof s.mimeType==="string"?s.mimeType.slice(0,200):null }] : []) : [];
  return {
    goal: typeof input.goal === "string" ? input.goal.slice(0, 2000) : "",
    needed: typeof input.needed === "string" ? input.needed.slice(0, 2000) : "",
    destinationProjectId: projectId,
    messages,
    selectedSources,
  };
}

export async function loadProcoreIntakeState(userId: number, companyId: number, projectId: number, client: Queryable = pool): Promise<ProcoreIntakeState> {
  await ensureProcoreIntakeStateSchema(client);
  const result = await client.query(`SELECT goal,needed,messages,selected_sources,destination_project_id,updated_at
    FROM procore_intake_states WHERE user_id=$1 AND company_id=$2 AND project_id=$3`, [userId,companyId,projectId]);
  const row=result.rows[0];
  return row ? { goal:row.goal,needed:row.needed,messages:row.messages,selectedSources:row.selected_sources,
    destinationProjectId:Number(row.destination_project_id),updatedAt:new Date(row.updated_at).toISOString() }
    : { goal:"",needed:"",messages:[],selectedSources:[],destinationProjectId:projectId,updatedAt:null };
}

export async function saveProcoreIntakeState(userId: number, companyId: number, projectId: number, input: Partial<ProcoreIntakeState>, client: Queryable = pool): Promise<ProcoreIntakeState> {
  await ensureProcoreIntakeStateSchema(client);
  const value=normalize(input,projectId);
  await client.query(`INSERT INTO procore_intake_states(user_id,company_id,project_id,goal,needed,destination_project_id,messages,selected_sources)
    VALUES($1,$2,$3,$4,$5,$3,$6::jsonb,$7::jsonb)
    ON CONFLICT(user_id,company_id,project_id) DO UPDATE SET goal=EXCLUDED.goal,needed=EXCLUDED.needed,messages=EXCLUDED.messages,selected_sources=EXCLUDED.selected_sources,updated_at=now()`,
    [userId,companyId,projectId,value.goal,value.needed,JSON.stringify(value.messages),JSON.stringify(value.selectedSources)]);
  return loadProcoreIntakeState(userId,companyId,projectId,client);
}
