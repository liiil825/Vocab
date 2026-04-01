import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getWordDetail, getWordEnrich, updateWord, type EnrichData } from '../api';
import Button from './ui/Button';

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
  prototype?: string;
  variant?: string;
  etymology?: string;
};

type Props = {
  word: string;
  onClose: () => void;
  onUpdated?: () => void;
};

const LEVEL_LABELS = ['新词', '初记', '短记', '强化', '过渡', '长期', '深度', '持久', '专家', '大师'];

export default function WordModal({ word, onClose, onUpdated }: Props) {
  const [detail, setDetail] = useState<WordDetail | null>(null);
  const [enrich, setEnrich] = useState<EnrichData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [form, setForm] = useState({ meaning: '', phonetic: '', pos: '', example: '', example_cn: '', etymology: '' });

  useEffect(() => {
    Promise.all([getWordDetail(word), getWordEnrich(word)]).then(([d, e]) => {
      setDetail(d);
      setEnrich(e);
      setForm({
        meaning: d.meaning || '',
        phonetic: d.phonetic || '',
        pos: d.pos || '',
        example: d.example || '',
        example_cn: d.example_cn || '',
        etymology: d.etymology || e?.etymology || '',
      });
      setLoading(false);
    });
  }, [word]);

  const handleSave = async () => {
    if (!detail) return;
    setSaving(true);
    await updateWord(word, form);
    // Re-fetch both detail and enrich to show updated data
    const [updated, enrichData] = await Promise.all([getWordDetail(word), getWordEnrich(word)]);
    setDetail(updated);
    setEnrich({ ...enrichData, etymology: updated.etymology || enrichData?.etymology || '' });
    setForm({
      meaning: updated.meaning || '',
      phonetic: updated.phonetic || '',
      pos: updated.pos || '',
      example: updated.example || '',
      example_cn: updated.example_cn || '',
      etymology: updated.etymology || enrichData?.etymology || '',
    });
    setSaving(false);
    setEditMode(false);
    onUpdated?.();
  };

  const handleCancel = () => {
    if (detail) {
      setForm({
        meaning: detail.meaning || '',
        phonetic: detail.phonetic || '',
        pos: detail.pos || '',
        example: detail.example || '',
        example_cn: detail.example_cn || '',
        etymology: detail.etymology || enrich?.etymology || '',
      });
    }
    setEditMode(false);
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key='backdrop'
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className='fixed inset-0 z-50 bg-black/70 backdrop-blur-sm'
        onClick={onClose}
      />
      {/* Modal */}
      <motion.div
        key='modal'
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className='fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none'
      >
        <div className='bg-surface-elevated border border-border rounded-2xl shadow-2xl shadow-black/50 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col pointer-events-auto'>
          {loading || !detail ? (
            <div className='p-8 text-center text-text-secondary'>加载中...</div>
          ) : (
            <>
              {/* Header */}
              <div className='flex items-center justify-between px-6 py-4 border-b border-border'>
                <div className='flex items-center gap-3'>
                  <span className='text-xl font-bold text-text-primary'>{detail.word}</span>
                  <span className='text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent'>
                    Lv.{detail.level} {LEVEL_LABELS[detail.level]}
                  </span>
                </div>
                <div className='flex items-center gap-2'>
                  {editMode ? (
                    <>
                      <Button variant='ghost' size='sm' onClick={handleCancel} disabled={saving}>取消</Button>
                      <Button size='sm' onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</Button>
                    </>
                  ) : (
                    <>
                      <Button variant='ghost' size='sm' onClick={onClose}>关闭</Button>
                      <Button variant='primary' size='sm' onClick={() => setEditMode(true)}>编辑</Button>
                    </>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className='flex-1 overflow-y-auto p-6 space-y-4'>
                {editMode ? (
                  /* Edit Form */
                  <div className='space-y-3'>
                    <FormField label='含义' value={form.meaning} onChange={v => setForm(f => ({ ...f, meaning: v }))} placeholder='单词含义' />
                    <FormField label='音标' value={form.phonetic} onChange={v => setForm(f => ({ ...f, phonetic: v }))} placeholder="e.g., /prəˈnaʊnsi/" />
                    <FormField label='词性' value={form.pos} onChange={v => setForm(f => ({ ...f, pos: v }))} placeholder="e.g., n., v., adj." />
                    <FormField label='例句' value={form.example} onChange={v => setForm(f => ({ ...f, example: v }))} placeholder='英文例句' textarea />
                    <FormField label='例句翻译' value={form.example_cn} onChange={v => setForm(f => ({ ...f, example_cn: v }))} placeholder='例句中文翻译' textarea />
                    <FormField label='词源' value={form.etymology} onChange={v => setForm(f => ({ ...f, etymology: v }))} placeholder='词源说明' textarea />
                  </div>
                ) : (
                  /* View Mode */
                  <div className='space-y-3'>
                    <DetailRow label='含义' value={detail.meaning || '-'} />
                    <DetailRow label='音标' value={detail.phonetic || '-'} />
                    <DetailRow label='词性' value={detail.pos || '-'} />
                    <DetailRow label='例句' value={detail.example ? `${detail.example}${detail.example_cn ? `\n${detail.example_cn}` : ''}` : '-'} mono />
                    <DetailRow label='复习次数' value={`${detail.review_count} 次`} />
                    <DetailRow label='错误次数' value={`${detail.error_count} 次`} />
                    <DetailRow label='下次复习' value={new Date(detail.next_review).toLocaleString('zh-CN')} />
                    <DetailRow label='添加时间' value={new Date(detail.added).toLocaleString('zh-CN')} />
                    {detail.etymology && <DetailRow label='词源' value={detail.etymology} />}
                    {enrich?.prototype && <DetailRow label='原型' value={enrich.prototype} />}
                    {detail.history && detail.history.length > 0 && (
                      <div>
                        <div className='text-xs text-text-muted mb-1'>复习历史</div>
                        <div className='space-y-1'>
                          {detail.history.slice(-5).reverse().map((h, i) => (
                            <div key={i} className='text-xs text-text-secondary flex gap-2'>
                              <span>{new Date(h.date).toLocaleString('zh-CN')}</span>
                              <span className={h.result === 'pass' ? 'text-success' : h.result === 'fail' ? 'text-danger' : 'text-warning'}>
                                {h.result === 'pass' ? '✓' : h.result === 'fail' ? '✗' : '~'} {h.result}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className='text-xs text-text-muted mb-0.5'>{label}</div>
      <div className={`text-sm text-text-primary ${mono ? 'font-mono' : ''} whitespace-pre-wrap`}>{value}</div>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, textarea }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; textarea?: boolean }) {
  return (
    <div>
      <div className='text-xs text-text-muted mb-1'>{label}</div>
      {textarea ? (
        <textarea
          className='w-full bg-surface rounded-lg border border-border text-text-primary text-sm px-3 py-2 resize-none focus:outline-none focus:border-accent transition-colors'
          rows={2}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          type='text'
          className='w-full bg-surface rounded-lg border border-border text-text-primary text-sm px-3 py-2 focus:outline-none focus:border-accent transition-colors'
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
