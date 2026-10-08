import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

function computeStats(trades) {
  const closed = trades.filter((t) => t.result === 'win' || t.result === 'loss');
  const wins = closed.filter((t) => t.result === 'win');
  const losses = closed.filter((t) => t.result === 'loss');
  const totalPnL = trades.reduce((s, t) => s + (Number(t.profit_loss) || 0), 0);
  const grossWin = wins.reduce((s, t) => s + (Number(t.profit_loss) || 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (Number(t.profit_loss) || 0), 0));
  const winRate = closed.length ? (wins.length / closed.length) * 100 : 0;
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
  const avgRR = trades.filter((t) => t.risk_reward).reduce((s, t) => s + t.risk_reward, 0) / (trades.filter((t) => t.risk_reward).length || 1);

  // drawdown
  const sorted = [...trades].sort((a, b) => new Date(a.date || a.created_date) - new Date(b.date || b.created_date));
  let equity = 0, peak = 0, maxDD = 0, curDD = 0;
  for (const t of sorted) {
    equity += Number(t.profit_loss) || 0;
    peak = Math.max(peak, equity);
    const dd = peak - equity;
    maxDD = Math.max(maxDD, dd);
    curDD = peak - equity;
  }

  const byKey = (key) => {
    const map = {};
    for (const t of trades) {
      const k = t[key];
      if (!k) continue;
      map[k] = (map[k] || 0) + (Number(t.profit_loss) || 0);
    }
    return map;
  };
  const bySession = byKey('session');
  const byMarket = byKey('market');
  const byQuality = byKey('setup_quality');

  const bestSetup = Object.entries(byQuality).sort((a, b) => b[1] - a[1])[0];
  const worstSetup = Object.entries(byQuality).sort((a, b) => a[1] - b[1])[0];

  return { total: trades.length, closed: closed.length, wins: wins.length, losses: losses.length, winRate, avgWin, avgLoss, avgRR, profitFactor, totalPnL, maxDD, curDD, bySession, byMarket, byQuality, bestSetup, worstSetup };
}

export default function PerformanceStats({ trades = [] }) {
  const s = useMemo(() => computeStats(trades), [trades]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Total Trades" value={s.total} />
        <Stat label="Wins" value={s.wins} tone="bullish" />
        <Stat label="Losses" value={s.losses} tone="bearish" />
        <Stat label="Win Rate" value={`${s.winRate.toFixed(1)}%`} tone={s.winRate >= 50 ? 'bullish' : 'bearish'} />
        <Stat label="Net P/L" value={`${s.totalPnL >= 0 ? '+' : ''}$${s.totalPnL.toFixed(2)}`} tone={s.totalPnL >= 0 ? 'bullish' : 'bearish'} />
        <Stat label="Profit Factor" value={s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2)} tone={s.profitFactor >= 1.5 ? 'bullish' : 'bearish'} />
        <Stat label="Avg Win" value={`$${s.avgWin.toFixed(2)}`} tone="bullish" />
        <Stat label="Avg Loss" value={`$${s.avgLoss.toFixed(2)}`} tone="bearish" />
        <Stat label="Avg R/R" value={`1:${s.avgRR.toFixed(1)}`} />
        <Stat label="Max Drawdown" value={`$${s.maxDD.toFixed(2)}`} tone="bearish" />
        <Stat label="Current Drawdown" value={`$${s.curDD.toFixed(2)}`} tone={s.curDD > 0 ? 'bearish' : 'bullish'} />
        <Stat label="Closed" value={s.closed} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Breakdown title="By Market" data={s.byMarket} />
        <Breakdown title="By Session" data={s.bySession} />
        <Breakdown title="By Setup Quality" data={s.byQuality} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Best Setup Type</div>
          <div className="text-sm font-semibold text-bullish">{s.bestSetup?.[0] || '—'} <span className="text-muted-foreground font-normal">({s.bestSetup ? `${s.bestSetup[1] >= 0 ? '+' : ''}$${s.bestSetup[1].toFixed(2)}` : ''})</span></div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Worst Setup Type</div>
          <div className="text-sm font-semibold text-bearish">{s.worstSetup?.[0] || '—'} <span className="text-muted-foreground font-normal">({s.worstSetup ? `${s.worstSetup[1] >= 0 ? '+' : ''}$${s.worstSetup[1].toFixed(2)}` : ''})</span></div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1">{label}</div>
      <div className={cn('text-base font-semibold tabular-nums', tone === 'bullish' ? 'text-bullish' : tone === 'bearish' ? 'text-bearish' : 'text-foreground')}>{value}</div>
    </div>
  );
}

function Breakdown({ title, data }) {
  const entries = Object.entries(data);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-sm font-semibold mb-3">{title}</div>
      {entries.length === 0 ? <div className="text-xs text-muted-foreground">No data</div> : (
        <div className="space-y-2">
          {entries.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{k}</span>
              <span className={cn('tabular-nums font-medium', v >= 0 ? 'text-bullish' : 'text-bearish')}>{v >= 0 ? '+' : ''}${v.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}