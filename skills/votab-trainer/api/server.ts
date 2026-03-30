import { Hono } from "hono";
import { cors } from "hono/cors";
import { loadData, addWord, getWord, removeWord, getWordsByFilter, getDueWords, updateWordEnrich } from "../dist/storage.js";
import { processReviewFeedbacks, getToday, addDays } from "../dist/algorithm.js";
import { Word } from "../dist/types.js";
import { enrichWord } from "../dist/llm.js";

const app = new Hono();

app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type"]
}));

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
    history: [],
    prototype: "",
    variant: "",
    etymology: ""
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

app.get("/api/words/:word/enrich", async (c) => {
  const word = c.req.param("word");
  const existing = getWord(word);

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
      updateWordEnrich(word, enrich);
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

console.log("Starting Vocab-Trainer API server on http://0.0.0.0:3099");
export default {
  port: 3099,
  hostname: "0.0.0.0",
  fetch: app.fetch
};
