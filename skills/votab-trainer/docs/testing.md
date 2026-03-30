# 测试文档

## 测试命令

```bash
bun run test              # 运行全部测试（单元 + 集成）
bun run test:unit         # 只运行单元测试
bun run test:integration  # 只运行集成测试
```

## 测试结构

```
tests/
├── helpers/
│   ├── mcp-client.mjs      # MCP 客户端封装，启动服务器、发请求、收响应
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

### 核心原理

`storage.ts` 的 `getDataPath()` 是**函数**而非常量，每次调用 `loadData()` / `saveData()` 时在运行时读取 `VOCAB_DATA_PATH` 环境变量。

### 流程

```
测试文件 import data-env.mjs
       ↓
data-env.mjs 设置 process.env.VOCAB_DATA_PATH
= words.test.{uuid}.json
       ↓
测试文件 import storage.js / algorithm.js
       ↓
storage.js 调用 getDataPath() → 读到测试路径
       ↓
所有操作都在测试数据文件进行
```

### 关键代码

```javascript
// data-env.mjs — 模块加载时立即设置
process.env.VOCAB_DATA_PATH = TEST_DATA_FILE;

// storage.ts — 函数每次调用时读取
function getDataPath(): string {
  return process.env.VOCAB_DATA_PATH ||
    `${process.env.HOME}/.vocab-trainer/words.json`;
}
```

### 为什么这样做

TypeScript 模块的 import 顺序是按文件依赖图的。如果 storage.ts 在模块顶层定义：

```typescript
const DEFAULT_DATA_PATH = process.env.VOCAB_DATA_PATH || "...";
```

这行代码在 `import storage from "storage"` 时就执行了，此时 `VOCAB_DATA_PATH` 还没被设置。

改为函数后，`getDataPath()` 在每次 `loadData()` 调用时才执行，此时 `VOCAB_DATA_PATH` 已被测试环境正确设置。

## 生命周期

每个测试文件执行流程：

```
setupTestData()
  ├── 备份 words.json → words.json.backup.{uuid}
  └── 创建空白的 words.test.{uuid}.json

runTests() — 执行测试用例

teardownTestData(hadBackup)
  ├── 删除 words.test.{uuid}.json
  └── 恢复 words.json ← backup.{uuid}
```

## 测试辅助函数

| 函数 | 用途 |
|------|------|
| `setupTestData()` | 备份真实数据，初始化测试环境 |
| `teardownTestData(hadBackup)` | 清理测试数据，恢复真实数据 |
| `resetTestData()` | 重置测试数据为空 |
| `readTestData()` | 直接读取测试数据文件 |
| `writeTestData(data)` | 直接写入测试数据文件 |
| `getToday()` | 获取今天的日期字符串 |
