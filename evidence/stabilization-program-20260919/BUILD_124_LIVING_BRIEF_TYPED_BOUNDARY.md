# Build 124 — typed Living Brief boundary

Status: `PASS`

- Removed the repository's remaining `@ts-ignore` from Living Brief source discovery.
- Added an explicit typed `__dirname` declaration while preserving ESM `import.meta.url` fallback behavior.
- The direct regression rejects future TypeScript suppression at this boundary.
