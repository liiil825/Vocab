import { useState, useEffect } from 'react';
import { getReview, postFeedback, getWordEnrich, type EnrichData } from '../api';

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
  interval_days: number;
  error_count: number;
  review_count: number;
  history: { date: string; result: string }[];
};

type FeedbackItem = {
  word: string;
  feedback: "pass" | "fail" | "fuzzy";
};

type FeedbackResult = {
  success: boolean;
  results: { word: string; old_level: number; new_level: number; next_review: string; interval_days: number }[];
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
  const [enrichedData, setEnrichedData] = useState<Record<string, EnrichData>>({});
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReview().then(data => {
      setWords(data.words);
      setLoading(false);
    });
  }, []);

  const enrichCurrentWord = (word: string) => {
    setEnrichLoading(true);
    getWordEnrich(word)
      .then(data => {
        if (!data.error) {
          setEnrichedData(prev => ({ ...prev, [word]: data }));
        }
      })
      .catch(() => {
        // Silently fail - enrich is best-effort
      })
      .finally(() => {
        setEnrichLoading(false);
      });
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

  if (loading) return <div>加载中...</div>;
  if (result) {
    return (
      <div>
        <h2>复习完成！</h2>
        <p>通过: {result.summary.passed}</p>
        <p>失败: {result.summary.failed}</p>
        <p>模糊: {result.summary.fuzzy}</p>
        <p>连续天数: {result.updated_streak}</p>
      </div>
    );
  }
  if (words.length === 0) {
    return <div>今天没有需要复习的单词！</div>;
  }

  const currentWord = words[currentIndex];

  return (
    <div>
      <div style={{ marginBottom: '10px' }}>
        进度: {currentIndex + 1} / {words.length}
      </div>
      <div style={{
        border: '1px solid #ccc',
        borderRadius: '8px',
        padding: '40px',
        textAlign: 'center',
        marginBottom: '20px'
      }}>
        <h2 style={{ fontSize: '32px', marginBottom: '20px' }}>{currentWord.word}</h2>
        {showAnswer ? (
          <div style={{ textAlign: 'left' }}>
            {currentWord.meaning ? (
  <p><strong>含义:</strong> {currentWord.meaning}</p>
) : (
  <p><strong>含义:</strong> <em style={{color: '#888'}}>暂无解释，请参考下方扩展信息</em></p>
)}
            {currentWord.phonetic && <p><strong>音标:</strong> {currentWord.phonetic}</p>}
            {currentWord.pos && <p><strong>词性:</strong> {currentWord.pos}</p>}
            {currentWord.example && (
              <p><strong>例句:</strong> {currentWord.example}</p>
            )}
            {currentWord.example_cn && <p>{currentWord.example_cn}</p>}
            {enrichLoading && <p><em style={{color: '#888'}}>正在获取扩展信息...</em></p>}
            {!enrichLoading && enrichedData[currentWord.word] && (
              <div style={{ marginTop: '16px', borderTop: '1px solid #eee', paddingTop: '12px' }}>
                {enrichedData[currentWord.word].prototype && (
                  <details style={{ marginBottom: '8px' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>原型</summary>
                    <p style={{ margin: '4px 0 0 16px', color: '#444' }}>{enrichedData[currentWord.word].prototype}</p>
                  </details>
                )}
                {enrichedData[currentWord.word].variant && (
                  <details style={{ marginBottom: '8px' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>变体</summary>
                    <p style={{ margin: '4px 0 0 16px', color: '#444' }}>{enrichedData[currentWord.word].variant}</p>
                  </details>
                )}
                {enrichedData[currentWord.word].etymology && (
                  <details style={{ marginBottom: '8px' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>词源词根</summary>
                    <p style={{ margin: '4px 0 0 16px', color: '#444' }}>{enrichedData[currentWord.word].etymology}</p>
                  </details>
                )}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => {
              setShowAnswer(true);
              if (!enrichedData[currentWord.word]) {
                enrichCurrentWord(currentWord.word);
              }
            }}
            style={{
              padding: '10px 30px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            显示答案
          </button>
        )}
      </div>
      {showAnswer && (
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            onClick={() => handleFeedback('fail')}
            style={{ padding: '10px 20px', backgroundColor: '#ff4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            不记得
          </button>
          <button
            onClick={() => handleFeedback('fuzzy')}
            style={{ padding: '10px 20px', backgroundColor: '#ffaa44', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            模糊
          </button>
          <button
            onClick={() => handleFeedback('pass')}
            style={{ padding: '10px 20px', backgroundColor: '#44aa44', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            记得
          </button>
        </div>
      )}
    </div>
  );
}
