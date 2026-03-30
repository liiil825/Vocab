import { useState } from 'react';
import { postWord } from '../api';

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
    if (!word.trim()) {
      setError('请输入单词');
      return;
    }

    const res = await postWord({
      word: word.trim(),
      meaning: meaning.trim(),
      phonetic: phonetic.trim(),
      pos: pos.trim(),
      example: example.trim(),
      example_cn: exampleCn.trim(),
      source: 'user'
    });

    setResult(res);
    if (res.success) {
      setWord('');
      setMeaning('');
      setPhonetic('');
      setPos('');
      setExample('');
      setExampleCn('');
    } else {
      setError(res.message);
    }
  };

  return (
    <div>
      <h2>添加新单词</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>
          <label>单词 *</label><br />
          <input
            type="text"
            value={word}
            onChange={e => setWord(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div>
          <label>含义</label><br />
          <input
            type="text"
            value={meaning}
            onChange={e => setMeaning(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div>
          <label>音标</label><br />
          <input
            type="text"
            value={phonetic}
            onChange={e => setPhonetic(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div>
          <label>词性</label><br />
          <input
            type="text"
            value={pos}
            onChange={e => setPos(e.target.value)}
            placeholder="如: n., v., adj."
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div>
          <label>例句</label><br />
          <textarea
            value={example}
            onChange={e => setExample(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div>
          <label>例句中文</label><br />
          <textarea
            value={exampleCn}
            onChange={e => setExampleCn(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {result?.success && <p style={{ color: 'green' }}>{result.message}</p>}
        <button type="submit" style={{ padding: '10px', cursor: 'pointer' }}>
          添加
        </button>
      </form>
    </div>
  );
}
