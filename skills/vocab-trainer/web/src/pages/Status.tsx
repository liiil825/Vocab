import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getStatus().then((data: any) => { setStatus(data); setLoading(false); }); }, []);

  if (loading) return <div className='text-text-secondary'>加载中...</div>;
  if (!status) return <div className='text-text-secondary'>加载失败</div>;

  const stats = [
    { label: '今日待复习', value: status.today_due, color: 'text-accent' },
    { label: '连续天数', value: status.streak, color: 'text-warning' },
    { label: '总单词数', value: status.total_words, color: 'text-success' },
    { label: '总复习次数', value: status.total_reviews, color: 'text-text-primary' },
  ];

  const levels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const maxCount = Math.max(...levels.map(l => status.level_stats?.[l] ?? 0), 1);

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
              const count = status.level_stats?.[level] ?? 0;
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