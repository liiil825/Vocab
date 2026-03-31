/**
 * 补全单词数据
 * 用法: MINIMAX_API_KEY=xxx bun run scripts/enrich-words.ts [--dry-run]
 *
 * 通过 MiniMax LLM API 补全单词的 meaning, phonetic, example, example_cn,
 * prototype, variant, etymology 字段
 */
import { Database } from "bun:sqlite";

const DATA_DIR = `${process.env.HOME}/.vocab-trainer`;
const MAIN_DB = `${DATA_DIR}/words.db`;

interface EnrichResult {
  meaning?: string;
  phonetic?: string;
  example?: string;
  example_cn?: string;
  prototype?: string;
  variant?: string;
  etymology?: string;
}

function getMinimaxConfig() {
  const apiKey = process.env.MINIMAX_API_KEY;
  const baseUrl = process.env.MINIMAX_BASE_URL || "https://api.minimax.com";
  const model = process.env.MINIMAX_MODEL || "MiniMax-Text-01";

  if (!apiKey) {
    throw new Error("MINIMAX_API_KEY environment variable is not set");
  }

  return { apiKey, baseUrl, model };
}

async function enrichWord(word: string, missingFields: string[]): Promise<Partial<EnrichResult>> {
  const { apiKey, baseUrl, model } = getMinimaxConfig();

  // Determine which fields to request
  const needsBasic = missingFields.some(f => ['meaning', 'phonetic', 'example', 'example_cn'].includes(f));
  const needsExtra = missingFields.some(f => ['prototype', 'variant', 'etymology'].includes(f));

  let prompt = "";
  if (needsBasic && needsExtra) {
    prompt = `分析英语单词 "${word}"，返回JSON格式的中文解释：
{
  "meaning": "中文含义",
  "phonetic": "音标，如 /test/",
  "example": "英文例句",
  "example_cn": "例句中文翻译",
  "prototype": "词根词源",
  "variant": "同根词/变体",
  "etymology": "词源说明"
}`;
  } else if (needsBasic) {
    prompt = `分析英语单词 "${word}"，返回JSON格式的中文解释：
{
  "meaning": "中文含义",
  "phonetic": "音标，如 /test/",
  "example": "英文例句",
  "example_cn": "例句中文翻译"
}`;
  } else {
    prompt = `分析英语单词 "${word}"，返回JSON格式：
{
  "prototype": "词根词源",
  "variant": "同根词/变体",
  "etymology": "词源说明"
}`;
  }

  const response = await fetch(`${baseUrl}/v1/text/chatcompletion_v2`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", name: "MiniMax AI", content: "你是一个专业的英语词汇分析助手。" },
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
    return JSON.parse(jsonStr);
  } catch {
    // Try to fix truncated JSON
    const lastBrace = jsonStr.lastIndexOf('}');
    if (lastBrace > 0) {
      try {
        return JSON.parse(jsonStr.slice(0, lastBrace + 1));
      } catch {
        throw new Error(`Failed to parse response as JSON: ${jsonStr.slice(0, 200)}`);
      }
    }
    throw new Error(`Failed to parse response as JSON: ${jsonStr.slice(0, 200)}`);
  }
}

// Convert arrays/objects to strings for database storage
function normalizeValue(val: any): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (Array.isArray(val)) return val.join(", ");
  return JSON.stringify(val);
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  if (!process.env.MINIMAX_API_KEY) {
    console.error("错误: 需要设置 MINIMAX_API_KEY 环境变量");
    console.error("用法: MINIMAX_API_KEY=xxx bun run scripts/enrich-words.ts [--dry-run]");
    process.exit(1);
  }

  const db = new Database(MAIN_DB);

  // Find incomplete words
  const words = db.query(`
    SELECT id, word, meaning, phonetic, example, example_cn, prototype, variant, etymology
    FROM words
  `).all() as any[];

  const incompleteWords: { id: number; word: string; missingFields: string[] }[] = [];

  for (const w of words) {
    const missingFields: string[] = [];
    if (!w.meaning) missingFields.push('meaning');
    if (!w.phonetic) missingFields.push('phonetic');
    if (!w.example) missingFields.push('example');
    if (!w.example_cn) missingFields.push('example_cn');
    if (!w.prototype) missingFields.push('prototype');
    if (!w.variant) missingFields.push('variant');
    if (!w.etymology) missingFields.push('etymology');

    if (missingFields.length > 0) {
      incompleteWords.push({ id: w.id, word: w.word, missingFields });
    }
  }

  console.log(`找到 ${incompleteWords.length} 个数据不全的单词\n`);

  if (isDryRun) {
    console.log("[DRY RUN] 预览将要补全的单词:\n");
    for (const w of incompleteWords) {
      console.log(`  ${w.word}: 缺少 ${w.missingFields.join(', ')}`);
    }
    console.log("\n使用 --dry-run 跳过实际更新");
    db.close();
    return;
  }

  // Process each incomplete word
  let updated = 0;
  let errors = 0;

  for (const w of incompleteWords) {
    console.log(`处理: ${w.word} (缺少 ${w.missingFields.join(', ')})`);

    try {
      const enrichment = await enrichWord(w.word, w.missingFields);

      // Build update query dynamically based on what we got
      const updates: string[] = [];
      const values: any[] = [];

      if (enrichment.meaning && w.missingFields.includes('meaning')) {
        updates.push('meaning = ?');
        values.push(normalizeValue(enrichment.meaning));
      }
      if (enrichment.phonetic && w.missingFields.includes('phonetic')) {
        updates.push('phonetic = ?');
        values.push(normalizeValue(enrichment.phonetic));
      }
      if (enrichment.example && w.missingFields.includes('example')) {
        updates.push('example = ?');
        values.push(normalizeValue(enrichment.example));
      }
      if (enrichment.example_cn && w.missingFields.includes('example_cn')) {
        updates.push('example_cn = ?');
        values.push(normalizeValue(enrichment.example_cn));
      }
      if (enrichment.prototype && w.missingFields.includes('prototype')) {
        updates.push('prototype = ?');
        values.push(normalizeValue(enrichment.prototype));
      }
      if (enrichment.variant && w.missingFields.includes('variant')) {
        updates.push('variant = ?');
        values.push(normalizeValue(enrichment.variant));
      }
      if (enrichment.etymology && w.missingFields.includes('etymology')) {
        updates.push('etymology = ?');
        values.push(normalizeValue(enrichment.etymology));
      }

      if (updates.length > 0) {
        values.push(w.id);
        // Ensure all values are strings or null (SQLite doesn't accept undefined)
        const safeValues = values.map(v => v == null ? null : String(v));
        db.query(`UPDATE words SET ${updates.join(', ')} WHERE id = ?`).run(...safeValues);
        console.log(`  ✅ 已更新: ${updates.join(', ')}`);
        updated++;
      } else {
        console.log(`  ⚠️ LLM 未返回任何可用数据`);
      }

      // Rate limiting - wait a bit between requests
      await new Promise(r => setTimeout(r, 500));

    } catch (err) {
      console.log(`  ❌ 错误: ${(err as Error).message}`);
      errors++;
    }
  }

  console.log(`\n完成: 成功更新 ${updated} 个单词, ${errors} 个错误`);

  db.close();
}

main().catch(console.error);
