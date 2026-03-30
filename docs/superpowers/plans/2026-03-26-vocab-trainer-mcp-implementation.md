# Vocab-Trainer MCP 服务器重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 vocab-trainer 从 prompt-based 重构为 MCP 服务器，程序精确控制艾宾浩斯间隔计算

**Architecture:** Node.js + TypeScript 实现 MCP 服务器，通过 7 个工具函数暴露接口，大模型通过 MCP 调用执行实际操作

**Tech Stack:** Node.js, TypeScript, @modelcontextprotocol/server, JSON 文件存储

---

## 文件结构

```
vocab-trainer/
├── src/
│   ├── index.ts          # MCP 服务器入口（STDIO 模式）
│   ├── types.ts          # TypeScript 类型定义
│   ├── storage.ts        # JSON 文件读写
│   ├── algorithm.ts      # 艾宾浩斯算法
│   └── tools.ts          # MCP 工具定义
├── package.json
├── tsconfig.json
└── .env                  # 可选配置
```

---

## Task 1: 创建项目结构

**Files:**
- Create: `vocab-trainer/package.json`
- Create: `vocab-trainer/tsconfig.json`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "vocab-trainer",
  "version": "1.0.0",
  "description": "Vocab-Trainer MCP Server with Spaced Repetition",
  "main": "dist/index.js",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/server": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Commit**

```bash
git add vocab-trainer/package.json vocab-trainer/tsconfig.json
git commit -m "feat: init vocab-trainer project structure"
```

---

## Task 2: 实现类型定义

**Files:**
- Create: `vocab-trainer/src/types.ts`

- [ ] **Step 1: 编写类型定义**

```typescript
export interface ReviewRecord {
  date: string;          // 复习日期 (YYYY-MM-DD)
  result: "pass" | "fail" | "fuzzy";
}

export interface Word {
  word: string;
  meaning: string;
  phonetic: string;
  pos: string;
  example: string;
  example_cn: string;
  source: string;
  added: string;
  level: number;
  next_review: string;
  interval_days: number;
  error_count: number;
  review_count: number;
  history: ReviewRecord[];
}

export interface VocabData {
  version: number;
  streak: number;
  last_review_date: string | null;
  total_reviews: number;
  words: Word[];
}

export interface FeedbackItem {
  word: string;
  feedback: "pass" | "fail" | "fuzzy";
}

export interface ReviewResult {
  word: string;
  old_level: number;
  new_level: number;
  next_review: string;
  interval_days: number;
}

export interface ReviewSummary {
  passed: number;
  failed: number;
  fuzzy: number;
}

// MCP 工具返回类型
export interface VocabReviewResponse {
  words: Word[];
  count: number;
  streak: number;
  last_review_date: string | null;
}

export interface VocabAddResponse {
  success: boolean;
  word: string;
  level: number;
  next_review: string;
  message: string;
}

export interface VocabFeedbackResponse {
  success: boolean;
  results: ReviewResult[];
  summary: ReviewSummary;
  updated_streak: number;
  message: string;
}

export interface VocabStatusResponse {
  total_words: number;
  level_stats: Record<number, number>;
  streak: number;
  today_due: number;
  tomorrow_due: number;
  total_reviews: number;
}

export interface VocabListResponse {
  words: Pick<Word, "word" | "meaning" | "level" | "next_review" | "error_count">[];
  total: number;
}

export interface VocabRemoveResponse {
  success: boolean;
  message: string;
}

export interface VocabWordDetailResponse extends Word {}
```

- [ ] **Step 2: Commit**

```bash
git add vocab-trainer/src/types.ts
git commit -m "feat: add TypeScript type definitions"
```

---

## Task 3: 实现 JSON 存储层

**Files:**
- Create: `vocab-trainer/src/storage.ts`

- [ ] **Step 1: 编写存储层代码**

```typescript
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { VocabData, Word } from "./types.js";

const DEFAULT_DATA_PATH = process.env.VOCAB_DATA_PATH ||
  `${process.env.HOME}/.vocab-trainer/words.json`;

function ensureDir(): void {
  const dir = dirname(DEFAULT_DATA_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function getDefaultData(): VocabData {
  return {
    version: 1,
    streak: 0,
    last_review_date: null,
    total_reviews: 0,
    words: []
  };
}

export function loadData(): VocabData {
  ensureDir();
  if (!existsSync(DEFAULT_DATA_PATH)) {
    const data = getDefaultData();
    saveData(data);
    return data;
  }
  const content = readFileSync(DEFAULT_DATA_PATH, "utf-8");
  return JSON.parse(content) as VocabData;
}

export function saveData(data: VocabData): void {
  ensureDir();
  writeFileSync(DEFAULT_DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export function addWord(word: Word): void {
  const data = loadData();
  data.words.push(word);
  saveData(data);
}

export function getWord(word: string): Word | undefined {
  const data = loadData();
  return data.words.find(w => w.word.toLowerCase() === word.toLowerCase());
}

export function updateWord(word: string, updates: Partial<Word>): Word | undefined {
  const data = loadData();
  const idx = data.words.findIndex(w => w.word.toLowerCase() === word.toLowerCase());
  if (idx === -1) return undefined;

  data.words[idx] = { ...data.words[idx], ...updates };
  saveData(data);
  return data.words[idx];
}

export function removeWord(word: string): boolean {
  const data = loadData();
  const idx = data.words.findIndex(w => w.word.toLowerCase() === word.toLowerCase());
  if (idx === -1) return false;

  data.words.splice(idx, 1);
  saveData(data);
  return true;
}

export function getWordsByFilter(filter?: string): Word[] {
  const data = loadData();
  const today = new Date().toISOString().split("T")[0];

  switch (filter) {
    case "new":
      return data.words.filter(w => w.level === 0);
    case "learning":
      return data.words.filter(w => w.level >= 1 && w.level <= 3);
    case "hard":
      return data.words.filter(w => w.level <= 1 && w.error_count >= 1);
    case "mastered":
      return data.words.filter(w => w.level === 5);
    case "today":
      return data.words.filter(w => w.next_review <= today);
    default:
      return data.words;
  }
}

export function getDueWords(): Word[] {
  const data = loadData();
  const today = new Date().toISOString().split("T")[0];
  return data.words.filter(w => w.next_review <= today);
}

export function updateStats(streak: number, lastReviewDate: string): void {
  const data = loadData();
  data.streak = streak;
  data.last_review_date = lastReviewDate;
  data.total_reviews += 1;
  saveData(data);
}
```

- [ ] **Step 2: Commit**

```bash
git add vocab-trainer/src/storage.ts
git commit -m "feat: implement JSON storage layer"
```

---

## Task 4: 实现艾宾浩斯算法

**Files:**
- Create: `vocab-trainer/src/algorithm.ts`

- [ ] **Step 1: 编写算法实现**

```typescript
import { Word, ReviewResult, ReviewSummary, FeedbackItem } from "./types.js";
import { loadData, saveData, updateWord } from "./storage.js";

const INTERVALS = [1, 2, 4, 7, 15, 30]; // level 0-5 对应间隔

export function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

export function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function calculateNextReview(
  currentLevel: number,
  feedback: "pass" | "fail" | "fuzzy"
): { newLevel: number; intervalDays: number } {
  switch (feedback) {
    case "pass": {
      const newLevel = Math.min(5, currentLevel + 1);
      return { newLevel, intervalDays: INTERVALS[newLevel] };
    }
    case "fail":
      return { newLevel: Math.max(0, currentLevel - 1), intervalDays: 1 };
    case "fuzzy":
      return {
        newLevel: currentLevel,
        intervalDays: Math.max(1, Math.floor(INTERVALS[currentLevel] / 2))
      };
  }
}

export function processReviewFeedbacks(feedbacks: FeedbackItem[]): {
  results: ReviewResult[];
  summary: ReviewSummary;
  updatedStreak: number;
} {
  const data = loadData();
  const today = getToday();
  const results: ReviewResult[] = [];

  let passed = 0;
  let failed = 0;
  let fuzzy = 0;

  for (const { word, feedback } of feedbacks) {
    const existingWord = data.words.find(
      w => w.word.toLowerCase() === word.toLowerCase()
    );
    if (!existingWord) continue;

    const oldLevel = existingWord.level;
    const { newLevel, intervalDays } = calculateNextReview(oldLevel, feedback);
    const nextReview = addDays(today, intervalDays);

    // 更新单词
    const historyEntry = {
      date: today,
      result: feedback
    };

    updateWord(word, {
      level: newLevel,
      interval_days: intervalDays,
      next_review: nextReview,
      review_count: existingWord.review_count + 1,
      error_count: feedback === "fail" ? existingWord.error_count + 1 : existingWord.error_count,
      history: [...existingWord.history, historyEntry]
    });

    results.push({
      word,
      old_level: oldLevel,
      new_level: newLevel,
      next_review: nextReview,
      interval_days: intervalDays
    });

    if (feedback === "pass") passed++;
    else if (feedback === "fail") failed++;
    else fuzzy++;
  }

  // 更新 streak
  let newStreak = data.streak;
  const lastDate = data.last_review_date;

  if (lastDate) {
    const yesterday = addDays(today, -1);
    if (lastDate === today) {
      // 今天已经复习过，streak 不变
    } else if (lastDate === yesterday) {
      newStreak += 1;
    } else {
      newStreak = 1;
    }
  } else {
    newStreak = 1;
  }

  // 更新统计数据
  data.streak = newStreak;
  data.last_review_date = today;
  data.total_reviews += 1;
  saveData(data);

  return {
    results,
    summary: { passed, failed, fuzzy },
    updatedStreak: newStreak
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add vocab-trainer/src/algorithm.ts
git commit -m "feat: implement spaced repetition algorithm"
```

---

## Task 5: 实现 MCP 工具定义

**Files:**
- Create: `vocab-trainer/src/tools.ts`

- [ ] **Step 1: 编写工具定义**

```typescript
import { McpServer, Tool } from "@modelcontextprotocol/server";
import { VocabData, Word } from "./types.js";
import {
  loadData,
  addWord,
  getWord,
  removeWord,
  getWordsByFilter,
  getDueWords
} from "./storage.js";
import { processReviewFeedbacks, getToday, addDays } from "./algorithm.js";

function createTools(server: McpServer): Tool[] {
  return [
    // 1. vocab_review - 获取今日待复习单词
    {
      name: "vocab_review",
      description: "获取今日待复习的单词列表",
      inputSchema: {
        type: "object",
        properties: {}
      },
      execute: async () => {
        const data = loadData();
        const dueWords = getDueWords();
        // 随机打乱顺序
        const shuffled = dueWords.sort(() => Math.random() - 0.5);

        return {
          words: shuffled,
          count: shuffled.length,
          streak: data.streak,
          last_review_date: data.last_review_date
        };
      }
    },

    // 2. vocab_add_word - 添加新词
    {
      name: "vocab_add_word",
      description: "添加新词到词库",
      inputSchema: {
        type: "object",
        properties: {
          word: { type: "string", description: "单词" },
          meaning: { type: "string", description: "中文释义" },
          phonetic: { type: "string", description: "音标" },
          pos: { type: "string", description: "词性" },
          example: { type: "string", description: "英文例句" },
          example_cn: { type: "string", description: "例句中文翻译" },
          source: { type: "string", description: "来源" }
        },
        required: ["word"]
      },
      execute: async (args: any) => {
        const wordLower = args.word.toLowerCase();
        const existing = loadData().words.find(
          w => w.word.toLowerCase() === wordLower
        );

        if (existing) {
          return {
            success: false,
            word: args.word,
            level: existing.level,
            next_review: existing.next_review,
            message: `单词 "${args.word}" 已存在，当前 level: ${existing.level}`
          };
        }

        const today = getToday();
        const tomorrow = addDays(today, 1);

        const newWord: Word = {
          word: wordLower,
          meaning: args.meaning || "",
          phonetic: args.phonetic || "",
          pos: args.pos || "",
          example: args.example || "",
          example_cn: args.example_cn || "",
          source: args.source || "user",
          added: today,
          level: 0,
          next_review: tomorrow,
          interval_days: 1,
          error_count: 0,
          review_count: 0,
          history: []
        };

        addWord(newWord);

        return {
          success: true,
          word: args.word,
          level: 0,
          next_review: tomorrow,
          message: `已添加 "${args.word}"，首次复习：${tomorrow}`
        };
      }
    },

    // 3. vocab_review_feedback - 提交复习反馈
    {
      name: "vocab_review_feedback",
      description: "提交复习反馈，更新单词状态（支持批量）",
      inputSchema: {
        type: "object",
        properties: {
          feedbacks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                word: { type: "string" },
                feedback: { type: "string", enum: ["pass", "fail", "fuzzy"] }
              },
              required: ["word", "feedback"]
            },
            description: "复习反馈数组"
          }
        },
        required: ["feedbacks"]
      },
      execute: async (args: any) => {
        const { results, summary, updatedStreak } = processReviewFeedbacks(
          args.feedbacks
        );

        return {
          success: true,
          results,
          summary,
          updated_streak: updatedStreak,
          message: `复习完成！通过 ${summary.passed}，失败 ${summary.failed}，模糊 ${summary.fuzzy}`
        };
      }
    },

    // 4. vocab_get_status - 获取词库状态
    {
      name: "vocab_get_status",
      description: "获取词库整体状态",
      inputSchema: {
        type: "object",
        properties: {}
      },
      execute: async () => {
        const data = loadData();
        const today = getToday();
        const tomorrow = addDays(today, 1);

        const levelStats: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        data.words.forEach(w => {
          levelStats[w.level] = (levelStats[w.level] || 0) + 1;
        });

        const todayDue = data.words.filter(w => w.next_review <= today).length;
        const tomorrowDue = data.words.filter(w => w.next_review === tomorrow).length;

        return {
          total_words: data.words.length,
          level_stats: levelStats,
          streak: data.streak,
          today_due: todayDue,
          tomorrow_due: tomorrowDue,
          total_reviews: data.total_reviews
        };
      }
    },

    // 5. vocab_list_words - 列出单词
    {
      name: "vocab_list_words",
      description: "列出单词（支持筛选）",
      inputSchema: {
        type: "object",
        properties: {
          filter: {
            type: "string",
            enum: ["all", "new", "learning", "hard", "mastered", "today"],
            description: "筛选条件"
          },
          limit: { type: "number", description: "返回数量限制" }
        }
      },
      execute: async (args: any) => {
        const words = getWordsByFilter(args.filter);
        const limited = args.limit ? words.slice(0, args.limit) : words;

        return {
          words: limited.map(w => ({
            word: w.word,
            meaning: w.meaning,
            level: w.level,
            next_review: w.next_review,
            error_count: w.error_count
          })),
          total: words.length
        };
      }
    },

    // 6. vocab_remove_word - 移除单词
    {
      name: "vocab_remove_word",
      description: "从词库移除单词",
      inputSchema: {
        type: "object",
        properties: {
          word: { type: "string", description: "要移除的单词" }
        },
        required: ["word"]
      },
      execute: async (args: any) => {
        const success = removeWord(args.word);
        return {
          success,
          message: success ? `已移除 "${args.word}"` : `未找到 "${args.word}"`
        };
      }
    },

    // 7. vocab_get_word_detail - 获取单词详情
    {
      name: "vocab_get_word_detail",
      description: "获取单词详情（用于学习模式）",
      inputSchema: {
        type: "object",
        properties: {
          word: { type: "string", description: "单词" }
        },
        required: ["word"]
      },
      execute: async (args: any) => {
        const word = getWord(args.word);
        if (!word) {
          return { error: `未找到单词 "${args.word}"` };
        }
        return word;
      }
    }
  ];
}

export { createTools };
```

- [ ] **Step 2: Commit**

```bash
git add vocab-trainer/src/tools.ts
git commit -m "feat: implement MCP tool definitions"
```

---

## Task 6: 实现 MCP 服务器入口

**Files:**
- Create: `vocab-trainer/src/index.ts`

- [ ] **Step 1: 编写服务器入口**

```typescript
import { McpServer } from "@modelcontextprotocol/server";
import { createTools } from "./tools.js";

const server = new McpServer({
  name: "vocab-trainer",
  version: "1.0.0"
});

// 注册所有工具
const tools = createTools(server);
server.setTools(tools);

// 启动 STDIO 服务器
console.error("Vocab-Trainer MCP Server starting...");
server.run();
```

- [ ] **Step 2: 构建项目**

Run: `cd vocab-trainer && npm install && npm run build`

Expected: 编译成功，生成 dist/index.js

- [ ] **Step 3: Commit**

```bash
git add vocab-trainer/src/index.ts
git commit -m "feat: add MCP server entry point"
```

---

## Task 7: 测试 MCP 工具

**Files:**
- Test: `vocab-trainer/test.mjs`

- [ ] **Step 1: 编写测试脚本**

```javascript
import { spawn } from "child_process";

function callTool(toolName, args = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", ["dist/index.js"], {
      stdio: ["pipe", "pipe", "pipe"]
    });

    let output = "";
    let error = "";

    proc.stdout.on("data", (data) => { output += data; });
    proc.stderr.on("data", (data) => { error += data; });

    proc.on("close", () => {
      resolve(JSON.parse(output));
    });

    proc.on("error", reject);

    // 发送 JSON-RPC 请求
    proc.stdin.write(JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: toolName, arguments: args }
    }) + "\n");

    proc.stdin.end();
  });
}

async function test() {
  // 测试添加单词
  console.log("=== 测试添加单词 ===");
  const addResult = await callTool("vocab_add_word", {
    word: "sparingly",
    meaning: "适量地，节俭地",
    phonetic: "/ˈspeərɪŋli/",
    pos: "adv",
    example: "Use comments sparingly.",
    example_cn: "注释要简洁克制。"
  });
  console.log(addResult);

  // 测试获取状态
  console.log("\n=== 测试获取状态 ===");
  const statusResult = await callTool("vocab_get_status");
  console.log(statusResult);
}

test().catch(console.error);
```

- [ ] **Step 2: 运行测试**

Run: `node vocab-trainer/test.mjs`

Expected: 验证各工具正常工作

- [ ] **Step 3: Commit**

```bash
git add vocab-trainer/test.mjs
git commit -m "test: add MCP tool tests"
```

---

## Task 8: 更新 /vocab 技能，整合 MCP 调用

**Files:**
- Modify: `skills/vocab-trainer/SKILL.md`

- [ ] **Step 1: 更新技能文档，添加 MCP 调用说明**

在 SKILL.md 中添加 MCP 工具调用说明部分：

```markdown
## MCP 工具调用

当用户调用 `/vocab` 指令时，大模型通过以下 MCP 工具执行操作：

### 复习流程 (/vocab review)
1. 调用 `vocab_review` 获取今日待复习单词
2. 逐个展示给用户，让用户回忆
3. 用户回答后，调用 `vocab_review_feedback` 批量提交
4. 程序精确更新 level，大模型渲染返回结果

### 添加单词 (/vocab add)
1. 调用 `vocab_add_word` 添加单词
2. 如果未提供释义，程序自动查询

### 查看状态 (/vocab status)
1. 调用 `vocab_get_status` 获取统计数据
```

- [ ] **Step 2: Commit**

```bash
git add skills/vocab-trainer/SKILL.md
git commit -m "feat: update vocab skill with MCP integration"
```

---

## 实现完成

所有任务完成后，vocab-trainer MCP 服务器将提供以下能力：

1. **精确的状态计算** — 艾宾浩斯间隔逻辑由程序执行，不依赖大模型理解
2. **7 个 MCP 工具** — vocab_review, vocab_add_word, vocab_review_feedback, vocab_get_status, vocab_list_words, vocab_remove_word, vocab_get_word_detail
3. **JSON 文件存储** — 数据持久化到 ~/.vocab-trainer/words.json
4. **与 /vocab 技能整合** — 大模型作为前端调用 MCP 工具
