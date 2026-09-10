import { z } from "zod/v4";
import { coordinationScopeSchema } from "./coordination-hub-service";

const lifecycleQuerySchema = z.object({
  scope: coordinationScopeSchema,
  credentialLimit: z.number().int().min(1).max(50).default(20),
  eventLimit: z.number().int().min(1).max(100).default(50),
}).strict();

export const connectorCredentialLifecycleRecordSchema = z.object({
  credentialId: z.string().trim().min(1).max(1_024),
  provider: z.literal("sharepoint"),
  label: z.string().trim().min(1).max(256),
  state: z.enum(["pending_validation", "active", "disabled", "revoked"]),
  keyVersion: z.number().int().positive(),
  createdByUserId: z.number().int().positive(),
  enrolledAt: z.string().datetime({ offset: true }),
  mappedToProject: z.boolean(),
}).strict();

export const connectorCredentialLifecycleEventSchema = z.object({
  event: z.enum(["enrolled", "rotated_pending_validation", "activated", "validation_rejected"]),
  credentialId: z.string().trim().min(1).max(1_024),
  actorUserId: z.number().int().positive(),
  occurredAt: z.string().datetime({ offset: true }),
  previousKeyVersion: z.number().int().positive().nullable(),
  keyVersion: z.number().int().positive().nullable(),
  evidenceCode: z.string().trim().min(1).max(128).regex(/^[A-Z0-9][A-Z0-9_.:-]*$/).nullable(),
}).strict();

export type ConnectorCredentialLifecycleQuery = z.infer<typeof lifecycleQuerySchema>;
export type ConnectorCredentialLifecycleRecord = z.infer<typeof connectorCredentialLifecycleRecordSchema>;
export type ConnectorCredentialLifecycleEvent = z.infer<typeof connectorCredentialLifecycleEventSchema>;

export interface ConnectorCredentialLifecycleStore {
  read(input: ConnectorCredentialLifecycleQuery): Promise<{
    credentials: ConnectorCredentialLifecycleRecord[];
    events: ConnectorCredentialLifecycleEvent[];
  }>;
}

export class ConnectorCredentialLifecycleService {
  constructor(private readonly store: ConnectorCredentialLifecycleStore) {}

  async read(input: unknown): Promise<{
    projectId: number;
    credentialLimit: number;
    eventLimit: number;
    credentials: ConnectorCredentialLifecycleRecord[];
    events: ConnectorCredentialLifecycleEvent[];
  }> {
    const query = lifecycleQuerySchema.parse(input);
    const result = await this.store.read(query);
    return {
      projectId: query.scope.projectId,
      credentialLimit: query.credentialLimit,
      eventLimit: query.eventLimit,
      credentials: z.array(connectorCredentialLifecycleRecordSchema).max(query.credentialLimit).parse(result.credentials),
      events: z.array(connectorCredentialLifecycleEventSchema).max(query.eventLimit).parse(result.events),
    };
  }
}
