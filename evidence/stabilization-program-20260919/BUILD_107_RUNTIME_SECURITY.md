# Build 107 — Runtime security configuration

Status: PASS

- Replaced globally open CORS with a credential-aware allowlist derived from governed BIMLog/Replit origins; originless native and server requests remain supported.
- Added CSP, frame denial, MIME sniffing denial, referrer policy, and browser capability-denial headers.
- Production now fails closed when `SESSION_SECRET` is absent or shorter than 32 characters.
- The unauthenticated environment probe and startup output no longer expose database host or database name.
- Request diagnostics remain metadata-only and upload paths remain bounded.

Regression: `pnpm --filter @workspace/api-server run test:block22-build107`
