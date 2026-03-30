# Vocab Trainer 前端重构设计 — 2026-03-30

## Summary

将 Vocab Trainer 前端从简陋的白色内联样式页面，重构为**暗色沉浸风格 + 流畅丰富动效**的现代化界面。

---

## 1. Design System

### 色彩系统

| Token | Hex | 用途 |
|-------|-----|------|
| `background` | `#0a0a0f` | 页面背景 |
| `surface` | `#16161d` | 卡片/容器背景 |
| `surface-elevated` | `#1e1e28` | 悬浮/高亮卡片 |
| `border` | `#2a2a36` | 边框/分割线 |
| `text-primary` | `#f4f4f5` | 主文字 |
| `text-secondary` | `#a1a1aa` | 次要文字 |
| `text-muted` | `#71717a` | 占位/禁用文字 |
| `accent` | `#3b82f6` | 主色调（蓝色） |
| `accent-hover` | `#60a5fa` | 主色悬浮 |
| `success` | `#22c55e` | 通过/成功 |
| `warning` | `#f59e0b` | 模糊/警告 |
| `danger` | `#ef4444` | 失败/危险 |

### Typography
- **字体族**: Geist（无衬线），回退 `system-ui, sans-serif`
- **标题**: `text-2xl font-bold tracking-tight`
- **正文**: `text-base leading-relaxed`
- **标签**: `text-xs text-zinc-400 uppercase tracking-wider`

### Border Radius
- **卡片**: `rounded-2xl`（16px）
- **按钮**: `rounded-xl`（12px）
- **输入框**: `rounded-lg`（8px）

### 动效规范（Level 3-4）

| 类型 | 效果 |
|------|------|
| 页面进入 | `opacity: 0→1`, `y: 20→0`, `duration: 0.4s`, `ease: [0.16, 1, 0.3, 1]` |
| 卡片 Hover | `scale: 1→1.02`, `shadow` 增强, `duration: 0.2s` |
| 按钮 Press | `scale: 1→0.97`, `duration: 0.1s` |
| Stagger | 子元素间隔 `0.06s` 依次进入 |
| 悬浮过渡 | `duration: 0.15s ease-out` |

---

## 2. Page: App.tsx（导航）

### 改造内容
- 深色导航栏 `bg-[#16161d]/80 backdrop-blur`
- 顶部固定 `sticky top-0 z-50`
- Logo/标题在左，路由链接在右
- 路由链接：`复习`、`学习`、`状态`、`单词`
- 当前路由高亮：`text-accent` + 底部下划线
- 移动端：水平滚动

---

## 3. Page: Review.tsx（核心复习页面）

### 布局
```
┌─────────────────────────────────────┐
│  [进度条: 3/10]           [streak🔥] │
├─────────────────────────────────────┤
│                                     │
│         ┌─────────────────┐         │
│         │                 │         │
│         │    WORD         │         │ ← 大字体居中
│         │   /fliːɪŋ/     │         │
│         │                 │         │
│         └─────────────────┘         │
│                                     │
│    [ 显示答案 ]  ← 按钮点击显示       │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  含义: 逃跑、逃离                     │
│  词性: verb                         │
│  例句: The cat was fleeing...       │
│                                     │
│  ▼ 原型       ▼ 变体       ▼ 词源    │ ← 可折叠展开
│                                     │
├─────────────────────────────────────┤
│  [ 不记得 ]  [ 模糊 ]  [ 记得 ]       │ ← 三按钮反馈
└─────────────────────────────────────┘
```

### 交互细节
- 点击"显示答案"：卡片翻转/展开动画，内容 fade-in
- 反馈按钮：颜色区分（红/橙/绿）
- 复习完成：成功动画 + 统计汇总
- 扩展信息（原型/变体/词源）：`<details>` 可折叠，带 chevron 图标动画

---

## 4. Page: Learn.tsx（添加单词）

### 布局
- 标题 + 副标题
- 单词输入框（自动聚焦）
- 表单分组：含义/音标/词性/例句/例句中文
- 提交按钮 + 成功/失败反馈
- 添加历史记录（最近添加的3个单词卡片）

### 表单样式
- Label 在上，输入框在下
- 输入框：`bg-[#1e1e28] border-zinc-700 focus:border-accent`
- Textarea 高度自适应

---

## 5. Page: Status.tsx（统计状态）

### 布局
- 4格 Bento 网格：
  - 今日待复习数（大数字 + 标签）
  - 连续天数（火🔥图标）
  - 总单词数
  - 总复习次数
- 下方：等级分布（0-5级对应条形图）
- 圆角卡片 + 微动效

---

## 6. Page: List.tsx（单词列表）

### 布局
- 顶部筛选器：全部 / 新词 / 学习中 / 困难 / 已掌握
- 单词卡片列表（虚拟滚动如果词多）：
  - 单词 + 等级徽章
  - 含义预览（截断）
  - 下次复习日期
  - 删除按钮（悬浮显示）

### 筛选器
- Tab 式横向排列
- 当前选中：`bg-accent/20 text-accent border-b-2 border-accent`

---

## 7. Component Inventory

### Button
- **变体**: `primary`（蓝色）、`danger`（红色）、`ghost`（透明）
- **状态**: default / hover（scale + shadow）/ active（scale down）/ disabled（opacity 50%）
- **尺寸**: sm / md / lg

### Card
- **背景**: `bg-[#16161d]`
- **边框**: `border border-[#2a2a36]`
- **圆角**: `rounded-2xl`
- **Hover**: `hover:border-zinc-600 hover:scale-[1.01] transition-all duration-200`

### Input
- **背景**: `bg-[#1e1e28]`
- **边框**: `border border-[#2a2a36] focus:border-accent`
- **占位符**: `text-zinc-500`

### ProgressBar
- **轨道**: `bg-[#1e1e28] rounded-full h-1.5`
- **填充**: `bg-accent rounded-full transition-all duration-500`

---

## 8. 实施顺序

### Phase 1: 基础改造
1. 安装 `framer-motion`
2. 提取全局 CSS 变量（暗色主题）
3. 创建基础组件：`Button`、`Card`、`Input`
4. 改造 App.tsx 导航
5. 改造 Review.tsx 页面

### Phase 2: 完成其余页面
6. 改造 Learn.tsx 页面
7. 改造 Status.tsx 页面
8. 改造 List.tsx 页面

---

## 9. 技术栈

- **动画**: `framer-motion`
- **样式**: Tailwind CSS v3（已有配置）
- **字体**: Geist（Google Fonts 或 CDN）
- **图标**: 无（暂不引入图标库）

---

## 10. Out of Scope

- 不改 API 接口
- 不改数据结构/SQLite schema
- 不加新功能
- 不做响应式 Pad/Mobile 专门优化（桌面为主）
- 不引入 Redux/Zustand（React state 够用）
