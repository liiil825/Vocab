import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getWords, deleteWord } from '../api';
import Card from '../components/ui/Card';
import FadeIn from '../components/motion/FadeIn';
import WordModal from '../components/WordModal';

type WordItem = { word: string; meaning: string; level: number; next_review: string; error_count: number };

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'new', label: '新词' },
  { key: 'learning', label: '学习中' },
  { key: 'hard', label: '困难' },
  { key: 'mastered', label: '已掌握' },
];

const LEVEL_COLORS: Record<number, string> = {
  0: 'bg-accent/20 text-accent',
  1: 'bg-blue-500/20 text-blue-400',
  2: 'bg-cyan-500/20 text-cyan-400',
  3: 'bg-teal-500/20 text-teal-400',
  4: 'bg-green-500/20 text-green-400',
  5: 'bg-emerald-500/20 text-emerald-400',
  6: 'bg-yellow-500/20 text-yellow-400',
  7: 'bg-orange-500/20 text-orange-400',
  8: 'bg-amber-500/20 text-amber-400',
  9: 'bg-red-500/20 text-red-400',
};

function formatReviewTime(isoString: string): { text: string; overdue: boolean } {
  const now = new Date();
  const next = new Date(isoString);
  const diffMs = next.getTime() - now.getTime();
  const overdue = diffMs < 0;

  const hours = next.getHours().toString().padStart(2, '0');
  const minutes = next.getMinutes().toString().padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return { text: `今天 ${timeStr}`, overdue };
  } else if (diffDays === 1) {
    return { text: `明天 ${timeStr}`, overdue };
  } else if (diffDays === -1) {
    return { text: `昨天 ${timeStr}`, overdue: true };
  } else if (diffDays < 0) {
    return { text: `${Math.abs(diffDays)}天前`, overdue: true };
  } else {
    const month = (next.getMonth() + 1).toString().padStart(2, '0');
    const day = next.getDate().toString().padStart(2, '0');
    return { text: `${month}-${day} ${timeStr}`, overdue };
  }
}

export default function List() {
  const [filter, setFilter] = useState('all');
  const [words, setWords] = useState<WordItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getWords(filter === 'all' ? undefined : filter).then((data: any) => {
      setWords(data.words || []);
      setTotal(data.total || 0);
      setLoading(false);
    });
  }, [filter]);

  const handleDelete = async (w: string) => {
    if (!confirm(`确定删除 "${w}"？`)) return;
    await deleteWord(w);
    setWords(prev => prev.filter(x => x.word !== w));
  };

  const handleRefresh = () => {
    setLoading(true);
    getWords(filter === 'all' ? undefined : filter).then((data: any) => {
      setWords(data.words || []);
      setTotal(data.total || 0);
      setLoading(false);
    });
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
        {loading ? (
          <FadeIn><Card hover={false} className='text-center py-12 text-text-secondary'>加载中...</Card></FadeIn>
        ) : words.length === 0 ? (
          <FadeIn><Card hover={false} className='text-center py-12 text-text-secondary'>暂无单词</Card></FadeIn>
        ) : (
          words.map((w, i) => {
            const { text: timeText, overdue } = formatReviewTime(w.next_review);
            return (
              <FadeIn key={w.word} delay={i * 0.03}>
                <motion.div
                  layout
                  onClick={() => setSelectedWord(w.word)}
                  whileHover={{ borderColor: 'rgba(59, 130, 246, 0.5)', scale: 1.005 }}
                  transition={{ duration: 0.15 }}
                  className='flex items-center gap-4 py-3 px-4 rounded-2xl border border-border bg-surface cursor-pointer select-none'
                >
                  {/* Word + Level */}
                  <div className='flex items-center gap-2 min-w-0'>
                    <span className='text-text-primary font-medium truncate'>{w.word}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${LEVEL_COLORS[w.level] ?? 'bg-accent/20 text-accent'}`}>
                      Lv.{w.level}
                    </span>
                  </div>

                  {/* Meaning */}
                  {w.meaning && (
                    <span className='text-text-muted text-sm truncate hidden md:inline flex-1 min-w-0'>
                      {w.meaning}
                    </span>
                  )}

                  {/* Review Time */}
                  <span className={`text-xs shrink-0 ${overdue ? 'text-danger' : 'text-text-muted'}`}>
                    {timeText}
                  </span>

                  {/* Actions */}
                  <div className='flex items-center gap-1 shrink-0'>
                    <button
                      onClick={() => setSelectedWord(w.word)}
                      className='p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors'
                      title='查看 / 编辑'
                    >
                      <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                        <path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'/>
                        <path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'/>
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(w.word)}
                      className='p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors'
                      title='删除'
                    >
                      <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                        <polyline points='3 6 5 6 21 6'/>
                        <path d='M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6'/>
                        <path d='M10 11v6M14 11v6'/>
                        <path d='M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2'/>
                      </svg>
                    </button>
                  </div>
                </motion.div>
              </FadeIn>
            );
          })
        )}
      </div>

      {/* Word Detail/Edit Modal */}
      <AnimatePresence>
        {selectedWord && (
          <WordModal
            word={selectedWord}
            onClose={() => setSelectedWord(null)}
            onUpdated={handleRefresh}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
