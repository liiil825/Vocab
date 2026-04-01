/**
 * Enrichment Display Demo Page
 * 演示新的变体表格和视觉区分效果
 */
import { useState } from 'react';
import Card from '../components/ui/Card';
import VariantTable from '../components/enrichment/VariantTable';
import type { VariantEntry } from '../api';

// Mock data to demonstrate the display
const mockVariants: VariantEntry[] = [
  { form: 'past', value: 'walked' },
  { form: 'pp', value: 'walked' },
  { form: 'ing', value: 'walking' },
  { form: '3rd', value: 'walks' },
  { form: 'adj', value: 'walkable' },
];

const mockVariants2: VariantEntry[] = [
  { form: 'es', value: 'explains' },
  { form: 'ed', value: 'explained' },
  { form: 'ing', value: 'explaining' },
];

const mockVariants3: VariantEntry[] = [
  { form: 'past', value: 'navigated' },
  { form: 'pp', value: 'navigated' },
  { form: 'ing', value: 'navigating' },
  { form: 'noun', value: 'navigation' },
  { form: 'noun', value: 'navigator' },
];

export default function EnrichmentDemo() {
  const [activeTab, setActiveTab] = useState<'table' | 'original'>('table');

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Enrichment Display Demo</h1>

      {/* Tab Switcher */}
      <div className="flex gap-2 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab('table')}
          className={`px-4 py-2 rounded-t text-sm font-medium transition-colors ${
            activeTab === 'table'
              ? 'bg-accent text-white'
              : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
          }`}
        >
          新表格格式
        </button>
        <button
          onClick={() => setActiveTab('original')}
          className={`px-4 py-2 rounded-t text-sm font-medium transition-colors ${
            activeTab === 'original'
              ? 'bg-accent text-white'
              : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
          }`}
        >
          原有文字格式
        </button>
      </div>

      {activeTab === 'table' ? (
        <div className="space-y-4">
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-2">
              Walk (演示数据)
            </h2>

            {/* Prototype - Blue */}
            <div className="pl-3 py-2 border-l-2 border-blue-500 bg-blue-500/5 rounded-r">
              <div className="text-xs text-blue-500 uppercase tracking-wider font-medium mb-1">
                原型
              </div>
              <p className="text-text-primary text-sm">
                walk /wɔːk/ (古英语 wealcan "滚动，转动")
              </p>
            </div>

            {/* Variant - Green with Table */}
            <div className="pl-3 py-2 border-l-2 border-green-500 bg-green-500/5 rounded-r">
              <div className="text-xs text-green-500 uppercase tracking-wider font-medium mb-2">
                变体
              </div>
              <VariantTable variants={mockVariants} />
            </div>

            {/* Etymology - Purple */}
            <div className="pl-3 py-2 border-l-2 border-purple-500 bg-purple-500/5 rounded-r">
              <div className="text-xs text-purple-500 uppercase tracking-wider font-medium mb-1">
                词源
              </div>
              <p className="text-text-secondary text-sm">
                源自古英语 wealcan，与 well（井）同源，原意为"滚动、转弯"，后引申为"行走"。
              </p>
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-2">
              Explain (演示数据)
            </h2>

            <div className="pl-3 py-2 border-l-2 border-green-500 bg-green-500/5 rounded-r">
              <div className="text-xs text-green-500 uppercase tracking-wider font-medium mb-2">
                变体
              </div>
              <VariantTable variants={mockVariants2} />
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-2">
              Navigate (演示数据)
            </h2>

            <div className="pl-3 py-2 border-l-2 border-green-500 bg-green-500/5 rounded-r">
              <div className="text-xs text-green-500 uppercase tracking-wider font-medium mb-2">
                变体
              </div>
              <VariantTable variants={mockVariants3} />
            </div>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-2">
              Walk (原有格式)
            </h2>

            <details className="group">
              <summary className="text-xs text-text-secondary uppercase tracking-wider cursor-pointer list-none flex items-center gap-1">
                <span className="text-accent">▶</span> 原型
              </summary>
              <p className="pl-4 text-text-secondary text-sm mt-1">
                walk /wɔːk/ (古英语 wealcan "滚动，转动")
              </p>
            </details>

            <details className="group">
              <summary className="text-xs text-text-secondary uppercase tracking-wider cursor-pointer list-none flex items-center gap-1">
                <span className="text-accent">▶</span> 变体
              </summary>
              <p className="pl-4 text-text-secondary text-sm mt-1 whitespace-pre-wrap">
                过去式: walked, 过去分词: walked, 现在分词: walking, 第三人称单数: walks, 形容词: walkable
              </p>
            </details>

            <details className="group">
              <summary className="text-xs text-text-secondary uppercase tracking-wider cursor-pointer list-none flex items-center gap-1">
                <span className="text-accent">▶</span> 词源
              </summary>
              <p className="pl-4 text-text-secondary text-sm mt-1 whitespace-pre-wrap">
                源自古英语 wealcan，与 well（井）同源，原意为"滚动、转弯"，后引申为"行走"。
              </p>
            </details>
          </Card>
        </div>
      )}

      {/* Style Legend */}
      <Card className="mt-6">
        <h3 className="text-sm font-medium text-text-primary mb-3">样式说明</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500/20 border-l-2 border-blue-500"></div>
            <span className="text-text-secondary">原型 (Proto)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500/20 border-l-2 border-green-500"></div>
            <span className="text-text-secondary">变体 (Variant)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-purple-500/20 border-l-2 border-purple-500"></div>
            <span className="text-text-secondary">词源 (Etymology)</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
