import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getReview, postFeedback, getWordEnrich, getNextReview, type EnrichData } from '../api';
import { playSound } from '../hooks/useSound';
import { useSpeech } from '../hooks/useSpeech';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import FadeIn from '../components/motion/FadeIn';
import { useModal } from '../components/ui/Modal';

type WordDetail = {
  word: string;
  meaning: string;
  phonetic: string;
  pos: string;
  example: string;
  example_cn: string;
  source: string;
  added: string;
  level: number;
  next_review: string;
  interval_minutes: number;
  error_count: number;
  review_count: number;
  history: { date: string; result: string }[];
};

type FeedbackItem = { word: string; feedback: 'pass' | 'fail' | 'fuzzy' };

type FeedbackResult = {
  success: boolean;
  results: { word: string; old_level: number; new_level: number; next_review: string; interval_minutes: number }[];
  summary: { passed: number; failed: number; fuzzy: number };
  updated_streak: number;
  message: string;
};

export default function Review() {
  const [words, setWords] = useState<WordDetail[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [result, setResult] = useState<FeedbackResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrichedData, setEnrichedData] = useState<Record<string, EnrichData>>({});
  const [enrichLoading, setEnrichLoading] = useState(false);
  const { showConfirm } = useModal();
  const { speakWord, speakExample } = useSpeech();
  const [nextReview, setNextReview] = useState<{ word: string; next_review: string; interval_minutes: number } | null>(null);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    getReview().then((data: any) => {
      setWords(data.words || []);
      setLoading(false);
    });
    getNextReview().then((data: any) => {
      setNextReview(data);
    });
  }, []);

  useEffect(() => {
    if (!nextReview) return;
    const updateCountdown = () => {
      const now = new Date();
      const target = new Date(nextReview.next_review);
      const diff = target.getTime() - now.getTime();
      if (diff <= 0) {
        setCountdown('00:00:00');
        return;
      }
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setCountdown(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextReview]);

  const enrichCurrentWord = (word: string) => {
    setEnrichLoading(true);
    getWordEnrich(word)
      .then((data: EnrichData) => {
        setEnrichedData(prev => ({ ...prev, [word]: data }));
      })
      .catch(() => {})
      .finally(() => setEnrichLoading(false));
  };

  const handleFeedback = (feedback: 'pass' | 'fail' | 'fuzzy') => {
    if (currentIndex >= words.length) return;
    const word = words[currentIndex];
    playSound(feedback);
    const newFeedbacks = [...feedbacks, { word: word.word, feedback }];
    setFeedbacks(newFeedbacks);
    setShowAnswer(false);
    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      postFeedback(newFeedbacks).then(setResult);
    }
  };

  const handleEndReview = async () => {
    if (feedbacks.length === 0) {
      await showConfirm({
        title: '还没有复习',
        message: '还没有复习任何单词，请先完成复习。',
        confirmText: '好的',
        variant: 'warning'
      });
      return;
    }
    const confirmed = await showConfirm({
      title: '结束复习',
      message: `确定结束复习？将提交 ${feedbacks.length} 个已复习单词。`,
      confirmText: '确定',
      cancelText: '继续',
      variant: 'warning'
    });
    if (confirmed) {
      postFeedback(feedbacks).then(setResult);
    }
  };

  if (loading) return (
    <div className='flex items-center justify-center h-64'>
      <div className='text-text-secondary'>加载中...</div>
    </div>
  );

  if (result) {
    const failedWords = result.results.filter(r => r.new_level === 0).map(r => r.word);
    const fuzzyWords = result.results.filter(r => r.new_level === r.old_level && r.new_level !== 0).map(r => r.word);

    return (
      <FadeIn>
        <Card className='text-center'>
          <h2 className='text-2xl font-bold text-text-primary mb-4'>复习完成！</h2>
          <div className='flex justify-center gap-8 text-sm'>
            <div><span className='text-success text-xl font-bold'>{result.summary?.passed ?? 0}</span><span className='text-text-secondary ml-1'>通过</span></div>
            <div><span className='text-danger text-xl font-bold'>{result.summary?.failed ?? 0}</span><span className='text-text-secondary ml-1'>失败</span></div>
            <div><span className='text-warning text-xl font-bold'>{result.summary?.fuzzy ?? 0}</span><span className='text-text-secondary ml-1'>模糊</span></div>
          </div>

          {/* Word lists */}
          <div className='mt-5 flex flex-col gap-3 text-left'>
            {failedWords.length > 0 && (
              <div className='flex flex-wrap gap-2 justify-center'>
                <span className='text-danger text-xs font-medium'>失败:</span>
                {failedWords.map(w => (
                  <span key={w} className='px-2 py-0.5 bg-danger/20 text-danger text-xs rounded-full'>{w}</span>
                ))}
              </div>
            )}
            {fuzzyWords.length > 0 && (
              <div className='flex flex-wrap gap-2 justify-center'>
                <span className='text-warning text-xs font-medium'>模糊:</span>
                {fuzzyWords.map(w => (
                  <span key={w} className='px-2 py-0.5 bg-warning/20 text-warning text-xs rounded-full'>{w}</span>
                ))}
              </div>
            )}
          </div>

          <p className='mt-4 text-accent font-medium'>连续 {result.updated_streak} 天</p>
          <Button className='mt-6' onClick={() => window.location.reload()}>再来一次</Button>
        </Card>
      </FadeIn>
    );
  }

  if (words.length === 0) return (
    <FadeIn>
      <Card className='text-center py-16'>
        <p className='text-xl text-text-secondary'>暂时没有需要复习的单词</p>
        {nextReview && countdown && (
          <div className='mt-4'>
            <p className='text-text-muted text-sm'>下一个单词: <span className='text-accent font-medium'>{nextReview.word}</span></p>
            <p className='text-3xl font-mono text-accent mt-2'>{countdown}</p>
            <p className='text-text-muted text-xs mt-1'>后可复习</p>
          </div>
        )}
        {!nextReview && <p className='text-text-muted text-sm mt-2'>明天再来吧</p>}
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
        <div className='flex items-center gap-4'>
          {feedbacks.length > 0 && feedbacks.length < words.length && (
            <button
              onClick={handleEndReview}
              className='text-xs px-3 py-1 rounded-full bg-warning/20 text-warning hover:bg-warning/30 transition-colors'
            >
              结束复习 ({feedbacks.length})
            </button>
          )}
          <div className='w-32 h-1.5 bg-surface-elevated rounded-full overflow-hidden'>
            <motion.div
              className='h-full bg-accent rounded-full'
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      </div>

      {/* Word Card */}
      <Card hover={false} className='text-center'>
        <AnimatePresence mode='wait'>
          {!showAnswer ? (
            <motion.div key='word' initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className='flex items-center justify-center gap-3'>
                <motion.h1
                  className='text-5xl font-bold text-text-primary tracking-tight'
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  {currentWord.word}
                </motion.h1>
                <button
                  onClick={() => speakWord(currentWord.word)}
                  className='text-text-muted hover:text-accent transition-colors p-2'
                  title='播放发音'
                >
                  <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z' />
                  </svg>
                </button>
              </div>
              {currentWord.phonetic && (
                <p className='text-text-muted text-lg mt-3'>{currentWord.phonetic}</p>
              )}
              <Button onClick={() => {
                playSound('reveal');
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
                <div className='flex items-start gap-2 text-text-secondary text-sm border-t border-border pt-3 mt-3'>
                  <span className='text-text-muted shrink-0'>例句:</span>
                  <span className='flex-1'>{currentWord.example}</span>
                  <button
                    onClick={() => speakExample(currentWord.example)}
                    className='text-text-muted hover:text-accent transition-colors p-1 shrink-0'
                    title='播放例句'
                  >
                    <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z' />
                    </svg>
                  </button>
                </div>
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
