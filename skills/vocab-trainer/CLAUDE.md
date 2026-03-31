# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`vocab-trainer` is a monorepo providing spaced repetition vocabulary learning via MCP server, HTTP API, and React web frontend.

## Architecture

```
vocab-trainer/                    # Bun workspace root
├── packages/
│   ├── vocab-core/               # Shared core library
│   │   ├── src/
│   │   │   ├── index.ts         # Public exports
│   │   │   ├── types.ts         # TypeScript types
│   │   │   ├── storage.ts       # SQLite storage (factory pattern)
│   │   │   └── algorithm.ts      # Spaced repetition algorithm
│   │   └── schema.sql           # SQLite schema
│   │
│   ├── vocab-mcp/               # MCP server (AI tools)
│   │   └── src/
│   │       ├── index.ts         # MCP server entry
│   │       ├── tools.ts         # 7 MCP tools
│   │       └── llm.ts           # LLM integration
│   │
│   └── vocab-api/               # HTTP REST API (Hono)
│       └── src/
│           ├── server.ts        # Hono API server
│           └── llm.ts           # LLM integration
│
├── web/                          # React frontend (unchanged)
└── tests/                        # Test suite
    ├── unit/                    # Unit tests
    ├── integration/             # Integration tests
    └── helpers/                 # Test utilities
```

## Commands

```bash
# Build & Run
bun run build              # Build all packages
bun run dev:mcp            # Run MCP server (packages/vocab-mcp/src/index.ts)
bun run dev:api            # Run HTTP API (packages/vocab-api/src/server.ts)
bun run dev:web            # Run React frontend

# Test
bun run test               # Run all tests (unit + integration)
bun run test:unit          # Unit tests only
bun run test:integration   # Integration tests only

# Individual test files
bun run tests/run-all.mjs              # All tests
bun run tests/run-all.mjs unit         # Unit tests only
bun run tests/run-all.mjs integration  # Integration tests only
```

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

- SQLite database `words.db` stores vocabulary with levels 0-5
- Level progression: 0→1→2→3→4→5 with intervals [1,2,4,7,15,30] days
- Feedback types: `pass` (advance), `fail` (reset to level 0), `fuzzy` (interval halved)
- Streak tracks consecutive review days

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

See [docs/testing.md](docs/testing.md) for full test documentation.

**Test isolation**: Each test suite uses a unique SQLite database file (UUID-based). The `closeDb()` function invalidates the cached storage instance between tests to ensure isolation.

**Known limitation**: Integration tests that verify streak behavior across MCP server restarts may fail because the MCP server runs as a separate process with its own storage cache.
