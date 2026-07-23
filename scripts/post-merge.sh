#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm run check:database-safety
BIMLOG_SCHEMA_TARGET=development pnpm --filter @workspace/db run sync-development
