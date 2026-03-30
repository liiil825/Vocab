import { useState, useEffect } from 'react';
import { getReview, postFeedback, FeedbackItem, WordDetail, FeedbackResult } from '../api';

export default function Review() {
  const [words, setWords] = useState<WordDetail[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [result, setResult] = useState<FeedbackResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReview().then(data => {
      setWords(data.words);
      setLoading(false);
    });
  }, []);

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
            <p><strong>含义:</strong> {currentWord.meaning}</p>
            {currentWord.phonetic && <p><strong>音标:</strong> {currentWord.phonetic}</p>}
            {currentWord.pos && <p><strong>词性:</strong> {currentWord.pos}</p>}
            {currentWord.example && (
              <p><strong>例句:</strong> {currentWord.example}</p>
            )}
            {currentWord.example_cn && <p>{currentWord.example_cn}</p>}
          </div>
        ) : (
          <button
            onClick={() => setShowAnswer(true)}
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
