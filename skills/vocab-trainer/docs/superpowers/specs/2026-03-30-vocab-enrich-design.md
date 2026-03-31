# Vocab Enrich Design — 2026-03-30

## Summary

修复复习页面单词缺少解释的 bug，并通过 MiniMax 大模型为每个复习单词补充原型、变体、词源词根等扩展信息。

---

## 1. Bug Fix: Missing Meaning Display

### Problem
单词的 `meaning` 字段在数据库中可能为空字符串，复习页面只显示空白。

### Fix
- Review.tsx：在显示答案时，若 `meaning` 为空，显示「暂无解释，请参考扩展信息」
- API `/api/words/:word` 返回时始终保证字段存在

---

## 2. New Word Data Fields

### Frontend Type (web/src/pages/Review.tsx & api.ts)

```typescript
type WordEnrich = {
  prototype: string;   // 原型：如动词原形、名词单数
  variant: string;      // 变体：时态/复数/比较级等变形
  etymology: string;   // 词源词根：拉丁/希腊词根、词缀含义
}
```

> 注意：这些字段不持久化到 SQLite，每次复习实时查询 MiniMax。

---

## 3. New API Endpoint: Enrich

### `GET /api/words/:word/enrich`

**Purpose:** 调用 MiniMax API 获取单词的扩展信息（原型/变体/词源词根）。

**Response:**
```json
{
  "word": "fleeing",
  "prototype": "flee（动词原形），意为"逃跑、逃离"",
  "variant": "现在分词 fleeing；过去式/过去分词 fled",
  "etymology": "源自古英语 flēon，原始日耳曼语 *flōahan；与德语 fliehen 同源"
}
```

**Error Response:**
```json
{ "error": "Failed to enrich word", "details": "..." }
```

**Implementation:**
- 放在 `api/server.ts` 中
- MiniMax 调用放在 `src/` 目录（新文件 `src/llm.ts`），与存储逻辑分离
- 使用 `MINIMAX_API_KEY`、`MINIMAX_BASE_URL`、`MINIMAX_MODEL` 环境变量
- **不缓存到数据库**（每次请求实时查询）
- 静默失败：enrich 失败时不影响复习流程，只是不显示扩展信息

---

## 4. Frontend Changes (Review.tsx)

### Review Flow

1. `getReview()` 获取今日待复习单词列表
2. 点击"显示答案"后：
   - 显示基础信息（word、meaning、phonetic、pos、example、example_cn）
   - 调用 `getWordEnrich(word)` 获取扩展信息
   - 若 enrich 成功，显示三个可折叠/展开的区块：原型、变体、词源词根
   - 若 enrich 失败或 meaning 为空，显示提示

### API Call (web/src/api.ts)

```typescript
export const getWordEnrich = (word: string) =>
  fetch(`${API}/words/${encodeURIComponent(word)}/enrich`).then(r => r.json());
```

### UI Layout (初步)

```
┌──────────────────────────────────────┐
│            fleeing                   │
├──────────────────────────────────────┤
│  含义: 逃跑,逃离                       │
│  音标: /ˈfliːɪŋ/                      │
│  词性: verb（现在分词）                │
│  例句: The cat was fleeing from...   │
│  中文: 猫咪正在逃离...                  │
├──────────────────────────────────────┤
│  ▼ 原型   [展开]                      │
│  ▼ 变体   [展开]                      │
│  ▼ 词源   [展开]                      │
└──────────────────────────────────────┘
```

---

## 5. Backend Module: src/llm.ts

```typescript
// 新建 src/llm.ts
export type EnrichResult = {
  prototype: string;
  variant: string;
  etymology: string;
};

export async function enrichWord(word: string): Promise<EnrichResult> {
  // 调用 MiniMax API
  // prompt 要求返回 JSON 格式
}
```

**MiniMax Prompt 要求：**
- 输入：单词 + 词性（可选）+ 已有例句（可选）
- 输出：JSON 包含 prototype、variant、etymology
- 风格：简洁中文，50-100字每字段
- 模型：使用环境变量指定的模型

---

## 6. Environment Variables

`.env` 文件（用户配置）：
```
MINIMAX_API_KEY=your_api_key_here
MINIMAX_BASE_URL=https://api.minimax.chat
MINIMAX_MODEL=abab6.5s-chat
```

---

## 7. Testing

- `GET /api/words/:word/enrich` 单元测试：mock MiniMax 响应
- 前端 Review 页面：meaning 为空时的提示显示
- 前端 Review 页面：enrich 信息正常展示

---

## 8. Files to Change

| File | Change |
|------|--------|
| `src/llm.ts` | **新建** MiniMax 调用模块 |
| `api/server.ts` | 新增 `/api/words/:word/enrich` 路由 |
| `web/src/api.ts` | 新增 `getWordEnrich()` API 调用 |
| `web/src/pages/Review.tsx` | 调用 enrich API，显示扩展信息区块，修复 meaning 为空的问题 |
| `.env` | 新增 MiniMax 环境变量 |

---

## 9. Out of Scope

- 不修改 SQLite schema（扩展信息不持久化）
- 不修改单词添加流程
- 不实现缓存策略（每次复习都查询 MiniMax）
