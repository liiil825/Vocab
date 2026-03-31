# Enrichment Data Table Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display prototype, variant, and etymology data from LLM enrichment as multi-line tables instead of raw text blocks.

**Architecture:** Change LLM enrichment to return structured JSON arrays for each enrichment field, update storage schema to JSON columns, and render tables on the frontend.

**Tech Stack:** TypeScript, SQLite (JSON columns), React, Tailwind CSS

---

## Overview

Currently the LLM returns plain strings for `prototype`, `variant`, and `etymology`:
```json
{"prototype":"PIE *bʰer-","variant":"bear (n.) from OE bera","etymology":"..."}
```

But these fields often contain **multiple items** (e.g., multiple variants separated by newlines). Displaying them as raw text is hard to read. The goal is to display them as tables:

| Type | Form | Note |
|------|------|------|
| 原型 | PIE *bʰer- | ... |
| 变体 | bear (n.) | from OE bera |

---

## File Map

```
packages/vocab-core/src/types.ts          - Modify EnrichResult type
packages/vocab-core/schema.sql            - Change TEXT → JSON columns
packages/vocab-core/src/storage.ts        - Update rowToWord, updateWordEnrich
packages/vocab-api/src/llm.ts             - Change LLM prompt and parsing
packages/vocab-api/src/server.ts          - Minimal changes if any
web/src/api.ts                           - Update EnrichData type
web/src/pages/Review.tsx                  - Render tables for enrichment data
```

---

## Task 1: Update Types and Schema

**Files:**
- Modify: `packages/vocab-core/src/types.ts:98-102`
- Modify: `packages/vocab-core/schema.sql`
- Modify: `packages/vocab-core/src/storage.ts:279-284`

### Steps

- [ ] **Step 1: Update EnrichResult type**

Modify `packages/vocab-core/src/types.ts` to change the three string fields into arrays:

```typescript
export interface EnrichResult {
  prototype: EnrichItem[];
  variant: EnrichItem[];
  etymology: EnrichItem[];
}

export interface EnrichItem {
  form: string;
  note?: string;
}
```

- [ ] **Step 2: Update schema.sql**

Change the three TEXT columns to JSON columns:

```sql
prototype TEXT DEFAULT '[]',
variant TEXT DEFAULT '[]',
etymology TEXT DEFAULT '[]'
```

- [ ] **Step 3: Update storage.ts updateWordEnrich()**

The `updateWordEnrich()` function at line 279 already passes `prototype`, `variant`, `etymology` as strings. Update `rowToWord()` at line 36 and the storage functions to JSON-parse these columns:

```typescript
prototype: JSON.parse(row.prototype || '[]'),
variant: JSON.parse(row.variant || '[]'),
etymology: JSON.parse(row.etymology || '[]'),
```

---

## Task 2: Update LLM Enrichment

**Files:**
- Modify: `packages/vocab-api/src/llm.ts:15-82`

- [ ] **Step 1: Update LLM prompt**

Change the prompt to request structured JSON arrays instead of plain strings:

```typescript
const prompt = `分析单词 "${word}"，返回简短的JSON，中文说明：
{
  "prototype": [
    {"form": "原始形式", "note": "说明（可选）"}
  ],
  "variant": [
    {"form": "变体形式1", "note": "来源或说明"},
    {"form": "变体形式2", "note": "来源或说明"}
  ],
  "etymology": [
    {"form": "词源1", "note": "说明"},
    {"form": "词源2", "note": "说明"}
  ]
}`;
```

- [ ] **Step 2: Update JSON parsing**

Update the parsing code to handle the new array structure with `form` and `note` fields. Keep the empty-array fallback:

```typescript
return {
  prototype: Array.isArray(result.prototype) ? result.prototype : [],
  variant: Array.isArray(result.variant) ? result.variant : [],
  etymology: Array.isArray(result.etymology) ? result.etymology : []
};
```

- [ ] **Step 3: Run existing integration tests**

Run: `bun run tests/run-all.mjs integration`
Expected: Some tests may fail due to type changes - this is expected and will be addressed in Task 3.

---

## Task 3: Fix Integration Tests

**Files:**
- Modify: `tests/integration/mcp.test.mjs`
- Modify: `tests/integration/batch-review.test.mjs`

- [ ] **Step 1: Check test failures**

Run: `bun run tests/run-all.mjs integration 2>&1 | head -100`
Expected: Failures in tests that check enrichment data structure

- [ ] **Step 2: Update MCP test enrichment assertions**

In `tests/integration/mcp.test.mjs`, update any assertions that check `prototype`, `variant`, or `etymology` to use the new array structure.

- [ ] **Step 3: Update batch-review test enrichment assertions**

In `tests/integration/batch-review.test.mjs`, similarly update assertions.

- [ ] **Step 4: Re-run integration tests**

Run: `bun run tests/run-all.mjs integration`
Expected: All pass

---

## Task 4: Update Frontend Types

**Files:**
- Modify: `web/src/api.ts`

- [ ] **Step 1: Update EnrichData type**

```typescript
export type EnrichItem = {
  form: string;
  note?: string;
};

export type EnrichData = {
  word: string;
  prototype: EnrichItem[];
  variant: EnrichItem[];
  etymology: EnrichItem[];
};
```

---

## Task 5: Update Frontend Display (Review.tsx)

**Files:**
- Modify: `web/src/pages/Review.tsx:273-302`

- [ ] **Step 1: Create EnrichmentTable component helper**

Inside `Review.tsx` (or extract to a component), create a helper to render an enrichment section as a table:

```typescript
function EnrichmentTable({ label, items }: { label: string; items: EnrichItem[] }) {
  if (!items || items.length === 0) return null;
  return (
    <details className='group'>
      <summary className='text-xs text-text-secondary uppercase tracking-wider cursor-pointer list-none flex items-center gap-1'>
        <span className='text-accent'>▶</span> {label}
      </summary>
      <table className='pl-4 text-text-secondary text-sm mt-1 w-full'>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className={i > 0 ? 'border-t border-border' : ''}>
              <td className='pr-4 py-1 align-top'>{item.form}</td>
              {item.note && <td className='text-text-muted py-1'>{item.note}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
```

- [ ] **Step 2: Update enrichment rendering in Review.tsx**

Replace the three raw text `<details>` blocks (lines 277-300) with:

```typescript
<EnrichmentTable label='原型' items={enrich.prototype} />
<EnrichmentTable label='变体' items={enrich.variant} />
<EnrichmentTable label='词源' items={enrich.etymology} />
```

- [ ] **Step 3: Verify display**

Run: `bun run dev:web` and check the review page.

---

## Task 6: Verify Tests

- [ ] **Step 1: Run all tests**

Run: `bun run test`
Expected: All 102 tests pass

---

## Dependencies

- MiniMax API (for new enrichment format)
- Existing DB migration path (columns exist as TEXT, need migration to JSON)

## Risks

- **HIGH**: Existing cached enrichment data in DB is plain text, not JSON arrays. Need migration script.
- **MEDIUM**: LLM prompt change may produce slightly different output quality. Monitor enrichment results.
- **LOW**: Frontend table rendering is straightforward.

## Migration for Existing Data

Existing words in the database have plain-text enrichment fields. A migration script is needed to:
1. Parse existing plain-text into structured JSON
2. Or re-enrich via the `/enrich` endpoint

See `scripts/migrate-v1-to-v2.ts` for reference. A new migration `migrate-enrichment-format.ts` may be needed, or we can add it to the existing migration.
