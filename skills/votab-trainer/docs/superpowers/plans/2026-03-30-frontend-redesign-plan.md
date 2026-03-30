# Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all 4 pages (Review, Learn, Status, List) with dark immersive theme and smooth animations using framer-motion.

**Architecture:** Install Tailwind CSS v3 for styling + framer-motion for animations. Create reusable UI components. Refactor pages one by one starting with App shell.

**Tech Stack:** Tailwind CSS v3, framer-motion, React, TypeScript

---

## File Map

| File | Change |
|------|--------|
| `web/package.json` | Add `tailwindcss`, `framer-motion`, `@tailwindcss/vite` |
| `web/vite.config.ts` | Add Tailwind plugin |
| `web/src/index.css` | Replace with Tailwind directives + dark theme CSS vars |
| `web/src/components/ui/Button.tsx` | Create: primary/danger/ghost variants, hover/press animations |
| `web/src/components/ui/Card.tsx` | Create: dark surface card with hover effects |
| `web/src/components/ui/Input.tsx` | Create: dark-themed text input/textarea |
| `web/src/components/motion/FadeIn.tsx` | Create: reusable fade-in-up animation wrapper |
| `web/src/App.tsx` | Modify: dark nav with blur, active link highlight |
| `web/src/pages/Review.tsx` | Modify: full redesign with card animations, enrich sections |
| `web/src/pages/Learn.tsx` | Modify: dark form layout with styled inputs |
| `web/src/pages/Status.tsx` | Modify: bento grid stats cards |
| `web/src/pages/List.tsx` | Modify: dark table with filter tabs |

---

## Task 1: Install Dependencies & Configure Tailwind

**Files:**
- Modify: `web/package.json`
- Modify: `web/vite.config.ts`
- Modify: `web/src/index.css`

- [ ] **Step 1: Add dependencies to package.json**

```json
{
  "dependencies": {
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-router-dom": "^7.13.2",
    "framer-motion": "^11.0.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "tailwindcss": "^4.0.0"
  }
}
```

Run in `web/` directory:
```bash
cd web && bun add framer-motion && bun add -d tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Update vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5173
  }
})
```

- [ ] **Step 3: Replace web/src/index.css**

Replace all content with:

```css
@import "tailwindcss";

@theme {
  --color-bg: #0a0a0f;
  --color-surface: #16161d;
  --color-surface-elevated: #1e1e28;
  --color-border: #2a2a36;
  --color-text-primary: #f4f4f5;
  --color-text-secondary: #a1a1aa;
  --color-text-muted: #71717a;
  --color-accent: #3b82f6;
  --color-accent-hover: #60a5fa;
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
}

html {
  background-color: var(--color-bg);
  color: var(--color-text-primary);
}

body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}

#root {
  min-height: 100dvh;
}
```

- [ ] **Step 4: Commit**

```bash
git add web/package.json web/vite.config.ts web/src/index.css
git commit -m "feat: add Tailwind CSS v4 and framer-motion"
```

---

## Task 2: Create UI Components

**Files:**
- Create: `web/src/components/ui/Button.tsx`
- Create: `web/src/components/ui/Card.tsx`
- Create: `web/src/components/ui/Input.tsx`
- Create: `web/src/components/motion/FadeIn.tsx`

- [ ] **Step 1: Create web/src/components/ui/Button.tsx**

```tsx
import { motion } from 'framer-motion';

type ButtonProps = {
  children: React.ReactNode;
  variant?: 'primary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  className = ''
}: ButtonProps) {
  const base: Record<string, string> = {
    primary: 'bg-accent hover:bg-accent-hover text-white',
    danger: 'bg-danger/80 hover:bg-danger text-white',
    ghost: 'bg-transparent hover:bg-surface-elevated text-text-secondary border border-border'
  };

  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-sm rounded-lg',
    md: 'px-5 py-2.5 text-base rounded-xl',
    lg: 'px-6 py-3 text-lg rounded-xl'
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      disabled={disabled}
      className={`
        font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed
        ${base[variant]}
        ${sizes[size]}
        ${className}
      `}
    >
      {children}
    </motion.button>
  );
}
```

- [ ] **Step 2: Create web/src/components/ui/Card.tsx**

```tsx
import { motion } from 'framer-motion';

type CardProps = {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
};

export default function Card({ children, className = '', hover = true }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={hover ? { scale: 1.01, borderColor: '#52525b' } : {}}
      className={`
        bg-surface border border-border rounded-2xl p-6
        transition-all duration-200
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 3: Create web/src/components/ui/Input.tsx**

```tsx
type InputProps = {
  label?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
};

export default function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  multiline = false,
  rows = 3,
  className = ''
}: InputProps) {
  const base = 'w-full bg-surface-elevated border border-border rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors duration-200';

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <label className='text-xs text-text-secondary uppercase tracking-wider'>{label}</label>}
      {multiline ? (
        <textarea
          rows={rows}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`${base} resize-none`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={base}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create web/src/components/motion/FadeIn.tsx**

```tsx
import { motion } from 'framer-motion';

type FadeInProps = {
  children: React.ReactNode;
  delay?: number;
  className?: string;
};

export default function FadeIn({ children, delay = 0, className = '' }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add web/src/components/ui/Button.tsx web/src/components/ui/Card.tsx web/src/components/ui/Input.tsx web/src/components/motion/FadeIn.tsx
git commit -m "feat: create reusable UI components (Button, Card, Input, FadeIn)"
```

---

## Task 3: Redesign App.tsx Navigation

**Files:**
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Replace App.tsx with dark nav**

```tsx
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Review from './pages/Review';
import Learn from './pages/Learn';
import Status from './pages/Status';
import List from './pages/List';

const links = [
  { to: '/', label: '复习' },
  { to: '/learn', label: '学习' },
  { to: '/status', label: '状态' },
  { to: '/list', label: '单词' },
];

function NavLink({ to, label }: { to: string; label: string }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link to={to} className={`relative px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${isActive ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}`}>
      {label}
      {isActive && (
        <motion.div
          layoutId='nav-indicator'
          className='absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full'
          transition={{ duration: 0.2 }}
        />
      )}
    </Link>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className='min-h-[100dvh] bg-bg'>
        <nav className='sticky top-0 z-50 bg-surface/80 backdrop-blur-md border-b border-border'>
          <div className='max-w-4xl mx-auto px-6 h-14 flex items-center justify-between'>
            <span className='text-base font-bold text-text-primary tracking-tight'>Vocab Trainer</span>
            <div className='flex items-center gap-1'>
              {links.map(l => <NavLink key={l.to} {...l} />)}
            </div>
          </div>
        </nav>
        <main className='max-w-4xl mx-auto px-6 py-8'>
          <Routes>
            <Route path='/' element={<Review />} />
            <Route path='/learn' element={<Learn />} />
            <Route path='/status' element={<Status />} />
            <Route path='/list' element={<List />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/App.tsx
git commit -m "feat: redesign App.tsx with dark sticky nav"
```

---

## Task 4: Redesign Review.tsx

**Files:**
- Modify: `web/src/pages/Review.tsx`

- [ ] **Step 1: Replace Review.tsx with redesigned version**

Read the current Review.tsx to understand the existing state management (words, currentIndex, showAnswer, feedbacks, result, enrichedData, enrichLoading).

Then replace the entire file with this content (keep all existing logic for API calls and state management, only change the JSX/UI):

```tsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getReview, postFeedback, getWordEnrich, type EnrichData } from '../api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import FadeIn from '../components/motion/FadeIn';

type WordDetail = {
  word: string;
  meaning: string;
  phonetic: string;
  pos: string;
  example: string;
  example_cn: string;
  prototype: string;
  variant: string;
  etymology: string;
  [key: string]: unknown;
};

type FeedbackItem = { word: string; feedback: 'pass' | 'fail' | 'fuzzy' };

export default function Review() {
  const [words, setWords] = useState<WordDetail[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [enrichedData, setEnrichedData] = useState<Record<string, EnrichData>>({});
  const [enrichLoading, setEnrichLoading] = useState(false);

  useEffect(() => {
    getReview().then((data: any) => {
      setWords(data.words || []);
      setLoading(false);
    });
  }, []);

  const enrichCurrentWord = (word: string) => {
    setEnrichLoading(true);
    getWordEnrich(word)
      .then((data: EnrichData) => {
        if (!data.error) {
          setEnrichedData(prev => ({ ...prev, [word]: data }));
        }
      })
      .catch(() => {})
      .finally(() => setEnrichLoading(false));
  };

  const handleFeedback = (feedback: 'pass' | 'fail' | 'fuzzy') => {
    if (currentIndex >= words.length) return;
    const word = words[currentIndex];
    const newFeedbacks = [...feedbacks, { word: word.word, feedback }];
    setFeedbacks(newFeedbacks);
    setShowAnswer(false);
    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      postFeedback(newFeedbacks).then(setResult);
    }
  };

  if (loading) return (
    <div className='flex items-center justify-center h-64'>
      <div className='text-text-secondary'>加载中...</div>
    </div>
  );

  if (result) return (
    <FadeIn>
      <Card className='text-center'>
        <h2 className='text-2xl font-bold text-text-primary mb-4'>复习完成！</h2>
        <div className='flex justify-center gap-8 text-sm'>
          <div><span className='text-success text-xl font-bold'>{result.summary?.passed ?? 0}</span><span className='text-text-secondary ml-1'>通过</span></div>
          <div><span className='text-danger text-xl font-bold'>{result.summary?.failed ?? 0}</span><span className='text-text-secondary ml-1'>失败</span></div>
          <div><span className='text-warning text-xl font-bold'>{result.summary?.fuzzy ?? 0}</span><span className='text-text-secondary ml-1'>模糊</span></div>
        </div>
        <p className='mt-4 text-accent font-medium'>连续 {result.updated_streak} 天 🔥</p>
        <Button className='mt-6' onClick={() => window.location.reload()}>再来一次</Button>
      </Card>
    </FadeIn>
  );

  if (words.length === 0) return (
    <FadeIn>
      <Card className='text-center py-16'>
        <p className='text-xl text-text-secondary'>今天没有需要复习的单词！</p>
        <p className='text-text-muted text-sm mt-2'>明天再来吧</p>
      </Card>
    </FadeIn>
  );

  const currentWord = words[currentIndex];
  const progress = ((currentIndex) / words.length) * 100;
  const enrich = enrichedData[currentWord.word];

  return (
    <div className='flex flex-col gap-6'>
      {/* Progress */}
      <div className='flex items-center justify-between text-sm text-text-secondary'>
        <span>进度: {currentIndex + 1} / {words.length}</span>
        <div className='w-32 h-1.5 bg-surface-elevated rounded-full overflow-hidden'>
          <motion.div
            className='h-full bg-accent rounded-full'
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      {/* Word Card */}
      <Card hover={false} className='text-center'>
        <AnimatePresence mode='wait'>
          {!showAnswer ? (
            <motion.div key='word' initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.h1
                className='text-5xl font-bold text-text-primary tracking-tight mb-3'
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                {currentWord.word}
              </motion.h1>
              {currentWord.phonetic && (
                <p className='text-text-muted text-lg mb-6'>{currentWord.phonetic}</p>
              )}
              <Button onClick={() => {
                setShowAnswer(true);
                if (!enrichedData[currentWord.word]) enrichCurrentWord(currentWord.word);
              }}>
                显示答案
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key='answer'
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className='text-left space-y-3'
            >
              {/* Meaning */}
              {currentWord.meaning ? (
                <p><span className='text-text-secondary text-sm'>含义</span><br /><span className='text-text-primary text-lg'>{currentWord.meaning}</span></p>
              ) : (
                <p><span className='text-text-muted italic'>暂无解释，请参考下方扩展信息</span></p>
              )}

              {/* Phonetic & POS */}
              <div className='flex gap-4 text-sm'>
                {currentWord.phonetic && <span className='text-text-muted'>{currentWord.phonetic}</span>}
                {currentWord.pos && <span className='text-accent'>{currentWord.pos}</span>}
              </div>

              {/* Examples */}
              {currentWord.example && (
                <p className='text-text-secondary text-sm border-t border-border pt-3 mt-3'>
                  <span className='text-text-muted'>例句: </span>{currentWord.example}
                </p>
              )}
              {currentWord.example_cn && (
                <p className='text-text-muted text-sm'>{currentWord.example_cn}</p>
              )}

              {/* Enrichment Sections */}
              {enrichLoading && <p className='text-text-muted text-sm italic py-2'>正在获取扩展信息...</p>}
              {!enrichLoading && enrich && (
                <div className='border-t border-border pt-3 mt-3 space-y-2'>
                  {enrich.prototype && (
                    <details className='group'>
                      <summary className='text-xs text-text-secondary uppercase tracking-wider cursor-pointer list-none flex items-center gap-1'>
                        <span className='text-accent'>▶</span> 原型
                      </summary>
                      <p className='pl-4 text-text-secondary text-sm mt-1'>{enrich.prototype}</p>
                    </details>
                  )}
                  {enrich.variant && (
                    <details className='group'>
                      <summary className='text-xs text-text-secondary uppercase tracking-wider cursor-pointer list-none flex items-center gap-1'>
                        <span className='text-accent'>▶</span> 变体
                      </summary>
                      <p className='pl-4 text-text-secondary text-sm mt-1 whitespace-pre-wrap'>{enrich.variant}</p>
                    </details>
                  )}
                  {enrich.etymology && (
                    <details className='group'>
                      <summary className='text-xs text-text-secondary uppercase tracking-wider cursor-pointer list-none flex items-center gap-1'>
                        <span className='text-accent'>▶</span> 词源
                      </summary>
                      <p className='pl-4 text-text-secondary text-sm mt-1 whitespace-pre-wrap'>{enrich.etymology}</p>
                    </details>
                  )}
                </div>
              )}

              {/* Feedback Buttons */}
              <div className='flex gap-3 pt-4'>
                <Button variant='danger' size='lg' className='flex-1' onClick={() => handleFeedback('fail')}>不记得</Button>
                <Button variant='ghost' size='lg' className='flex-1' onClick={() => handleFeedback('fuzzy')}>模糊</Button>
                <Button variant='primary' size='lg' className='flex-1' onClick={() => handleFeedback('pass')}>记得</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/Review.tsx
git commit -m "feat: redesign Review.tsx with dark theme and framer-motion animations"
```

---

## Task 5: Redesign Learn.tsx

**Files:**
- Modify: `web/src/pages/Learn.tsx`

- [ ] **Step 1: Replace Learn.tsx**

```tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { postWord } from '../api';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import FadeIn from '../components/motion/FadeIn';

export default function Learn() {
  const [word, setWord] = useState('');
  const [meaning, setMeaning] = useState('');
  const [phonetic, setPhonetic] = useState('');
  const [pos, setPos] = useState('');
  const [example, setExample] = useState('');
  const [exampleCn, setExampleCn] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim()) { setError('请输入单词'); return; }
    const res = await postWord({ word: word.trim(), meaning: meaning.trim(), phonetic: phonetic.trim(), pos: pos.trim(), example: example.trim(), example_cn: exampleCn.trim(), source: 'user' });
    setResult(res);
    if (res.success) {
      setWord(''); setMeaning(''); setPhonetic(''); setPos(''); setExample(''); setExampleCn('');
      setError('');
    } else {
      setError(res.message);
    }
  };

  return (
    <div className='max-w-xl mx-auto'>
      <FadeIn>
        <h1 className='text-2xl font-bold text-text-primary tracking-tight mb-2'>添加新单词</h1>
        <p className='text-text-secondary mb-6 text-sm'>建立你的个人词库</p>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Card hover={false}>
          <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
            <Input label='单词 *' value={word} onChange={e => setWord(e.target.value)} placeholder='输入英文单词' />
            <Input label='含义' value={meaning} onChange={e => setMeaning(e.target.value)} placeholder='中文释义（可选）' />
            <Input label='音标' value={phonetic} onChange={e => setPhonetic(e.target.value)} placeholder='/fəˈnetɪk/' />
            <Input label='词性' value={pos} onChange={e => setPos(e.target.value)} placeholder='n. v. adj. adv.' />
            <Input label='例句' value={example} onChange={e => setExample(e.target.value)} placeholder='English sentence...' multiline rows={2} />
            <Input label='例句中文' value={exampleCn} onChange={e => setExampleCn(e.target.value)} placeholder='例句翻译...' multiline rows={2} />

            {error && <p className='text-danger text-sm'>{error}</p>}
            {result?.success && <p className='text-success text-sm'>{result.message}</p>}

            <Button type='submit' className='w-full mt-2'>添加单词</Button>
          </form>
        </Card>
      </FadeIn>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/Learn.tsx
git commit -m "feat: redesign Learn.tsx with dark form layout"
```

---

## Task 6: Redesign Status.tsx

**Files:**
- Modify: `web/src/pages/Status.tsx`

- [ ] **Step 1: Replace Status.tsx**

```tsx
import { useState, useEffect } from 'react';
import { getStatus } from '../api';
import Card from '../components/ui/Card';
import FadeIn from '../components/motion/FadeIn';

type StatusData = {
  total_words: number;
  level_stats: Record<number, number>;
  streak: number;
  today_due: number;
  tomorrow_due: number;
  total_reviews: number;
};

export default function Status() {
  const [data, setData] = useState<StatusData | null>(null);

  useEffect(() => { getStatus().then(setData); }, []);

  if (!data) return <div className='text-text-secondary'>加载中...</div>;

  const stats = [
    { label: '今日待复习', value: data.today_due, color: 'text-accent' },
    { label: '连续天数', value: data.streak, color: 'text-warning' },
    { label: '总单词数', value: data.total_words, color: 'text-success' },
    { label: '总复习次数', value: data.total_reviews, color: 'text-text-primary' },
  ];

  const levels = [0, 1, 2, 3, 4, 5];
  const maxCount = Math.max(...levels.map(l => data.level_stats?.[l] ?? 0), 1);

  return (
    <div className='space-y-6'>
      <FadeIn>
        <h1 className='text-2xl font-bold text-text-primary tracking-tight'>学习状态</h1>
      </FadeIn>

      <div className='grid grid-cols-2 gap-4'>
        {stats.map((s, i) => (
          <FadeIn key={s.label} delay={i * 0.06}>
            <Card hover={false} className='text-center'>
              <p className={`text-4xl font-bold ${s.color}`}>{s.value}</p>
              <p className='text-text-secondary text-sm mt-1'>{s.label}</p>
            </Card>
          </FadeIn>
        ))}
      </div>

      <FadeIn delay={0.25}>
        <Card hover={false}>
          <h2 className='text-sm text-text-secondary uppercase tracking-wider mb-4'>等级分布</h2>
          <div className='space-y-3'>
            {levels.map(level => {
              const count = data.level_stats?.[level] ?? 0;
              const pct = (count / maxCount) * 100;
              return (
                <div key={level} className='flex items-center gap-3'>
                  <span className='text-xs text-text-muted w-8'>Lv.{level}</span>
                  <div className='flex-1 h-2 bg-surface-elevated rounded-full overflow-hidden'>
                    <motion.div
                      className='h-full bg-accent rounded-full'
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, delay: 0.3 + level * 0.05 }}
                    />
                  </div>
                  <span className='text-xs text-text-secondary w-6 text-right'>{count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </FadeIn>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/Status.tsx
git commit -m "feat: redesign Status.tsx with bento grid cards"
```

---

## Task 7: Redesign List.tsx

**Files:**
- Modify: `web/src/pages/List.tsx`

- [ ] **Step 1: Replace List.tsx**

```tsx
import { useState, useEffect } from 'react';
import { getWords, deleteWord } from '../api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import FadeIn from '../components/motion/FadeIn';

type WordItem = { word: string; meaning: string; level: number; next_review: string; error_count: number };

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'new', label: '新词' },
  { key: 'learning', label: '学习中' },
  { key: 'hard', label: '困难' },
  { key: 'mastered', label: '已掌握' },
];

export default function List() {
  const [filter, setFilter] = useState('all');
  const [words, setWords] = useState<WordItem[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    getWords(filter === 'all' ? undefined : filter).then((data: any) => {
      setWords(data.words || []);
      setTotal(data.total || 0);
    });
  }, [filter]);

  const handleDelete = async (w: string) => {
    if (!confirm(`确定删除 "${w}"？`)) return;
    await deleteWord(w);
    setWords(prev => prev.filter(x => x.word !== w));
  };

  return (
    <div className='space-y-6'>
      <FadeIn>
        <h1 className='text-2xl font-bold text-text-primary tracking-tight'>单词列表</h1>
        <p className='text-text-secondary text-sm mt-1'>共 {total} 个单词</p>
      </FadeIn>

      {/* Filter Tabs */}
      <FadeIn delay={0.05}>
        <div className='flex gap-1 border-b border-border'>
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors duration-200 border-b-2 -mb-px ${
                filter === f.key ? 'text-accent border-accent' : 'text-text-secondary border-transparent hover:text-text-primary'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </FadeIn>

      {/* Word List */}
      <div className='space-y-2'>
        {words.length === 0 ? (
          <FadeIn>
            <Card hover={false} className='text-center py-12 text-text-secondary'>
              暂无单词
            </Card>
          </FadeIn>
        ) : (
          words.map((w, i) => (
            <FadeIn key={w.word} delay={i * 0.03}>
              <Card hover={false} className='flex items-center justify-between py-3'>
                <div className='flex items-center gap-3'>
                  <span className='text-text-primary font-medium'>{w.word}</span>
                  <span className='text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent'>Lv.{w.level}</span>
                  {w.meaning && <span className='text-text-muted text-sm hidden sm:inline'>{w.meaning.slice(0, 30)}{w.meaning.length > 30 ? '...' : ''}</span>}
                </div>
                <div className='flex items-center gap-3'>
                  <span className='text-text-muted text-xs'>{w.next_review}</span>
                  <button onClick={() => handleDelete(w.word)} className='text-text-muted hover:text-danger text-sm transition-colors'>删除</button>
                </div>
              </Card>
            </FadeIn>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/List.tsx
git commit -m "feat: redesign List.tsx with dark filter tabs"
```

---

## Task 8: Verify Build

**Files:**
- Build verification

- [ ] **Step 1: Run build**

```bash
cd web && bun run build
```

Expected: No TypeScript errors, successful build.

- [ ] **Step 2: Commit all remaining changes**

```bash
git add -A && git commit -m "feat: complete dark theme redesign for all pages"
```

---

## Verification

After all tasks:
```bash
cd web && bun run dev
# Open http://localhost:5173 and check all 4 pages render correctly
```

---

## Spec Coverage

| Spec Requirement | Task |
|-----------------|------|
| Dark theme colors | Task 1 (index.css) |
| Button component | Task 2 |
| Card component | Task 2 |
| Input component | Task 2 |
| FadeIn motion wrapper | Task 2 |
| App nav redesign | Task 3 |
| Review page redesign | Task 4 |
| Learn page redesign | Task 5 |
| Status page redesign | Task 6 |
| List page redesign | Task 7 |
| Build verification | Task 8 |
