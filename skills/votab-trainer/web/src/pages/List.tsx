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
  const [loading, setLoading] = useState(true);

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
