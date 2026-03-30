/**
 * 测试数据环境助手 - 管理测试数据的隔离与恢复
 *
 * 每个测试文件使用独立的测试数据文件（通过 UUID 确保唯一），
 * 配合 storage.ts 的 getDataPath() 函数在运行时读取 VOCAB_DATA_PATH，
 * 实现测试数据与真实数据的完全隔离。
 */
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { randomUUID } from "crypto";

const DATA_DIR = `${process.env.HOME}/.vocab-trainer`;
const DEFAULT_DATA_FILE = `${DATA_DIR}/words.json`;

// 每个测试套件使用独立的测试数据文件（使用 UUID 确保唯一）
const TEST_ID = randomUUID();
export const TEST_DATA_FILE = `${DATA_DIR}/words.test.${TEST_ID}.json`;
const BACKUP_FILE = `${DATA_DIR}/words.json.backup.${TEST_ID}`;

// 立即设置环境变量，确保在任何模块加载前生效
process.env.VOCAB_DATA_PATH = TEST_DATA_FILE;

/**
 * 获取当前使用的数据文件路径
 */
export function getDataFilePath() {
  return process.env.VOCAB_DATA_PATH || DEFAULT_DATA_FILE;
}

/**
 * 设置测试环境 - 备份现有数据并创建空的测试数据文件
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
 * 重置测试数据文件为空
 */
export function resetTestData() {
  const emptyData = {
    version: 1,
    streak: 0,
    last_review_date: null,
    total_reviews: 0,
    words: []
  };
  writeFileSync(TEST_DATA_FILE, JSON.stringify(emptyData, null, 2));
}

/**
 * 直接读取测试数据文件（用于测试辅助）
 */
export function readTestData() {
  return JSON.parse(readFileSync(TEST_DATA_FILE, "utf-8"));
}

/**
 * 直接写入测试数据文件（用于测试辅助）
 */
export function writeTestData(data) {
  writeFileSync(TEST_DATA_FILE, JSON.stringify(data, null, 2));
}

/**
 * 获取今天的日期字符串
 */
export function getToday() {
  return new Date().toISOString().split("T")[0];
}
