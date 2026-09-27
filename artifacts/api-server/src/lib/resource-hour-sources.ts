/** Read model only: scenarios and progress never create approved time. */
export function summarizeResourceHours(rows: ReadonlyArray<{ status: string; hours: string; supersededByEntryId?: string | null }>) {
  const buckets = { recorded: 0n, pending: 0n, approved: 0n, draft: 0n, rejected: 0n, legacy: 0n };
  for (const row of rows) {
    if (row.supersededByEntryId || ["corrected", "superseded"].includes(row.status)) continue;
    if (!/^\d+(\.\d{1,6})?$/.test(row.hours)) throw new Error("Invalid stored resource hours");
    const [whole, fraction = ""] = row.hours.split(".");
    const units = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
    const statuses: Record<string, keyof typeof buckets> = { submitted: "pending", approved: "approved", draft: "draft", rejected: "rejected", legacy_recorded: "legacy" };
    const key = Object.hasOwn(statuses, row.status) ? statuses[row.status] : undefined;
    if (!key) throw new Error("Unknown stored resource hour status");
    buckets.recorded += units;
    buckets[key] += units;
  }
  const format = (units: bigint) => { const cents = (units + 5_000n) / 10_000n; return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`; };
  // Architecture Closure v1.2: recorded, unapproved time is committed/pending;
  // approval moves it to consumed, not into a second overlapping commitment.
  const pending = buckets.pending + buckets.draft + buckets.legacy;
  return { recorded: format(buckets.recorded), pending: format(pending), approved: format(buckets.approved), draft: format(buckets.draft), rejected: format(buckets.rejected), legacy: format(buckets.legacy), committed: format(pending) };
}
