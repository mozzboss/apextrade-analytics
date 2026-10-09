import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LivePriceRow({ price, change, pct, dp, isLive }) {
  const up = (change || 0) >= 0;
  return (
    <div className="flex items-end gap-3 mb-1">
      <div className="text-3xl font-display font-semibold tabular-nums tracking-tight">
        {price != null ? Number(price).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp }) : '—'}
      </div>
      {change != null && (
        <div className={cn('flex items-center gap-1 text-sm font-medium pb-1.5', up ? 'text-bullish' : 'text-bearish')}>
          {up ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          {up ? '+' : ''}{Number(change).toFixed(dp)}
          {pct != null && <span className="text-xs opacity-80">({pct >= 0 ? '+' : ''}{Number(pct).toFixed(2)}%)</span>}
        </div>
      )}
      {isLive && (
        <span className="ml-auto pb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-bullish">
          <span className="w-1.5 h-1.5 rounded-full bg-bullish animate-pulse" /> Live
        </span>
      )}
    </div>
  );
}