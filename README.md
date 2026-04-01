# Vocab Trainer

A spaced repetition vocabulary learning system with a web interface, HTTP API, and MCP server.

## Features

- **Spaced Repetition Algorithm** — 10 levels (0-9) with intervals from 20 minutes to 60 days
- **Smart Feedback** — Pass advances levels; Fail resets Lv.0-3 to zero and Lv.4+ stays at current level (20-min retry)
- **Web UI** — Review, Learn, Status, and Word List pages
- **REST API** — Full CRUD for programmatic access
- **MCP Server** — AI tool integration for Claude and other MCP-compatible assistants
- **Enrichment Data** — LLM-powered etymology, word forms, and root analysis
- **SQLite Storage** — Persistent, portable, no external database needed

## Architecture

```
vocab-trainer/
├── packages/
│   ├── vocab-core/       # Core library (algorithm, storage, types)
│   ├── vocab-api/        # HTTP REST API (Hono, port 3099)
│   └── vocab-mcp/        # MCP server for AI assistants
├── web/                  # React web frontend (Vite, port 5173)
└── tests/                # Unit + integration tests (138 tests passing)
```

## Quick Start

```bash
# Install Bun (if needed)
curl -fsSL https://bun.sh/install | bash

# Start API + Web UI
bun run dev

# Or start individually
bun run dev:api   # API at http://localhost:3099
bun run dev:web   # Web UI at http://localhost:5173
```

## Web UI

| Page | Route | Description |
|------|-------|-------------|
| Review | `/review` | Daily vocabulary review with pass/fail/fuzzy feedback |
| Learn | `/learn` | Add new words with LLM enrichment |
| List | `/list` | Browse, view, edit, and delete words |
| Status | `/status` | Learning statistics and schedule |

## API Endpoints

```
GET  /api/status           # Overall status (streak, counts, level stats)
GET  /api/review            # Get words due for review today
POST /api/review/feedback   # Submit pass/fail/fuzzy feedback
GET  /api/words             # List all words (filter: all/new/learning/hard/mastered)
POST /api/words             # Add a new word
GET  /api/words/:word       # Get word details
PUT  /api/words/:word       # Update word fields
DELETE /api/words/:word      # Remove a word
GET  /api/words/:word/enrich # Get LLM-generated etymology & variants
GET  /api/settings          # Get settings
POST /api/settings          # Update settings
```

## Spaced Repetition Levels

| Level | Interval | Label |
|-------|----------|-------|
| 0 | 20 min | New |
| 1 | 1 hr | Fresh |
| 2 | 4 hr | Short |
| 3 | 12 hr | Strengthen |
| 4 | 1 day | Bridge |
| 5 | 2 days | Long-term |
| 6 | 7 days | Deep |
| 7 | 15 days | Durable |
| 8 | 30 days | Expert |
| 9 | 60 days | Master |

## Tech Stack

- **Runtime**: Bun
- **Backend**: TypeScript, Hono, bun:sqlite
- **Frontend**: React, React Router v6, Tailwind CSS, Framer Motion
- **Protocol**: MCP (AI tools), HTTP REST
- **Tests**: Bun test (138 passing)

## License

MIT
