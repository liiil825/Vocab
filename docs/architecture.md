# 架构文档

## 技术栈

- **运行时**: Bun
- **后端**: TypeScript, bun:sqlite, Hono
- **前端**: Vite, React, React Router v6
- **协议**: MCP (AI工具), HTTP API (Web前端)
- **架构**: Bun workspaces monorepo

## 目录结构

```
vocab-trainer/                    # Bun workspace root
├── packages/
│   ├── vocab-core/               # 共享核心库
│   │   ├── package.json
│   │   ├── schema.sql            # SQLite schema (单一数据源)
│   │   └── src/
│   │       ├── index.ts          # 公共导出
│   │       ├── types.ts          # TypeScript 类型
│   │       ├── storage.ts        # SQLite 存储 (工厂模式)
│   │       └── algorithm.ts      # 间隔重复算法
│   │
│   ├── vocab-mcp/               # MCP 服务器
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts          # MCP 服务入口
│   │       ├── tools.ts          # 7个 MCP tools
│   │       └── llm.ts           # LLM 集成
│   │
│   └── vocab-api/               # HTTP REST API
│       ├── package.json
│       └── src/
│           ├── server.ts        # Hono API (port 3099)
│           └── llm.ts           # LLM 集成
│
├── web/                          # React 前端
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Review.tsx      # 复习页面
│   │   │   ├── Learn.tsx       # 学习页面
│   │   │   ├── Status.tsx      # 状态页面
│   │   │   └── List.tsx        # 列表页面
│   │   ├── api.ts             # API 客户端
│   │   ├── App.tsx            # React Router
│   │   └── main.tsx           # 入口
│   └── vite.config.ts
│
└── tests/                        # 测试套件
    ├── unit/                    # 单元测试
    ├── integration/             # 集成测试
    └── helpers/                 # 测试工具
```

## 核心设计

### 存储层 (vocab-core/src/storage.ts)

使用 `bun:sqlite` 存储，采用**工厂模式**替代单例模式：

```typescript
// 创建独立实例
const storage = createStorage({ dbPath: '/path/to/db.db' });

// 从环境变量创建 (MCP/API 服务器使用)
const storage = createStorageFromEnv();

// 测试时清除缓存
closeDb(); // 使缓存失效，下次调用 createStorageFromEnv() 会创建新实例
```

**关键设计**:
- `createStorageFromEnv()` 在调用时读取 `VOCAB_DATA_PATH`，并缓存实例
- 测试通过 `closeDb()` 清除缓存，实现测试数据隔离
- 每个进程（MCP服务器、API服务器）独立缓存，避免状态污染

**数据库路径**: `~/.vocab-trainer/words.db` 或 `VOCAB_DATA_PATH` 环境变量

### 数据库 Schema (vocab-core/schema.sql)

```sql
-- words 表: 存储单词
CREATE TABLE words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL UNIQUE,        -- 原始大小写
  word_lower TEXT NOT NULL,         -- 小写，用于查询
  meaning, phonetic, pos, example, example_cn, source,
  added TEXT,                        -- YYYY-MM-DD
  level INTEGER DEFAULT 0,            -- 0-5
  next_review TEXT,                  -- YYYY-MM-DD
  interval_days INTEGER DEFAULT 1,
  error_count, review_count INTEGER DEFAULT 0,
  history TEXT DEFAULT '[]',         -- JSON: [{date, result}]
  prototype TEXT DEFAULT '',
  variant TEXT DEFAULT '',
  etymology TEXT DEFAULT ''
);

-- stats 表: 存储统计数据
CREATE TABLE stats (
  id INTEGER PRIMARY KEY DEFAULT 1,
  version INTEGER DEFAULT 1,
  streak INTEGER DEFAULT 0,
  last_review_date TEXT,
  total_reviews INTEGER DEFAULT 0
);

CREATE INDEX idx_words_word_lower ON words(word_lower);
CREATE INDEX idx_words_next_review ON words(next_review);
CREATE INDEX idx_words_level ON words(level);
```

### 间隔重复算法 (vocab-core/src/algorithm.ts)

艾宾浩斯记忆曲线改进版:
- Level 0-9 对应间隔: [20分钟, 1小时, 4小时, 12小时, 1天, 2天, 7天, 15天, 30天, 60天]
- `pass`: level++, interval 使用新级别对应间隔
- `fail`: level 重置为 0, interval = 20分钟
- `fuzzy`: level 不变, interval = 上一个间隔 ÷3 (最低20分钟)
- Streak: 24小时内有复习即连续

### MCP Tools (vocab-mcp/src/tools.ts)

| Tool | Purpose |
|------|---------|
| `vocab_review` | 获取今日待复习 |
| `vocab_add_word` | 添加单词 |
| `vocab_review_feedback` | 提交反馈 |
| `vocab_get_status` | 获取状态 |
| `vocab_list_words` | 列出单词 |
| `vocab_remove_word` | 移除单词 |
| `vocab_get_word_detail` | 单词详情 |

### HTTP API (vocab-api/src/server.ts)

端口: 3099

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/status | 统计状态 |
| GET | /api/review | 今日待复习 |
| POST | /api/review/feedback | 提交反馈 |
| GET | /api/words | 单词列表 |
| POST | /api/words | 添加单词 |
| DELETE | /api/words/:word | 删除单词 |
| GET | /api/words/:word | 单词详情 |

### 前端页面

- **Review**: 卡片式复习，pass/fail/fuzzy 反馈
- **Learn**: 添加新单词表单
- **Status**: 统计面板 + 词汇量柱状图
- **List**: 表格 + 筛选器

## 启动命令

```bash
# 构建
bun run build              # 构建所有 packages

# 开发
bun run dev:mcp           # 启动 MCP 服务器
bun run dev:api           # 启动 API 服务器 (port 3099)
bun run dev:web           # 启动前端 (port 5173)

# 测试
bun run test              # 运行所有测试
bun run test:unit         # 单元测试
bun run test:integration  # 集成测试
```

## 测试隔离设计

每个测试套件使用独立的 SQLite 数据库文件（UUID 确保唯一性）：

```javascript
const TEST_DATA_FILE = `${DATA_DIR}/words.test.${TEST_ID}.db`;
```

测试流程：
1. `setupTestData()` - 备份现有数据，切换到测试数据库
2. `resetTestData()` - 创建新的空数据库并调用 `closeDb()` 清除缓存
3. `writeTestData()` - 直接写入测试数据，调用 `closeDb()` 使 storage 缓存失效
4. `teardownTestData()` - 清理测试数据，恢复备份

**已知限制**: MCP 服务器运行在独立进程中，有自己的存储缓存。集成测试中验证 streak 连续行为的测试可能失败，因为 `writeTestData()` 只能清除测试进程的缓存，无法清除 MCP 服务器的缓存。
