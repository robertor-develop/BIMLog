---
name: api-server request body parsing robustness
description: How express body parsing is configured and how the plugin-sync route recovers unparsed bodies
---

# Body parsing config (app.ts)

`express.json` uses a custom `type` matcher: accepts any content-type containing `json` or `text/plain`, and explicitly excludes `multipart/form-data` and `application/x-www-form-urlencoded`. A `verify` hook stashes the raw buffer on `req.rawBody` (same hook on `express.urlencoded`).

**Why text/plain is accepted:** external HTTP clients (e.g. a .NET HttpWebRequest inside Autodesk Navisworks) can have their content-type altered or downgraded by host-process proxy/security settings, so the body must still parse as JSON. **Do NOT** broaden the matcher to `*/*` or `application/octet-stream` — that would consume the multer multipart upload at `/clash-reports/upload` and break file uploads.

# plugin-sync body recovery

The plugin-sync route has a pre-auth middleware that, when `req.body.clashes` is undefined, recovers the body two ways: (1) a urlencoded misparse where the whole JSON arrived as a single form key, (2) JSON.parse of `req.rawBody` (BOM-stripped).

**Key diagnostic distinction:** if the `[plugin-sync] hit` log shows `rawBody bytes: 0`, the body never reached the server — that is a CLIENT/proxy problem (e.g. `Expect: 100-continue` dropped behind the edge proxy, or a system proxy stripping the body), NOT something the server can parse. Client fix in .NET: `ServicePointManager.Expect100Continue = false` and/or `request.Proxy = null`. If `rawBody bytes > 0`, the server now parses it regardless of content-type charset/encoding.

# plugin-sync malformed JSON -> was 400

Two distinct defects, both producing `SyntaxError: Expected double-quoted property name` and a 400. App-level `express.json` runs before the route and throws first, so the route's raw-body recovery never ran.

1. **Locale decimal commas (the real production cause).** The plugin runs under a non-invariant .NET culture (es-* — UI showed "Aprobado"), so doubles serialize with a comma decimal separator: `"distance":0,0000`, `"positionX":2112,4409`. That is invalid JSON. This is the dominant failure — NOT trailing commas. Diagnose by the log snippet showing `<digit>,<digit>` in a numeric value.
2. **Trailing/double commas** from the plugin omitting null fields (`,}` / `,,`).

**Fix shape:** a middleware registered BEFORE `express.json` matches `POST` to `/clash-reports/plugin-sync$`, manually buffers the stream into `req.rawBody`, and sets `req._body = true` so `express.json`/`urlencoded` skip it (they early-return when `_body` is truthy). The route then parses `rawBody`; on parse failure it runs `repairPluginJson()` and re-parses, logging the failing snippet + a warning when a repair is applied (not silent).

**`repairPluginJson` rules (string-aware, tracks a `{`/`[` bracket stack):** (a) a comma between two digits whose nearest enclosing bracket is `{` (object value) -> `.` (decimal fix); the `{`-only guard means numeric arrays `[1,2,3]` are left intact; (b) a comma immediately followed (after whitespace) by `}`, `]`, or `,` -> dropped (structural noise). Never touches chars inside string literals, so data values are preserved.

**Why the manual buffer needs its own size cap:** bypassing `express.json` for this path also bypasses its `limit: 50mb`, creating a pre-auth memory-exhaustion DoS. The custom reader MUST enforce its own byte cap (mirror 50mb), respond 413 on overflow, and free buffered chunks. Do NOT `req.destroy()` to reject — that resets the connection and the edge proxy returns 502 instead of 413; instead use a `done` guard, clear chunks, send 413, and let further chunks be discarded by the guard.

**Root cause is client-side:** the proper fix is the plugin serializing via a real JSON serializer (Newtonsoft / System.Text.Json) instead of string concatenation. The server repair is a kept belt-and-suspenders guard (user chose "both").

# lens-sync raw control chars in Issue Notes -> was 500

The Navisworks plugin does NOT escape control characters when serializing the free-text Issue Note, so a multi-line/tabbed note injects raw `\n`/`\t` (charCode < 0x20) INSIDE a JSON string literal. JSON forbids that, so `JSON.parse`/`express.json` throws `Bad control character in string literal in JSON at position N` and the whole request 500s — short single-line notes sync fine, long ones fail. Symptom: plugin shows "Synced: 5 | Waiting: 1" / "Sync errors".

**Fix shape (mirrors plugin-sync):** the app.ts raw-body bypass regex covers BOTH paths (`/clash-reports/(plugin-sync|lens-sync)$`) so `express.json` is skipped and `req.rawBody` is buffered. The lens-sync route's own pre-auth middleware parses rawBody; on failure it runs `escapeJsonStringControlChars()` (string-aware: escapes control chars only while `inStr`, leaves inter-token whitespace alone) then re-parses, finally falling back to `repairPluginJson()`. Any NEW plugin POST path that carries free text must be added to the bypass regex AND given this recovery, or it will hard-fail the same way.

**Note column is already TEXT (unlimited)** — no length limit ever blocked storage; the only blocker was JSON parsing of control chars.
