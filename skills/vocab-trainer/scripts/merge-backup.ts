/**
 * 合并备份数据库到正式数据库
 * 用法: bun run scripts/merge-backup.ts <backup_db_path>
 *
 * 只会添加备份中存在但正式数据库中不存在的单词
 */
import { Database } from "bun:sqlite";
import { resolve } from "path";

const DATA_DIR = `${process.env.HOME}/.vocab-trainer`;
const MAIN_DB = `${DATA_DIR}/words.db`;

const backupPath = process.argv[2];
if (!backupPath) {
  console.error("用法: bun run scripts/merge-backup.ts <backup_db_path>");
  process.exit(1);
}

const backupDb = new Database(resolve(backupPath));
const mainDb = new Database(MAIN_DB);

// 获取备份中的所有单词
const backupWords = backupDb
  .query("SELECT word, word_lower, meaning, phonetic, pos, example, example_cn, source, added, level, next_review, interval_days, error_count, review_count, history, prototype, variant, etymology FROM words")
  .all() as any[];

// 获取正式数据库中的单词
const mainWords = mainDb.query("SELECT word_lower FROM words").all() as {
  word_lower: string;
}[];
const mainWordSet = new Set(mainWords.map((w) => w.word_lower));

// 统计需要合并的单词
let mergedCount = 0;
let skipCount = 0;

console.log(`备份数据库: ${backupPath}`);
console.log(`正式数据库: ${MAIN_DB}`);
console.log(`备份中单词数: ${backupWords.length}`);
console.log(`正式数据库单词数: ${mainWordSet.size}`);
console.log("");

for (const word of backupWords) {
  if (!mainWordSet.has(word.word_lower)) {
    // 单词不存在于正式数据库，添加
    mainDb.query(`
      INSERT INTO words (word, word_lower, meaning, phonetic, pos, example, example_cn, source, added, level, next_review, interval_days, error_count, review_count, history, prototype, variant, etymology)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      word.word,
      word.word_lower,
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
      word.history || "[]",
      word.prototype || "",
      word.variant || "",
      word.etymology || ""
    );
    console.log(`+ 添加: ${word.word} (level: ${word.level || 0})`);
    mergedCount++;
  } else {
    skipCount++;
  }
}

console.log("");
console.log(`完成: 添加 ${mergedCount} 个新单词, 跳过 ${skipCount} 个已存在`);

backupDb.close();
mainDb.close();
