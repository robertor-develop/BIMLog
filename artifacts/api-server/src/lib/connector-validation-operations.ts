import { z } from "zod/v4";
import { coordinationScopeSchema } from "./coordination-hub-service";

const querySchema = z.object({
  scope: coordinationScopeSchema,
  limit: z.number().int().min(1).max(50).default(20),
}).strict();

export const connectorValidationOperationSchema = z.object({
  credentialId: z.string().trim().min(1).max(1_024),
  provider: z.literal("sharepoint"),
  credentialState: z.enum(["pending_validation", "active", "disabled", "revoked"]),
  keyVersion: z.number().int().positive(),
  decision: z.enum(["activated", "rejected"]),
  evidenceCode: z.string().trim().min(1).max(128).regex(/^[A-Z0-9][A-Z0-9_.:-]*$/),
  actorUserId: z.number().int().positive(),
  occurredAt: z.string().datetime({ offset: true }),
}).strict();

export type ConnectorValidationOperation = z.infer<typeof connectorValidationOperationSchema>;
export type ConnectorValidationOperationsQuery = z.infer<typeof querySchema>;

export interface ConnectorValidationOperationsStore {
  list(input: ConnectorValidationOperationsQuery): Promise<ConnectorValidationOperation[]>;
}

export class ConnectorValidationOperationsService {
  constructor(private readonly store: ConnectorValidationOperationsStore) {}

  async list(input: unknown): Promise<{ projectId: number; limit: number; operations: ConnectorValidationOperation[] }> {
    const query = querySchema.parse(input);
    const operations = z.array(connectorValidationOperationSchema).max(query.limit).parse(await this.store.list(query));
    return { projectId: query.scope.projectId, limit: query.limit, operations };
  }
}
