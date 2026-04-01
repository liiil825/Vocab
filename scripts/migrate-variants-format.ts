/**
 * 迁移变体数据格式
 * 用法: MINIMAX_API_KEY=xxx bun run scripts/migrate-variants-format.ts [--dry-run]
 *
 * 将 variant 字段从字符串格式迁移到数组格式
 * 字符串格式: "past: walked, pp: walked, ing: walking"
 * 数组格式: [{"form": "past", "value": "walked"}, {"form": "pp", "value": "walked"}, {"form": "ing", "value": "walking"}]
 */
import { Database } from "bun:sqlite";

const DATA_DIR = `${process.env.HOME}/.vocab-trainer`;
const MAIN_DB = `${DATA_DIR}/words.db`;

interface VariantEntry {
  form: string;
  value: string;
}

interface ParseResult {
  variant: VariantEntry[];
}

function getMinimaxConfig() {
  const apiKey = Bun.env.MINIMAX_API_KEY;
  const baseUrl = Bun.env.MINIMAX_BASE_URL || "https://api.minimaxi.com";
  // Use high-speed model
  const model = "MiniMax-M2.5-highspeed";

  if (!apiKey) {
    throw new Error("MINIMAX_API_KEY environment variable is not set");
  }

  return { apiKey, baseUrl, model };
}

async function parseVariantToArray(word: string, variantString: string): Promise<VariantEntry[]> {
  const { apiKey, baseUrl, model } = getMinimaxConfig();

  const prompt = `将以下单词的变化形式字符串转换为JSON数组格式。

单词: ${word}
当前格式: "${variantString}"
目标格式: {"variant": [{"form": "形式（英文小写）", "value": "值（英文）"}]}

要求:
- form 使用英文小写，如 past, pp, ing, es, s, ed, ier, est 等
- value 使用英文原形
- 返回纯JSON，不要其他内容
- 如果无法解析，返回 {"variant": []}`;

  const response = await fetch(`${baseUrl}/v1/text/chatcompletion_v2`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", name: "MiniMax AI", content: "你是一个专业的英语词汇分析助手，擅长解析单词的变化形式。" },
        { role: "user", name: "用户", content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiniMax API error: ${response.status} ${errorText}`);
  }

  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(`MiniMax API returned no content`);
  }

  // Parse JSON from response
  let jsonStr = content.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const result = JSON.parse(jsonStr) as ParseResult;
    if (Array.isArray(result.variant)) {
      return result.variant.filter(v => v.form && v.value);
    }
    return [];
  } catch {
    // Try to fix truncated JSON
    const lastBrace = jsonStr.lastIndexOf('}');
    if (lastBrace > 0) {
      try {
        const result = JSON.parse(jsonStr.slice(0, lastBrace + 1)) as ParseResult;
        if (Array.isArray(result.variant)) {
          return result.variant.filter(v => v.form && v.value);
        }
        return [];
      } catch {
        // fall through
      }
    }
    throw new Error(`Failed to parse response as JSON: ${jsonStr.slice(0, 200)}`);
  }
}

function isStringVariant(value: string): boolean {
  // Check if the variant is a plain string (old format) rather than a JSON array
  if (!value) return false;
  const trimmed = value.trim();
  // If it starts with '[', it's already JSON array
  if (trimmed.startsWith('[')) return false;
  // If it looks like JSON object, it's not a plain string
  if (trimmed.startsWith('{')) return false;
  // Plain strings typically contain colons, commas like "past: walked, pp: walked"
  return true;
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const isVerbose = process.argv.includes("--verbose");

  if (!Bun.env.MINIMAX_API_KEY) {
    console.error("错误: 需要设置 MINIMAX_API_KEY 环境变量");
    console.error("用法: bun run scripts/migrate-variants-format.ts [--dry-run] [--verbose]");
    console.error("或者在 .env 文件中设置 MINIMAX_API_KEY");
    process.exit(1);
  }

  const db = new Database(MAIN_DB);

  // Find words with string-format variant (not JSON array)
  const words = db.query(`
    SELECT id, word, variant
    FROM words
    WHERE variant IS NOT NULL AND variant != '' AND variant != '[]'
  `).all() as any[];

  const wordsNeedingMigration: { id: number; word: string; variant: string }[] = [];

  for (const w of words) {
    if (isStringVariant(w.variant)) {
      wordsNeedingMigration.push({ id: w.id, word: w.word, variant: w.variant });
    }
  }

  console.log(`找到 ${wordsNeedingMigration.length} 个需要迁移的单词\n`);

  if (isDryRun) {
    console.log("[DRY RUN] 预览将要迁移的单词:\n");
    for (const w of wordsNeedingMigration.slice(0, 10)) {
      console.log(`  ${w.word}: "${w.variant}"`);
    }
    if (wordsNeedingMigration.length > 10) {
      console.log(`  ... 还有 ${wordsNeedingMigration.length - 10} 个`);
    }
    console.log("\n使用 --dry-run 跳过实际更新");
    db.close();
    return;
  }

  // Process each word
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const w of wordsNeedingMigration) {
    console.log(`处理: ${w.word}`);
    if (isVerbose) {
      console.log(`  原始: "${w.variant}"`);
    }

    try {
      const parsed = await parseVariantToArray(w.word, w.variant);

      if (parsed.length > 0) {
        const jsonVariant = JSON.stringify(parsed);
        db.query(`UPDATE words SET variant = ? WHERE id = ?`).run(jsonVariant, w.id);
        console.log(`  ✅ 已迁移为 ${parsed.length} 个变体`);
        if (isVerbose) {
          console.log(`  新格式: ${jsonVariant}`);
        }
        updated++;
      } else {
        console.log(`  ⚠️ 解析结果为空，跳过`);
        skipped++;
      }

      // Rate limiting - wait a bit between requests
      await new Promise(r => setTimeout(r, 500));

    } catch (err) {
      console.log(`  ❌ 错误: ${(err as Error).message}`);
      errors++;
    }
  }

  console.log(`\n完成: 成功迁移 ${updated} 个单词, 跳过 ${skipped} 个, ${errors} 个错误`);

  db.close();
}

main().catch(console.error);
