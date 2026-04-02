# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`vocab-trainer` is a monorepo providing spaced repetition vocabulary learning via MCP server, HTTP API, and React web frontend.

## Architecture

See [docs/architecture.md](docs/architecture.md) for full technical documentation including directory structure, storage design, data model, API endpoints, and MCP tools.

See [docs/review-system.md](docs/review-system.md) for detailed review algorithm, feedback handling logic, and Status page API format.

## Commands

```bash
# Build & Run
bun run build              # Build all packages
bun run dev:mcp            # Run MCP server (packages/vocab-mcp/src/index.ts)
bun run dev:api            # Run HTTP API (packages/vocab-api/src/server.ts)
bun run dev:web            # Run React frontend

# Start all services (recommended - loads env vars from scripts/.env)
bash scripts/dev.sh        # API + MCP + Web in parallel

# Test
bun run test               # Run all tests (unit + integration)
bun run test:unit          # Unit tests only
bun run test:integration   # Integration tests only

# Individual test files
bun run tests/run-all.mjs              # All tests
bun run tests/run-all.mjs unit         # Unit tests only
bun run tests/run-all.mjs integration  # Integration tests only
```

**Important**: Always use `bash scripts/dev.sh` to start services - it loads environment variables (MINIMAX_API_KEY, etc.) from `scripts/.env`. Starting directly with `bun run dev:api` will fail due to missing env vars.

## LAN Access

For access from other devices on the LAN, set `VITE_API_URL` in `web/.env`:

```
VITE_API_URL=http://192.168.0.105:3099/api
```

## Storage Design

**Factory Pattern**: `vocab-core` uses `createStorage()` factory instead of singleton. This enables:
- Test isolation via unique database files per test suite
- Independent instances per process (MCP server, API server)

**Critical design**: `createStorageFromEnv()` reads `VOCAB_DATA_PATH` at call time and caches the instance. For tests, `closeDb()` invalidates the cache before switching test data files.

**Database path**: `~/.vocab-trainer/words.db` (or `VOCAB_DATA_PATH` env var)

## Data Model

- SQLite database `words.db` stores vocabulary with levels 0-9
- Level progression: 0→1→2→3→4→5→6→7→8→9 with intervals [20min, 1hr, 4hr, 12hr, 1day, 2day, 7day, 15day, 30day, 60day]
- Feedback types: `pass` (advance), `fail` (Level 0-3: reset to 0, Level 4+: keep level), `fuzzy` (interval halved)
- Streak tracks consecutive review days
- New words are immediately reviewable (no initial delay)

## MCP Tools

| Tool | Purpose |
|------|---------|
| `vocab_review` | Get today's due words |
| `vocab_review_feedback` | Submit pass/fail/fuzzy for multiple words at once |
| `vocab_add_word` | Add a new word |
| `vocab_get_status` | Get statistics (streak, counts, level distribution) |
| `vocab_list_words` | List words with optional filter |
| `vocab_remove_word` | Remove a word |
| `vocab_get_word_detail` | Get full word info |

## Testing

See [docs/testing.md](docs/testing.md) for full test documentation including test structure, data isolation mechanism, and known test issues.

**Test status** (2026-03-31):
- Algorithm unit tests: 33 passed, 0 failed
- Storage unit tests: 23 passed, 0 failed
- Enrichment unit tests: 20 passed, 0 failed
- MCP integration tests: 21 passed, 0 failed
- Batch review integration tests: 41 passed, 0 failed
- **Total: 138 passed, 0 failed**

All tests passing as of 2026-03-31.
