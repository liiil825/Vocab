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

  所有单词数据持久化存储在 `~/.vocab-trainer/words.json`。
  每次会话开始时读取该文件，复习/添加后立即更新。
---

# 背单词技能 — 艾宾浩斯间隔重复系统

## 数据存储

所有单词保存在 `~/.vocab-trainer/words.json`，如果文件不存在则自动创建。

### 文件结构

```json
{
  "version": 1,
  "streak": 0,
  "last_review_date": "2026-03-24",
  "total_reviews": 0,
  "words": [
    {
      "word": "sparingly",
      "meaning": "适量地，节俭地",
      "phonetic": "/ˈspeərɪŋli/",
      "pos": "adv",
      "example": "Use comments sparingly.",
      "example_cn": "注释要简洁克制。",
      "source": "/eng 分析 \"Use comments sparingly.\"",
      "added": "2026-03-24",
      "level": 0,
      "next_review": "2026-03-25",
      "interval_days": 1,
      "error_count": 0,
      "review_count": 0,
      "history": [
        {
          "date": "2026-03-25",
          "result": "pass"
        }
      ]
    }
  ]
}
```

### 顶层字段

| 字段               | 说明                     |
| ------------------ | ------------------------ |
| `version`          | 数据格式版本号，当前为 1 |
| `streak`           | 连续复习天数             |
| `last_review_date` | 最近一次复习日期         |
| `total_reviews`    | 累计复习轮数             |
| `words`            | 单词数组                 |

### 单词字段

| 字段            | 说明                                          |
| --------------- | --------------------------------------------- |
| `word`          | 单词本身（小写存储）                          |
| `meaning`       | 中文释义                                      |
| `phonetic`      | 音标（如 `/ˈspeərɪŋli/`）                     |
| `pos`           | 词性 (n/v/adj/adv/prep/conj/phrase)           |
| `example`       | 含该词的英文例句                              |
| `example_cn`    | 例句中文翻译                                  |
| `source`        | 来源（用户手动添加 / /eng 分析 / 阅读材料等） |
| `added`         | 添加日期 (YYYY-MM-DD)                         |
| `level`         | 掌握等级 0-5                                  |
| `next_review`   | 下次复习日期 (YYYY-MM-DD)                     |
| `interval_days` | 当前间隔天数                                  |
| `error_count`   | 累计错误次数                                  |
| `review_count`  | 累计复习次数                                  |
| `history`       | 复习历史记录数组                              |

### history 数组条目

| 字段     | 说明                      |
| -------- | ------------------------- |
| `date`   | 复习日期                  |
| `result` | `pass` / `fail` / `fuzzy` |

## 掌握等级 (level)

```
0 — 🆕 新词      尚未复习
1 — 😰 初识      复习过 1 次，仍需强化
2 — 🙂 眼熟      复习过 2-3 次，大概记得
3 — 😊 熟悉      复习过 4-5 次，基本掌握
4 — 💪 巩固      复习过 6+ 次，较长时间未忘
5 — ✅ 掌握      连续多次正确，已牢固记忆
```

## 艾宾浩斯复习间隔

```
正确 → 推进到下一间隔
错误 → 重置为第 1 天间隔，level 降 1 级（最低降到 0）
模糊 → 间隔减半（最小为 1 天），level 不变

┌─────────────────────────────────────────────────────┐
│  Level 0 → 1    间隔 1 天                            │
│  Level 1 → 2    间隔 2 天                            │
│  Level 2 → 3    间隔 4 天                            │
│  Level 3 → 4    间隔 7 天                            │
│  Level 4 → 5    间隔 15 天                           │
│  Level 5 (已掌握) 间隔 30 天 → 60 天 → 90 天         │
│                                                     │
│  Level 5 连续 3 次 pass → 视为永久掌握，不再主动复习  │
│  任何级别答错 → 间隔重置为 1 天，level = max(0, -1)  │
└─────────────────────────────────────────────────────┘
```

## 子命令处理流程

### 1. `/vocab add <内容>`

**处理步骤：**

1. 读取 `~/.vocab-trainer/words.json`（不存在则创建空文件）
2. 解析用户输入，提取待添加的单词（逗号分隔或自然语言句子）
3. 对每个单词：
   - 查询音标、词性、中文释义
   - 构造一条英文例句和中文翻译
   - 检查是否已存在（小写匹配），存在则跳过并提示
   - 设置 `level=0`，`next_review=明天日期`，`interval_days=1`
4. 追加写入 JSON 文件
5. 输出确认信息

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
| 首次复习 | 明天 (2026-03-25) |

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

1. 读取 `~/.vocab-trainer/words.json`
2. 筛选 `today >= next_review` 的单词
3. 如果没有待复习单词，输出「今日无待复习」提示并退出
4. 随机打乱顺序
5. 逐个展示，等待用户作答反馈
6. 根据反馈更新 level、interval、next_review
7. 更新 streak（今天是否是连续复习）
8. 写回 JSON 文件
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

| 反馈      | level 变化  | interval 变化  | next_review      |
| --------- | ----------- | -------------- | ---------------- |
| ✅ 记住了 | +1 (最高 5) | 按间隔表推进   | today + interval |
| ❌ 没记住 | -1 (最低 0) | 重置为 1       | tomorrow         |
| ⏭️ 模糊   | 不变        | 减半（最小 1） | today + interval |

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
2. 对每个单词，查询并展示完整学习卡片
3. 学习结束后自动加入复习队列（如果尚未存在）
4. 如果词库中已存在该词，仍展示学习卡片并提示当前掌握状态

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

  ✅ 已自动加入复习队列，首次复习：明天 (2026-03-25)

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

  📅 首次复习：明天 (2026-03-25)
```

**已存在词库中的词：**

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
| `mastered`   | level = 5                    |
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

1. 读取 JSON 文件
2. 查找匹配单词（大小写不敏感）
3. 找到则删除并写回，输出确认
4. 未找到则提示

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

当 `~/.vocab-trainer/words.json` 不存在时，自动创建：

```json
{
  "version": 1,
  "streak": 0,
  "last_review_date": null,
  "total_reviews": 0,
  "words": []
}
```

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

### 文件读写顺序

```
每次操作开始 → 读取 words.json → 内存中处理 → 写回 words.json
```

### 日期格式

所有日期统一使用 `YYYY-MM-DD` 格式（如 `2026-03-24`）。

### 今日判定

「今天」的日期由用户所在时区决定。如果无法确定时区，默认使用 Asia/Shanghai (UTC+8)。

### 并发安全

由于是 prompt-based 技能，不存在真正的并发问题。但每次操作都应完整读取 → 修改 → 写回，避免丢失数据。

---

## MCP 工具调用

重构后的 vocab-trainer 提供 MCP 服务器，大模型通过以下 MCP 工具执行实际操作：

### MCP 工具列表

| 工具 | 功能 |
|------|------|
| `vocab_review` | 获取今日待复习的单词列表 |
| `vocab_add_word` | 添加新词到词库 |
| `vocab_review_feedback` | 提交复习反馈，更新单词状态（支持批量） |
| `vocab_get_status` | 获取词库整体状态 |
| `vocab_list_words` | 列出单词（支持筛选） |
| `vocab_remove_word` | 从词库移除单词 |
| `vocab_get_word_detail` | 获取单词详情（用于学习模式） |

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

### MCP 服务器启动

```bash
cd vocab-trainer && npm run start
```

服务器通过 STDIO 与大模型通信。
