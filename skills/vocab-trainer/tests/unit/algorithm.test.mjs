#!/usr/bin/env bun
/**
 * 算法单元测试 v2 - 艾宾浩斯间隔序列
 * 间隔: [20分钟, 1小时, 4小时, 12小时, 1天, 2天, 7天, 15天, 30天] (level 0-9)
 */
import { getNow, getToday, addMinutes, calculateNextReview, processReviewFeedbacks } from "../../packages/vocab-core/src/algorithm.js";
import { createStorageFromEnv } from "../../packages/vocab-core/src/storage.js";
import { setupTestData, teardownTestData, resetTestData, readTestData, writeTestData } from "../helpers/data-env.mjs";

console.log("=== 算法单元测试 v2 ===\n");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ❌ ${message}`);
    failed++;
  }
}

async function runTests() {
  setupTestData();
  resetTestData();

  // Get storage instance for tests
  const storage = createStorageFromEnv();

  // 测试 1: getNow
  console.log("测试 1: getNow()");
  const now = getNow();
  assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(now), `ISO datetime 格式正确: ${now}`);

  // 测试 2: addMinutes
  console.log("\n测试 2: addMinutes()");
  assert(addMinutes("2026-03-26T10:00:00Z", 20) === "2026-03-26T10:20:00.000Z", `+20分钟`);
  assert(addMinutes("2026-03-26T10:00:00Z", 60) === "2026-03-26T11:00:00.000Z", `+60分钟 = 1小时`);
  assert(addMinutes("2026-03-26T10:00:00Z", 240) === "2026-03-26T14:00:00.000Z", `+240分钟 = 4小时`);
  assert(addMinutes("2026-03-26T10:00:00Z", -60) === "2026-03-26T09:00:00.000Z", `-60分钟`);

  // 测试 3: calculateNextReview - pass
  console.log("\n测试 3: calculateNextReview (pass)");
  let result = calculateNextReview(0, "pass");
  assert(result.newLevel === 1 && result.intervalMinutes === 60, `level 0 + pass → level 1, interval 60分钟 (1小时)`);

  result = calculateNextReview(1, "pass");
  assert(result.newLevel === 2 && result.intervalMinutes === 240, `level 1 + pass → level 2, interval 240分钟 (4小时)`);

  result = calculateNextReview(4, "pass");
  assert(result.newLevel === 5 && result.intervalMinutes === 2880, `level 4 + pass → level 5, interval 2880分钟 (2天)`);

  result = calculateNextReview(8, "pass");
  assert(result.newLevel === 9 && result.intervalMinutes === 86400, `level 8 + pass → level 9 (max), interval 86400分钟 (60天)`);

  // 测试 4: calculateNextReview - fail
  console.log("\n测试 4: calculateNextReview (fail)");
  // Level 0-3: reset to level 0
  result = calculateNextReview(0, "fail");
  assert(result.newLevel === 0 && result.intervalMinutes === 20, `level 0 + fail → level 0 (已在最低)`);

  result = calculateNextReview(3, "fail");
  assert(result.newLevel === 0 && result.intervalMinutes === 20, `level 3 + fail → level 0, interval 20分钟`);

  // Level 4+: keep level unchanged, 20 minutes later
  result = calculateNextReview(4, "fail");
  assert(result.newLevel === 4 && result.intervalMinutes === 20, `level 4 + fail → level 4, interval 20分钟`);

  result = calculateNextReview(5, "fail");
  assert(result.newLevel === 5 && result.intervalMinutes === 20, `level 5 + fail → level 5, interval 20分钟`);

  result = calculateNextReview(9, "fail");
  assert(result.newLevel === 9 && result.intervalMinutes === 20, `level 9 + fail → level 9, interval 20分钟`);

  // 测试 5: calculateNextReview - fuzzy (÷3)
  console.log("\n测试 5: calculateNextReview (fuzzy - ÷3)");
  result = calculateNextReview(2, "fuzzy"); // INTERVALS[2] = 240, 240/3 = 80
  assert(result.newLevel === 2 && result.intervalMinutes === 80, `level 2 + fuzzy → level 2, interval 80分钟 (240÷3)`);

  result = calculateNextReview(4, "fuzzy"); // INTERVALS[4] = 1440, 1440/3 = 480
  assert(result.newLevel === 4 && result.intervalMinutes === 480, `level 4 + fuzzy → level 4, interval 480分钟 (1440÷3)`);

  result = calculateNextReview(0, "fuzzy"); // INTERVALS[0] = 20, max(20, 20/3) = 20
  assert(result.newLevel === 0 && result.intervalMinutes === 20, `level 0 + fuzzy → level 0, interval 20分钟 (不低于最小值)`);

  // 测试 6: processReviewFeedbacks - pass
  console.log("\n测试 6: processReviewFeedbacks (pass)");
  const nowStr = getNow();
  const testWord1 = {
    word: "testpass",
    meaning: "测试通过",
    phonetic: "/test/",
    pos: "n",
    example: "Test.",
    example_cn: "测试。",
    source: "test",
    added: nowStr,
    level: 0,
    next_review: nowStr,
    interval_minutes: 20,
    error_count: 0,
    review_count: 0,
    history: []
  };
  storage.addWord(testWord1);
  const passResult = processReviewFeedbacks(storage, [{ word: "testpass", feedback: "pass" }]);
  assert(passResult.results.length === 1, "处理了 1 个反馈");
  assert(passResult.results[0].new_level === 1, "level 0 → 1");
  assert(passResult.updatedStreak === 1, "streak 为 1");

  // 测试 7: processReviewFeedbacks - fail (Level 4+ keep level)
  console.log("\n测试 7: processReviewFeedbacks (fail - Level 4+ keep level)");
  storage.addWord({ ...testWord1, word: "testfail", level: 5, next_review: nowStr, interval_minutes: 2880 });
  const failResult = processReviewFeedbacks(storage, [{ word: "testfail", feedback: "fail" }]);
  assert(failResult.results[0].new_level === 5, "level 5 → 5 (fail 保持级别)");
  assert(failResult.results[0].interval_minutes === 20, "level 5 + fail interval 20分钟");
  assert(failResult.summary.failed === 1, "失败计数为 1");

  // 测试 8: processReviewFeedbacks - fuzzy
  console.log("\n测试 8: processReviewFeedbacks (fuzzy)");
  storage.addWord({ ...testWord1, word: "testfuzzy", level: 4, next_review: nowStr, interval_minutes: 1440 });
  const fuzzyResult = processReviewFeedbacks(storage, [{ word: "testfuzzy", feedback: "fuzzy" }]);
  assert(fuzzyResult.results[0].new_level === 4, "level 4 + fuzzy → level 4 (不变)");
  assert(fuzzyResult.results[0].interval_minutes === 480, "interval = 1440÷3 = 480");
  assert(fuzzyResult.summary.fuzzy === 1, "模糊计数为 1");

  // 测试 9: processReviewFeedbacks - 批量
  console.log("\n测试 9: processReviewFeedbacks (批量)");
  resetTestData();
  const freshStorage = createStorageFromEnv();
  const nowForBatch = getNow();
  for (const w of ["word1", "word2", "word3"]) {
    freshStorage.addWord({ ...testWord1, word: w, level: 0, next_review: nowForBatch, interval_minutes: 20 });
  }
  const batchResult = processReviewFeedbacks(freshStorage, [
    { word: "word1", feedback: "pass" },
    { word: "word2", feedback: "fail" },
    { word: "word3", feedback: "fuzzy" }
  ]);
  assert(batchResult.summary.passed === 1, "通过 1");
  assert(batchResult.summary.failed === 1, "失败 1");
  assert(batchResult.summary.fuzzy === 1, "模糊 1");
  assert(batchResult.results.length === 3, "处理了 3 个");

  // 测试 10: processReviewFeedbacks - 不存在的词
  console.log("\n测试 10: processReviewFeedbacks (不存在的词)");
  const storageForTest10 = createStorageFromEnv();
  const nonExistResult = processReviewFeedbacks(storageForTest10, [{ word: "nonexistent", feedback: "pass" }]);
  assert(nonExistResult.results.length === 0, "不存在的词不产生结果");

  // 测试 11: streak - 24小时内复习保持连续
  console.log("\n测试 11: streak - 24小时内复习");
  resetTestData();
  let data = readTestData();
  const twentyHoursAgo = addMinutes(getNow(), -20 * 60); // 20小时前
  data.stats.last_review_date = twentyHoursAgo;
  data.stats.streak = 5;
  writeTestData(data);
  const storageForTest11 = createStorageFromEnv();
  storageForTest11.addWord({ ...testWord1, word: "streaktest", level: 0, next_review: getNow() });
  const streakResult = processReviewFeedbacks(storageForTest11, [{ word: "streaktest", feedback: "pass" }]);
  assert(streakResult.updatedStreak === 5, `24小时内 streak 保持为 5，实际: ${streakResult.updatedStreak}`);

  // 测试 12: streak - 超过24小时中断
  console.log("\n测试 12: streak - 超过24小时中断");
  data = readTestData();
  const thirtyHoursAgo = addMinutes(getNow(), -30 * 60); // 30小时前
  data.stats.last_review_date = thirtyHoursAgo;
  data.stats.streak = 10;
  writeTestData(data);
  const storageForTest12 = createStorageFromEnv();
  const breakResult = processReviewFeedbacks(storageForTest12, [{ word: "streaktest", feedback: "pass" }]);
  assert(breakResult.updatedStreak === 1, `超过24小时 streak 重置为 1，实际: ${breakResult.updatedStreak}`);

  teardownTestData();

  console.log("\n" + "=".repeat(50));
  console.log(`算法测试: ✅ ${passed} 通过, ❌ ${failed} 失败`);
  console.log("=".repeat(50));
  return failed === 0;
}

const success = await runTests();
process.exit(success ? 0 : 1);
