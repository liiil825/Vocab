# Vocab-Trainer Web + SQLite 重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor vocab-trainer storage from JSON to SQLite and add React web frontend for direct vocab review without OpenClaw agent.

**Architecture:** Replace JSON file I/O with SQLite using bun:sqlite. Add Hono HTTP API server on port 3099. Create Vite + React frontend with 4 pages. MCP server continues unchanged and transparently uses the same storage layer.

**Tech Stack:** Bun, TypeScript, bun:sqlite, Hono, Vite, React, React Router v6

---

## File Structure

```
vocab-trainer/
├── src/                      # Existing Bun backend (MCP)
│   ├── storage.ts           # MODIFY: Replace JSON with SQLite
│   ├── types.ts             # UNCHANGED
│   ├── algorithm.ts          # UNCHANGED (uses storage.ts)
│   ├── tools.ts              # UNCHANGED (MCP tools)
│   └── index.ts              # UNCHANGED (MCP entry)
├── api/                      # NEW: HTTP API
│   └── server.ts             # CREATE: Hono API server
├── web/                      # NEW: Vite + React frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Review.tsx   # CREATE
│   │   │   ├── Learn.tsx    # CREATE
│   │   │   ├── Status.tsx   # CREATE
│   │   │   └── List.tsx     # CREATE
│   │   ├── api.ts           # CREATE: API client
│   │   ├── App.tsx          # CREATE
│   │   └── main.tsx         # CREATE
│   ├── index.html            # CREATE
│   └── vite.config.ts       # CREATE
└── db/
    └── schema.sql            # CREATE: SQLite schema reference
```

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`

### Steps

- [ ] **Step 1: Add bun-types for TypeScript**

Run: `bun add -d bun-types`
Expected: bun-types added to devDependencies

- [ ] **Step 2: Add hono for HTTP API**

Run: `bun add hono`
Expected: hono added to dependencies

- [ ] **Step 3: Update tsconfig.json for bun:sqlite types**

Read `tsconfig.json`, then add to compilerOptions:

```json
{
  "compilerOptions": {
    "types": ["bun-types"]
  }
}
```

---

## Task 2: Rewrite storage.ts to use SQLite

**Files:**
- Modify: `src/storage.ts`

### Steps

- [ ] **Step 1: Write the complete SQLite-based storage.ts**

```typescript
import { Database } from "bun:sqlite";
import { VocabData, Word, ReviewRecord } from "./types.js";

function getDataPath(): string {
  return process.env.VOCAB_DATA_PATH ||
    `${process.env.HOME}/.vocab-trainer/words.db`;
}

let db: Database | null = null;

function getDb(): Database {
  if (db) return db;

  const dbPath = getDataPath();
  const dir = dbPath.substring(0, dbPath.lastIndexOf('/'));

  // Ensure directory exists
  if (dir) {
    try {
      require('fs').mkdirSync(dir, { recursive: true });
    } catch {
      // Directory may already exist
    }
  }

  db = new Database(dbPath);

  // Initialize schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL UNIQUE,
      word_lower TEXT NOT NULL,
      meaning TEXT DEFAULT '',
      phonetic TEXT DEFAULT '',
      pos TEXT DEFAULT '',
      example TEXT DEFAULT '',
      example_cn TEXT DEFAULT '',
      source TEXT DEFAULT 'user',
      added TEXT NOT NULL,
      level INTEGER DEFAULT 0,
      next_review TEXT NOT NULL,
      interval_days INTEGER DEFAULT 1,
      error_count INTEGER DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      history TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY DEFAULT 1,
      version INTEGER DEFAULT 1,
      streak INTEGER DEFAULT 0,
      last_review_date TEXT,
      total_reviews INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_words_word_lower ON words(word_lower);
    CREATE INDEX IF NOT EXISTS idx_words_next_review ON words(next_review);
    CREATE INDEX IF NOT EXISTS idx_words_level ON words(level);
  `);

  // Ensure stats row exists
  const stats = db.query("SELECT * FROM stats WHERE id = 1").get();
  if (!stats) {
    db.query("INSERT INTO stats (id, version, streak, total_reviews) VALUES (1, 1, 0, 0)").run();
  }

  return db;
}

function rowToWord(row: any): Word {
  return {
    word: row.word,
    meaning: row.meaning || "",
    phonetic: row.phonetic || "",
    pos: row.pos || "",
    example: row.example || "",
    example_cn: row.example_cn || "",
    source: row.source || "user",
    added: row.added,
    level: row.level,
    next_review: row.next_review,
    interval_days: row.interval_days,
    error_count: row.error_count,
    review_count: row.review_count,
    history: JSON.parse(row.history || "[]") as ReviewRecord[]
  };
}

export function loadData(): VocabData {
  const database = getDb();

  const statsRow = database.query("SELECT * FROM stats WHERE id = 1").get() as any;
  const wordsRows = database.query("SELECT * FROM words").all() as any[];

  return {
    version: statsRow?.version || 1,
    streak: statsRow?.streak || 0,
    last_review_date: statsRow?.last_review_date || null,
    total_reviews: statsRow?.total_reviews || 0,
    words: wordsRows.map(rowToWord)
  };
}

export function saveData(data: VocabData): void {
  const database = getDb();

  database.query(`
    INSERT OR REPLACE INTO stats (id, version, streak, last_review_date, total_reviews)
    VALUES (1, ?, ?, ?, ?)
  `).run(data.version, data.streak, data.last_review_date, data.total_reviews);
}

export function addWord(word: Word): void {
  const database = getDb();

  database.query(`
    INSERT INTO words (word, word_lower, meaning, phonetic, pos, example, example_cn, source, added, level, next_review, interval_days, error_count, review_count, history)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    word.word,
    word.word.toLowerCase(),
    word.meaning,
    word.phonetic,
    word.pos,
    word.example,
    word.example_cn,
    word.source,
    word.added,
    word.level,
    word.next_review,
    word.interval_days,
    word.error_count,
    word.review_count,
    JSON.stringify(word.history)
  );
}

export function getWord(word: string): Word | undefined {
  const database = getDb();
  const row = database.query(
    "SELECT * FROM words WHERE word_lower = ?"
  ).get(word.toLowerCase()) as any;

  return row ? rowToWord(row) : undefined;
}

export function updateWord(word: string, updates: Partial<Word>): Word | undefined {
  const database = getDb();
  const existing = getWord(word);
  if (!existing) return undefined;

  const updated = { ...existing, ...updates };
  const wordLower = word.toLowerCase();

  database.query(`
    UPDATE words SET
      word = ?, word_lower = ?, meaning = ?, phonetic = ?, pos = ?,
      example = ?, example_cn = ?, source = ?, added = ?, level = ?,
      next_review = ?, interval_days = ?, error_count = ?, review_count = ?, history = ?
    WHERE word_lower = ?
  `).run(
    updated.word,
    updated.word.toLowerCase(),
    updated.meaning,
    updated.phonetic,
    updated.pos,
    updated.example,
    updated.example_cn,
    updated.source,
    updated.added,
    updated.level,
    updated.next_review,
    updated.interval_days,
    updated.error_count,
    updated.review_count,
    JSON.stringify(updated.history),
    wordLower
  );

  return updated;
}

export function removeWord(word: string): boolean {
  const database = getDb();
  const result = database.query(
    "DELETE FROM words WHERE word_lower = ?"
  ).run(word.toLowerCase());

  return result.changes > 0;
}

export function getWordsByFilter(filter?: string): Word[] {
  const database = getDb();
  const today = new Date().toISOString().split("T")[0];

  let rows: any[];
  switch (filter) {
    case "new":
      rows = database.query("SELECT * FROM words WHERE level = 0").all();
      break;
    case "learning":
      rows = database.query("SELECT * FROM words WHERE level >= 1 AND level <= 3").all();
      break;
    case "hard":
      rows = database.query("SELECT * FROM words WHERE level <= 1 AND error_count >= 1").all();
      break;
    case "mastered":
      rows = database.query("SELECT * FROM words WHERE level = 5").all();
      break;
    case "today":
      rows = database.query("SELECT * FROM words WHERE next_review <= ?").all(today);
      break;
    default:
      rows = database.query("SELECT * FROM words").all();
  }

  return rows.map(rowToWord);
}

export function getDueWords(): Word[] {
  const database = getDb();
  const today = new Date().toISOString().split("T")[0];
  const rows = database.query(
    "SELECT * FROM words WHERE next_review <= ?"
  ).all(today);

  return rows.map(rowToWord);
}

export function updateStats(streak: number, lastReviewDate: string): void {
  const database = getDb();
  database.query(`
    UPDATE stats SET streak = ?, last_review_date = ?, total_reviews = total_reviews + 1
    WHERE id = 1
  `).run(streak, lastReviewDate);
}
```

- [ ] **Step 2: Verify build compiles**

Run: `bun run build`
Expected: Compiles without TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/storage.ts package.json tsconfig.json bun.lock
git commit -m "feat: rewrite storage.ts to use SQLite (bun:sqlite)"
```

---

## Task 3: Create db/schema.sql

**Files:**
- Create: `db/schema.sql`

### Steps

- [ ] **Step 1: Create schema.sql file**

```sql
-- Vocab-Trainer SQLite Schema

CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL UNIQUE,
  word_lower TEXT NOT NULL,
  meaning TEXT DEFAULT '',
  phonetic TEXT DEFAULT '',
  pos TEXT DEFAULT '',
  example TEXT DEFAULT '',
  example_cn TEXT DEFAULT '',
  source TEXT DEFAULT 'user',
  added TEXT NOT NULL,
  level INTEGER DEFAULT 0,
  next_review TEXT NOT NULL,
  interval_days INTEGER DEFAULT 1,
  error_count INTEGER DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  history TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS stats (
  id INTEGER PRIMARY KEY DEFAULT 1,
  version INTEGER DEFAULT 1,
  streak INTEGER DEFAULT 0,
  last_review_date TEXT,
  total_reviews INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_words_word_lower ON words(word_lower);
CREATE INDEX IF NOT EXISTS idx_words_next_review ON words(next_review);
CREATE INDEX IF NOT EXISTS idx_words_level ON words(level);
```

- [ ] **Step 2: Commit**

```bash
git add db/schema.sql
git commit -m "feat: add SQLite schema for vocab-trainer"
```

---

## Task 4: Create HTTP API Server

**Files:**
- Create: `api/server.ts`

### Steps

- [ ] **Step 1: Create api directory**

Run: `mkdir -p api`

- [ ] **Step 2: Create api/server.ts**

```typescript
import { Hono } from "hono";
import { loadData, addWord, getWord, removeWord, getWordsByFilter, getDueWords } from "../dist/storage.js";
import { processReviewFeedbacks, getToday, addDays } from "../dist/algorithm.js";
import { Word } from "../dist/types.js";

const app = new Hono();

function groupByLevel(words: Word[]): Record<number, number> {
  const stats: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  words.forEach(w => {
    stats[w.level] = (stats[w.level] || 0) + 1;
  });
  return stats;
}

app.get("/api/status", (c) => {
  const data = loadData();
  const today = getToday();
  const tomorrow = addDays(today, 1);
  const todayDue = data.words.filter(w => w.next_review <= today).length;
  const tomorrowDue = data.words.filter(w => w.next_review === tomorrow).length;

  return c.json({
    total_words: data.words.length,
    level_stats: groupByLevel(data.words),
    streak: data.streak,
    today_due: todayDue,
    tomorrow_due: tomorrowDue,
    total_reviews: data.total_reviews
  });
});

app.get("/api/review", (c) => {
  const data = loadData();
  const due = getDueWords();
  due.sort(() => Math.random() - 0.5);

  return c.json({
    words: due,
    count: due.length,
    streak: data.streak,
    last_review_date: data.last_review_date
  });
});

app.post("/api/review/feedback", async (c) => {
  const { feedbacks } = await c.req.json();
  const result = processReviewFeedbacks(feedbacks);

  return c.json({
    success: true,
    results: result.results,
    summary: result.summary,
    updated_streak: result.updatedStreak,
    message: `复习完成！通过 ${result.summary.passed}，失败 ${result.summary.failed}，模糊 ${result.summary.fuzzy}`
  });
});

app.get("/api/words", (c) => {
  const filter = c.req.query("filter");
  const words = getWordsByFilter(filter || undefined);

  return c.json({
    words: words.map(w => ({
      word: w.word,
      meaning: w.meaning,
      level: w.level,
      next_review: w.next_review,
      error_count: w.error_count
    })),
    total: words.length
  });
});

app.post("/api/words", async (c) => {
  const body = await c.req.json();
  const existing = getWord(body.word);

  if (existing) {
    return c.json({
      success: false,
      word: body.word,
      level: existing.level,
      next_review: existing.next_review,
      message: `单词 "${body.word}" 已存在，当前 level: ${existing.level}`
    }, 400);
  }

  const today = getToday();
  const tomorrow = addDays(today, 1);

  const newWord: Word = {
    word: body.word,
    meaning: body.meaning || "",
    phonetic: body.phonetic || "",
    pos: body.pos || "",
    example: body.example || "",
    example_cn: body.example_cn || "",
    source: body.source || "user",
    added: today,
    level: 0,
    next_review: tomorrow,
    interval_days: 1,
    error_count: 0,
    review_count: 0,
    history: []
  };

  addWord(newWord);

  return c.json({
    success: true,
    word: body.word,
    level: 0,
    next_review: tomorrow,
    message: `已添加 "${body.word}"，首次复习：${tomorrow}`
  });
});

app.delete("/api/words/:word", (c) => {
  const word = c.req.param("word");
  const success = removeWord(word);

  return c.json({
    success,
    message: success ? `已移除 "${word}"` : `未找到 "${word}"`
  });
});

app.get("/api/words/:word", (c) => {
  const word = c.req.param("word");
  const result = getWord(word);

  if (!result) {
    return c.json({ error: `未找到单词 "${word}"` }, 404);
  }

  return c.json(result);
});

console.log("Starting Vocab-Trainer API server on http://localhost:3099");
export default {
  port: 3099,
  fetch: app.fetch
};
```

- [ ] **Step 3: Test API server starts**

Run: `bun run api/server.ts & sleep 2 && curl http://localhost:3099/api/status`
Expected: JSON response with status data

- [ ] **Step 4: Commit**

```bash
git add api/server.ts
git commit -m "feat: add Hono HTTP API server on port 3099"
```

---

## Task 5: Initialize Vite + React Project

**Files:**
- Create: `web/` directory structure with Vite + React + TypeScript

### Steps

- [ ] **Step 1: Create web directory and initialize Vite**

Run: `mkdir -p web && cd web && bun create vite . --template react-ts`
Expected: Vite project scaffolded

- [ ] **Step 2: Install dependencies**

Run: `cd web && bun install`
Expected: Dependencies installed

- [ ] **Step 3: Install react-router-dom**

Run: `cd web && bun add react-router-dom`
Expected: react-router-dom added

- [ ] **Step 4: Commit web scaffold**

```bash
git add web/
git commit -m "feat: scaffold Vite + React frontend"
```

---

## Task 6: Create Web API Client

**Files:**
- Create: `web/src/api.ts`

### Steps

- [ ] **Step 1: Create web/src/api.ts**

```typescript
const API = "http://localhost:3099/api";

export interface WordSummary {
  word: string;
  meaning: string;
  level: number;
  next_review: string;
  error_count: number;
}

export interface WordDetail extends WordSummary {
  phonetic: string;
  pos: string;
  example: string;
  example_cn: string;
  source: string;
  added: string;
  interval_days: number;
  review_count: number;
  history: { date: string; result: string }[];
}

export interface Status {
  total_words: number;
  level_stats: Record<number, number>;
  streak: number;
  today_due: number;
  tomorrow_due: number;
  total_reviews: number;
}

export interface ReviewResponse {
  words: WordDetail[];
  count: number;
  streak: number;
  last_review_date: string | null;
}

export interface FeedbackItem {
  word: string;
  feedback: "pass" | "fail" | "fuzzy";
}

export interface FeedbackResult {
  success: boolean;
  results: { word: string; old_level: number; new_level: number; next_review: string; interval_days: number }[];
  summary: { passed: number; failed: number; fuzzy: number };
  updated_streak: number;
  message: string;
}

export const getStatus = () => fetch(`${API}/status`).then(r => r.json());
export const getReview = () => fetch(`${API}/review`).then(r => r.json());
export const getWords = (filter?: string) => fetch(`${API}/words${filter ? `?filter=${filter}` : ''}`).then(r => r.json());
export const getWordDetail = (word: string) => fetch(`${API}/words/${encodeURIComponent(word)}`).then(r => r.json());
export const postFeedback = (feedbacks: FeedbackItem[]) => fetch(`${API}/review/feedback`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ feedbacks })
}).then(r => r.json());
export const postWord = (word: Omit<WordDetail, 'level' | 'next_review' | 'interval_days' | 'error_count' | 'review_count' | 'history' | 'added'>) => fetch(`${API}/words`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(word)
}).then(r => r.json());
export const deleteWord = (word: string) => fetch(`${API}/words/${encodeURIComponent(word)}`, { method: "DELETE" }).then(r => r.json());
```

- [ ] **Step 2: Commit**

```bash
git add web/src/api.ts
git commit -m "feat: add API client for web frontend"
```

---

## Task 7: Create App Router

**Files:**
- Create: `web/src/App.tsx`
- Create: `web/src/main.tsx`
- Modify: `web/index.html`

### Steps

- [ ] **Step 1: Create web/src/App.tsx**

```tsx
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Review from './pages/Review';
import Learn from './pages/Learn';
import Status from './pages/Status';
import List from './pages/List';

function App() {
  return (
    <BrowserRouter>
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <nav style={{ display: 'flex', gap: '20px', marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
          <Link to="/">复习</Link>
          <Link to="/learn">学习</Link>
          <Link to="/status">状态</Link>
          <Link to="/list">单词列表</Link>
        </nav>
        <Routes>
          <Route path="/" element={<Review />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/status" element={<Status />} />
          <Route path="/list" element={<List />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
```

- [ ] **Step 2: Create web/src/main.tsx**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 3: Update web/index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vocab Trainer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Commit**

```bash
git add web/src/App.tsx web/src/main.tsx web/index.html
git commit -m "feat: add React Router setup and main App component"
```

---

## Task 8: Create Review Page

**Files:**
- Create: `web/src/pages/Review.tsx`

### Steps

- [ ] **Step 1: Create web/src/pages directory**

Run: `mkdir -p web/src/pages`

- [ ] **Step 2: Create web/src/pages/Review.tsx**

```tsx
import { useState, useEffect } from 'react';
import { getReview, postFeedback, FeedbackItem, WordDetail, FeedbackResult } from '../api';

export default function Review() {
  const [words, setWords] = useState<WordDetail[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [result, setResult] = useState<FeedbackResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReview().then(data => {
      setWords(data.words);
      setLoading(false);
    });
  }, []);

  const handleFeedback = (feedback: 'pass' | 'fail' | 'fuzzy') => {
    if (currentIndex >= words.length) return;

    const word = words[currentIndex];
    const newFeedbacks = [...feedbacks, { word: word.word, feedback }];
    setFeedbacks(newFeedbacks);
    setShowAnswer(false);

    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      postFeedback(newFeedbacks).then(setResult);
    }
  };

  if (loading) return <div>加载中...</div>;
  if (result) {
    return (
      <div>
        <h2>复习完成！</h2>
        <p>通过: {result.summary.passed}</p>
        <p>失败: {result.summary.failed}</p>
        <p>模糊: {result.summary.fuzzy}</p>
        <p>连续天数: {result.updated_streak}</p>
      </div>
    );
  }
  if (words.length === 0) {
    return <div>今天没有需要复习的单词！</div>;
  }

  const currentWord = words[currentIndex];

  return (
    <div>
      <div style={{ marginBottom: '10px' }}>
        进度: {currentIndex + 1} / {words.length}
      </div>
      <div style={{
        border: '1px solid #ccc',
        borderRadius: '8px',
        padding: '40px',
        textAlign: 'center',
        marginBottom: '20px'
      }}>
        <h2 style={{ fontSize: '32px', marginBottom: '20px' }}>{currentWord.word}</h2>
        {showAnswer ? (
          <div style={{ textAlign: 'left' }}>
            <p><strong>含义:</strong> {currentWord.meaning}</p>
            {currentWord.phonetic && <p><strong>音标:</strong> {currentWord.phonetic}</p>}
            {currentWord.pos && <p><strong>词性:</strong> {currentWord.pos}</p>}
            {currentWord.example && (
              <p><strong>例句:</strong> {currentWord.example}</p>
            )}
            {currentWord.example_cn && <p>{currentWord.example_cn}</p>}
          </div>
        ) : (
          <button
            onClick={() => setShowAnswer(true)}
            style={{
              padding: '10px 30px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            显示答案
          </button>
        )}
      </div>
      {showAnswer && (
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            onClick={() => handleFeedback('fail')}
            style={{ padding: '10px 20px', backgroundColor: '#ff4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            不记得
          </button>
          <button
            onClick={() => handleFeedback('fuzzy')}
            style={{ padding: '10px 20px', backgroundColor: '#ffaa44', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            模糊
          </button>
          <button
            onClick={() => handleFeedback('pass')}
            style={{ padding: '10px 20px', backgroundColor: '#44aa44', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            记得
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Review.tsx
git commit -m "feat: add Review page with flashcard UI"
```

---

## Task 9: Create Learn Page

**Files:**
- Create: `web/src/pages/Learn.tsx`

### Steps

- [ ] **Step 1: Create web/src/pages/Learn.tsx**

```tsx
import { useState } from 'react';
import { postWord } from '../api';

export default function Learn() {
  const [word, setWord] = useState('');
  const [meaning, setMeaning] = useState('');
  const [phonetic, setPhonetic] = useState('');
  const [pos, setPos] = useState('');
  const [example, setExample] = useState('');
  const [exampleCn, setExampleCn] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim()) {
      setError('请输入单词');
      return;
    }

    const res = await postWord({
      word: word.trim(),
      meaning: meaning.trim(),
      phonetic: phonetic.trim(),
      pos: pos.trim(),
      example: example.trim(),
      example_cn: exampleCn.trim(),
      source: 'user'
    });

    setResult(res);
    if (res.success) {
      setWord('');
      setMeaning('');
      setPhonetic('');
      setPos('');
      setExample('');
      setExampleCn('');
    } else {
      setError(res.message);
    }
  };

  return (
    <div>
      <h2>添加新单词</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>
          <label>单词 *</label><br />
          <input
            type="text"
            value={word}
            onChange={e => setWord(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div>
          <label>含义</label><br />
          <input
            type="text"
            value={meaning}
            onChange={e => setMeaning(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div>
          <label>音标</label><br />
          <input
            type="text"
            value={phonetic}
            onChange={e => setPhonetic(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div>
          <label>词性</label><br />
          <input
            type="text"
            value={pos}
            onChange={e => setPos(e.target.value)}
            placeholder="如: n., v., adj."
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div>
          <label>例句</label><br />
          <textarea
            value={example}
            onChange={e => setExample(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div>
          <label>例句中文</label><br />
          <textarea
            value={exampleCn}
            onChange={e => setExampleCn(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {result?.success && <p style={{ color: 'green' }}>{result.message}</p>}
        <button type="submit" style={{ padding: '10px', cursor: 'pointer' }}>
          添加
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/Learn.tsx
git commit -m "feat: add Learn page for adding new words"
```

---

## Task 10: Create Status Page

**Files:**
- Create: `web/src/pages/Status.tsx`

### Steps

- [ ] **Step 1: Create web/src/pages/Status.tsx**

```tsx
import { useState, useEffect } from 'react';
import { getStatus, Status } from '../api';

export default function Status() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStatus().then(data => {
      setStatus(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div>加载中...</div>;
  if (!status) return <div>加载失败</div>;

  return (
    <div>
      <h2>学习状态</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px' }}>
          <h3>总单词数</h3>
          <p style={{ fontSize: '32px', margin: 0 }}>{status.total_words}</p>
        </div>
        <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px' }}>
          <h3>连续天数</h3>
          <p style={{ fontSize: '32px', margin: 0 }}>{status.streak}</p>
        </div>
        <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px' }}>
          <h3>今日待复习</h3>
          <p style={{ fontSize: '32px', margin: 0, color: '#ff6600' }}>{status.today_due}</p>
        </div>
        <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px' }}>
          <h3>明日待复习</h3>
          <p style={{ fontSize: '32px', margin: 0 }}>{status.tomorrow_due}</p>
        </div>
      </div>

      <h3 style={{ marginTop: '30px' }}>词汇量分布</h3>
      <div style={{ display: 'flex', gap: '10px' }}>
        {[0, 1, 2, 3, 4, 5].map(level => (
          <div key={level} style={{ textAlign: 'center', flex: 1 }}>
            <div style={{
              height: `${Math.max(20, (status.level_stats[level] || 0) / Math.max(1, status.total_words) * 200)}px`,
              backgroundColor: `hsl(${level * 30}, 70%, 50%)`,
              borderRadius: '4px',
              marginBottom: '5px'
            }} />
            <span>Level {level}: {status.level_stats[level] || 0}</span>
          </div>
        ))}
      </div>

      <p style={{ marginTop: '20px', color: '#666' }}>
        总复习次数: {status.total_reviews}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/Status.tsx
git commit -m "feat: add Status page with stats and level distribution"
```

---

## Task 11: Create List Page

**Files:**
- Create: `web/src/pages/List.tsx`

### Steps

- [ ] **Step 1: Create web/src/pages/List.tsx**

```tsx
import { useState, useEffect } from 'react';
import { getWords, deleteWord, WordSummary } from '../api';

const FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'new', label: '新词' },
  { value: 'learning', label: '学习中' },
  { value: 'hard', label: '困难' },
  { value: 'mastered', label: '已掌握' },
  { value: 'today', label: '今日' }
];

export default function List() {
  const [words, setWords] = useState<WordSummary[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getWords(filter === 'all' ? undefined : filter).then(data => {
      setWords(data.words);
      setLoading(false);
    });
  }, [filter]);

  const handleDelete = async (word: string) => {
    if (!confirm(`确定要删除 "${word}" 吗？`)) return;
    await deleteWord(word);
    setWords(words.filter(w => w.word !== word));
  };

  return (
    <div>
      <h2>单词列表</h2>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding: '8px 16px',
              backgroundColor: filter === f.value ? '#0066cc' : '#eee',
              color: filter === f.value ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div>加载中...</div>
      ) : (
        <>
          <p>共 {words.length} 个单词</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ccc' }}>
                <th style={{ textAlign: 'left', padding: '10px' }}>单词</th>
                <th style={{ textAlign: 'left', padding: '10px' }}>含义</th>
                <th style={{ textAlign: 'center', padding: '10px' }}>Level</th>
                <th style={{ textAlign: 'center', padding: '10px' }}>下次复习</th>
                <th style={{ textAlign: 'center', padding: '10px' }}>错误</th>
                <th style={{ textAlign: 'center', padding: '10px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {words.map(w => (
                <tr key={w.word} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>{w.word}</td>
                  <td style={{ padding: '10px', color: '#666' }}>{w.meaning}</td>
                  <td style={{ textAlign: 'center', padding: '10px' }}>
                    <span style={{
                      backgroundColor: `hsl(${w.level * 30}, 70%, 50%)`,
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '12px'
                    }}>
                      {w.level}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', padding: '10px' }}>{w.next_review}</td>
                  <td style={{ textAlign: 'center', padding: '10px' }}>{w.error_count}</td>
                  <td style={{ textAlign: 'center', padding: '10px' }}>
                    <button
                      onClick={() => handleDelete(w.word)}
                      style={{
                        backgroundColor: '#ff4444',
                        color: 'white',
                        border: 'none',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/List.tsx
git commit -m "feat: add List page with filtering and delete"
```

---

## Task 12: Update package.json Scripts

**Files:**
- Modify: `package.json`

### Steps

- [ ] **Step 1: Update package.json scripts**

Read `package.json`, then add new scripts:

```json
{
  "scripts": {
    "build": "tsc",
    "start": "bun run dist/index.js",
    "api": "bun run api/server.ts",
    "dev:web": "cd web && bun run dev --host",
    "dev": "bun run api & bun run dev:web",
    "test": "bun run tests/run-all.mjs",
    "test:unit": "bun run tests/run-all.mjs unit",
    "test:integration": "bun run tests/run-all.mjs integration"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "feat: add api, dev:web, and dev scripts to package.json"
```

---

## Task 13: Verify Everything Works

### Steps

- [ ] **Step 1: Build TypeScript**

Run: `bun run build`
Expected: Compiles without errors

- [ ] **Step 2: Start API server in background**

Run: `bun run api &`
Expected: Server starts on port 3099

- [ ] **Step 3: Test API status endpoint**

Run: `curl http://localhost:3099/api/status`
Expected: JSON response with status

- [ ] **Step 4: Start web dev server**

Run: `bun run dev:web`
Expected: Vite dev server starts on port 5173

- [ ] **Step 5: Run MCP tests**

Run: `bun run test`
Expected: All tests pass

---

## Self-Review Checklist

**1. Spec coverage:**
- SQLite storage: Task 2 ✓
- HTTP API server: Task 4 ✓
- Vite + React setup: Task 5 ✓
- API client: Task 6 ✓
- App router: Task 7 ✓
- Review page: Task 8 ✓
- Learn page: Task 9 ✓
- Status page: Task 10 ✓
- List page: Task 11 ✓
- Package scripts: Task 12 ✓
- Verification: Task 13 ✓

**2. Placeholder scan:**
- No TBD/TODO found
- All code is complete and runnable

**3. Type consistency:**
- API types match Word interface from types.ts
- FeedbackItem matches FeedbackItem from types.ts
- All function signatures preserved from original storage.ts
