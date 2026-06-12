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
