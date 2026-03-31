import { Word, ReviewResult, ReviewSummary, FeedbackItem } from "./types.js";
import { createStorageFromEnv, type StorageConnection } from "./storage.js";

// 艾宾浩斯间隔序列 (分钟): 20分钟, 1小时, 4小时, 12小时, 1天, 2天, 7天, 15天, 30天, 60天
// Level 0-9 共10个级别
const INTERVALS = [20, 60, 240, 720, 1440, 2880, 10080, 21600, 43200, 86400] as const;

/**
 * 获取当前时刻 (ISO8601 datetime)
 */
export function getNow(): string {
  return new Date().toISOString();
}

/**
 * 获取今天的日期字符串 (YYYY-MM-DD)
 */
export function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * 按分钟添加时间
 * @param date ISO8601 datetime 字符串
 * @param minutes 要添加的分钟数 (可为负数)
 */
export function addMinutes(date: string, minutes: number): string {
  const d = new Date(date);
  d.setTime(d.getTime() + minutes * 60 * 1000);
  return d.toISOString();
}

/**
 * 按天数添加时间 (兼容性导出)
 * @param date ISO8601 datetime 字符串
 * @param days 要添加的天数 (可为负数)
 * @deprecated 使用 addMinutes 代替，按分钟计算更精确
 */
export function addDays(date: string, days: number): string {
  return addMinutes(date, days * 1440);
}

/**
 * 计算下次复习时间和新级别
 * @param currentLevel 当前级别 (0-9)
 * @param feedback 复习反馈
 * @returns 新级别和间隔分钟数
 */
export function calculateNextReview(
  currentLevel: number,
  feedback: "pass" | "fail" | "fuzzy"
): { newLevel: number; intervalMinutes: number } {
  switch (feedback) {
    case "pass": {
      const newLevel = Math.min(9, currentLevel + 1);
      return { newLevel, intervalMinutes: INTERVALS[newLevel] };
    }
    case "fail":
      return { newLevel: 0, intervalMinutes: INTERVALS[0] }; // 重置到 level 0 (20分钟)
    case "fuzzy":
      return {
        newLevel: currentLevel,
        intervalMinutes: Math.max(INTERVALS[0], Math.floor(INTERVALS[currentLevel] / 3))
      };
  }
}

export interface ProcessFeedbacksResult {
  results: ReviewResult[];
  summary: ReviewSummary;
  updatedStreak: number;
}

/**
 * Process review feedbacks.
 * @param storageOrFeedbacks - Either a storage connection or an array of feedbacks (for backward compatibility)
 * @param feedbacks - Array of feedbacks (only used if first param is storage)
 */
export function processReviewFeedbacks(
  storageOrFeedbacks: StorageConnection | FeedbackItem[],
  feedbacks?: FeedbackItem[]
): ProcessFeedbacksResult {
  // Handle backward compatibility: if first arg is array, it's feedbacks and we use default storage
  let storage: StorageConnection;
  let feedbackItems: FeedbackItem[];

  if (Array.isArray(storageOrFeedbacks)) {
    storage = createStorageFromEnv();
    feedbackItems = storageOrFeedbacks;
  } else {
    storage = storageOrFeedbacks;
    feedbackItems = feedbacks || [];
  }
  const data = storage.loadData();
  const now = getNow();
  const today = getToday();
  const results: ReviewResult[] = [];

  let passed = 0;
  let failed = 0;
  let fuzzy = 0;

  for (const { word, feedback } of feedbackItems) {
    const existingWord = data.words.find(
      w => w.word.toLowerCase() === word.toLowerCase()
    );
    if (!existingWord) continue;

    const oldLevel = existingWord.level;
    const { newLevel, intervalMinutes } = calculateNextReview(oldLevel, feedback);
    const nextReview = addMinutes(now, intervalMinutes);

    // 更新单词
    const historyEntry = {
      date: now, // 使用完整 datetime
      result: feedback
    };

    existingWord.level = newLevel;
    existingWord.interval_minutes = intervalMinutes;
    existingWord.next_review = nextReview;
    existingWord.review_count += 1;
    if (feedback === "fail") existingWord.error_count += 1;
    existingWord.history.push(historyEntry);

    // 持久化单词更新到数据库
    storage.updateWord(word, existingWord);

    results.push({
      word,
      old_level: oldLevel,
      new_level: newLevel,
      next_review: nextReview,
      interval_minutes: intervalMinutes
    });

    if (feedback === "pass") passed++;
    else if (feedback === "fail") failed++;
    else fuzzy++;
  }

  // 更新 streak: 24小时内有复习就算连续
  let newStreak = data.streak;
  const lastReviewDatetime = data.last_review_date;

  if (lastReviewDatetime) {
    const lastTime = new Date(lastReviewDatetime).getTime();
    const nowTime = new Date(now).getTime();
    const hoursSinceLastReview = (nowTime - lastTime) / (1000 * 60 * 60);

    if (hoursSinceLastReview <= 24) {
      // 24小时内有复习，streak 不变（视为同一次连续复习）
      // 如果 last_review_date 是"今天"之前但不超过24小时，也保持连续
    } else {
      // 超过24小时，重置 streak
      newStreak = 1;
    }
  } else {
    newStreak = 1;
  }

  // 更新统计数据
  data.streak = newStreak;
  data.last_review_date = now; // 使用完整 datetime
  data.total_reviews += 1;
  storage.saveData(data);

  return {
    results,
    summary: { passed, failed, fuzzy },
    updatedStreak: newStreak
  };
}
