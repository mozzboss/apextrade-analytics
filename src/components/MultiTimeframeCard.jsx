import React from 'react';
import SectionCard from './SectionCard';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

function tfTone(v) {
  const s = String(v || '').toLowerCase();
  if (s.includes('bull')) return 'text-bullish';
  if (s.includes('bear')) return 'text-bearish';
  if (s.includes('pullback') || s.includes('range') || s.includes('neutral')) return 'text-warn';
  return 'text-muted-foreground';
}

const TFS = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'daily', label: 'Daily' },
  { key: 'h4', label: '4H' },
  { key: 'h1', label: '1H' },
  { key: 'm30', label: '30M' },
  { key: 'm15', label: '15M' },
  { key: 'm5', label: '5M' },
];

export default function MultiTimeframeCard({ mtf }) {
  const bias = mtf?.overall_bias || '—';
  const status = mtf?.overall_status || '—';
  const biasTone = bias.toLowerCase().includes('bull') ? 'text-bullish' : bias.toLowerCase().includes('bear') ? 'text-bearish' : 'text-warn';

  return (
    <SectionCard title="Multi-Timeframe Analysis" icon={Clock}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {TFS.map((tf) => (
          <div key={tf.key} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{tf.label}</div>
            <div className={cn('text-sm font-medium mt-0.5', tfTone(mtf?.[tf.key]))}>{mtf?.[tf.key] || '—'}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-border">
        <div className="text-xs text-muted-foreground">Overall Bias: <span className={cn('text-sm font-semibold ml-1', biasTone)}>{bias}</span></div>
        <div className="text-xs text-muted-foreground">Status: <span className="text-sm font-semibold ml-1 text-gold">{status}</span></div>
      </div>
    </SectionCard>
  );
}