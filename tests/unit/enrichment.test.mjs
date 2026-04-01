#!/usr/bin/env bun
/**
 * 扩展信息（enrichment）单元测试
 * 测试 variant 数组格式的存储、检索和向后兼容性
 */
import { createStorage, createStorageFromEnv, closeDb } from "../../packages/vocab-core/src/storage.js";
import { getNow } from "../../packages/vocab-core/src/algorithm.js";
import { setupTestData, teardownTestData, writeTestData, readTestData } from "../helpers/data-env.mjs";

console.log("=== 扩展信息单元测试 ===\n");

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

const testWordBase = {
  word: "walk",
  meaning: "行走",
  phonetic: "/wɔːk/",
  pos: "v",
  example: "I walk to school.",
  example_cn: "我走路去学校。",
  source: "test",
  added: nowStr,
  level: 0,
  next_review: nowStr,
  interval_minutes: 20,
  error_count: 0,
  review_count: 0,
  history: [],
  prototype: "Proto-Germanic *walkjan",
  etymology: "源自古英语 wealcan"
};

// Variant array format (new)
const variantArray = [
  { form: "past", value: "walked" },
  { form: "pp", value: "walked" },
  { form: "ing", value: "walking" },
  { form: "3rd", value: "walks" }
];

async function runTests() {
  setupTestData();
  teardownTestData(); // Clean up any existing test data first

  // Re-set environment after teardown
  const { randomUUID } = await import("crypto");
  const DATA_DIR = `${process.env.HOME}/.vocab-trainer`;
  const TEST_ID = randomUUID();
  const TEST_DATA_FILE = `${DATA_DIR}/words.test.${TEST_ID}.db`;
  process.env.VOCAB_DATA_PATH = TEST_DATA_FILE;
  closeDb();

  const storage = createStorageFromEnv();

  // 测试 1: addWord with variant array
  console.log("测试 1: addWord() with variant array");
  const wordWithVariant = { ...testWordBase, variant: variantArray };
  storage.addWord(wordWithVariant);
  const fetched = storage.getWord("walk");
  assert(fetched !== undefined, "添加带 variant 数组的词成功");
  assert(Array.isArray(fetched?.variant), "variant 是数组类型");
  assert(fetched?.variant.length === 4, `variant 数组长度为 4，实际: ${fetched?.variant.length}`);
  assert(fetched?.variant[0].form === "past", "variant[0].form 为 'past'");
  assert(fetched?.variant[0].value === "walked", "variant[0].value 为 'walked'");

  // 测试 2: updateWord with variant array
  console.log("\n测试 2: updateWord() with variant array");
  const newVariant = [
    { form: "past", value: "walked" },
    { form: "adj", value: "walkable" }
  ];
  storage.updateWord("walk", { variant: newVariant });
  const updated = storage.getWord("walk");
  assert(updated?.variant.length === 2, `update 后 variant 长度为 2，实际: ${updated?.variant.length}`);
  assert(updated?.variant[1].form === "adj", "update 后 variant[1].form 为 'adj'");

  // 测试 3: updateWordEnrich with variant array
  console.log("\n测试 3: updateWordEnrich() with variant array");
  const enrichData = {
    prototype: "Proto-Germanic *walkjan",
    variant: [
      { form: "past", value: "walked" },
      { form: "ing", value: "walking" }
    ],
    etymology: "源自古英语"
  };
  storage.updateWordEnrich("walk", enrichData);
  const enriched = storage.getWord("walk");
  assert(enriched?.prototype === "Proto-Germanic *walkjan", "prototype 更新正确");
  assert(enriched?.variant.length === 2, `updateWordEnrich 后 variant 长度为 2，实际: ${enriched?.variant.length}`);
  assert(enriched?.etymology === "源自古英语", "etymology 更新正确");

  // 测试 4: Backward compatibility - old string variant format
  console.log("\n测试 4: Backward compatibility - old string variant format");
  // Manually insert a word with old string variant format
  closeDb();
  const { existsSync, unlinkSync } = await import("fs");
  if (existsSync(TEST_DATA_FILE)) {
    unlinkSync(TEST_DATA_FILE);
  }
  closeDb();

  // Create fresh storage with direct DB write for old format
  const db = await import("bun:sqlite");
  const testDb = new db.Database(TEST_DATA_FILE);
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL UNIQUE,
      word_lower TEXT NOT NULL,
      meaning TEXT DEFAULT '',
      phonetic TEXT DEFAULT '',
      pos TEXT DEFAULT '',
      example TEXT DEFAULT '',
      example_cn TEXT DEFAULT '',
      source TEXT DEFAULT 'user',
      added TEXT NOT NULL,
      level INTEGER DEFAULT 0,
      next_review TEXT NOT NULL,
      interval_minutes INTEGER DEFAULT 20,
      error_count INTEGER DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      history TEXT DEFAULT '[]',
      prototype TEXT DEFAULT '',
      variant TEXT DEFAULT '',
      etymology TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY DEFAULT 1,
      version INTEGER DEFAULT 2,
      streak INTEGER DEFAULT 0,
      last_review_date TEXT,
      total_reviews INTEGER DEFAULT 0
    );
    INSERT INTO stats (id, version, streak, total_reviews) VALUES (1, 2, 0, 0);
  `);

  // Insert word with old string variant format
  testDb.query(`
    INSERT INTO words (word, word_lower, meaning, phonetic, pos, example, example_cn, source, added, level, next_review, interval_minutes, error_count, review_count, history, prototype, variant, etymology)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "oldword", "oldword", "旧词", "/old/", "n", "Old example.", "旧例子。", "test",
    nowStr, 0, nowStr, 20, 0, 0, "[]",
    "old prototype", "past: walked, ing: walking", "old etymology"
  );
  testDb.close();
  closeDb();

  const storage2 = createStorageFromEnv();
  const oldWord = storage2.getWord("oldword");
  assert(oldWord !== undefined, "能读取旧格式 variant 的词");
  assert(Array.isArray(oldWord?.variant), "旧格式 variant 仍被解析为数组");
  assert(oldWord?.variant.length === 0, "旧字符串格式无法解析，返回空数组");

  // 测试 5: Empty variant handling
  console.log("\n测试 5: Empty variant handling");
  closeDb();
  if (existsSync(TEST_DATA_FILE)) {
    unlinkSync(TEST_DATA_FILE);
  }
  closeDb();

  const testDb2 = new db.Database(TEST_DATA_FILE);
  testDb2.exec(`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL UNIQUE,
      word_lower TEXT NOT NULL,
      meaning TEXT DEFAULT '',
      phonetic TEXT DEFAULT '',
      pos TEXT DEFAULT '',
      example TEXT DEFAULT '',
      example_cn TEXT DEFAULT '',
      source TEXT DEFAULT 'user',
      added TEXT NOT NULL,
      level INTEGER DEFAULT 0,
      next_review TEXT NOT NULL,
      interval_minutes INTEGER DEFAULT 20,
      error_count INTEGER DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      history TEXT DEFAULT '[]',
      prototype TEXT DEFAULT '',
      variant TEXT DEFAULT '',
      etymology TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY DEFAULT 1,
      version INTEGER DEFAULT 2,
      streak INTEGER DEFAULT 0,
      last_review_date TEXT,
      total_reviews INTEGER DEFAULT 0
    );
    INSERT INTO stats (id, version, streak, total_reviews) VALUES (1, 2, 0, 0);
  `);
  testDb2.query(`
    INSERT INTO words (word, word_lower, meaning, phonetic, pos, example, example_cn, source, added, level, next_review, interval_minutes, error_count, review_count, history, prototype, variant, etymology)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "emptyvar", "emptyvar", "空变体", "/empty/", "v", "Example.", "例子。", "test",
    nowStr, 0, nowStr, 20, 0, 0, "[]", "", "", ""
  );
  testDb2.close();
  closeDb();

  const storage3 = createStorageFromEnv();
  const emptyVarWord = storage3.getWord("emptyvar");
  assert(emptyVarWord !== undefined, "能读取空 variant 的词");
  assert(Array.isArray(emptyVarWord?.variant), "空 variant 被解析为数组");
  assert(emptyVarWord?.variant.length === 0, "空 variant 数组长度为 0");

  // 测试 6: addWord with empty variant array
  console.log("\n测试 6: addWord() with empty variant array");
  const emptyVariantWord = {
    ...testWordBase,
    word: "novariant",
    variant: []
  };
  storage3.addWord(emptyVariantWord);
  const noVarFetched = storage3.getWord("novariant");
  assert(noVarFetched?.variant.length === 0, "空 variant 数组添加成功");

  // 测试 7: Invalid JSON variant handling
  console.log("\n测试 7: Invalid JSON variant handling");
  closeDb();
  if (existsSync(TEST_DATA_FILE)) {
    unlinkSync(TEST_DATA_FILE);
  }
  closeDb();

  const testDb3 = new db.Database(TEST_DATA_FILE);
  testDb3.exec(`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL UNIQUE,
      word_lower TEXT NOT NULL,
      meaning TEXT DEFAULT '',
      phonetic TEXT DEFAULT '',
      pos TEXT DEFAULT '',
      example TEXT DEFAULT '',
      example_cn TEXT DEFAULT '',
      source TEXT DEFAULT 'user',
      added TEXT NOT NULL,
      level INTEGER DEFAULT 0,
      next_review TEXT NOT NULL,
      interval_minutes INTEGER DEFAULT 20,
      error_count INTEGER DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      history TEXT DEFAULT '[]',
      prototype TEXT DEFAULT '',
      variant TEXT DEFAULT '',
      etymology TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY DEFAULT 1,
      version INTEGER DEFAULT 2,
      streak INTEGER DEFAULT 0,
      last_review_date TEXT,
      total_reviews INTEGER DEFAULT 0
    );
    INSERT INTO stats (id, version, streak, total_reviews) VALUES (1, 2, 0, 0);
  `);
  testDb3.query(`
    INSERT INTO words (word, word_lower, meaning, phonetic, pos, example, example_cn, source, added, level, next_review, interval_minutes, error_count, review_count, history, prototype, variant, etymology)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "invalidvar", "invalidvar", "无效变体", "/invalid/", "v", "Example.", "例子。", "test",
    nowStr, 0, nowStr, 20, 0, 0, "[]", "", "{invalid json}", ""
  );
  testDb3.close();
  closeDb();

  const storage4 = createStorageFromEnv();
  const invalidVarWord = storage4.getWord("invalidvar");
  assert(invalidVarWord !== undefined, "能读取无效 variant 的词");
  assert(Array.isArray(invalidVarWord?.variant), "无效 JSON variant 被解析为数组");
  assert(invalidVarWord?.variant.length === 0, "无效 JSON variant 返回空数组");

  teardownTestData();

  console.log("\n" + "=".repeat(50));
  console.log(`扩展信息测试: ✅ ${passed} 通过, ❌ ${failed} 失败`);
  console.log("=".repeat(50));
  return failed === 0;
}

const success = await runTests();
process.exit(success ? 0 : 1);
