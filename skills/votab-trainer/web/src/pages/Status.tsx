import { useState, useEffect } from 'react';
import { getStatus, Status as StatusData } from '../api';

export default function Status() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStatus().then(data => {
      setStatus(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div>加载中...</div>;
  if (!status) return <div>加载失败</div>;

  return (
    <div>
      <h2>学习状态</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px' }}>
          <h3>总单词数</h3>
          <p style={{ fontSize: '32px', margin: 0 }}>{status.total_words}</p>
        </div>
        <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px' }}>
          <h3>连续天数</h3>
          <p style={{ fontSize: '32px', margin: 0 }}>{status.streak}</p>
        </div>
        <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px' }}>
          <h3>今日待复习</h3>
          <p style={{ fontSize: '32px', margin: 0, color: '#ff6600' }}>{status.today_due}</p>
        </div>
        <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px' }}>
          <h3>明日待复习</h3>
          <p style={{ fontSize: '32px', margin: 0 }}>{status.tomorrow_due}</p>
        </div>
      </div>

      <h3 style={{ marginTop: '30px' }}>词汇量分布</h3>
      <div style={{ display: 'flex', gap: '10px' }}>
        {[0, 1, 2, 3, 4, 5].map(level => (
          <div key={level} style={{ textAlign: 'center', flex: 1 }}>
            <div style={{
              height: `${Math.max(20, (status.level_stats[level] || 0) / Math.max(1, status.total_words) * 200)}px`,
              backgroundColor: `hsl(${level * 30}, 70%, 50%)`,
              borderRadius: '4px',
              marginBottom: '5px'
            }} />
            <span>Level {level}: {status.level_stats[level] || 0}</span>
          </div>
        ))}
      </div>

      <p style={{ marginTop: '20px', color: '#666' }}>
        总复习次数: {status.total_reviews}
      </p>
    </div>
  );
}