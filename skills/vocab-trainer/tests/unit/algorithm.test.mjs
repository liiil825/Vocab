#!/usr/bin/env bun
/**
 * 算法单元测试
 */
import { getToday, addDays, calculateNextReview, processReviewFeedbacks } from "../../packages/vocab-core/src/algorithm.js";
import { createStorageFromEnv } from "../../packages/vocab-core/src/storage.js";
import { setupTestData, teardownTestData, resetTestData, readTestData, writeTestData } from "../helpers/data-env.mjs";

console.log("=== 算法单元测试 ===\n");

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

  // 测试 1: getToday
  console.log("测试 1: getToday()");
  const today = getToday();
  assert(/^\d{4}-\d{2}-\d{2}$/.test(today), `日期格式正确: ${today}`);

  // 测试 2: addDays
  console.log("\n测试 2: addDays()");
  assert(addDays("2026-03-26", 1) === "2026-03-27", `2026-03-26 + 1 = 2026-03-27`);
  assert(addDays("2026-03-26", 7) === "2026-04-02", `2026-03-26 + 7 = 2026-04-02`);
  assert(addDays("2026-03-26", -1) === "2026-03-25", `2026-03-26 - 1 = 2026-03-25`);

  // 测试 3: calculateNextReview
  console.log("\n测试 3: calculateNextReview()");
  let result = calculateNextReview(0, "pass");
  assert(result.newLevel === 1 && result.intervalDays === 2, `level 0 + pass → level 1, interval 2`);
  result = calculateNextReview(2, "pass");
  assert(result.newLevel === 3 && result.intervalDays === 7, `level 2 + pass → level 3, interval 7`);
  result = calculateNextReview(3, "fail");
  assert(result.newLevel === 2 && result.intervalDays === 1, `level 3 + fail → level 2, interval 1`);
  result = calculateNextReview(2, "fuzzy");
  assert(result.newLevel === 2 && result.intervalDays === 2, `level 2 + fuzzy → level 2, interval 2`);

  // 测试 4: processReviewFeedbacks - pass
  console.log("\n测试 4: processReviewFeedbacks (pass)");
  const testWord1 = {
    word: "testpass",
    meaning: "测试通过",
    phonetic: "/test/",
    pos: "n",
    example: "Test.",
    example_cn: "测试。",
    source: "test",
    added: getToday(),
    level: 0,
    next_review: getToday(),
    interval_days: 1,
    error_count: 0,
    review_count: 0,
    history: []
  };
  storage.addWord(testWord1);
  const passResult = processReviewFeedbacks(storage, [{ word: "testpass", feedback: "pass" }]);
  assert(passResult.results.length === 1, "处理了 1 个反馈");
  assert(passResult.results[0].new_level === 1, "level 0 → 1");
  assert(passResult.updatedStreak === 1, "streak 为 1");

  // 测试 5: processReviewFeedbacks - fail
  console.log("\n测试 5: processReviewFeedbacks (fail)");
  storage.addWord({ ...testWord1, word: "testfail", level: 2 });
  const failResult = processReviewFeedbacks(storage, [{ word: "testfail", feedback: "fail" }]);
  assert(failResult.results[0].new_level === 1, "level 2 → 1 (fail 降级)");
  assert(failResult.summary.failed === 1, "失败计数为 1");

  // 测试 6: processReviewFeedbacks - fuzzy
  console.log("\n测试 6: processReviewFeedbacks (fuzzy)");
  storage.addWord({ ...testWord1, word: "testfuzzy", level: 2 });
  const fuzzyResult = processReviewFeedbacks(storage, [{ word: "testfuzzy", feedback: "fuzzy" }]);
  assert(fuzzyResult.results[0].new_level === 2, "level 2 + fuzzy → level 2 (不变)");
  assert(fuzzyResult.summary.fuzzy === 1, "模糊计数为 1");

  // 测试 7: processReviewFeedbacks - 批量
  console.log("\n测试 7: processReviewFeedbacks (批量)");
  resetTestData();
  // resetTestData 后需要获取新的 storage 实例
  const freshStorage = createStorageFromEnv();
  for (const w of ["word1", "word2", "word3"]) {
    freshStorage.addWord({ ...testWord1, word: w, level: 0, next_review: getToday() });
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

  // 测试 8: processReviewFeedbacks - 不存在的词
  console.log("\n测试 8: processReviewFeedbacks (不存在的词)");
  // writeTestData 后缓存被清除，重新获取新实例
  const storageForTest8 = createStorageFromEnv();
  const nonExistResult = processReviewFeedbacks(storageForTest8, [{ word: "nonexistent", feedback: "pass" }]);
  assert(nonExistResult.results.length === 0, "不存在的词不产生结果");

  // 测试 9: streak 连续
  console.log("\n测试 9: streak 连续复习");
  resetTestData();
  let data = readTestData();
  data.stats.last_review_date = addDays(getToday(), -1); // 昨天已复习，今天继续，streak 应增加
  data.stats.streak = 5;
  writeTestData(data);
  // writeTestData 后缓存被清除，需要重新获取新实例
  const storageForTest9 = createStorageFromEnv();
  storageForTest9.addWord({ ...testWord1, word: "streaktest", level: 0, next_review: getToday() });
  const streakResult = processReviewFeedbacks(storageForTest9, [{ word: "streaktest", feedback: "pass" }]);
  assert(streakResult.updatedStreak === 6, `连续 streak 5 → 6，实际: ${streakResult.updatedStreak}`);

  // 测试 10: streak 中断
  console.log("\n测试 10: streak 中断");
  data = readTestData();
  data.stats.last_review_date = "2026-03-27"; // 2天前
  data.stats.streak = 10;
  writeTestData(data);
  // writeTestData 后缓存被清除，需要重新获取新实例
  const storageForTest10 = createStorageFromEnv();
  const breakResult = processReviewFeedbacks(storageForTest10, [{ word: "streaktest", feedback: "pass" }]);
  assert(breakResult.updatedStreak === 1, `中断后 streak 重置为 1，实际: ${breakResult.updatedStreak}`);

  teardownTestData();

  console.log("\n" + "=".repeat(50));
  console.log(`算法测试: ✅ ${passed} 通过, ❌ ${failed} 失败`);
  console.log("=".repeat(50));
  return failed === 0;
}

const success = await runTests();
process.exit(success ? 0 : 1);
