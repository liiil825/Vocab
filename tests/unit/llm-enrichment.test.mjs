#!/usr/bin/env bun
/**
 * LLM Enrichment 单元测试
 * 测试 enrichWord 函数正确调用 LLM API 并处理响应
 */

// 加载环境变量
import { existsSync, readFileSync } from "fs";
const envPath = "../../scripts/.env";
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

import { setupTestData, teardownTestData } from "../helpers/data-env.mjs";

console.log("=== LLM Enrichment 单元测试 ===\n");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log("  ✅ " + message);
    passed++;
  } else {
    console.log("  ❌ " + message);
    failed++;
  }
}

// Mock fetch for testing
const originalFetch = globalThis.fetch;
let lastFetchCall = null;
let fetchResponseOverride = null;

globalThis.fetch = async (url, options) => {
  lastFetchCall = { url, options };
  if (fetchResponseOverride) {
    return fetchResponseOverride;
  }
  return originalFetch(url, options);
};

function mockFetchResponse(response) {
  fetchResponseOverride = {
    ok: true,
    json: async () => response
  };
}

function restoreFetch() {
  fetchResponseOverride = null;
  lastFetchCall = null;
}

// 测试用的完整 enrichment 响应
const completeEnrichContent = "```json\n{\n  \"prototype\": \"aware (警觉的，意识到的) + -ness (名词后缀，表示状态或性质)\",\n  \"variant\": [\n    {\"form\": \"形容词\", \"value\": \"aware\"},\n    {\"form\": \"副词\", \"value\": \"consciously\"}\n  ],\n  \"etymology\": \"源自古英语 gewær。\",\n  \"examples\": [\n    {\"en\": \"The campaign aims to raise public awareness.\", \"cn\": \"这场运动旨在提高公众意识。\"},\n    {\"en\": \"Her cultural awareness helped her adapt.\", \"cn\": \"她的文化意识帮助她适应。\"},\n    {\"en\": \"Self-awareness is key to growth.\", \"cn\": \"自我意识是成长的关键。\"}\n  ],\n  \"collocations\": [\"raise awareness\", \"public awareness\", \"self-awareness\"],\n  \"synonyms\": [\"consciousness\", \"perception\", \"understanding\"],\n  \"antonyms\": [\"ignorance\", \"obliviousness\"]\n}\n```";

const completeEnrichResponse = {
  choices: [{
    message: {
      content: completeEnrichContent
    }
  }]
};

// 被截断的响应（模拟 max_tokens 不足的情况）
const truncatedContent = "```json\n{\n  \"prototype\": \"aware + -ness\",\n  \"variant\": [\n    {\"form\": \"adj\", \"value\": \"aware\"},\n    {\"form\": \"adv\", \"value\": \"con\"\n  }";

const truncatedResponse = {
  choices: [{
    message: {
      content: truncatedContent
    }
  }]
};

async function runTests() {
  setupTestData();
  teardownTestData();

  // 测试 1: 验证 max_tokens 参数被正确传递
  console.log("测试 1: enrichWord 调用包含 max_tokens=8000");
  mockFetchResponse(completeEnrichResponse);

  // 动态 import 以使用已修改的模块
  const { enrichWord } = await import("../../packages/vocab-api/src/llm.js");
  await enrichWord("awareness");

  assert(lastFetchCall !== null, "fetch 被调用");
  assert(lastFetchCall.options.body.includes('"max_tokens":8000'), "max_tokens=8000 被传递");

  restoreFetch();

  // 测试 2: 完整响应被正确解析
  console.log("\n测试 2: 完整 LLM 响应被正确解析");
  mockFetchResponse(completeEnrichResponse);

  const result = await enrichWord("awareness");
  assert(result.prototype === "aware (警觉的，意识到的) + -ness (名词后缀，表示状态或性质)", "prototype 解析正确");
  assert(result.examples.length === 3, "examples 数量正确");
  assert(result.collocations.length === 3, "collocations 数量正确");
  assert(result.synonyms.length === 3, "synonyms 数量正确");
  assert(result.antonyms.length === 2, "antonyms 数量正确");

  restoreFetch();

  // 测试 3: 被截断的响应抛出错误
  console.log("\n测试 3: 严重截断的响应正确抛出错误");
  mockFetchResponse(truncatedResponse);

  let threwError = false;
  try {
    await enrichWord("testword");
  } catch (e) {
    threwError = true;
    assert(e.message.includes("Failed to parse"), "正确抛出解析错误");
  }
  assert(threwError, "截断响应导致抛出错误");

  restoreFetch();

  // 测试 4: 响应中没有 content 时抛出错误
  console.log("\n测试 4: API 返回空 content 时抛出错误");
  mockFetchResponse({ choices: [{ message: {} }] });

  let emptyContentError = false;
  try {
    await enrichWord("testword");
  } catch (e) {
    emptyContentError = true;
    assert(e.message.includes("no content"), "正确抛出空内容错误");
  }
  assert(emptyContentError, "空 content 抛出错误");

  restoreFetch();

  // 测试 5: 非 200 状态码抛出错误
  console.log("\n测试 5: API 错误状态码抛出错误");
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    text: async () => "Internal Server Error"
  });

  let httpError = false;
  try {
    await enrichWord("testword");
  } catch (e) {
    httpError = true;
    assert(e.message.includes("MiniMax API error: 500"), "正确抛出 HTTP 错误");
  }
  assert(httpError, "HTTP 错误状态码抛出错误");

  // 恢复原始 fetch
  globalThis.fetch = originalFetch;

  teardownTestData();

  console.log("\n" + "=".repeat(50));
  console.log("LLM Enrichment 测试: ✅ " + passed + " 通过, ❌ " + failed + " 失败");
  console.log("=".repeat(50));
  return failed === 0;
}

const success = await runTests();
process.exit(success ? 0 : 1);
