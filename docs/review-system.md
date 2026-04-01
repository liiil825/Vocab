# 复习系统设计

## 间隔重复算法

本系统采用改良版艾宾浩斯遗忘曲线，间隔序列为：

```
Level 0: 20 分钟   — 新词/刚添加
Level 1: 1 小时   — 初记
Level 2: 4 小时   — 短记
Level 3: 12 小时  — 强化
Level 4: 1 天     — 过渡
Level 5: 2 天     — 长期
Level 6: 7 天     — 深度
Level 7: 15 天    — 持久
Level 8: 30 天    — 专家
Level 9: 60 天    — 大师
```

## 反馈处理逻辑

### Pass (记住了)
- Level 0-3: `newLevel = level + 1`, `interval = INTERVALS[newLevel]`
- Level 4-9: `newLevel = level + 1` (最高 9), `interval = INTERVALS[newLevel]`

### Fail (没记住)
- **Level 0-3**: `newLevel = 0`, `interval = 20分钟` — 重置到新词状态
- **Level 4+**: `newLevel = level` (保持不变), `interval = 20分钟` — 20分钟后可再次复习，级别不变

### Fuzzy (模糊)
- 所有级别: `newLevel = level` (不变), `interval = max(20, INTERVALS[level] / 3)`

## 关键设计决策

### Level 4+ Fail 不降级的理由

当单词已达到 Level 4+（间隔1天以上），说明用户已经经历过多次复习建立了较强的记忆。此时 fail 并不意味着完全遗忘，而是可能一时想不起来。如果降回 Level 0重新开始20分钟间隔，会打乱复习节奏。

采用"保持级别 + 20分钟后重试"的策略：
- 用户可以在当天晚些时候重新尝试
- 不会因为一次失误丢失几天的复习进度
- 符合"模糊但有印象"的处理逻辑

### 新词首次复习

新添加的单词（Level 0）立即可复习，不需要等待20分钟。这是因为：
- 用户刚学过这个词，遗忘曲线起点较高
- 尽早复习可以巩固记忆
- 20分钟间隔从第一次复习结束后开始计算

## Status 页面显示

### Level 0-3 (短期记忆)
按复习时间分组显示，用户可以看到今天每个时间段需要复习多少词：

```json
{
  "words_by_time": {
    "14:00": ["word1", "word2"],
    "15:30": ["word3"]
  },
  "level0_3_due_count": 3
}
```

### Level 4+ (长期记忆)
显示批量复习时间和待复习数量：

```json
{
  "review_batch_time": "08:30",
  "level4_plus_due_count": 5
}
```

## API 端点

### GET /api/status
返回词库整体状态：

```json
{
  "total_words": 52,
  "level_stats": {"0": 0, "1": 0, "2": 3, "3": 28, "4": 21, ...},
  "level_next_review": {"0": null, "1": null, "2": "...", "3": "...", ...},
  "level0_3_due_count": 0,
  "level4_plus_due_count": 0,
  "words_by_time": {"23:52": ["framework", "tips"], "21:32": ["authentication"]},
  "review_batch_time": "08:30",
  "streak": 1,
  "total_reviews": 11
}
```

### GET /api/settings
获取设置：
```json
{"review_batch_time": "08:30"}
```

### POST /api/settings
更新设置：
```json
{"review_batch_time": "09:00"}
```
