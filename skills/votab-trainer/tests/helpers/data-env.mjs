/**
 * 测试数据环境助手 - 管理测试数据的隔离与恢复
 *
 * 每个测试文件使用独立的测试数据文件（通过 UUID 确保唯一），
 * 配合 storage.ts 的 getDataPath() 函数在运行时读取 VOCAB_DATA_PATH，
 * 实现测试数据与真实数据的完全隔离。
 *
 * 注意: storage.ts 已改用 SQLite (bun:sqlite)，所以使用 .db 扩展名
 */
import { existsSync, mkdirSync, unlinkSync, renameSync } from "fs";
import { randomUUID } from "crypto";
import { Database } from "bun:sqlite";
import { closeDb } from "../../dist/storage.js";

const DATA_DIR = `${process.env.HOME}/.vocab-trainer`;
const DEFAULT_DATA_FILE = `${DATA_DIR}/words.db`;

// 每个测试套件使用独立的测试数据文件（使用 UUID 确保唯一）
const TEST_ID = randomUUID();
export const TEST_DATA_FILE = `${DATA_DIR}/words.test.${TEST_ID}.db`;
const BACKUP_FILE = `${DATA_DIR}/words.db.backup.${TEST_ID}`;

// 立即设置环境变量，确保在任何模块加载前生效
process.env.VOCAB_DATA_PATH = TEST_DATA_FILE;

/**
 * 获取当前使用的数据文件路径
 */
export function getDataFilePath() {
  return process.env.VOCAB_DATA_PATH || DEFAULT_DATA_FILE;
}

/**
 * 设置测试环境 - 备份现有数据并创建空的测试数据库
 */
export function setupTestData() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  // 备份现有数据
  if (existsSync(DEFAULT_DATA_FILE)) {
    renameSync(DEFAULT_DATA_FILE, BACKUP_FILE);
    return true; // 有备份需要恢复
  }
  return false;
}

/**
 * 清理测试环境 - 删除测试数据并恢复备份
 */
export function teardownTestData(hadBackup) {
  // 删除测试数据文件
  if (existsSync(TEST_DATA_FILE)) {
    unlinkSync(TEST_DATA_FILE);
  }

  // 恢复备份（仅当有备份时才恢复）
  if (hadBackup && existsSync(BACKUP_FILE)) {
    renameSync(BACKUP_FILE, DEFAULT_DATA_FILE);
  }
}

/**
 * 重置测试数据库 - 创建新的空数据库并初始化 schema
 */
export function resetTestData() {
  // 关闭缓存的数据库连接，避免删除文件时连接失效
  closeDb();

  // 删除旧的测试数据库（如果存在）
  if (existsSync(TEST_DATA_FILE)) {
    unlinkSync(TEST_DATA_FILE);
  }

  // 创建新的测试数据库
  const db = new Database(TEST_DATA_FILE);

  // 初始化 schema
  db.exec(`
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
      interval_days INTEGER DEFAULT 1,
      error_count INTEGER DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      history TEXT DEFAULT '[]',
      prototype TEXT DEFAULT '',
      variant TEXT DEFAULT '',
      etymology TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY DEFAULT 1,
      version INTEGER DEFAULT 1,
      streak INTEGER DEFAULT 0,
      last_review_date TEXT,
      total_reviews INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_words_word_lower ON words(word_lower);
    CREATE INDEX IF NOT EXISTS idx_words_next_review ON words(next_review);
    CREATE INDEX IF NOT EXISTS idx_words_level ON words(level);
  `);

  // 初始化 stats 行
  db.query("INSERT INTO stats (id, version, streak, total_reviews) VALUES (1, 1, 0, 0)").run();

  db.close();
}

/**
 * 直接读取测试数据库中的所有词汇（用于测试辅助）
 */
export function readTestData() {
  const db = new Database(TEST_DATA_FILE);
  const words = db.query("SELECT * FROM words").all();
  const stats = db.query("SELECT * FROM stats WHERE id = 1").get();
  db.close();
  return { words, stats };
}

/**
 * 直接写入测试数据文件（用于测试辅助）
 * 使用单独的直接文件操作方式，避免与存储模块的缓存连接冲突
 */
export function writeTestData(data) {
  // 使用单独的连接来写入测试数据
  const db = new Database(TEST_DATA_FILE);

  // 清空现有数据
  db.exec("DELETE FROM words");
  db.exec("DELETE FROM stats WHERE id = 1");

  // 写入 stats
  if (data.stats) {
    db.query(`
      INSERT OR REPLACE INTO stats (id, version, streak, last_review_date, total_reviews)
      VALUES (1, ?, ?, ?, ?)
    `).run(data.stats.version, data.stats.streak, data.stats.last_review_date, data.stats.total_reviews);
  }

  // 写入 words
  if (data.words && data.words.length > 0) {
    for (const word of data.words) {
      db.query(`
        INSERT INTO words (word, word_lower, meaning, phonetic, pos, example, example_cn, source, added, level, next_review, interval_days, error_count, review_count, history, prototype, variant, etymology)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        word.word,
        word.word_lower || word.word.toLowerCase(),
        word.meaning || "",
        word.phonetic || "",
        word.pos || "",
        word.example || "",
        word.example_cn || "",
        word.source || "user",
        word.added,
        word.level || 0,
        word.next_review,
        word.interval_days || 1,
        word.error_count || 0,
        word.review_count || 0,
        typeof word.history === 'string' ? word.history : JSON.stringify(word.history || []),
        word.prototype || "",
        word.variant || "",
        word.etymology || ""
      );
    }
  }

  db.close();
}

/**
 * 获取今天的日期字符串
 */
export function getToday() {
  return new Date().toISOString().split("T")[0];
}
