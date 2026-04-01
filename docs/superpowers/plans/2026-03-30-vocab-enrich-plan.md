# Vocab Enrich Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix review page bug where words with empty `meaning` show nothing, and add MiniMax API integration to enrich each word with prototype/variant/etymology during review.

**Architecture:** New `src/llm.ts` module wraps MiniMax API calls. API server adds `/api/words/:word/enrich` endpoint. Frontend calls enrich on each word reveal and displays expandable sections.

**Tech Stack:** Bun, TypeScript, Hono, React, MiniMax REST API

---

## File Map

| File | Responsibility |
|------|----------------|
| `src/llm.ts` | **Create** — MiniMax API wrapper, `enrichWord()` function |
| `src/types.ts` | **Modify** — Add `EnrichResult` type |
| `api/server.ts` | **Modify** — Add `GET /api/words/:word/enrich` route |
| `web/src/api.ts` | **Modify** — Add `getWordEnrich()` client function |
| `web/src/pages/Review.tsx` | **Modify** — Fix meaning-empty bug, call enrich, render new sections |
| `.env` | **Modify** — Add `MINIMAX_API_KEY`, `MINIMAX_BASE_URL`, `MINIMAX_MODEL` |

---

## Task 1: Fix Meaning-Empty Bug in Review.tsx

**Files:** `web/src/pages/Review.tsx`

- [ ] **Step 1: Open Review.tsx and locate the meaning display block**

Find lines 97-103 where meaning is rendered inside `showAnswer`:

```tsx
<p><strong>含义:</strong> {currentWord.meaning}</p>
```

- [ ] **Step 2: Replace with conditional rendering**

Replace the meaning line with:

```tsx
{currentWord.meaning ? (
  <p><strong>含义:</strong> {currentWord.meaning}</p>
) : (
  <p><strong>含义:</strong> <em style={{color: '#888'}}>暂无解释，请参考下方扩展信息</em></p>
)}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Review.tsx
git commit -m "fix: show friendly message when word meaning is empty"
```

---

## Task 2: Create src/llm.ts — MiniMax API Wrapper

**Files:** `src/llm.ts` (create), `src/types.ts` (modify)

- [ ] **Step 1: Add EnrichResult type to src/types.ts**

Add at the end of `src/types.ts`:

```typescript
export interface EnrichResult {
  prototype: string;
  variant: string;
  etymology: string;
}
```

- [ ] **Step 2: Create src/llm.ts**

```typescript
import { EnrichResult } from "./types.js";

function getMinimaxConfig() {
  const apiKey = process.env.MINIMAX_API_KEY;
  const baseUrl = process.env.MINIMAX_BASE_URL || "https://api.minimax.chat";
  const model = process.env.MINIMAX_MODEL || "abab6.5s-chat";

  if (!apiKey) {
    throw new Error("MINIMAX_API_KEY environment variable is not set");
  }

  return { apiKey, baseUrl, model };
}

export async function enrichWord(word: string): Promise<EnrichResult> {
  const { apiKey, baseUrl, model } = getMinimaxConfig();

  const prompt = `你是一个英语词汇分析助手。请分析单词 "${word}"，返回以下三个方面的信息（用中文回答）：

1. **原型 (prototype)**: 这个单词的原始形态（如动词原形、名词单数等），以及基本含义
2. **变体 (variant)**: 这个单词的常见变形（如时态、复数、比较级、进行时等）
3. **词源词根 (etymology)**: 这个单词的拉丁/希腊词根、词缀来源，以及同源词汇

请直接返回 JSON 格式，不要添加任何前缀或解释：
{
  "prototype": "...",
  "variant": "...",
  "etymology": "..."
}`;

  const response = await fetch(`${baseUrl}/v1/text/chatcompletion_pro?Model=${model}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "你是一个专业的英语词汇分析助手。" },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      stream: false
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiniMax API error: ${response.status} ${errorText}`);
  }

  const data = await response.json() as any;
  const content = data.choices?.[0]?.messages?.[0]?.text;

  if (!content) {
    throw new Error("MiniMax API returned no content");
  }

  // Parse JSON from response
  // The model might wrap the JSON in markdown code blocks
  let jsonStr = content.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const result = JSON.parse(jsonStr) as EnrichResult;
    return {
      prototype: result.prototype || "",
      variant: result.variant || "",
      etymology: result.etymology || ""
    };
  } catch {
    throw new Error(`Failed to parse MiniMax response as JSON: ${jsonStr.slice(0, 200)}`);
  }
}
```

- [ ] **Step 3: Rebuild dist/**

```bash
bun run build
```

- [ ] **Step 4: Commit**

```bash
git add src/llm.ts src/types.ts dist/llm.js dist/llm.d.ts
git commit -m "feat: add MiniMax API wrapper in src/llm.ts"
```

---

## Task 3: Add GET /api/words/:word/enrich Route

**Files:** `api/server.ts` (modify)

- [ ] **Step 1: Open api/server.ts and add import**

Add after the existing imports (line 5):

```typescript
import { enrichWord } from "../dist/llm.js";
```

- [ ] **Step 2: Add the enrich route**

Add after the existing `app.get("/api/words/:word", ...)` route (around line 146), before the console.log:

```typescript
app.get("/api/words/:word/enrich", async (c) => {
  const word = c.req.param("word");

  try {
    const enrich = await enrichWord(word);
    return c.json({
      word,
      ...enrich
    });
  } catch (err) {
    console.error(`Failed to enrich word "${word}":`, err);
    return c.json({
      error: "Failed to enrich word",
      details: err instanceof Error ? err.message : String(err)
    }, 500);
  }
});
```

- [ ] **Step 3: Test the route manually**

Start the API server and test with curl:

```bash
# In one terminal
MINIMAX_API_KEY=your_key bun run api

# In another terminal (wait for server to start)
curl http://localhost:3099/api/words/flee/enrich
```

Expected (if MiniMax works): JSON with prototype, variant, etymology fields.
Expected (if no API key): 500 with "MINIMAX_API_KEY environment variable is not set"

- [ ] **Step 4: Commit**

```bash
git add api/server.ts
git commit -m "feat: add GET /api/words/:word/enrich endpoint"
```

---

## Task 4: Add getWordEnrich to Frontend API Client

**Files:** `web/src/api.ts` (modify)

- [ ] **Step 1: Add getWordEnrich to web/src/api.ts**

Add at the end of the file (after line 66):

```typescript
export type EnrichData = {
  word: string;
  prototype: string;
  variant: string;
  etymology: string;
}

export const getWordEnrich = (word: string): Promise<EnrichData> =>
  fetch(`${API}/words/${encodeURIComponent(word)}/enrich`).then(r => r.json());
```

- [ ] **Step 2: Commit**

```bash
git add web/src/api.ts
git commit -m "feat: add getWordEnrich API client function"
```

---

## Task 5: Update Review.tsx to Display Enriched Information

**Files:** `web/src/pages/Review.tsx` (modify)

- [ ] **Step 1: Add EnrichData import**

Add after the existing imports (line 2):

```typescript
import { getReview, postFeedback, getWordEnrich, type EnrichData } from '../api';
```

- [ ] **Step 2: Add state for enriched data**

Find the `useState` declarations (line 34-40) and add:

```typescript
const [enrichedData, setEnrichedData] = useState<Record<string, EnrichData>>({});
const [enrichLoading, setEnrichLoading] = useState(false);
```

- [ ] **Step 3: Create enrichWord function**

Add before the `handleFeedback` function (around line 48):

```typescript
const enrichCurrentWord = (word: string) => {
  setEnrichLoading(true);
  getWordEnrich(word)
    .then(data => {
      if (!data.error) {
        setEnrichedData(prev => ({ ...prev, [word]: data }));
      }
    })
    .catch(() => {
      // Silently fail - enrich is best-effort
    })
    .finally(() => {
      setEnrichLoading(false);
    });
};
```

- [ ] **Step 4: Call enrichCurrentWord when answer is shown**

Find the button click handler (lines 106-116) and modify it:

Replace:
```tsx
<button
  onClick={() => setShowAnswer(true)}
```

With:
```tsx
<button
  onClick={() => {
    setShowAnswer(true);
    if (!enrichedData[currentWord.word]) {
      enrichCurrentWord(currentWord.word);
    }
  }}
```

- [ ] **Step 5: Add expandable sections for enriched data after the meaning block**

Find the closing `</div>` of the answer section (line 104, after `example_cn` rendering) and add:

```tsx
            {currentWord.example_cn && <p>{currentWord.example_cn}</p>}
            {enrichLoading && <p><em style={{color: '#888'}}>正在获取扩展信息...</em></p>}
            {!enrichLoading && enrichedData[currentWord.word] && (
              <div style={{ marginTop: '16px', borderTop: '1px solid #eee', paddingTop: '12px' }}>
                {enrichedData[currentWord.word].prototype && (
                  <details style={{ marginBottom: '8px' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>原型</summary>
                    <p style={{ margin: '4px 0 0 16px', color: '#444' }}>{enrichedData[currentWord.word].prototype}</p>
                  </details>
                )}
                {enrichedData[currentWord.word].variant && (
                  <details style={{ marginBottom: '8px' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>变体</summary>
                    <p style={{ margin: '4px 0 0 16px', color: '#444' }}>{enrichedData[currentWord.word].variant}</p>
                  </details>
                )}
                {enrichedData[currentWord.word].etymology && (
                  <details style={{ marginBottom: '8px' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>词源词根</summary>
                    <p style={{ margin: '4px 0 0 16px', color: '#444' }}>{enrichedData[currentWord.word].etymology}</p>
                  </details>
                )}
              </div>
            )}
```

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/Review.tsx
git commit -m "feat: enrich review words with MiniMax prototype/variant/etymology"
```

---

## Task 6: Add .env Configuration

**Files:** `.env` (create or modify)

- [ ] **Step 1: Create .env from example or add to existing .env**

Create a new `.env` file (if not exists) or append to it:

```
MINIMAX_API_KEY=your_api_key_here
MINIMAX_BASE_URL=https://api.minimax.chat
MINIMAX_MODEL=abab6.5s-chat
```

- [ ] **Step 2: Add .env to .gitignore if not already**

Check if `.env` is in `.gitignore`. If not, add it:

```bash
grep -q "^.env$" .gitignore || echo ".env" >> .gitignore
```

- [ ] **Step 3: Commit**

```bash
git add .env .gitignore
git commit -m "chore: add MiniMax .env config and update gitignore"
```

---

## Verification Steps

After all tasks complete, run the full test suite:

```bash
bun run build
bun run test
```

Manual verification:

```bash
# 1. Start API server with MiniMax key
MINIMAX_API_KEY=your_key bun run api

# 2. Start web dev server
bun run dev:web

# 3. Open browser to http://localhost:5173
# 4. Navigate to Review page
# 5. Verify:
#    - Words with empty meaning show "暂无解释，请参考下方扩展信息"
#    - After clicking "显示答案", enriched sections appear (原型/变体/词源词根)
#    - Expandable <details> elements work correctly
```

---

## Spec Coverage Check

| Spec Requirement | Task |
|-----------------|------|
| Bug fix: meaning empty → friendly message | Task 1 |
| New fields: prototype, variant, etymology | Task 2 (types + lmm.ts) |
| GET /api/words/:word/enrich endpoint | Task 3 |
| getWordEnrich() frontend client | Task 4 |
| Review.tsx shows enrich sections | Task 5 |
| MiniMax .env config | Task 6 |
