/**
 * 清理备份文件
 * 用法: bun run scripts/cleanup-backups.ts [--dry-run]
 *
 * 默认只保留 words.db，删除所有其他备份文件
 * 使用 --dry-run 可以预览要删除的文件而不实际删除
 */
import { existsSync, unlinkSync, readdirSync } from "fs";
import { join } from "path";

const DATA_DIR = `${process.env.HOME}/.vocab-trainer`;
const MAIN_DB = "words.db";

const isDryRun = process.argv.includes("--dry-run");

const files = readdirSync(DATA_DIR);
let deleteCount = 0;
let keepCount = 0;

console.log(`${isDryRun ? "[DRY RUN] 预览" : "执行清理"}: ${DATA_DIR}\n`);

for (const file of files) {
  if (file === MAIN_DB) {
    keepCount++;
    continue;
  }

  // 删除所有非正式数据库的文件
  const filePath = join(DATA_DIR, file);
  if (isDryRun) {
    console.log(`  删除: ${file}`);
    deleteCount++;
  } else {
    unlinkSync(filePath);
    console.log(`  已删除: ${file}`);
    deleteCount++;
  }
}

console.log(`\n完成: ${isDryRun ? "将删除" : "已删除"} ${deleteCount} 个文件, 保留 ${keepCount} 个文件`);
