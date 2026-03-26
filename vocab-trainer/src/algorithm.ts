import { Word, ReviewResult, ReviewSummary, FeedbackItem } from "./types.js";
import { loadData, saveData, updateWord } from "./storage.js";

const INTERVALS = [1, 2, 4, 7, 15, 30]; // level 0-5 对应间隔

export function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

export function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function calculateNextReview(
  currentLevel: number,
  feedback: "pass" | "fail" | "fuzzy"
): { newLevel: number; intervalDays: number } {
  switch (feedback) {
    case "pass": {
      const newLevel = Math.min(5, currentLevel + 1);
      return { newLevel, intervalDays: INTERVALS[newLevel] };
    }
    case "fail":
      return { newLevel: Math.max(0, currentLevel - 1), intervalDays: 1 };
    case "fuzzy":
      return {
        newLevel: currentLevel,
        intervalDays: Math.max(1, Math.floor(INTERVALS[currentLevel] / 2))
      };
  }
}

export function processReviewFeedbacks(feedbacks: FeedbackItem[]): {
  results: ReviewResult[];
  summary: ReviewSummary;
  updatedStreak: number;
} {
  const data = loadData();
  const today = getToday();
  const results: ReviewResult[] = [];

  let passed = 0;
  let failed = 0;
  let fuzzy = 0;

  for (const { word, feedback } of feedbacks) {
    const existingWord = data.words.find(
      w => w.word.toLowerCase() === word.toLowerCase()
    );
    if (!existingWord) continue;

    const oldLevel = existingWord.level;
    const { newLevel, intervalDays } = calculateNextReview(oldLevel, feedback);
    const nextReview = addDays(today, intervalDays);

    // 更新单词
    const historyEntry = {
      date: today,
      result: feedback
    };

    updateWord(word, {
      level: newLevel,
      interval_days: intervalDays,
      next_review: nextReview,
      review_count: existingWord.review_count + 1,
      error_count: feedback === "fail" ? existingWord.error_count + 1 : existingWord.error_count,
      history: [...existingWord.history, historyEntry]
    });

    results.push({
      word,
      old_level: oldLevel,
      new_level: newLevel,
      next_review: nextReview,
      interval_days: intervalDays
    });

    if (feedback === "pass") passed++;
    else if (feedback === "fail") failed++;
    else fuzzy++;
  }

  // 更新 streak
  let newStreak = data.streak;
  const lastDate = data.last_review_date;

  if (lastDate) {
    const yesterday = addDays(today, -1);
    if (lastDate === today) {
      // 今天已经复习过，streak 不变
    } else if (lastDate === yesterday) {
      newStreak += 1;
    } else {
      newStreak = 1;
    }
  } else {
    newStreak = 1;
  }

  // 更新统计数据
  data.streak = newStreak;
  data.last_review_date = today;
  data.total_reviews += 1;
  saveData(data);

  return {
    results,
    summary: { passed, failed, fuzzy },
    updatedStreak: newStreak
  };
}