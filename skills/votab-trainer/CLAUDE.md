# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`vocab-trainer` is an MCP server providing spaced repetition vocabulary learning. It exposes 7 tools via the Model Context Protocol for OpenClaw agents to use. Also includes an HTTP API server and React web frontend for direct access.

## Commands

```bash
bun run build          # Compile TypeScript to dist/
bun run start          # Run MCP server (bun run dist/index.js)
bun run api            # Run HTTP API server (bun run api/server.ts)
bun run dev:web        # Run React frontend dev server
bun run dev            # Run both API and web dev servers
bun run test           # Run all tests (unit + integration)
bun run test:unit       # Unit tests only
bun run test:integration # Integration tests only
```

## Architecture

See [docs/architecture.md](docs/architecture.md) for full architecture documentation.

```
index.ts          # MCP server entry, registers tools via @modelcontextprotocol/sdk
    ↓
tools.ts          # Defines 7 MCP tools (vocab_review, vocab_add_word, etc.)
    ↓
algorithm.ts      # Spaced repetition logic: calculateNextReview, processReviewFeedbacks
storage.ts        # SQLite storage via bun:sqlite, path resolved at RUNTIME
    ↓
~/.vocab-trainer/words.db  # Persistent SQLite storage
```

**Critical design**: `storage.ts` uses `getDataPath()` as a function (not a constant), so it reads `VOCAB_DATA_PATH` at call time. This enables test isolation — tests set `VOCAB_DATA_PATH` before importing storage/algorithm modules.

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

See [docs/testing.md](docs/testing.md) for full test documentation including commands, structure, coverage, and data isolation mechanism.

**Key isolation design**: `storage.ts` uses `getDataPath()` as a function (not a constant), reading `VOCAB_DATA_PATH` at call time. Tests set this env var before importing storage/algorithm modules.

## Bug Note

`processReviewFeedbacks` was previously buggy — it called `updateWord()` which internally loaded/saved data, then `saveData(data)` at the end overwrote those changes. Fixed by directly mutating `existingWord` in memory before a single `saveData()` call at the end.
