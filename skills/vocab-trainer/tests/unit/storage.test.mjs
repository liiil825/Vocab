#!/usr/bin/env bun
/**
 * 存储层单元测试
 */
import { createStorage, createStorageFromEnv, closeDb } from "../../packages/vocab-core/src/storage.js";
import { getToday, addDays } from "../../packages/vocab-core/src/algorithm.js";
import { setupTestData, teardownTestData, resetTestData, readTestData } from "../helpers/data-env.mjs";

console.log("=== 存储层单元测试 ===\n");

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

const testWord = {
  word: "testword",
  meaning: "测试单词",
  phonetic: "/test/",
  pos: "n",
  example: "This is a test.",
  example_cn: "这是一个测试。",
  source: "test",
  added: getToday(),
  level: 0,
  next_review: getToday(),
  interval_days: 1,
  error_count: 0,
  review_count: 0,
  history: []
};

async function runTests() {
  setupTestData();
  resetTestData();

  // Get storage instance for tests
  const storage = createStorageFromEnv();

  // 测试 1: 初始状态
  console.log("测试 1: 初始状态");
  const initial = storage.loadData();
  assert(initial.words.length === 0, "初始词库为空");
  assert(initial.streak === 0, "初始 streak 为 0");

  // 测试 2: addWord
  console.log("\n测试 2: addWord()");
  storage.addWord({ ...testWord, word: "word1" });
  const afterAdd = storage.loadData();
  assert(afterAdd.words.length === 1, "添加后有 1 个词");
  assert(afterAdd.words[0].word === "word1", "添加的词正确");

  // 测试 3: getWord
  console.log("\n测试 3: getWord()");
  const found = storage.getWord("word1");
  assert(found !== undefined, "找到已添加的词");
  assert(found?.word === "word1", "返回的词正确");
  const notFound = storage.getWord("nonexistent");
  assert(notFound === undefined, "不存在的词返回 undefined");

  // 测试 4: 大小写不敏感
  console.log("\n测试 4: 大小写不敏感");
  const caseInsensitive = storage.getWord("WORD1");
  assert(caseInsensitive?.word === "word1", "大写也能找到");

  // 测试 5: updateWord
  console.log("\n测试 5: updateWord()");
  const updated = storage.updateWord("word1", { level: 3, interval_days: 7 });
  assert(updated?.level === 3, "level 更新为 3");
  assert(updated?.interval_days === 7, "interval_days 更新为 7");
  const verifyUpdate = storage.getWord("word1");
  assert(verifyUpdate?.level === 3, "持久化验证 level");
  assert(verifyUpdate?.interval_days === 7, "持久化验证 interval_days");

  // 测试 6: updateWord 不存在的词
  console.log("\n测试 6: updateWord() 不存在的词");
  const updateNonExist = storage.updateWord("nonexistent", { level: 5 });
  assert(updateNonExist === undefined, "不存在的词返回 undefined");

  // 测试 7: removeWord
  console.log("\n测试 7: removeWord()");
  const removeResult = storage.removeWord("word1");
  assert(removeResult === true, "移除成功返回 true");
  const afterRemove = storage.loadData();
  assert(afterRemove.words.length === 0, "移除后词库为空");
  const removeNonExist = storage.removeWord("nonexistent");
  assert(removeNonExist === false, "移除不存在的词返回 false");

  // 测试 8: getDueWords
  console.log("\n测试 8: getDueWords()");
  storage.addWord({ ...testWord, word: "dueword", next_review: getToday() });
  storage.addWord({ ...testWord, word: "futureword", next_review: "2099-01-01" });
  const due = storage.getDueWords();
  assert(due.length === 1, "有 1 个到期词");
  assert(due[0].word === "dueword", "到期的词正确");

  // 测试 9: getWordsByFilter
  console.log("\n测试 9: getWordsByFilter()");
  storage.addWord({ ...testWord, word: "new1", level: 0 });
  storage.addWord({ ...testWord, word: "learn1", level: 2 });
  storage.addWord({ ...testWord, word: "hard1", level: 1, error_count: 2 });
  storage.addWord({ ...testWord, word: "master1", level: 5 });

  assert(storage.getWordsByFilter("new").length === 3, `new 筛选: 3 个`);
  assert(storage.getWordsByFilter("learning").length === 2, `learning 筛选: 2 个`);
  assert(storage.getWordsByFilter("hard").length === 1, "hard 筛选: 1 个");
  assert(storage.getWordsByFilter("mastered").length === 1, "mastered 筛选: 1 个");
  assert(storage.getWordsByFilter("all").length === 6, `all 筛选: 6 个`);

  teardownTestData();

  console.log("\n" + "=".repeat(50));
  console.log(`存储层测试: ✅ ${passed} 通过, ❌ ${failed} 失败`);
  console.log("=".repeat(50));
  return failed === 0;
}

const success = await runTests();
process.exit(success ? 0 : 1);
