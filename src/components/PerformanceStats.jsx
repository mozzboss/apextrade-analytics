import React, { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeWinRate, computeAdvancedStats } from '@/services/performanceStats';
import { flagUnderperformingStrategies } from '@/services/learningService';

const PRIORITY_MARKETS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY'];

function fmtCI(ci) {
  if (ci == null) return '';
  return `${ci.low.toFixed(0)}–${ci.high.toFixed(0)}%`;
}

export default function PerformanceStats({ trades = [] }) {
  const wr = useMemo(() => computeWinRate(trades), [trades]);
  const adv = useMemo(() => computeAdvancedStats(trades), [trades]);
  const flagged = useMemo(() => flagUnderperformingStrategies(trades), [trades]);

  return (
    <div className="space-y-5">
      {/* Overall headline metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Win Rate" value={wr.decisive ? `${wr.winRate.toFixed(1)}%` : '—'}
          sub={wr.decisive ? `n=${wr.decisive} · CI ${fmtCI(wr.ci)}` : 'No closed trades'}
          tone={wr.winRate >= 50 ? 'bullish' : wr.decisive ? 'bearish' : undefined} />
        <Stat label="Net P/L" value={`${adv.netPnL >= 0 ? '+' : ''}$${adv.netPnL.toFixed(2)}`} tone={adv.netPnL >= 0 ? 'bullish' : 'bearish'} />
        <Stat label="Profit Factor" value={adv.profitFactor === Infinity ? '∞' : adv.profitFactor.toFixed(2)} tone={adv.profitFactor >= 1.5 ? 'bullish' : 'bearish'} />
        <Stat label="EV / Trade" value={`${adv.expectedValue >= 0 ? '+' : ''}$${adv.expectedValue.toFixed(2)}`} tone={adv.expectedValue >= 0 ? 'bullish' : 'bearish'} />
        <Stat label="Break-even Win Rate" value={`${adv.breakEvenWinRate.toFixed(1)}%`} />
        <Stat label="Avg R/R" value={adv.avgRR ? `1:${adv.avgRR.toFixed(1)}` : '—'} />
        <Stat label="Avg Win" value={`$${adv.avgWin.toFixed(2)}`} tone="bullish" />
        <Stat label="Avg Loss" value={`$${adv.avgLoss.toFixed(2)}`} tone="bearish" />
        <Stat label="Max Drawdown" value={`$${adv.maxDrawdown.toFixed(2)}`} tone="bearish" />
        <Stat label="Longest Loss Streak" value={adv.longestLossStreak} tone={adv.longestLossStreak >= 3 ? 'bearish' : undefined} />
        <Stat label="Current Loss Streak" value={adv.currentLossStreak} tone={adv.currentLossStreak > 0 ? 'bearish' : 'bullish'} />
        <Stat label="Break-even Trades" value={wr.breakeven} />
      </div>

      {wr.decisive < 20 && wr.decisive > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/5 px-3.5 py-2.5 text-xs text-warn">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Small sample (n={wr.decisive}). Win rate confidence is low — treat all rates as indicative until ≥20 decisive trades per group.
        </div>
      )}

      {/* Win rate by market — priority pairs first */}
      <WinRateTable title="Win Rate by Market" groups={wr.byMarket} priorityKeys={PRIORITY_MARKETS} />

      {/* Win rate by strategy / session / timeframe / market condition */}
      <div className="grid lg:grid-cols-2 gap-4">
        <WinRateTable title="Win Rate by Strategy" groups={wr.byStrategy} />
        <WinRateTable title="Win Rate by Session" groups={wr.bySession} />
        <WinRateTable title="Win Rate by Timeframe" groups={wr.byTimeframe} />
        <WinRateTable title="Win Rate by Market Condition" groups={wr.byMarketCondition} />
      </div>

      {/* Underperforming strategies */}
      {flagged.length > 0 && (
        <div className="rounded-xl border border-bearish/30 bg-bearish/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-bearish mb-2">
            <AlertTriangle className="w-4 h-4" /> Strategies Flagged for Review
          </div>
          <div className="space-y-1.5">
            {flagged.map((f) => (
              <div key={f.strategy} className="flex items-center justify-between text-xs">
                <span className="text-foreground font-medium">{f.strategy}</span>
                <span className="text-bearish tabular-nums">{f.winRate.toFixed(1)}% win · n={f.sampleSize} · CI {fmtCI(f.ci)}</span>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-muted-foreground mt-2">Review and recalibrate before allowing these setups to trade live again. No automatic strategy changes are applied.</div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1">{label}</div>
      <div className={cn('text-base font-semibold tabular-nums', tone === 'bullish' ? 'text-bullish' : tone === 'bearish' ? 'text-bearish' : 'text-foreground')}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function WinRateTable({ title, groups, priorityKeys }) {
  const entries = Object.entries(groups || {});
  if (!entries.length) return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-sm font-semibold mb-2">{title}</div>
      <div className="text-xs text-muted-foreground">No closed trades yet.</div>
    </div>
  );
  const ordered = [
    ...(priorityKeys || []).map((k) => [k, groups[k]]).filter(([, g]) => g),
    ...entries.filter(([k]) => !(priorityKeys || []).includes(k)),
  ].sort((a, b) => b[1].decisive - a[1].decisive);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-sm font-semibold mb-3">{title}</div>
      <div className="space-y-2">
        {ordered.map(([k, g]) => (
          <div key={k} className="flex items-center justify-between text-sm gap-3">
            <span className="text-muted-foreground truncate">{k || '—'}</span>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[11px] text-muted-foreground tabular-nums">n={g.sampleSize}</span>
              <span className={cn('tabular-nums font-medium w-16 text-right', g.winRate >= 50 ? 'text-bullish' : g.sampleSize > 0 ? 'text-bearish' : 'text-muted-foreground')}>
                {g.sampleSize ? `${g.winRate.toFixed(1)}%` : '—'}
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums w-20 text-right">{g.sampleSize ? `CI ${fmtCI(g.ci)}` : ''}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}