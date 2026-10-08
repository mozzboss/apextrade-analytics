import React from 'react';
import SectionCard from './SectionCard';
import { Gauge } from 'lucide-react';
import { buildQualityBreakdown, computeSignalScore, gradeFromScore, gradeTone } from '@/services/signalEngine';
import { cn } from '@/lib/utils';

export default function TradeQualityScore({ analysis, setup }) {
  const b = analysis ? computeSignalScore(analysis) : buildQualityBreakdown(setup);
  const grade = setup?.quality_grade || gradeFromScore(b.total);
  const tone = gradeTone(grade);
  const toneClass = tone === 'bullish' ? 'text-bullish' : tone === 'warn' ? 'text-warn' : tone === 'muted' ? 'text-muted-foreground' : 'text-bearish';

  const rows = [
    { label: 'Market Structure', value: b.marketStructure, max: 20 },
    { label: 'Higher-Timeframe Alignment', value: b.htf, max: 20 },
    { label: 'Liquidity', value: b.liquidity, max: 15 },
    { label: 'Momentum', value: b.momentum, max: 15 },
    { label: 'Macro Environment', value: b.macro, max: 15 },
    { label: 'Risk / Reward', value: b.rr, max: 10 },
    { label: 'News Risk', value: b.newsRisk, max: 5 },
  ];

  return (
    <SectionCard title="Trade Quality Score" icon={Gauge}
      action={<div className="flex items-center gap-2">
        <span className={cn('text-lg font-bold tabular-nums', toneClass)}>{b.total}<span className="text-xs text-muted-foreground font-normal">/100</span></span>
        <span className={cn('px-2 py-0.5 rounded-md text-xs font-bold border', tone === 'bullish' ? 'bg-bullish/15 border-bullish/30' : tone === 'warn' ? 'bg-warn/15 border-warn/30' : tone === 'muted' ? 'bg-muted border-border' : 'bg-bearish/15 border-bearish/30', toneClass)}>{grade}</span>
      </div>}>
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="tabular-nums text-foreground font-medium">{r.value}/{r.max}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className={cn('h-full rounded-full', tone === 'bearish' ? 'bg-bearish' : tone === 'warn' ? 'bg-warn' : 'bg-bullish')} style={{ width: `${(r.value / r.max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-border text-[11px] text-muted-foreground">
        Best Setups require grade A+ or A. Lower grades are labeled and should be approached with caution or skipped.
      </div>
    </SectionCard>
  );
}