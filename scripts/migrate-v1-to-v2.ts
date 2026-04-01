#!/usr/bin/env bun
/**
 * 数据迁移脚本: v1 → v2
 *
 * 迁移内容:
 * 1. interval_days (天) → interval_minutes (分钟)
 * 2. next_review 日期格式 → ISO8601 datetime 格式
 * 3. level 5 (max) → 保持 level 5 (新算法 level 0-4 对应原 level 0-4, level 5 对应新 level 4)
 *    注: 旧算法 level 0-5 共6级，新算法 level 0-9 共10级
 *    映射: 旧 level 0-4 → 新 level 0-4, 旧 level 5 → 新 level 4
 * 4. last_review_date 日期格式 → ISO8601 datetime 格式
 *
 * 使用方法:
 *   bun run scripts/migrate-v1-to-v2.ts
 *
 * 警告: 建议在运行前备份数据！
 */

import { Database } from "bun:sqlite";
import { existsSync, cpSync } from "fs";

const DATA_PATH = process.env.VOCAB_DATA_PATH || `${process.env.HOME}/.vocab-trainer/words.db`;

function getToday(): string {
  return new Date().toISOString();
}

function daysToMinutes(days: number): number {
  return days * 1440;
}

function migrateDatabase(dbPath: string): void {
  console.log(`\n📦 迁移数据库: ${dbPath}`);

  // 检查文件是否存在
  if (!existsSync(dbPath)) {
    console.log(`❌ 数据库文件不存在: ${dbPath}`);
    return;
  }

  // 备份
  const backupPath = `${dbPath}.backup.${Date.now()}`;
  console.log(`💾 创建备份: ${backupPath}`);
  cpSync(dbPath, backupPath);

  const db = new Database(dbPath);

  // 检查 schema 版本
  const stats = db.query("SELECT * FROM stats WHERE id = 1").get() as any;
  if (stats?.version >= 2) {
    console.log(`✅ 数据库已经是 v${stats.version}，无需迁移`);
    db.close();
    return;
  }

  console.log(`\n🔄 开始迁移 v1 → v2...`);

  // 检查是否有 interval_minutes 列
  const cols = db.query("PRAGMA table_info(words)").all() as any[];
  const hasIntervalMinutes = cols.some(c => c.name === 'interval_minutes');

  if (!hasIntervalMinutes) {
    console.log(`📝 添加 interval_minutes 列...`);
    db.exec("ALTER TABLE words ADD COLUMN interval_minutes INTEGER");
  }

  // 迁移 words 表
  console.log(`📝 迁移 words 表...`);
  const words = db.query("SELECT * FROM words").all() as any[];

  for (const word of words) {
    // 转换 interval_days → interval_minutes
    const intervalMinutes = word.interval_minutes || daysToMinutes(word.interval_days || 1);

    // 转换 next_review (如果是旧格式 YYYY-MM-DD，添加时间部分)
    let nextReview = word.next_review;
    if (nextReview && !nextReview.includes('T')) {
      nextReview = `${nextReview}T00:00:00.000Z`;
    }

    // 映射 level: 旧 5 → 新 4 (因为新算法有更多级别)
    let level = word.level;
    if (level > 4) {
      level = 4; // 旧 level 5 (max) → 新 level 4
    }

    db.query(`
      UPDATE words SET
        interval_minutes = ?,
        next_review = ?,
        level = ?
      WHERE id = ?
    `).run(intervalMinutes, nextReview, level, word.id);

    console.log(`   ${word.word}: level ${word.level} → ${level}, interval ${word.interval_days}d → ${intervalMinutes}min`);
  }

  // 迁移 stats 表
  console.log(`📝 迁移 stats 表...`);
  let lastReviewDate = stats?.last_review_date;
  if (lastReviewDate && !lastReviewDate.includes('T')) {
    lastReviewDate = `${lastReviewDate}T00:00:00.000Z`;
  }

  db.query(`
    UPDATE stats SET
      version = 2,
      last_review_date = ?
    WHERE id = 1
  `).run(lastReviewDate || null);

  console.log(`✅ 迁移完成!`);
  console.log(`\n📊 迁移统计:`);
  console.log(`   - 迁移单词数: ${words.length}`);
  console.log(`   - 迁移后版本: 2`);

  db.close();
}

// 主流程
console.log("═══════════════════════════════════════");
console.log("   Vocab-Trainer 数据迁移 v1 → v2");
console.log("═══════════════════════════════════════");

migrateDatabase(DATA_PATH);

console.log("\n🎉 迁移完成!");
console.log("\n提示:");
console.log("  - 备份文件位于:", `${DATA_PATH}.backup.*`);
console.log("  - 新间隔序列: [20分钟, 1小时, 4小时, 12小时, 1天, 2天, 7天, 15天, 30天]");
console.log("  - fail 行为: 重置到 level 0");
console.log("  - fuzzy 行为: interval ÷3");
console.log("  - streak 行为: 24小时内有复习即连续");
