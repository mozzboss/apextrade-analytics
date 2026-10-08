import React from 'react';
import { cn } from '@/lib/utils';
import { signalTone } from '@/services/signalEngine';

const TONE_CLASSES = {
  bullish: 'bg-bullish/15 text-bullish border-bullish/30',
  bearish: 'bg-bearish/15 text-bearish border-bearish/30',
  warn: 'bg-warn/15 text-warn border-warn/30',
  muted: 'bg-muted text-muted-foreground border-border',
};

export default function SignalBadge({ signal, className }) {
  const tone = signalTone(signal);
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold tracking-wide border', TONE_CLASSES[tone], className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', tone === 'bullish' ? 'bg-bullish' : tone === 'bearish' ? 'bg-bearish' : tone === 'warn' ? 'bg-warn' : 'bg-muted-foreground')} />
      {signal || '—'}
    </span>
  );
}