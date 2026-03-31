# 测试文档

## 测试状态 (2026-03-31)

| 测试类型 | 通过 | 失败 |
|---------|------|------|
| 算法单元测试 | 22 | 0 |
| 存储层单元测试 | 23 | 0 |
| MCP 集成测试 | 20 | 0 |
| 批量复习集成测试 | 37 | 0 |
| **总计** | **102** | **0** |

**已修复**：之前 streak 连续测试失败的原因是 `readTestData()` 返回 `{ words, stats }` 结构，但测试代码错误地设置 `data.last_review_date` 而不是 `data.stats.last_review_date`。

## 测试命令

```bash
bun run tests/run-all.mjs              # 运行全部测试
bun run tests/run-all.mjs unit         # 只运行单元测试
bun run tests/run-all.mjs integration  # 只运行集成测试
```

## 测试结构

```
tests/
├── helpers/
│   ├── mcp-client.mjs      # MCP 客户端封装
│   └── data-env.mjs         # 测试数据隔离，管理 VOCAB_DATA_PATH
├── unit/
│   ├── algorithm.test.mjs   # 算法单元测试
│   └── storage.test.mjs     # 存储层单元测试
├── integration/
│   ├── mcp.test.mjs         # MCP 工具集成测试
│   └── batch-review.test.mjs # 批量部分复习场景
└── run-all.mjs              # 统一测试运行器
```

## 测试覆盖

| 测试文件 | 覆盖内容 |
|---------|---------|
| `algorithm.test.mjs` | getToday, addDays, calculateNextReview, processReviewFeedbacks, streak 逻辑 |
| `storage.test.mjs` | addWord, getWord, updateWord, removeWord, getDueWords, getWordsByFilter |
| `mcp.test.mjs` | 全部 7 个 MCP 工具的基本 CRUD |
| `batch-review.test.mjs` | 批量添加、部分提交、提前结束、未复习词仍返回、错误处理、streak 连续/中断 |

## 数据隔离机制

测试使用独立的数据库文件（UUID 确保唯一），正式数据库 (`~/.vocab-trainer/words.db`) 完全不受影响。

**设计原则**：测试不移动、复制或修改正式数据库。测试期间正式 MCP 服务可正常运行。

### 测试流程

```
setupTestData()
  └── 确保测试目录存在

resetTestData()
  └── 创建新的空测试数据库（独立文件，不影响正式数据库）

运行测试
  └── 测试 MCP 服务器使用测试数据库（通过 VOCAB_DATA_PATH）
  └── 正式 MCP 服务完全不受影响

teardownTestData()
  └── 删除测试数据库
```

### 核心原理

`storage.ts` 的 `getDataPath()` 是**函数**而非常量，每次调用 `loadData()` / `saveData()` 时在运行时读取 `VOCAB_DATA_PATH` 环境变量。

### 流程

```
测试文件 import data-env.mjs
       ↓
data-env.mjs 设置 process.env.VOCAB_DATA_PATH
= words.test.{uuid}.db (SQLite)
       ↓
测试文件 import storage.js / algorithm.js
       ↓
storage.js 调用 getDataPath() → 读到测试路径
       ↓
所有操作都在测试数据库文件进行
```

### 关键代码

```javascript
// data-env.mjs — 模块加载时立即设置
process.env.VOCAB_DATA_PATH = TEST_DATA_FILE;

// storage.ts — 函数每次调用时读取
function getDataPath(): string {
  return process.env.VOCAB_DATA_PATH ||
    `${process.env.HOME}/.vocab-trainer/words.db`;
}
```

### 为什么这样做

TypeScript 模块的 import 顺序是按文件依赖图的。如果 storage.ts 在模块顶层定义：

```typescript
const DEFAULT_DATA_PATH = process.env.VOCAB_DATA_PATH || "...";
```

这行代码在 `import storage from "storage"` 时就执行了，此时 `VOCAB_DATA_PATH` 还没被设置。

改为函数后，`getDataPath()` 在每次 `loadData()` 调用时才执行，此时 `VOCAB_DATA_PATH` 已被测试环境正确设置。

## 测试辅助函数

| 函数 | 用途 |
|------|------|
| `setupTestData()` | 确保测试目录存在 |
| `teardownTestData()` | 删除测试数据库 |
| `resetTestData()` | 重置测试数据为空 |
| `readTestData()` | 直接读取测试数据文件 |
| `writeTestData(data)` | 直接写入测试数据文件 |
| `getToday()` | 获取今天的日期字符串 |
| `closeDb()` | 关闭缓存的数据库连接（用于测试隔离） |

## 已知测试问题

无。所有测试均已通过。
