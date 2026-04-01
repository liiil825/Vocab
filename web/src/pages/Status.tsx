import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getStatus } from '../api';
import Card from '../components/ui/Card';
import FadeIn from '../components/motion/FadeIn';

type StatusData = {
  total_words: number;
  level_stats: Record<number, number>;
  level_next_review: Record<number, string | null>;
  level0_3_due_count: number;
  level4_plus_due_count: number;
  words_by_time: Record<string, string[]>;
  review_batch_time: string;
  streak: number;
  total_reviews: number;
};

const LEVEL_INFO: Record<number, { label: string; emoji: string }> = {
  0: { label: '新词', emoji: '🆕' },
  1: { label: '初记', emoji: '⏰' },
  2: { label: '短记', emoji: '📝' },
  3: { label: '强化', emoji: '🔄' },
  4: { label: '过渡', emoji: '💪' },
  5: { label: '长期', emoji: '📈' },
  6: { label: '深度', emoji: '🧠' },
  7: { label: '持久', emoji: '⭐' },
  8: { label: '专家', emoji: '🏆' },
  9: { label: '大师', emoji: '✅' },
};

function formatNextReview(isoString: string | null): string {
  if (!isoString) return '-';

  const now = new Date();
  const next = new Date(isoString);
  const diffMs = next.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Format as "MM-DD HH:mm" or "今天 HH:mm" or "明天 HH:mm"
  const month = next.getMonth() + 1;
  const day = next.getDate();
  const hours = next.getHours().toString().padStart(2, '0');
  const minutes = next.getMinutes().toString().padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  if (diffMs < 0) {
    // Overdue
    return `已过期 ${timeStr}`;
  } else if (diffDays === 0) {
    return `今天 ${timeStr}`;
  } else if (diffDays === 1) {
    return `明天 ${timeStr}`;
  } else {
    return `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} ${timeStr}`;
  }
}

export default function Status() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStatus().then((data: any) => {
      setStatus(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className='text-text-secondary'>加载中...</div>;
  if (!status) return <div className='text-text-secondary'>加载失败</div>;

  const levels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const maxCount = Math.max(...levels.map(l => status.level_stats?.[l] ?? 0), 1);

  // Group time slots for Level 0-3 display
  const timeSlots = Object.entries(status.words_by_time || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, words]) => ({
      time,
      count: words.length,
      words: words.join(', ')
    }));

  return (
    <div className='space-y-6'>
      <FadeIn>
        <h1 className='text-2xl font-bold text-text-primary tracking-tight'>学习状态</h1>
      </FadeIn>

      {/* Summary Cards */}
      <div className='grid grid-cols-3 gap-4'>
        <FadeIn delay={0.06}>
          <Card hover={false} className='text-center'>
            <p className='text-3xl font-bold text-success'>{status.total_words}</p>
            <p className='text-text-secondary text-sm mt-1'>总单词数</p>
          </Card>
        </FadeIn>
        <FadeIn delay={0.12}>
          <Card hover={false} className='text-center'>
            <p className='text-3xl font-bold text-warning'>{status.streak}</p>
            <p className='text-text-secondary text-sm mt-1'>连续天数</p>
          </Card>
        </FadeIn>
        <FadeIn delay={0.18}>
          <Card hover={false} className='text-center'>
            <p className='text-3xl font-bold text-text-primary'>{status.total_reviews}</p>
            <p className='text-text-secondary text-sm mt-1'>总复习次数</p>
          </Card>
        </FadeIn>
      </div>

      {/* Today's Review Schedule - Level 0-3 by time */}
      {timeSlots.length > 0 && (
        <FadeIn delay={0.2}>
          <Card hover={false}>
            <h2 className='text-sm text-text-secondary uppercase tracking-wider mb-4'>今日复习时间 (Level 0-3)</h2>
            <div className='space-y-2'>
              {timeSlots.map(({ time, count, words }) => (
                <div key={time} className='flex items-center gap-3 py-2 border-b border-surface-elevated last:border-0'>
                  <span className='text-lg font-mono text-accent w-20'>{time}</span>
                  <span className='text-lg font-bold text-text-primary'>{count} 词</span>
                  <span className='text-sm text-text-muted truncate flex-1' title={words}>{words}</span>
                </div>
              ))}
            </div>
          </Card>
        </FadeIn>
      )}

      {/* Level 4+ Batch Review */}
      <FadeIn delay={0.25}>
        <Card hover={false}>
          <h2 className='text-sm text-text-secondary uppercase tracking-wider mb-4'>高级词汇复习 (Level 4+)</h2>
          <div className='flex items-center gap-4'>
            <div className='flex items-center gap-2'>
              <span className='text-2xl'>⏰</span>
              <span className='text-lg font-mono text-accent'>{status.review_batch_time}</span>
              <span className='text-text-secondary'>批量复习</span>
            </div>
            <div className='h-6 w-px bg-surface-elevated' />
            <div className='flex items-center gap-2'>
              <span className='text-2xl'>📚</span>
              <span className='text-lg font-bold text-warning'>{status.level4_plus_due_count}</span>
              <span className='text-text-secondary'>词待复习</span>
            </div>
          </div>
        </Card>
      </FadeIn>

      {/* Level Distribution */}
      <FadeIn delay={0.3}>
        <Card hover={false}>
          <h2 className='text-sm text-text-secondary uppercase tracking-wider mb-4'>等级分布与下次复习时间</h2>
          <div className='space-y-3'>
            {levels.map(level => {
              const count = status.level_stats?.[level] ?? 0;
              const nextReview = status.level_next_review?.[level] ?? null;
              const pct = (count / maxCount) * 100;
              const info = LEVEL_INFO[level];

              return (
                <div key={level} className='flex items-center gap-3'>
                  <span className='text-xs text-text-muted w-20'>
                    {info.emoji} Lv.{level} {info.label}
                  </span>
                  <div className='flex-1 h-2 bg-surface-elevated rounded-full overflow-hidden'>
                    <motion.div
                      className='h-full bg-accent rounded-full'
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, delay: 0.3 + level * 0.05 }}
                    />
                  </div>
                  <span className='text-xs text-text-secondary w-6 text-right'>{count}</span>
                  <span className='text-xs text-accent w-28 text-right'>
                    {count > 0 ? formatNextReview(nextReview) : '-'}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </FadeIn>
    </div>
  );
}
