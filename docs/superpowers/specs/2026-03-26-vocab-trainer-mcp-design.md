# Vocab-Trainer MCP 服务器重构设计

**Date:** 2026-03-26
**Status:** Draft

---

## 目标

将 vocab-trainer 从 prompt-based 技能重构为 **MCP 服务器**，由程序精确控制艾宾浩斯间隔计算，大模型通过 MCP 工具调用执行实际操作。

---

## 技术栈

- **Runtime:** Node.js
- **Language:** TypeScript
- **存储:** JSON 文件 (`~/.vocab-trainer/words.json`)
- **调用协议:** MCP (Model Context Protocol)

---

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                    User                                  │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              大模型 (LLM + MCP Client)                   │
│    - 理解用户意图                                        │
│    - 调用 MCP 工具                                       │
│    - 渲染输出结果                                         │
└─────────────────────┬───────────────────────────────────┘
                      │ MCP 协议
                      ▼
┌─────────────────────────────────────────────────────────┐
│              vocab-trainer MCP Server                    │
│    - 精确的状态计算                                      │
│    - 艾宾浩斯间隔逻辑                                     │
│    - JSON 文件读写                                        │
└─────────────────────────────────────────────────────────┘
```

---

## MCP 工具定义

### 1. `vocab_review`

开始复习，返回今日待复习的单词列表。

**参数:** 无

**返回:**
```typescript
{
  words: Word[];           // 今日待复习的单词列表
  count: number;           // 待复习数量
  streak: number;          // 连续复习天数
  last_review_date: string | null;  // 上次复习日期
}
```

**说明:**
- 返回 `next_review <= 今天` 的所有单词
- 大模型收到后，逐个展示给用户回忆
- 复习过程中，用户每反馈一次，大模型调用 `vocab_review_feedback` 提交

---

### 2. `vocab_add_word`

添加新词到词库。

**参数:**
```typescript
{
  word: string;           // 单词（必填）
  meaning?: string;       // 中文释义
  phonetic?: string;     // 音标（如 /ˈspeərɪŋli/）
  pos?: string;          // 词性 (n/v/adj/adv/prep/conj/phrase)
  example?: string;      // 英文例句
  example_cn?: string;   // 例句中文翻译
  source?: string;       // 来源（用户手动添加 / /eng 分析 / 阅读材料等）
}
```

**返回:**
```typescript
{
  success: boolean;
  word: string;
  level: number;
  next_review: string;
  message: string;
}
```

**说明:**
- 如果未提供 meaning/phonetic/pos/example/example_cn，程序会自动查询（调用词典 API）
- 添加时自动设置 `level=0`，`next_review=明天日期`，`interval_days=1`

---

### 3. `vocab_review_feedback`

提交复习反馈，更新单词状态。可单次提交或批量提交。

**参数:**
```typescript
{
  feedbacks: Array<{
    word: string;
    feedback: "pass" | "fail" | "fuzzy";
  }>;
}
```

**返回:**
```typescript
{
  success: boolean;
  results: Array<{
    word: string;
    old_level: number;
    new_level: number;
    next_review: string;
    interval_days: number;
  }>;
  summary: {
    passed: number;
    failed: number;
    fuzzy: number;
  };
  updated_streak: number;
  message: string;
}
```

**说明:**
- 批量提交时，一次性处理所有反馈并更新 JSON 文件
- `pass`：level + 1（最高5），按间隔表推进
- `fail`：level - 1（最低0），间隔重置为1天
- `fuzzy`：level 不变，间隔减半（最小1天）
- 自动更新 streak 和 last_review_date

---

### 4. `vocab_get_status`

获取词库整体状态。

**参数:** 无

**返回:**
```typescript
{
  total_words: number;
  level_stats: {
    [level: number]: number;
  };
  streak: number;
  today_due: number;
  tomorrow_due: number;
  total_reviews: number;
}
```

---

### 5. `vocab_list_words`

列出单词（支持筛选）。

**参数:**
```typescript
{
  filter?: "all" | "new" | "learning" | "hard" | "mastered" | "today";
  limit?: number;
}
```

**返回:**
```typescript
{
  words: Pick<Word, "word" | "meaning" | "level" | "next_review" | "error_count">[];
  total: number;
}
```

**filter 说明:**
| filter | 筛选条件 |
|--------|----------|
| `all` 或不填 | 全部单词 |
| `new` | level = 0 |
| `learning` | level 1-3 |
| `hard` | level ≤ 1 且 error_count ≥ 1 |
| `mastered` | level = 5 |
| `today` | next_review ≤ 今天 |

---

### 6. `vocab_remove_word`

移除单词。

**参数:**
```typescript
{
  word: string;
}
```

**返回:**
```typescript
{
  success: boolean;
  message: string;
}
```

---

### 7. `vocab_get_word_detail`

获取单词详情（用于学习模式）。

**参数:**
```typescript
{
  word: string;
}
```

**返回:**
```typescript
{
  word: string;
  meaning: string;
  phonetic: string;
  pos: string;
  example: string;
  example_cn: string;
  level: number;
  next_review: string;
  interval_days: number;
  error_count: number;
  review_count: number;
  history: ReviewRecord[];
}
```

---

## 数据类型定义

### 顶层数据结构

```typescript
interface VocabData {
  version: number;
  streak: number;
  last_review_date: string | null;
  total_reviews: number;
  words: Word[];
}
```

### 单词数据结构

```typescript
interface Word {
  word: string;           // 单词本身（小写存储）
  meaning: string;        // 中文释义
  phonetic: string;       // 音标（如 /ˈspeərɪŋli/）
  pos: string;           // 词性 (n/v/adj/adv/prep/conj/phrase)
  example: string;       // 含该词的英文例句
  example_cn: string;    // 例句中文翻译
  source: string;        // 来源（用户手动添加 / /eng 分析 / 阅读材料等）
  added: string;         // 添加日期 (YYYY-MM-DD)
  level: number;         // 掌握等级 0-5
  next_review: string;  // 下次复习日期 (YYYY-MM-DD)
  interval_days: number; // 当前间隔天数
  error_count: number;  // 累计错误次数
  review_count: number; // 累计复习次数
  history: ReviewRecord[]; // 复习历史记录数组
}
```

### 复习历史记录

```typescript
interface ReviewRecord {
  date: string;          // 复习日期 (YYYY-MM-DD)
  result: "pass" | "fail" | "fuzzy";  // 复习结果
}
```

### 掌握等级 (level)

| Level | 等级 | 说明 |
|-------|------|------|
| 0 | 🆕 新词 | 尚未复习 |
| 1 | 😰 初识 | 复习过 1 次，仍需强化 |
| 2 | 🙂 眼熟 | 复习过 2-3 次，大概记得 |
| 3 | 😊 熟悉 | 复习过 4-5 次，基本掌握 |
| 4 | 💪 巩固 | 复习过 6+ 次，较长时间未忘 |
| 5 | ✅ 掌握 | 连续多次正确，已牢固记忆 |

### 艾宾浩斯间隔表

| 当前 Level | 反馈 | 新 Level | 间隔天数 |
|------------|------|----------|----------|
| 0 → 1 | pass | 1 | 1 天 |
| 1 → 2 | pass | 2 | 2 天 |
| 2 → 3 | pass | 3 | 4 天 |
| 3 → 4 | pass | 4 | 7 天 |
| 4 → 5 | pass | 5 | 15 天 |
| 5+ | pass | 5 | 30→60→90 天 |
| 任何 | fail | max(0, level-1) | 1 天 |
| 任何 | fuzzy | level 不变 | interval/2（最小1天）|

---

## 艾宾浩斯算法实现

```typescript
const INTERVALS = [1, 2, 4, 7, 15, 30]; // level 0-5 对应间隔

function calculateNextReview(
  currentLevel: number,
  feedback: "pass" | "fail" | "fuzzy"
): { newLevel: number; intervalDays: number } {
  switch (feedback) {
    case "pass":
      // 正确：level + 1，间隔按表推进
      const newLevel = Math.min(5, currentLevel + 1);
      return { newLevel, intervalDays: INTERVALS[newLevel] };

    case "fail":
      // 错误：level - 1，间隔重置为 1 天
      return { newLevel: Math.max(0, currentLevel - 1), intervalDays: 1 };

    case "fuzzy":
      // 模糊：level 不变，间隔减半
      return {
        newLevel: currentLevel,
        intervalDays: Math.max(1, Math.floor(INTERVALS[currentLevel] / 2))
      };
  }
}
```

---

## 文件结构

```
vocab-trainer/
├── src/
│   ├── index.ts          # MCP 服务器入口
│   ├── types.ts          # TypeScript 类型定义
│   ├── storage.ts        # JSON 文件读写
│   ├── algorithm.ts      # 艾宾浩斯算法
│   └── tools.ts          # MCP 工具定义
├── package.json
├── tsconfig.json
└── .env                  # 可选配置（如数据路径）
```

---

## 数据文件格式

`~/.vocab-trainer/words.json`

```json
{
  "version": 1,
  "streak": 0,
  "last_review_date": null,
  "total_reviews": 0,
  "words": [
    {
      "word": "sparingly",
      "meaning": "适量地，节俭地",
      "phonetic": "/ˈspeərɪŋli/",
      "pos": "adv",
      "example": "Use comments sparingly.",
      "example_cn": "注释要简洁克制。",
      "source": "/eng 分析",
      "added": "2026-03-24",
      "level": 0,
      "next_review": "2026-03-25",
      "interval_days": 1,
      "error_count": 0,
      "review_count": 0,
      "history": []
    }
  ]
}
```

---

## 与现有 `/vocab` 技能的整合

原 prompt-based `/vocab` 技能保留作为"前端"：

1. 用户输入 `/vocab review` → 大模型调用 `vocab_review` 获取今日待复习词列表
2. 大模型逐个展示单词，让用户回忆
3. 用户全部反馈后，大模型调用 `vocab_review_feedback` 批量提交
4. 程序精确计算并更新所有词的 level，大模型渲染返回结果

这样：
- **程序**保证状态计算 100% 准确
- **大模型**保持友好的交互体验

---

## 实施步骤

1. 创建 Node.js + TypeScript 项目
2. 实现 `storage.ts`（JSON 读写）
3. 实现 `algorithm.ts`（艾宾浩斯逻辑）
4. 实现 MCP 服务器和工具定义
5. 测试 MCP 工具调用
6. 更新 `/vocab` 技能，整合 MCP 调用
