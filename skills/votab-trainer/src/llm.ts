import { EnrichResult } from "./types.js";

function getMinimaxConfig() {
  const apiKey = process.env.MINIMAX_API_KEY;
  const baseUrl = process.env.MINIMAX_BASE_URL || "https://api.minimax.chat";
  const model = process.env.MINIMAX_MODEL || "abab6.5s-chat";

  if (!apiKey) {
    throw new Error("MINIMAX_API_KEY environment variable is not set");
  }

  return { apiKey, baseUrl, model };
}

export async function enrichWord(word: string): Promise<EnrichResult> {
  const { apiKey, baseUrl, model } = getMinimaxConfig();

  const prompt = `你是一个英语词汇分析助手。请分析单词 "${word}"，返回以下三个方面的信息（用中文回答）：

1. **原型 (prototype)**: 这个单词的原始形态（如动词原形、名词单数等），以及基本含义
2. **变体 (variant)**: 这个单词的常见变形（如时态、复数、比较级、进行时等）
3. **词源词根 (etymology)**: 这个单词的拉丁/希腊词根、词缀来源，以及同源词汇

请直接返回 JSON 格式，不要添加任何前缀或解释：
{
  "prototype": "...",
  "variant": "...",
  "etymology": "..."
}`;

  const response = await fetch(`${baseUrl}/v1/text/chatcompletion_pro?Model=${model}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "你是一个专业的英语词汇分析助手。" },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      stream: false
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiniMax API error: ${response.status} ${errorText}`);
  }

  const data = await response.json() as any;
  const content = data.choices?.[0]?.messages?.[0]?.text;

  if (!content) {
    throw new Error("MiniMax API returned no content");
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
      variant: result.variant || "",
      etymology: result.etymology || ""
    };
  } catch {
    throw new Error(`Failed to parse MiniMax response as JSON: ${jsonStr.slice(0, 200)}`);
  }
}