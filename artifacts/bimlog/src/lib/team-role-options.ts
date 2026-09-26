import { distinctInvitationRoles } from "./invitation-ui";

/** Historical identities remain searchable, but cannot become new grants. */
export function filterRoleIdentities(options: { value: string }[], roles: string[]): string[] {
  return [...new Set([...distinctInvitationRoles(options).map(option => option.value), ...roles])];
}

/** Project administrator changes belong to the existing transfer workflow. */
export function selectableTeamRoles<T extends { value: string }>(options: T[], currentRole: string): T[] {
  return distinctInvitationRoles(options).filter(option => option.value !== "project_admin" || currentRole === "project_admin");
}
