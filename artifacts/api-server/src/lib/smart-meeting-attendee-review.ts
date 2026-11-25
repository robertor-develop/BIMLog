export type AttendeeCandidate = {
  fullName: string;
  email: string | null;
  company: string | null;
};

export type AttendeeReview = AttendeeCandidate & {
  matchStatus: "matched" | "new_contact" | "conflict";
  directoryEntryId: number | null;
};

const clean = (value: string | undefined) => value?.trim().replace(/\s+/g, " ") || null;
const email = (value: string | undefined) => {
  const normalized = value?.trim().toLowerCase() || "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
};

export function parseAttendeeCandidates(value: string): AttendeeCandidate[] {
  const candidates = value.split(/\r?\n|;/).map((line) => {
    const [nameValue, emailValue, companyValue] = line.split(/\t|,/);
    return { fullName: clean(nameValue) ?? "", email: email(emailValue), company: clean(companyValue) };
  }).filter((candidate) => candidate.fullName);
  if (candidates.length > 500) throw new Error("meeting_attendee_limit_exceeded");
  return candidates;
}

export function reviewAttendeeCandidates(
  candidates: AttendeeCandidate[],
  directory: Array<{ id: number; fullName: string; email: string | null }>,
): AttendeeReview[] {
  return candidates.map((candidate) => {
    const emailMatches = candidate.email
      ? directory.filter((entry) => entry.email?.trim().toLowerCase() === candidate.email)
      : [];
    if (emailMatches.length === 1) return { ...candidate, matchStatus: "matched", directoryEntryId: emailMatches[0].id };
    if (emailMatches.length > 1) return { ...candidate, matchStatus: "conflict", directoryEntryId: null };
    const nameMatches = directory.filter((entry) => entry.fullName.trim().toLowerCase() === candidate.fullName.toLowerCase());
    if (nameMatches.length === 1 && !candidate.email) return { ...candidate, matchStatus: "matched", directoryEntryId: nameMatches[0].id };
    if (nameMatches.length > 0) return { ...candidate, matchStatus: "conflict", directoryEntryId: null };
    return { ...candidate, matchStatus: "new_contact", directoryEntryId: null };
  });
}
