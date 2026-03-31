#!/usr/bin/env bun
/**
 * 批量部分复习集成测试
 *
 * 测试场景：
 * 1. 批量添加多个单词
 * 2. 批量提交部分单词的复习反馈（模拟提前结束复习）
 * 3. 验证未复习的单词下次仍会返回
 * 4. 测试错误处理
 */
import { McpClient } from "../helpers/mcp-client.mjs";
import { setupTestData, teardownTestData, resetTestData, readTestData, writeTestData, getToday, addDays, TEST_DATA_FILE } from "../helpers/data-env.mjs";

console.log("=== 批量部分复习集成测试 ===\n");

const TEST_WORDS = [
  { word: "ephemeral", meaning: "短暂的", phonetic: "/ɪˈfemərəl/", pos: "adj", example: "Fame can be ephemeral.", example_cn: "名声可能是短暂的。" },
  { word: "ubiquitous", meaning: "无处不在的", phonetic: "/juːˈbɪkwɪtəs/", pos: "adj", example: "Smartphones are ubiquitous.", example_cn: "智能手机无处不在。" },
  { word: "resilient", meaning: "有韧性的", phonetic: "/rɪˈzɪliənt/", pos: "adj", example: "Children are often resilient.", example_cn: "孩子通常很有韧性。" },
  { word: "ambiguous", meaning: "模棱两可的", phonetic: "/æmˈbɪɡjuəs/", pos: "adj", example: "The wording is ambiguous.", example_cn: "措辞模棱两可。" },
  { word: "frangible", meaning: "易碎的", phonetic: "/ˈfrændʒɪbl/", pos: "adj", example: "Glass is frangible.", example_cn: "玻璃是易碎的。" },
  { word: "pragmatic", meaning: "务实的", phonetic: "/præɡˈmætɪk/", pos: "adj", example: "She is a pragmatic person.", example_cn: "她是个务实的人。" },
  { word: "verbose", meaning: "冗长的", phonetic: "/vɜːˈbəʊs/", pos: "adj", example: "The report is too verbose.", example_cn: "报告太冗长了。" },
  { word: "lethargic", meaning: "嗜睡的", phonetic: "/ləˈθɑːdʒɪk/", pos: "adj", example: "The heat made me lethargic.", example_cn: "炎热让我昏昏欲睡。" },
  { word: "meticulous", meaning: "一丝不苟的", phonetic: "/məˈtɪkjələs/", pos: "adj", example: "He is meticulous about details.", example_cn: "他对细节一丝不苟。" },
  { word: "arduous", meaning: "艰巨的", phonetic: "/ˈɑːdjuəs/", pos: "adj", example: "The journey was arduous.", example_cn: "旅途非常艰辛。" },
];

let passed = 0;
let failed = 0;
let client;

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
  const hadBackup = setupTestData();
  resetTestData();

  client = new McpClient({
    env: { VOCAB_DATA_PATH: TEST_DATA_FILE }
  });
  await client.start();

  // ===== 测试 1: 批量添加单词 =====
  console.log("\n=== 测试 1: 批量添加 10 个单词 ===");
  for (const w of TEST_WORDS) {
    const result = await client.callTool("vocab_add_word", w);
    assert(result.success === true, `添加 ${w.word}: ${result.message}`);
  }
  const statusAfterAdd = await client.callTool("vocab_get_status");
  assert(statusAfterAdd.total_words === 10, `词库应有 10 词，实际: ${statusAfterAdd.total_words}`);

  // ===== 测试 2: 将单词 next_review 设为今天 =====
  console.log("\n=== 测试 2: 将单词 next_review 设为今天 ===");
  const today = getToday();
  const testData = readTestData();
  testData.words.forEach(word => {
    word.next_review = today;
  });
  writeTestData(testData);

  const reviewList = await client.callTool("vocab_review");
  assert(reviewList.count === 10, `应有 10 个待复习，实际: ${reviewList.count}`);

  // ===== 测试 3: 批量提交部分复习（只复习 4/10 个）=====
  console.log("\n=== 测试 3: 批量提交部分复习（只复习 4/10 个）===");
  const partialFeedbacks = [
    { word: "ephemeral", feedback: "pass" },
    { word: "ubiquitous", feedback: "fail" },
    { word: "resilient", feedback: "fuzzy" },
    { word: "ambiguous", feedback: "pass" },
  ];
  const partialResult = await client.callTool("vocab_review_feedback", {
    feedbacks: partialFeedbacks
  });
  assert(partialResult.success === true, `部分提交成功`);
  assert(partialResult.summary.passed === 2, `通过应为 2，实际: ${partialResult.summary.passed}`);
  assert(partialResult.summary.failed === 1, `失败应为 1，实际: ${partialResult.summary.failed}`);
  assert(partialResult.summary.fuzzy === 1, `模糊应为 1，实际: ${partialResult.summary.fuzzy}`);

  // ===== 测试 4: 验证 streak =====
  console.log("\n=== 测试 4: 验证 streak ===");
  const statusAfterReview = await client.callTool("vocab_get_status");
  assert(statusAfterReview.streak === 1, `streak 应为 1，实际: ${statusAfterReview.streak}`);
  assert(statusAfterReview.total_reviews === 1, `total_reviews 应为 1`);

  // ===== 测试 5: 验证未复习的单词仍会返回 =====
  console.log("\n=== 测试 5: 验证未复习的单词仍会返回 ===");
  const remainingReview = await client.callTool("vocab_review");
  assert(remainingReview.count === 6, `剩余待复习应为 6，实际: ${remainingReview.count}`);
  const remainingWords = remainingReview.words.map(w => w.word);
  assert(remainingWords.includes("frangible"), "frangible 仍在列表");
  assert(remainingWords.includes("pragmatic"), "pragmatic 仍在列表");
  assert(remainingWords.includes("verbose"), "verbose 仍在列表");
  assert(remainingWords.includes("lethargic"), "lethargic 仍在列表");
  assert(remainingWords.includes("meticulous"), "meticulous 仍在列表");
  assert(remainingWords.includes("arduous"), "arduous 仍在列表");

  // ===== 测试 6: 继续复习剩余 6 个词 =====
  console.log("\n=== 测试 6: 继续复习剩余 6 个词 ===");
  const remainingFeedbacks = remainingReview.words.map(w => ({
    word: w.word,
    feedback: "pass"
  }));
  const secondResult = await client.callTool("vocab_review_feedback", {
    feedbacks: remainingFeedbacks
  });
  assert(secondResult.success === true, `第二次提交成功`);
  assert(secondResult.summary.passed === 6, `第二次通过应为 6，实际: ${secondResult.summary.passed}`);

  // ===== 测试 7: 全部复习完后，再调用 review 应返回 0 =====
  console.log("\n=== 测试 7: 全部复习完后检查 ===");
  const emptyReview = await client.callTool("vocab_review");
  assert(emptyReview.count === 0, `全部复习后应返回 0`);

  // ===== 测试 8: 错误处理 - 不存在的单词 =====
  console.log("\n=== 测试 8: 错误处理 - 不存在的单词 ===");
  const nonExistResult = await client.callTool("vocab_review_feedback", {
    feedbacks: [{ word: "nonexistent_word_xyz", feedback: "pass" }]
  });
  assert(nonExistResult.success === true, `提交不存在的单词返回 success=true`);
  assert(nonExistResult.summary.passed === 0 && nonExistResult.summary.failed === 0 && nonExistResult.summary.fuzzy === 0,
    `无效词不计入任何分类`);

  // ===== 测试 9: 错误处理 - 无效的 feedback 类型 =====
  console.log("\n=== 测试 9: 错误处理 - 无效的 feedback 类型 ===");
  const invalidResult = await client.callTool("vocab_review_feedback", {
    feedbacks: [{ word: "ephemeral", feedback: "invalid_type" }]
  });
  // MCP 返回 isError: true 而不是抛出异常
  assert(invalidResult.isError === true, `无效 feedback 应返回错误响应`);

  // ===== 测试 10: 验证单词状态已正确更新 =====
  console.log("\n=== 测试 10: 验证单词状态更新 ===");
  const ephemeralDetail = await client.callTool("vocab_get_word_detail", { word: "ephemeral" });
  assert(ephemeralDetail.level === 1, `ephemeral level 应为 1，实际: ${ephemeralDetail.level}`);
  assert(ephemeralDetail.review_count === 1, `ephemeral review_count 应为 1`);

  const ubiquitousDetail = await client.callTool("vocab_get_word_detail", { word: "ubiquitous" });
  assert(ubiquitousDetail.level === 0, `ubiquitous level 应为 0（fail 后降级），实际: ${ubiquitousDetail.level}`);
  assert(ubiquitousDetail.error_count === 1, `ubiquitous error_count 应为 1`);

  // ===== 测试 11: streak 连续复习 =====
  console.log("\n=== 测试 11: streak 连续复习 ===");
  const data1 = readTestData();
  data1.last_review_date = addDays(getToday(), -1); // 昨天复习过，今天继续，streak 应增加
  data1.streak = 5;
  writeTestData(data1);
  await client.callTool("vocab_add_word", { word: "streaktarget", meaning: "测试" });
  const streakResult = await client.callTool("vocab_review_feedback", {
    feedbacks: [{ word: "streaktarget", feedback: "pass" }]
  });
  assert(streakResult.updated_streak === 6, `streak 应从 5 增加到 6，实际: ${streakResult.updated_streak}`);

  // ===== 测试 12: streak 中断 =====
  console.log("\n=== 测试 12: streak 中断 ===");
  const data2 = readTestData();
  data2.last_review_date = "2026-03-27";
  data2.streak = 3;
  writeTestData(data2);
  const breakResult = await client.callTool("vocab_review_feedback", {
    feedbacks: [{ word: "streaktarget", feedback: "pass" }]
  });
  assert(breakResult.updated_streak === 1, `streak 中断后应重置为 1，实际: ${breakResult.updated_streak}`);

  client.stop();
  teardownTestData(hadBackup);

  console.log("\n" + "=".repeat(50));
  console.log(`批量复习测试: ✅ ${passed} 通过, ❌ ${failed} 失败`);
  console.log("=".repeat(50));
  return failed === 0;
}

const success = await runTests();
process.exit(success ? 0 : 1);
