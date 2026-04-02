import type { EnrichResult } from "vocab-core/types";

function getMinimaxConfig() {
  const apiKey = Bun.env.MINIMAX_API_KEY;
  const baseUrl = Bun.env.MINIMAX_BASE_URL || "https://api.minimaxi.com";
  const model = Bun.env.MINIMAX_MODEL || "MiniMax-M2.7";

  if (!apiKey) {
    throw new Error("MINIMAX_API_KEY environment variable is not set");
  }

  return { apiKey, baseUrl, model };
}

const ENRICHMENT_EXAMPLES = `
【好示例】
单词: scrutinize
{
  "prototype": "scrutin- (查看) + -ize (使...)",
  "variant": [
    {"form": "过去式", "value": "scrutinized"},
    {"form": "进行式", "value": "scrutinizing"},
    {"form": "第三人称单数", "value": "scrutinizes"}
  ],
  "etymology": "源自拉丁语 scrutari（仔细检查），16世纪进入英语",
  "examples": [
    {"en": "The detective scrutinized the evidence for any clues.", "cn": "侦探仔细检查证据寻找线索。"},
    {"en": "She scrutinized the contract before signing it.", "cn": "她在签合同前仔细审阅了条款。"},
    {"en": "His work was scrutinized by the committee.", "cn": "他的工作受到了委员会的仔细审查。"}
  ],
  "collocations": ["scrutinize closely", "scrutinize carefully", "scrutinize every detail", "subject to scrutiny"],
  "synonyms": ["examine", "inspect", "analyze", "investigate"],
  "antonyms": ["ignore", "overlook", "neglect"]
}

【坏示例】
单词: scrutinize
{
  "prototype": "scrutinize",
  "variant": [],
  "etymology": "来历不明",
  "examples": [
    {"en": "He scrutinized.", "cn": "他仔细检查。"},
    {"en": "She scrutinized.", "cn": "她仔细检查。"},
    {"en": "They scrutinized.", "cn": "他们仔细检查。"}
  ],
  "collocations": ["look at"],
  "synonyms": ["see", "look"],
  "antonyms": []
}

【质量标准】
✅ 要做到：
- 例句必须包含单词在真实语境中的使用，句子内容各不相同
- 词根词源要有来源（拉丁语/希腊语/古英语等）和历史时期
- 变体要包含常见形式（过去式、进行式、第三人称单数等）
- 搭配要自然且实用
- 近义词要有相近的语义和使用场景
- **en 字段必须是纯英文，不含任何中文字符**
- **cn 字段必须是纯中文，不含任何英文字母**

❌ 避免：
- 例句只是"主语+动词"的空洞结构
- 词源含糊其辞（"来历不明"）或编造
- 变体列表为空或不相关
- 搭配过于基础（look at, go to）
- 近义词过于笼统
- **en 字段混入中文，或 cn 字段混入英文**
`;

export async function enrichWord(word: string): Promise<EnrichResult> {
  const { apiKey, baseUrl, model } = getMinimaxConfig();

  const prompt = `分析单词 "${word}"，返回高质量的JSON格式扩展信息。

${ENRICHMENT_EXAMPLES}

请严格按照上述JSON格式返回，确保：
1. examples数组恰好3个例句，每个例句的en和cn字段都要有内容
2. collocations数组2-5个常用搭配
3. synonyms数组2-4个近义词（选择语义最接近的）
4. antonyms数组1-3个反义词（如果没有合适的可为空数组）
5. etymology要有具体来源和历史，不要"来历不明"或"无法确定"
6. prototype要展示词根分解，不要只重复单词本身`;

  const response = await fetch(`${baseUrl}/v1/text/chatcompletion_v2`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      messages: [
        { role: "system", name: "MiniMax AI", content: "你是一个专业的英语词汇学家，为单词生成高质量学习材料。" },
        { role: "user", name: "用户", content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiniMax API error: ${response.status} ${errorText}`);
  }

  const data = await response.json() as any;

  // MiniMax-M2.7 returns: { choices: [{ message: { content: "..." } }] }
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(`MiniMax API returned no content: ${JSON.stringify(data).slice(0, 200)}`);
  }

  // Parse JSON from response
  // The model might wrap the JSON in markdown code blocks
  let jsonStr = content.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const result = JSON.parse(jsonStr) as EnrichResult;
    return {
      prototype: result.prototype || "",
      variant: Array.isArray(result.variant) ? result.variant : [],
      etymology: result.etymology || "",
      examples: Array.isArray(result.examples) ? result.examples : [],
      collocations: Array.isArray(result.collocations) ? result.collocations : [],
      synonyms: Array.isArray(result.synonyms) ? result.synonyms : [],
      antonyms: Array.isArray(result.antonyms) ? result.antonyms : []
    };
  } catch {
    // Try to fix truncated JSON by finding the last valid closing brace
    const lastBrace = jsonStr.lastIndexOf('}');
    if (lastBrace > 0) {
      try {
        const result = JSON.parse(jsonStr.slice(0, lastBrace + 1)) as EnrichResult;
        return {
          prototype: result.prototype || "",
          variant: Array.isArray(result.variant) ? result.variant : [],
          etymology: result.etymology || "",
          examples: Array.isArray(result.examples) ? result.examples : [],
          collocations: Array.isArray(result.collocations) ? result.collocations : [],
          synonyms: Array.isArray(result.synonyms) ? result.synonyms : [],
          antonyms: Array.isArray(result.antonyms) ? result.antonyms : []
        };
      } catch {
        // fall through to error
      }
    }
    throw new Error(`Failed to parse MiniMax response as JSON: ${jsonStr.slice(0, 200)}`);
  }
}
