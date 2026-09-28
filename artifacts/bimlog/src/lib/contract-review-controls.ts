// Presentation only: the server remains the authority for every action.
export function isIndependentContractActor(makerUserId: unknown, actorUserId: unknown): boolean {
  return typeof makerUserId === "number" && Number.isSafeInteger(makerUserId) && makerUserId > 0
    && typeof actorUserId === "number" && Number.isSafeInteger(actorUserId) && actorUserId > 0
    && makerUserId !== actorUserId;
}
