---
name: vocab-trainer
description: |
  基于艾宾浩斯遗忘曲线的智能背单词系统。通过 `/vocab` 指令触发。
  支持以下子命令：
  1. `/vocab add <单词或句子>` — 添加新词到复习队列（可从 /eng 分析结果中提取）
  2. `/vocab` 或 `/vocab review` — 开始今日复习
  3. `/vocab learn <单词>` — 学习新词的完整释义、音标、例句等
  4. `/vocab status` — 查看整体掌握进度
  5. `/vocab list [all|new|hard|mastered]` — 按状态筛选查看单词
  6. `/vocab remove <单词>` — 从词库移除

  ⚠️ 本技能通过 MCP 工具调用 Vocab-Trainer 服务器，禁止直接读写数据库。
---

# ⚙️ MCP 工具（必须使用）

本技能依赖 Vocab-Trainer MCP 服务器。**所有 `/vocab` 指令必须通过 MCP 工具执行，禁止直接读写数据库。**

## 启动 MCP（如未运行）

```bash
mcporter config add vocab-trainer --stdio "bun /home/david/.openclaw/workspace-english-teacher/skills/vocab-trainer/packages/vocab-mcp/src/index.ts"
mcporter list  # 验证 vocab-trainer 已注册且 healthy
```

如果 `mcporter list` 显示没有 servers，需要先添加：

```bash
mcporter config add vocab-trainer --stdio "bun /home/david/.openclaw/workspace-english-teacher/skills/vocab-trainer/packages/vocab-mcp/src/index.ts"
```

## MCP 工具列表

| 工具                    | 功能                                                           |
| ----------------------- | -------------------------------------------------------------- |
| `vocab_review`          | 获取今日待复习单词列表                                         |
| `vocab_review_feedback` | 提交复习反馈（pass/fail/fuzzy），更新单词 level 和下次复习时间 |
| `vocab_add_word`        | 添加新词到词库                                                 |
| `vocab_get_status`      | 获取词库整体状态（统计、各等级数量、streak 等）                |
| `vocab_list_words`      | 列出单词（支持按 level 筛选）                                  |
| `vocab_remove_word`     | 从词库移除单词                                                 |
| `vocab_get_word_detail` | 获取单词详情（用于 learn 模式展示完整卡片）                    |

## 执行流程

```
用户输入 /vocab xxx
  → 调用对应的 MCP 工具（如 vocab_review）
  → MCP 服务器读写 ~/.vocab-trainer/words.db (SQLite)
  → 返回结构化结果
  → 大模型渲染展示给用户
  → 用户反馈后调用 vocab_review_feedback 更新
  → 完成
```

**禁止**：直接用 read/edit 工具读写数据库文件。

---

# 背单词技能 — 艾宾浩斯间隔重复系统

## 数据存储

所有单词保存在 `~/.vocab-trainer/words.db` (SQLite)，如果文件不存在则自动创建。

### 数据库 Schema

```sql
CREATE TABLE words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL UNIQUE,           -- 单词原型（小写存储）
  word_lower TEXT NOT NULL,
  meaning TEXT DEFAULT '',
  phonetic TEXT DEFAULT '',
  pos TEXT DEFAULT '',
  example TEXT DEFAULT '',              -- 兼容字段（单个例句）
  example_cn TEXT DEFAULT '',            -- 兼容字段
  examples TEXT DEFAULT '[]',           -- JSON数组: [{en, cn}, ...] 3个例句
  collocations TEXT DEFAULT '[]',       -- JSON数组: ["常见搭配1", ...]
  synonyms TEXT DEFAULT '[]',           -- JSON数组: ["近义词1", ...]
  antonyms TEXT DEFAULT '[]',           -- JSON数组: ["反义词1", ...]
  source TEXT DEFAULT 'user',
  added TEXT NOT NULL,
  level INTEGER DEFAULT 0,              -- 0-9
  next_review TEXT NOT NULL,            -- ISO8601 datetime
  interval_minutes INTEGER DEFAULT 20,  -- 间隔分钟数
  error_count INTEGER DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  history TEXT DEFAULT '[]',
  prototype TEXT DEFAULT '',            -- 词根（英文）
  variant TEXT DEFAULT '',              -- 变体JSON: [{form, value}]
  etymology TEXT DEFAULT ''             -- 词源（中文）
);

CREATE TABLE stats (
  id INTEGER PRIMARY KEY DEFAULT 1,
  version INTEGER DEFAULT 2,            -- schema version 2
  streak INTEGER DEFAULT 0,
  last_review_date TEXT,               -- ISO8601 datetime
  total_reviews INTEGER DEFAULT 0,
  review_batch_time TEXT DEFAULT '08:30'
);
```

### 单词字段

| 字段              | 说明                                          |
| ----------------- | --------------------------------------------- |
| `word`            | 单词原型（小写存储）                          |
| `meaning`         | 中文释义                                      |
| `phonetic`        | 音标（如 `/ˈspeərɪŋli/`）                     |
| `pos`             | 词性 (n/v/adj/adv/prep/conj/phrase)           |
| `example`         | 含该词的英文例句（兼容性保留）                 |
| `example_cn`      | 例句中文翻译（兼容性保留）                     |
| `examples`        | 3个例句数组: [{en, cn}, ...]                  |
| `collocations`    | 常见搭配数组: ["scrutinize closely", ...]     |
| `synonyms`        | 近义词数组: ["examine", "inspect", ...]        |
| `antonyms`        | 反义词数组: ["ignore", "overlook", ...]        |
| `source`          | 来源（用户手动添加 / /eng 分析 / 阅读材料等） |
| `added`           | 添加时间 (ISO8601 datetime)                   |
| `level`           | 掌握等级 0-9                                  |
| `next_review`     | 下次复习时间 (ISO8601 datetime)               |
| `interval_minutes`| 当前间隔分钟数                                |
| `error_count`     | 累计错误次数                                  |
| `review_count`    | 累计复习次数                                  |
| `history`         | 复习历史记录数组（JSON 格式）                 |
| `prototype`       | 词根（英文）                                   |
| `variant`         | 变体数组 JSON: `[{"form":"past","value":"walked"}]` |
| `etymology`       | 词源（中文）                                   |

### history 数组条目

| 字段     | 说明                      |
| -------- | ------------------------- |
| `date`   | 复习日期                  |
| `result` | `pass` / `fail` / `fuzzy` |

## 掌握等级 (level)

```
0 — 🆕 新词      尚未复习 / 刚添加
1 — ⏰ 初记      已复习 1 次
2 — 📝 短记      已复习 2 次
3 — 🔄 强化      已复习 3 次，进入中期巩固
4 — 💪 过渡      间隔 1 天，长期记忆过渡期
5 — 📈 长期      间隔 2 天，进入长期记忆
6 — 🧠 深度      间隔 7 天，深度记忆
7 — ⭐ 持久      间隔 15 天，持久记忆
8 — 🏆 专家      间隔 30 天，专家级
9 — ✅ 大师      间隔 60 天，完全掌握
```

## 艾宾浩斯复习间隔

```
正确 (pass) → 推进到下一间隔
错误 (fail) → Level 0-3: 重置到 level 0, 20分钟; Level 4+: 保持级别, 20分钟后重试
模糊 (fuzzy) → 间隔 ÷3（最小 20 分钟），level 不变
连续复习 (streak) → 24 小时内有复习即连续

┌───────────────────────────────────────────────────────────────┐
│  Level 0    间隔 20 分钟    🆕 新词                           │
│  Level 1    间隔 1 小时    ⏰ 初次记忆                        │
│  Level 2    间隔 4 小时    📝 短期强化                        │
│  Level 3    间隔 12 小时   🔄 中期巩固                        │
│  Level 4    间隔 1 天      💪 过渡期                          │
│  Level 5    间隔 2 天      📈 长期记忆                        │
│  Level 6    间隔 7 天      🧠 深度记忆                        │
│  Level 7    间隔 15 天     ⭐ 持久记忆                        │
│  Level 8    间隔 30 天     🏆 专家级                          │
│  Level 9    间隔 60 天     ✅ 完全掌握                         │
└───────────────────────────────────────────────────────────────┘

新增词首次复习: 立即可复习（无需等待）
连续复习 streak: 24 小时内有复习即保持连续
```

## 子命令处理流程

### 1. `/vocab add <内容>`

**处理步骤：**

1. 解析用户输入，提取待添加的单词（逗号分隔或自然语言句子）
2. **Lemmatization（词形还原）**：将每个单词还原为原型
   - "foundations" → "foundation"
   - "tricks" → "trick"
   - "running" → "run"
3. 检查是否已存在（通过 lemmatized form 匹配），存在则跳过并提示
4. 调用 `vocab_add_word` 添加单词
   - **自动生成 enrichment**：MCP 工具会自动调用 LLM 生成 examples, collocations, synonyms, antonyms, prototype, variant, etymology
5. 输出确认信息

**vocab_add_word 参数（enrichment 字段已自动生成，无需手动传入）：**

```typescript
vocab_add_word({
  word: string,           // 原型形式（必填）
  meaning?: string,       // 中文释义（如不提供将自动生成）
  phonetic?: string,      // 音标（如不提供将自动生成）
  pos?: string,           // 词性（如不提供将自动生成）
  example?: string,        // 英文例句（兼容性保留）
  example_cn?: string,     // 例句翻译（兼容性保留）
  source?: string
})
```

**注意：** examples, collocations, synonyms, antonyms, prototype, variant, etymology 由 `vocab_add_word` MCP 工具自动调用 LLM 生成并存储，无需手动提供。

**输出格式（单个词）：**

```
✅ 已添加到复习队列

| 字段 | 内容 |
|------|------|
| 单词 | fraught |
| 音标 | /frɔːt/ |
| 词性 | adj |
| 释义 | 充满（不愉快事物）的 |
| 例句 | The project is fraught with risks. |
| 翻译 | 这个项目充满风险。 |
| 首次复习 | 立即可复习 |

💡 当前词库共 47 词，今日待复习 5 词
```

**输出格式（批量添加）：**

```
✅ 批量添加完成

| 单词 | 释义 | 首次复习 |
|------|------|----------|
| fraught | 充满...的 | 明天 |
| resilient | 有韧性的 | 明天 |
| ambiguous | 模棱两可的 | 明天 |
| ephemeral | 短暂的 | 明天 |

⏭️ 已跳过 1 词（sparingly 已存在）

💡 当前词库共 50 词，今日待复习 5 词
```

**从句子中提取单词：**

当用户输入 `/vocab add The project is fraught with risks.` 时：

- 自动识别句中可能的生僻/重点词汇（fraught, risks）
- 跳过基础词汇（the, is, with）
- 输出建议添加的词列表，让用户确认

```
📝 从句子中识别到以下词汇：

  - fraught (adj) — 充满...的
  - risks (n) — 风险

是否全部添加？输入 `/vocab add fraught, risks` 确认。
```

**重复添加检测：**

添加单词时，以**小写形式**比对已有词库。如果已存在：

```
⚠️ "sparingly" 已存在于词库中（level 3，上次复习 3 天前）

如需重新开始学习，先移除再添加：
  /vocab remove sparingly
  /vocab add sparingly
```

**与 `/vocab learn` 的区别：**

| 指令           | 行为                                                       |
| -------------- | ---------------------------------------------------------- |
| `/vocab add`   | 静默添加到复习队列，不展示学习内容，适合批量导入           |
| `/vocab learn` | 先展示完整学习卡片（音标、释义、例句、词根等），再加入队列 |

建议：第一次接触的生词用 `/vocab learn` 逐个学，已认识的词用 `/vocab add` 批量导入。

---

### 2. `/vocab` 或 `/vocab review`

**处理步骤：**

1. 读取数据库
2. 筛选 `today >= next_review` 的单词
3. 如果没有待复习单词，输出「今日无待复习」提示并退出
4. 随机打乱顺序
5. 逐个展示，等待用户作答反馈
6. 根据反馈更新 level、interval、next_review
7. 更新 streak（今天是否是连续复习）
8. 更新数据库
9. 输出本轮总结

**单个词展示格式：**

```
┌─────────────────────────────────────────────┐
│  📝 复习 1/5                                │
│                                             │
│     **sparingly**                           │
│     /ˈspeərɪŋli/  adv                       │
│                                             │
│     请回忆这个词的意思，然后回复任意内容     │
│     揭晓答案...                             │
└─────────────────────────────────────────────┘
```

**用户回复后揭晓：**

```
┌─────────────────────────────────────────────┐
│  **sparingly**  — 适量地，节俭地              │
│                                             │
│  📝 例句: Use comments sparingly.           │
│  🔄 翻译: 注释要简洁克制。                    │
│                                             │
│  上次复习: 2 天前 | 当前等级: 🙂 眼熟        │
│                                             │
│  你记住了吗？                                │
│  ✅ 记住了  ❌ 没记住  ⏭️ 模糊               │
└─────────────────────────────────────────────┘
```

**用户反馈处理规则：**

| 反馈      | Level 0-3 变化       | Level 4+ 变化        | interval 变化        |
| --------- | -------------------- | -------------------- | ------------------- |
| ✅ 记住了 | +1 (最高 9)          | +1 (最高 9)          | 按间隔表推进         |
| ❌ 没记住 | 重置为 level 0       | 保持级别不变         | 20 分钟              |
| ⏭️ 模糊   | 不变                 | 不变                 | ÷3（最小 20 分钟）   |

**无待复习词时的输出：**

```
📭 今天没有待复习的单词！

📅 下次复习安排：
  - 明天 (2026-03-25): 3 词 (sparingly, complex, fraught)
  - 后天 (2026-03-26): 2 词 (resilient, ambiguous)

💡 试试添加新词：/vocab add <单词>
```

**复习结束总结：**

```
📊 本轮复习完成

  ✅ 记住了: 3 词 (sparingly, complex, ephemeral)
  ❌ 遗忘: 1 词 (fraught) — 已安排明天重测
  ⏭️ 模糊: 1 词 (resilient) — 已安排 1 天后复测

  📈 累计进度: 新词 12 | 学习中 28 | 已掌握 7
  🔥 连续复习: 第 5 天
  📅 今日共复习: 5 词
```

---

### 3. `/vocab learn <单词>`

与 `/vocab add` 的区别：`add` 是静默添加到队列，`learn` 是**先学再加**，展示完整的单词学习卡片。

**处理步骤：**

1. 解析用户输入，提取要学习的单词（支持逗号分隔多个）
2. **Lemmatization（词形还原）**：将每个单词还原为原型
   - "foundations" → "foundation"
   - "tricks" → "trick"
3. 调用 `vocab_get_word_detail` 获取单词详情
   - 如果词库中已存在该词且有 enrichment 数据，直接返回
   - 如果词库中不存在或无 enrichment 数据，`vocab_add_word` 会自动调用 LLM 生成完整 enrichment 并存储
4. 展示学习卡片给用户（包含 enrichment 返回的 examples, collocations, synonyms, antonyms, prototype, variant, etymology）
5. 根据检查结果显示不同的确认信息：
   - **vocab_add_word 返回 success=true（新词）** → "✅ 已加入复习队列，首次复习：明天"
   - **vocab_add_word 返回 success=false（已存在，且 meaning 非空）** → "⚠️ 该词已在词库中（level X），下次复习：明天"
   - **vocab_add_word 返回 success=false（已存在，但 meaning 为空）** → "✅ 已加入复习队列，首次复习：明天"（信息不完整，当新词处理）
6. 如果词库中已存在该词，仍展示学习卡片并根据 level 显示不同提示

**注意：** enrichment 数据的生成（examples, collocations, synonyms, antonyms, prototype, variant, etymology）由 `vocab_add_word` MCP 工具自动完成，无需手动调用 LLM。

**输出格式（单个词）：**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  📖 学习新词

  **ephemeral**   /ɪˈfemərəl/   adj.

  ┌─────────────────────────────────────┐
  │  释义：短暂的，转瞬即逝的             │
  │                                     │
  │  英文释义：lasting for a very        │
  │  short time                         │
  └─────────────────────────────────────┘

  📝 例句 1：
  The beauty of cherry blossoms is ephemeral.
  樱花之美转瞬即逝。

  📝 例句 2：
  Social media fame is often ephemeral.
  社交媒体上的名声往往昙花一现。

  📝 例句 3：
  He enjoyed the ephemeral joy of victory.
  他享受了胜利带来的短暂喜悦。

  🔗 常见搭配：
  - ephemeral beauty   短暂的美丽
  - ephemeral pleasure 片刻的欢愉
  - prove ephemeral    证明是短暂的

  📊 词根词源：
  epi- (在...之上) + hemera (一天) → 只持续一天的

  🔄 近义词：transient, fleeting, momentary
  🔄 反义词：permanent, enduring, everlasting

  <!-- 末尾根据 vocab_add_word 结果显示以下之一 -->
  <!-- 新词（success=true）：✅ 已加入复习队列，首次复习：明天 -->
  <!-- 已有词（success=false, meaning 非空）：⚠️ 该词已在词库中（level X），下次复习：明天 -->
  <!-- 已有词（success=false, meaning 为空）：✅ 已加入复习队列，首次复习：明天 -->

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**输出格式（批量学习）：**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  📖 批量学习 (1/3)

  **ephemeral**   /ɪˈfemərəl/   adj. 短暂的
  The beauty of cherry blossoms is ephemeral.
  樱花之美转瞬即逝。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  📖 批量学习 (2/3)

  **ubiquitous**   /juːˈbɪkwɪtəs/   adj. 无处不在的
  Smartphones have become ubiquitous in modern life.
  智能手机在现代生活中无处不在。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  📖 批量学习 (3/3)

  **resilient**   /rɪˈzɪliənt/   adj. 有韧性的
  She proved to be resilient in the face of adversity.
  她在逆境中展现出了韧性。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✅ 全部学习完成，3 词已加入复习队列

  <!-- 末尾根据各词的 vocab_add_word 结果汇总显示 -->
  <!-- 新词：✅ 已加入复习队列 -->
  <!-- 已有词：⚠️ 该词已在词库中，跳过 -->
```

**已存在词库中的词：**

当 `vocab_add_word` 返回 `success=false` 且 `meaning` 非空时，表示该词之前已添加过且有完整信息，应显示：

```
📖 学习卡片

  **sparingly**   /ˈspeərɪŋli/   adv.

  释义：适量地，节俭地
  例句：Use comments sparingly.
  翻译：注释要简洁克制。

  ⚠️ 该词已在词库中
  当前等级：😊 熟悉 (level 3)
  上次复习：5 天前
  累计复习：6 次

  💡 仍可查看学习卡片巩固记忆
```

**从句子中学习：**

当用户输入 `/vocab learn The project is fraught with risks.` 时：

```
📝 从句子中识别到以下可学习的词汇：

  1. fraught   /frɔːt/   adj. — 充满（不愉快事物）的
  2. risks     /rɪsks/   n.   — 风险

  输入 `/vocab learn fraught, risks` 查看完整学习卡片。
  或输入 `/vocab learn all` 学习全部。
```

---

### 4. `/vocab status`

**输出格式：**

```
📊 单词掌握总览

  总词库: 47 词

  ✅ 已掌握 (level 5):  7 词  ████████░░░░░░░░ 15%
  💪 巩固中 (level 4):  5 词  ██████░░░░░░░░░░ 11%
  😊 熟悉   (level 3): 10 词  ████████████░░░░ 21%
  🙂 眼熟   (level 2):  8 词  █████████░░░░░░░ 17%
  😰 初识   (level 1):  5 词  ██████░░░░░░░░░░ 11%
  🆕 新词   (level 0): 12 词  ██████████████░░ 26%

  📅 今日待复习: 5 词
  📅 明日待复习: 3 词
  📅 本周待复习: 12 词

  🔥 连续复习: 第 5 天
  📈 累计复习轮数: 82 轮

  🏆 难词榜（错误次数最多的 5 词）:
  1. fraught — 错误 3 次，当前 level 1
  2. ambiguous — 错误 2 次，当前 level 2
  3. ephemeral — 错误 1 次，当前 level 3
  4. resilient — 错误 1 次，当前 level 2
  5. ubiquitous — 错误 1 次，当前 level 3
```

---

### 5. `/vocab list [filter]`

**filter 参数：**

| 参数         | 筛选条件                     |
| ------------ | ---------------------------- |
| `all` 或不填 | 全部单词                     |
| `new`        | level = 0                    |
| `learning`   | level 1-3                    |
| `hard`       | level ≤ 1 且 error_count ≥ 1 |
| `mastered`   | level >= 8                   |
| `today`      | next_review ≤ 今天           |

**输出格式：**

```
😰 难词列表 (level ≤ 1，共 5 词)

| # | 单词 | 释义 | 等级 | 下次复习 | 错误 | 添加日期 |
|---|------|------|------|----------|------|----------|
| 1 | fraught | 充满...的 | 😰 1 | 明天 | 3 | 03-20 |
| 2 | resilient | 有韧性的 | 😰 1 | 后天 | 2 | 03-21 |
| 3 | ambiguous | 模棱两可的 | 🆕 0 | 明天 | 1 | 03-23 |
| 4 | ubiquitous | 无处不在的 | 🆕 0 | 明天 | 1 | 03-22 |
| 5 | ephemeral | 短暂的 | 😰 1 | 3天后 | 1 | 03-19 |
```

---

### 6. `/vocab remove <word>`

**处理步骤：**

1. 从数据库查找匹配单词（大小写不敏感）
2. 找到则删除，输出确认
3. 未找到则提示

**输出格式：**

```
🗑️ 已移除 "ephemeral"

  释义: 短暂的
  最终等级: 🙂 眼熟 (level 2)
  共复习过 4 次

当前词库: 46 词
```

**未找到时：**

```
❓ 词库中未找到 "xyz"

💡 查看完整词库：/vocab list all
```

---

## 首次使用初始化

当 `~/.vocab-trainer/words.db` 不存在时，SQLite 数据库会自动创建，并初始化 schema。

并输出欢迎信息：

```
📚 背单词系统已初始化！

词库为空，开始添加你的第一批单词：

  /vocab add <单词>              — 添加单个或多个词
  /eng <英文句子>                — 分析后一键添加重点词汇

💡 试试：/vocab add ephemeral, ubiquitous, resilient
```

---

## 与 /eng 技能联动

当用户通过 `/eng` 分析英文后，使用 `/vocab add` 或 `/vocab learn` 添加词汇时：

- 自动从最近一次 `/eng` 分析结果中匹配例句和释义
- `source` 字段记录为：`/eng 分析 "原文片段"`
- 如果用户添加的词不在最近一次分析中，则由技能自行查询释义并生成例句

---

## 技术要点

### 数据库操作

```
每次操作开始 → 读取数据库 → 内存中处理 → 更新数据库
```

### 日期格式

所有日期统一使用 `YYYY-MM-DD` 格式（如 `2026-03-24`）。

### 今日判定

「今天」的日期由用户所在时区决定。如果无法确定时区，默认使用 Asia/Shanghai (UTC+8)。

### 并发安全

由于是 prompt-based 技能，不存在真正的并发问题。SQLite 提供 ACID 保证，每次操作都应完整读取 → 修改 → 更新，避免丢失数据。

---

### 复习流程 (/vocab review)

1. 调用 `vocab_review` 获取今日待复习单词列表
2. 大模型逐个展示给用户，让用户回忆
3. 用户回答后，调用 `vocab_review_feedback` 批量提交
4. 程序精确更新 level，大模型渲染返回结果

### 添加单词 (/vocab add)

1. 调用 `vocab_add_word` 添加单词
2. 返回添加结果（是否成功、首次复习日期等）

### 查看状态 (/vocab status)

1. 调用 `vocab_get_status` 获取统计数据
2. 大模型渲染为友好的表格展示
