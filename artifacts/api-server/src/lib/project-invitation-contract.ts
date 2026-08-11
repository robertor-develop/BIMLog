export function normalizeInvitationEmail(value: unknown) {
  const email = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("A valid invitation email is required.");
  return email;
}

export function invitationEmailLockKey(email: string) {
  return `bimlog:invitation-email:${email}`;
}

export function projectInvitationLockKey(projectId: number, email: string) {
  return `bimlog:project-invitation:${projectId}:${email}`;
}

export function resolveInvitationCompanyId(
  companyIds: Array<number | null | undefined>,
) {
  const canonical = [
    ...new Set(
      companyIds.filter(
        (value): value is number =>
          Number.isSafeInteger(value) && Number(value) > 0,
      ),
    ),
  ];
  if (canonical.length > 1)
    throw new Error(
      "Pending invitations bind this email to conflicting companies. Ask an administrator to cancel the incorrect invitation.",
    );
  return canonical[0] ?? null;
}
