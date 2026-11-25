const unescapeIcs = (value: string) => value
  .replace(/\\n/gi, "\n")
  .replace(/\\,/g, ",")
  .replace(/\\;/g, ";")
  .replace(/\\\\/g, "\\");

const unfold = (value: string) => value.replace(/\r?\n[ \t]/g, "");

export type IcsMeetingCandidate = {
  uid: string;
  title: string;
  start: string;
  end: string | null;
  location: string | null;
  attendees: Array<{ fullName: string; email: string }>;
};

function parseDate(value: string) {
  if (!/^\d{8}T\d{6}Z$/.test(value)) throw new Error("meeting_ics_unsupported_date");
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`;
  if (Number.isNaN(Date.parse(iso))) throw new Error("meeting_ics_invalid_date");
  return iso;
}

export function parseIcsMeeting(value: string): IcsMeetingCandidate {
  if (Buffer.byteLength(value, "utf8") > 1_000_000) throw new Error("meeting_ics_too_large");
  const lines = unfold(value).split(/\r?\n/);
  const startIndex = lines.indexOf("BEGIN:VEVENT");
  const endIndex = lines.indexOf("END:VEVENT", startIndex + 1);
  if (startIndex < 0 || endIndex < 0) throw new Error("meeting_ics_event_required");
  const event = lines.slice(startIndex + 1, endIndex);
  const field = (name: string) => event.find((line) => line.startsWith(`${name}:`))?.slice(name.length + 1) ?? null;
  const uid = field("UID")?.trim();
  const title = field("SUMMARY")?.trim();
  const start = field("DTSTART")?.trim();
  if (!uid || !title || !start) throw new Error("meeting_ics_identity_required");
  const attendees = event.filter((line) => line.startsWith("ATTENDEE"))
    .map((line) => {
      const separator = line.indexOf(":");
      const params = line.slice(0, separator);
      const address = line.slice(separator + 1).replace(/^mailto:/i, "").trim().toLowerCase();
      const fullName = /(?:^|;)CN=([^;]+)/i.exec(params)?.[1];
      return { fullName: unescapeIcs(fullName || address), email: address };
    })
    .filter((row) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email));
  return {
    uid,
    title: unescapeIcs(title),
    start: parseDate(start),
    end: field("DTEND") ? parseDate(field("DTEND")!.trim()) : null,
    location: field("LOCATION") ? unescapeIcs(field("LOCATION")!.trim()) : null,
    attendees,
  };
}
