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

# plugin-sync malformed JSON (trailing/double commas) -> was 400

The plugin hand-builds JSON and conditionally omits null fields, leaving trailing commas before `}`/`]` or double commas `,,`. JSON forbids these, so app-level `express.json` (runs before the route) threw `SyntaxError: Expected double-quoted property name` and returned 400 — the route's raw-body recovery never ran because the app-level parser fails first.

**Fix shape:** a middleware registered BEFORE `express.json` matches `POST` to `/clash-reports/plugin-sync$`, manually buffers the stream into `req.rawBody`, and sets `req._body = true` so `express.json`/`urlencoded` skip it (they early-return when `_body` is truthy). The route then parses `rawBody`; on parse failure it runs `repairPluginJson()` — a string-aware scanner that drops only commas immediately followed (after whitespace) by `}`, `]`, or `,`, never touching chars inside string literals — and re-parses. Logs the failing snippet + a warning when a repair is applied (not silent).

**Why the manual buffer needs its own size cap:** bypassing `express.json` for this path also bypasses its `limit: 50mb`, creating a pre-auth memory-exhaustion DoS. The custom reader MUST enforce its own byte cap (mirror 50mb), respond 413 on overflow, and free buffered chunks. Do NOT `req.destroy()` to reject — that resets the connection and the edge proxy returns 502 instead of 413; instead use a `done` guard, clear chunks, send 413, and let further chunks be discarded by the guard.

**Root cause is client-side:** the proper fix is the plugin serializing via a real JSON serializer (Newtonsoft / System.Text.Json) instead of string concatenation. The server repair is a kept belt-and-suspenders guard (user chose "both").
