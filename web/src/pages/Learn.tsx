import { useState } from 'react';
import { postWord } from '../api';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import FadeIn from '../components/motion/FadeIn';

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
    if (!word.trim()) { setError('请输入单词'); return; }
    const res = await postWord({ word: word.trim(), meaning: meaning.trim(), phonetic: phonetic.trim(), pos: pos.trim(), example: example.trim(), example_cn: exampleCn.trim(), source: 'user' });
    setResult(res);
    if (res.success) {
      setWord(''); setMeaning(''); setPhonetic(''); setPos(''); setExample(''); setExampleCn('');
      setError('');
    } else {
      setError(res.message);
    }
  };

  return (
    <div className='max-w-xl mx-auto'>
      <FadeIn>
        <h1 className='text-2xl font-bold text-text-primary tracking-tight mb-2'>添加新单词</h1>
        <p className='text-text-secondary mb-6 text-sm'>建立你的个人词库</p>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Card hover={false}>
          <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
            <Input label='单词 *' value={word} onChange={e => setWord(e.target.value)} placeholder='输入英文单词' />
            <Input label='含义' value={meaning} onChange={e => setMeaning(e.target.value)} placeholder='中文释义（可选）' />
            <Input label='音标' value={phonetic} onChange={e => setPhonetic(e.target.value)} placeholder='/fəˈnetɪk/' />
            <Input label='词性' value={pos} onChange={e => setPos(e.target.value)} placeholder='n. v. adj. adv.' />
            <Input label='例句' value={example} onChange={e => setExample(e.target.value)} placeholder='English sentence...' multiline rows={2} />
            <Input label='例句中文' value={exampleCn} onChange={e => setExampleCn(e.target.value)} placeholder='例句翻译...' multiline rows={2} />

            {error && <p className='text-danger text-sm'>{error}</p>}
            {result?.success && <p className='text-success text-sm'>{result.message}</p>}

            <Button className='w-full mt-2'>添加单词</Button>
          </form>
        </Card>
      </FadeIn>
    </div>
  );
}
