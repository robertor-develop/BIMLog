export const BIMLOG_SHARED_VERSION_PATTERN = /^v1\.05\.N(\d{2,})-P(\d{2,})$/;
export const BIMLOG_FIRST_SHARED_VERSION = "v1.05.N01-P01" as const;

export type BimlogVersionOwner = "lens-next" | "platform-apu";

export type BimlogSharedVersion = Readonly<{
  raw: string;
  lensNext: number;
  platform: number;
}>;

export function parseBimlogSharedVersion(value: unknown): BimlogSharedVersion | null {
  if (typeof value !== "string") return null;
  const match = BIMLOG_SHARED_VERSION_PATTERN.exec(value.trim());
  if (!match) return null;
  const lensNext = Number(match[1]);
  const platform = Number(match[2]);
  if (!Number.isSafeInteger(lensNext) || lensNext < 1) return null;
  if (!Number.isSafeInteger(platform) || platform < 1) return null;
  return { raw: value.trim(), lensNext, platform };
}

const counter = (value: number) => String(value).padStart(2, "0");

export function nextBimlogSharedVersion(
  current: unknown,
  owner: BimlogVersionOwner,
) {
  const parsed = parseBimlogSharedVersion(current);
  if (!parsed) return BIMLOG_FIRST_SHARED_VERSION;
  return owner === "lens-next"
    ? `v1.05.N${counter(parsed.lensNext + 1)}-P${counter(parsed.platform)}`
    : `v1.05.N${counter(parsed.lensNext)}-P${counter(parsed.platform + 1)}`;
}

export function assertBimlogVersionTransition(input: {
  previous: unknown;
  next: unknown;
  owner: BimlogVersionOwner;
}) {
  const next = parseBimlogSharedVersion(input.next);
  if (!next) throw new Error("BIMLOG_SHARED_VERSION_INVALID");
  const previous = parseBimlogSharedVersion(input.previous);
  if (!previous) {
    if (next.raw !== BIMLOG_FIRST_SHARED_VERSION)
      throw new Error("BIMLOG_FIRST_SHARED_VERSION_REQUIRED");
    return next;
  }
  if (input.owner === "lens-next") {
    if (next.platform !== previous.platform)
      throw new Error("BIMLOG_PLATFORM_COUNTER_NOT_OWNED");
    if (next.lensNext !== previous.lensNext + 1)
      throw new Error("BIMLOG_LENS_COUNTER_SEQUENCE_INVALID");
  } else {
    if (next.lensNext !== previous.lensNext)
      throw new Error("BIMLOG_LENS_COUNTER_NOT_OWNED");
    if (next.platform !== previous.platform + 1)
      throw new Error("BIMLOG_PLATFORM_COUNTER_SEQUENCE_INVALID");
  }
  return next;
}
