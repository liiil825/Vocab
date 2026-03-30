# 架构文档

## 技术栈

- **运行时**: Bun
- **后端**: TypeScript, bun:sqlite, Hono
- **前端**: Vite, React, React Router v6
- **协议**: MCP (保留), HTTP API (新增)

## 目录结构

```
vocab-trainer/
├── src/                      # MCP server
│   ├── index.ts             # MCP server entry
│   ├── tools.ts             # 7个 MCP tools
│   ├── storage.ts          # SQLite storage (bun:sqlite)
│   ├── algorithm.ts         # 间隔重复算法
│   └── types.ts            # TypeScript 类型
├── api/                     # HTTP API server
│   └── server.ts           # Hono API (port 3099)
├── web/                     # React 前端
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Review.tsx # 复习页面
│   │   │   ├── Learn.tsx  # 学习页面
│   │   │   ├── Status.tsx # 状态页面
│   │   │   └── List.tsx   # 列表页面
│   │   ├── api.ts         # API client
│   │   ├── App.tsx        # React Router
│   │   └── main.tsx       # 入口
│   └── vite.config.ts
├── db/
│   └── schema.sql         # SQLite schema
└── dist/                  # 编译输出
```

## 核心设计

### 存储层 (storage.ts)

使用 `bun:sqlite` 替代 JSON 文件存储。

**关键设计**: `getDataPath()` 是函数而非常量，每次调用 `loadData()` / `saveData()` 时在运行时读取 `VOCAB_DATA_PATH`。这使得测试可以设置环境变量实现数据隔离。

**数据库路径**: `~/.vocab-trainer/words.db`

### 数据库 Schema

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
  history TEXT DEFAULT '[]'          -- JSON: [{date, result}]
);

-- stats 表: 存储统计数据
CREATE TABLE stats (
  id INTEGER PRIMARY KEY DEFAULT 1,
  version, streak, last_review_date, total_reviews
);
```

### 间隔重复算法 (algorithm.ts)

- Level 0-5 对应间隔: [1, 2, 4, 7, 15, 30] 天
- `pass`: level++, interval 翻倍
- `fail`: level 重置为 0, interval = 1
- `fuzzy`: level 不变, interval 减半

### MCP Tools (tools.ts)

| Tool | Purpose |
|------|---------|
| `vocab_review` | 获取今日待复习 |
| `vocab_add_word` | 添加单词 |
| `vocab_review_feedback` | 提交反馈 |
| `vocab_get_status` | 获取状态 |
| `vocab_list_words` | 列出单词 |
| `vocab_remove_word` | 移除单词 |
| `vocab_get_word_detail` | 单词详情 |

### HTTP API (api/server.ts)

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
bun run build       # 编译 TypeScript
bun run api         # 启动 API server (port 3099)
bun run dev:web     # 启动前端 (port 5173)
bun run dev         # 同时启动 API + 前端
```
