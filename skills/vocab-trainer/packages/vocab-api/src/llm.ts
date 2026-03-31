import type { EnrichResult } from "vocab-core/types";

const MAX_ERROR_PREVIEW = 200;

interface MiniMaxChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

function getMinimaxConfig() {
  const apiKey = Bun.env.MINIMAX_API_KEY;
  const baseUrl = Bun.env.MINIMAX_BASE_URL || "https://api.minimaxi.com";
  const model = Bun.env.MINIMAX_MODEL || "MiniMax-M2.7";

  if (!apiKey) {
    throw new Error("MINIMAX_API_KEY environment variable is not set");
  }

  return { apiKey, baseUrl, model };
}

export async function enrichWord(word: string): Promise<EnrichResult> {
  const { apiKey, baseUrl, model } = getMinimaxConfig();

  const prompt = `分析单词 "${word}"，返回简短的中文JSON（每项不超过50字）：
{"prototype":"...","variant":"...","etymology":"..."}`;

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

  const data = await response.json() as MiniMaxChatResponse;

  // MiniMax-M2.7 returns: { choices: [{ message: { content: "..." } }] }
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(`MiniMax API returned no content: ${JSON.stringify(data).slice(0, MAX_ERROR_PREVIEW)}`);
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
    // Try to fix truncated JSON by finding the last valid closing brace
    const lastBrace = jsonStr.lastIndexOf('}');
    if (lastBrace > 0) {
      try {
        const result = JSON.parse(jsonStr.slice(0, lastBrace + 1)) as EnrichResult;
        return {
          prototype: result.prototype || "",
          variant: result.variant || "",
          etymology: result.etymology || ""
        };
      } catch {
        // fall through to error
      }
    }
    throw new Error(`Failed to parse MiniMax response as JSON: ${jsonStr.slice(0, MAX_ERROR_PREVIEW)}`);
  }
}
