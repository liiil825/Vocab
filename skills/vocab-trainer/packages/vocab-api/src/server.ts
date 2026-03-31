import { Hono } from "hono";
import { cors } from "hono/cors";
import { Word, createStorageFromEnv, processReviewFeedbacks, getNow, addMinutes } from "vocab-core";
import { enrichWord } from "./llm.js";
import type { StorageConnection } from "vocab-core/storage";

// Create shared storage instance for the API server
let storage: StorageConnection | null = null;

function getStorage(): StorageConnection {
  if (!storage) {
    storage = createStorageFromEnv();
  }
  return storage;
}

const app = new Hono();

app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type"]
}));

function groupByLevel(words: Word[]): Record<number, number> {
  const stats: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
  words.forEach(w => {
    stats[w.level] = (stats[w.level] || 0) + 1;
  });
  return stats;
}

function getLevelNextReview(words: Word[]): Record<number, string | null> {
  // For each level, find the earliest next_review time
  const result: Record<number, string | null> = { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null, 8: null, 9: null };
  const wordsByLevel: Record<number, Word[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [] };

  words.forEach(w => {
    wordsByLevel[w.level].push(w);
  });

  for (let level = 0; level <= 9; level++) {
    const levelWords = wordsByLevel[level];
    if (levelWords.length === 0) {
      result[level] = null;
      continue;
    }
    // Find the earliest next_review
    let earliest = levelWords[0].next_review;
    for (let i = 1; i < levelWords.length; i++) {
      if (levelWords[i].next_review < earliest) {
        earliest = levelWords[i].next_review;
      }
    }
    result[level] = earliest;
  }

  return result;
}

// Group words by their review time for today (Level 0-3)
function groupWordsByTodayTime(words: Word[]): Record<string, string[]> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const result: Record<string, string[]> = {};

  // Only include words that are Level 0-3 and due today
  words.filter(w => w.level <= 3 && w.next_review >= todayStart.toISOString() && w.next_review < todayEnd.toISOString())
    .forEach(w => {
      const reviewDate = new Date(w.next_review);
      const timeKey = `${reviewDate.getHours().toString().padStart(2, '0')}:${reviewDate.getMinutes().toString().padStart(2, '0')}`;
      if (!result[timeKey]) {
        result[timeKey] = [];
      }
      result[timeKey].push(w.word);
    });

  return result;
}

app.get("/api/status", (c) => {
  const db = getStorage();
  const data = db.loadData();
  const now = getNow();

  // Count words that can be reviewed now (Level 0-3 with next_review <= now)
  const nowDue = data.words.filter(w => w.level <= 3 && w.next_review <= now).length;

  // Count Level 4+ words that can be reviewed now (next_review <= now)
  const level4PlusDue = data.words.filter(w => w.level >= 4 && w.next_review <= now).length;

  return c.json({
    total_words: data.words.length,
    level_stats: groupByLevel(data.words),
    level_next_review: getLevelNextReview(data.words),
    level0_3_due_count: nowDue,
    level4_plus_due_count: level4PlusDue,
    words_by_time: groupWordsByTodayTime(data.words),
    review_batch_time: data.review_batch_time,
    streak: data.streak,
    total_reviews: data.total_reviews
  });
});

app.get("/api/review", (c) => {
  const db = getStorage();
  const data = db.loadData();
  const due = db.getDueWords();
  due.sort(() => Math.random() - 0.5);

  return c.json({
    words: due,
    count: due.length,
    streak: data.streak,
    last_review_date: data.last_review_date
  });
});

app.get("/api/review/next", (c) => {
  const db = getStorage();
  const data = db.loadData();
  const now = getNow();

  // Find the word with earliest next_review that is in the future
  const upcoming = data.words
    .filter(w => w.next_review > now)
    .sort((a, b) => a.next_review.localeCompare(b.next_review));

  if (upcoming.length === 0) {
    return c.json(null);
  }

  const next = upcoming[0];
  return c.json({
    word: next.word,
    next_review: next.next_review,
    interval_minutes: next.interval_minutes
  });
});

app.post("/api/review/feedback", async (c) => {
  const db = getStorage();
  const { feedbacks } = await c.req.json();
  const result = processReviewFeedbacks(db, feedbacks);

  return c.json({
    success: true,
    results: result.results,
    summary: result.summary,
    updated_streak: result.updatedStreak,
    message: `复习完成！通过 ${result.summary.passed}，失败 ${result.summary.failed}，模糊 ${result.summary.fuzzy}`
  });
});

app.get("/api/words", (c) => {
  const db = getStorage();
  const filter = c.req.query("filter");
  const words = db.getWordsByFilter(filter || undefined);

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
  const db = getStorage();
  const body = await c.req.json();
  const existing = db.getWord(body.word);

  if (existing) {
    return c.json({
      success: false,
      word: body.word,
      level: existing.level,
      next_review: existing.next_review,
      message: `单词 "${body.word}" 已存在，当前 level: ${existing.level}`
    }, 400);
  }

  const now = getNow();
  const firstReview = now; // 新词立即可复习

  const newWord: Word = {
    word: body.word,
    meaning: body.meaning || "",
    phonetic: body.phonetic || "",
    pos: body.pos || "",
    example: body.example || "",
    example_cn: body.example_cn || "",
    source: body.source || "user",
    added: now,
    level: 0,
    next_review: firstReview,
    interval_minutes: 20,
    error_count: 0,
    review_count: 0,
    history: [],
    prototype: "",
    variant: "",
    etymology: ""
  };

  db.addWord(newWord);

  return c.json({
    success: true,
    word: body.word,
    level: 0,
    next_review: firstReview,
    message: `已添加 "${body.word}"，可立即复习`
  });
});

app.delete("/api/words/:word", (c) => {
  const db = getStorage();
  const word = c.req.param("word");
  const success = db.removeWord(word);

  return c.json({
    success,
    message: success ? `已移除 "${word}"` : `未找到 "${word}"`
  });
});

app.get("/api/words/:word", (c) => {
  const db = getStorage();
  const word = c.req.param("word");
  const result = db.getWord(word);

  if (!result) {
    return c.json({ error: `未找到单词 "${word}"` }, 404);
  }

  return c.json(result);
});

app.get("/api/words/:word/enrich", async (c) => {
  const db = getStorage();
  const word = c.req.param("word");
  const existing = db.getWord(word);

  // If word exists in DB and has all enrich fields, return from DB
  if (existing && existing.prototype && existing.variant && existing.etymology) {
    return c.json({
      word,
      prototype: existing.prototype,
      variant: existing.variant,
      etymology: existing.etymology,
      cached: true
    });
  }

  // Otherwise call LLM to get enrich data
  try {
    const enrich = await enrichWord(word);

    // Save to DB if word exists
    if (existing) {
      db.updateWordEnrich(word, enrich);
    }

    return c.json({
      word,
      ...enrich,
      cached: false
    });
  } catch (err) {
    console.error(`Failed to enrich word "${word}":`, err);
    return c.json({
      error: "Failed to enrich word",
      details: err instanceof Error ? err.message : String(err)
    }, 500);
  }
});

// GET /api/settings - get settings
app.get("/api/settings", (c) => {
  const db = getStorage();
  const data = db.loadData();
  return c.json({
    review_batch_time: data.review_batch_time
  });
});

// POST /api/settings - update settings
app.post("/api/settings", async (c) => {
  const db = getStorage();
  const body = await c.req.json();

  if (body.review_batch_time !== undefined) {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(body.review_batch_time)) {
      return c.json({ success: false, message: "Invalid time format. Use HH:MM (e.g., 08:30)" }, 400);
    }
    db.updateReviewBatchTime(body.review_batch_time);
  }

  return c.json({ success: true, message: "Settings updated" });
});

console.log("Starting Vocab-Trainer API server on http://0.0.0.0:3099");
export default {
  port: 3099,
  hostname: "0.0.0.0",
  fetch: app.fetch,
  idleTimeout: 60
};
