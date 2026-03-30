import { useState, useEffect } from 'react';
import { getWords, deleteWord, WordSummary } from '../api';

const FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'new', label: '新词' },
  { value: 'learning', label: '学习中' },
  { value: 'hard', label: '困难' },
  { value: 'mastered', label: '已掌握' },
  { value: 'today', label: '今日' }
];

export default function List() {
  const [words, setWords] = useState<WordSummary[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getWords(filter === 'all' ? undefined : filter).then(data => {
      setWords(data.words);
      setLoading(false);
    });
  }, [filter]);

  const handleDelete = async (word: string) => {
    if (!confirm(`确定要删除 "${word}" 吗？`)) return;
    await deleteWord(word);
    setWords(words.filter(w => w.word !== word));
  };

  return (
    <div>
      <h2>单词列表</h2>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding: '8px 16px',
              backgroundColor: filter === f.value ? '#0066cc' : '#eee',
              color: filter === f.value ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div>加载中...</div>
      ) : (
        <>
          <p>共 {words.length} 个单词</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ccc' }}>
                <th style={{ textAlign: 'left', padding: '10px' }}>单词</th>
                <th style={{ textAlign: 'left', padding: '10px' }}>含义</th>
                <th style={{ textAlign: 'center', padding: '10px' }}>Level</th>
                <th style={{ textAlign: 'center', padding: '10px' }}>下次复习</th>
                <th style={{ textAlign: 'center', padding: '10px' }}>错误</th>
                <th style={{ textAlign: 'center', padding: '10px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {words.map(w => (
                <tr key={w.word} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>{w.word}</td>
                  <td style={{ padding: '10px', color: '#666' }}>{w.meaning}</td>
                  <td style={{ textAlign: 'center', padding: '10px' }}>
                    <span style={{
                      backgroundColor: `hsl(${w.level * 30}, 70%, 50%)`,
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '12px'
                    }}>
                      {w.level}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', padding: '10px' }}>{w.next_review}</td>
                  <td style={{ textAlign: 'center', padding: '10px' }}>{w.error_count}</td>
                  <td style={{ textAlign: 'center', padding: '10px' }}>
                    <button
                      onClick={() => handleDelete(w.word)}
                      style={{
                        backgroundColor: '#ff4444',
                        color: 'white',
                        border: 'none',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}