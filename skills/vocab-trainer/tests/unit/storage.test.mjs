#!/usr/bin/env bun
/**
 * 存储层单元测试 v2
 */
import { createStorage, createStorageFromEnv, closeDb } from "../../packages/vocab-core/src/storage.js";
import { getNow, addMinutes } from "../../packages/vocab-core/src/algorithm.js";
import { setupTestData, teardownTestData, resetTestData, readTestData } from "../helpers/data-env.mjs";

console.log("=== 存储层单元测试 v2 ===\n");

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

const nowStr = getNow();
const testWord = {
  word: "testword",
  meaning: "测试单词",
  phonetic: "/test/",
  pos: "n",
  example: "This is a test.",
  example_cn: "这是一个测试。",
  source: "test",
  added: nowStr,
  level: 0,
  next_review: nowStr,
  interval_minutes: 20,
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
  const updated = storage.updateWord("word1", { level: 3, interval_minutes: 240 });
  assert(updated?.level === 3, "level 更新为 3");
  assert(updated?.interval_minutes === 240, "interval_minutes 更新为 240");
  const verifyUpdate = storage.getWord("word1");
  assert(verifyUpdate?.level === 3, "持久化验证 level");
  assert(verifyUpdate?.interval_minutes === 240, "持久化验证 interval_minutes");

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

  // 测试 8: getDueWords (datetime 比较)
  console.log("\n测试 8: getDueWords()");
  const pastTime = addMinutes(getNow(), -60); // 1小时前 (已到期)
  const futureTime = addMinutes(getNow(), 1440); // 24小时后 (未到期)
  storage.addWord({ ...testWord, word: "dueword", next_review: pastTime, interval_minutes: 20 });
  storage.addWord({ ...testWord, word: "futureword", next_review: futureTime, interval_minutes: 1440 });
  const due = storage.getDueWords();
  assert(due.length === 1, "有 1 个到期词");
  assert(due[0].word === "dueword", "到期的词正确");

  // 测试 9: getWordsByFilter
  console.log("\n测试 9: getWordsByFilter()");
  storage.addWord({ ...testWord, word: "new1", level: 0, next_review: pastTime });
  storage.addWord({ ...testWord, word: "learn1", level: 2, next_review: pastTime });
  storage.addWord({ ...testWord, word: "learn2", level: 4, next_review: pastTime });
  storage.addWord({ ...testWord, word: "hard1", level: 1, error_count: 2, next_review: pastTime });
  storage.addWord({ ...testWord, word: "master1", level: 8, next_review: pastTime });
  storage.addWord({ ...testWord, word: "master2", level: 9, next_review: pastTime });

  assert(storage.getWordsByFilter("new").length === 3, `new 筛选: 3 个 (level=0: dueword, futureword, new1)`);
  assert(storage.getWordsByFilter("learning").length === 3, `learning 筛选: 3 个 (level 1-4: learn1, learn2, hard1)`);
  assert(storage.getWordsByFilter("hard").length === 1, "hard 筛选: 1 个 (level <=2 且有错误: hard1)");
  assert(storage.getWordsByFilter("mastered").length === 2, "mastered 筛选: 2 个 (level >=8: master1, master2)");
  assert(storage.getWordsByFilter("all").length === 8, `all 筛选: 8 个`);

  teardownTestData();

  console.log("\n" + "=".repeat(50));
  console.log(`存储层测试: ✅ ${passed} 通过, ❌ ${failed} 失败`);
  console.log("=".repeat(50));
  return failed === 0;
}

const success = await runTests();
process.exit(success ? 0 : 1);
