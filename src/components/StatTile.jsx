import React from 'react';
import { cn } from '@/lib/utils';

export default function StatTile({ label, value, sub, tone, className }) {
  const toneClass =
    tone === 'bullish' ? 'text-bullish' : tone === 'bearish' ? 'text-bearish' : tone === 'gold' ? 'text-gold' : 'text-foreground';
  return (
    <div className={cn('rounded-xl border border-border bg-card px-3.5 py-3', className)}>
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1">{label}</div>
      <div className={cn('text-sm font-semibold tabular-nums', toneClass)}>{value ?? '—'}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}