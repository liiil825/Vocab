#!/usr/bin/env bun
/**
 * MCP 集成测试 v2 - 测试所有 MCP 工具的基本功能
 */
import { McpClient } from "../helpers/mcp-client.mjs";
import { setupTestData, teardownTestData, resetTestData, TEST_DATA_FILE } from "../helpers/data-env.mjs";

console.log("=== MCP 集成测试 v2 ===\n");

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
  setupTestData();
  resetTestData();

  client = new McpClient({
    env: { VOCAB_DATA_PATH: TEST_DATA_FILE }
  });
  await client.start();

  // 测试 1: vocab_get_status (空词库)
  console.log("\n测试 1: vocab_get_status (空词库)");
  const status1 = await client.callTool("vocab_get_status");
  assert(status1.total_words === 0, `总词数: 0`);
  assert(status1.streak === 0, `streak: 0`);

  // 测试 2: vocab_add_word (新算法: 首次复习是20分钟后)
  console.log("\n测试 2: vocab_add_word");
  const addResult = await client.callTool("vocab_add_word", {
    word: "sparingly",
    meaning: "适量地，节俭地",
    phonetic: "/ˈspeərɪŋli/",
    pos: "adv",
    example: "Use comments sparingly.",
    example_cn: "注释要简洁克制。"
  });
  assert(addResult.success === true, `添加成功`);
  assert(addResult.level === 0, `初始 level: 0`);

  // 测试 3: vocab_add_word (重复添加)
  console.log("\n测试 3: vocab_add_word (重复添加)");
  const addDup = await client.callTool("vocab_add_word", {
    word: "sparingly",
    meaning: "测试"
  });
  assert(addDup.success === false, `重复添加返回 success=false`);
  assert(addDup.level === 0, `返回现有 level: 0`);

  // 测试 4: vocab_get_status
  console.log("\n测试 4: vocab_get_status");
  const status2 = await client.callTool("vocab_get_status");
  assert(status2.total_words === 1, `总词数: 1`);

  // 测试 5: vocab_review
  // 新算法: sparingly 的 next_review = 20分钟后，应该在待复习列表中
  console.log("\n测试 5: vocab_review");
  const review1 = await client.callTool("vocab_review");
  assert(review1.count === 1, `待复习: 1（sparingly 刚添加，20分钟后就到期）`);

  // 测试 6: vocab_review_feedback (pass)
  console.log("\n测试 6: vocab_review_feedback (pass)");
  const feedback1 = await client.callTool("vocab_review_feedback", {
    feedbacks: [{ word: "sparingly", feedback: "pass" }]
  });
  assert(feedback1.success === true, `反馈提交成功`);
  assert(feedback1.summary.passed === 1, `通过: 1`);
  assert(feedback1.updated_streak === 1, `streak: 1`);

  // 测试 7: vocab_get_word_detail
  console.log("\n测试 7: vocab_get_word_detail");
  const detail = await client.callTool("vocab_get_word_detail", { word: "sparingly" });
  assert(detail.word === "sparingly", `返回正确单词`);
  assert(detail.level === 1, `level 更新为 1 (pass后升级)`);
  assert(detail.review_count === 1, `review_count: 1`);
  assert(detail.interval_minutes === 60, `interval_minutes: 60 (1小时)`);

  // 测试 8: vocab_list_words
  console.log("\n测试 8: vocab_list_words");
  const list = await client.callTool("vocab_list_words", { filter: "all" });
  assert(list.total === 1, `列表总数: 1`);
  assert(list.words[0].word === "sparingly", `列表包含 sparingly`);

  // 测试 9: vocab_remove_word
  console.log("\n测试 9: vocab_remove_word");
  const remove = await client.callTool("vocab_remove_word", { word: "sparingly" });
  assert(remove.success === true, `移除成功`);
  const status3 = await client.callTool("vocab_get_status");
  assert(status3.total_words === 0, `移除后总词数: 0`);

  // 测试 10: vocab_remove_word (不存在的词)
  console.log("\n测试 10: vocab_remove_word (不存在的词)");
  const removeNonExist = await client.callTool("vocab_remove_word", { word: "nonexistent" });
  assert(removeNonExist.success === false, `移除不存在的词返回 false`);

  // 测试 11: vocab_get_word_detail (不存在的词)
  console.log("\n测试 11: vocab_get_word_detail (不存在的词)");
  const detailNonExist = await client.callTool("vocab_get_word_detail", { word: "nonexistent" });
  assert(detailNonExist.error !== undefined, `不存在的词返回 error`);

  client.stop();
  teardownTestData();

  console.log("\n" + "=".repeat(50));
  console.log(`MCP 集成测试: ✅ ${passed} 通过, ❌ ${failed} 失败`);
  console.log("=".repeat(50));
  return failed === 0;
}

const success = await runTests();
process.exit(success ? 0 : 1);
