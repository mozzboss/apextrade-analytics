import React, { useState } from 'react';
import { Radio, Loader2, Zap } from 'lucide-react';
import { MarketDataService, SYMBOL_META } from '@/services/marketData';
import { PositionSizeService, DEFAULTS } from '@/services/riskEngine';
import { cn } from '@/lib/utils';

export default function LiveTradeCalc({ market, entry, stopLoss, takeProfit, risk, accountBalance, onUseLivePrice }) {
  const [fetching, setFetching] = useState(false);
  const [livePrice, setLivePrice] = useState(null);
  const [error, setError] = useState('');

  async function fetchLive() {
    setFetching(true); setError('');
    try {
      const snap = await MarketDataService.getSnapshot(market);
      if (snap?.data_available && snap?.current_price) {
        setLivePrice(snap.current_price);
        onUseLivePrice(snap.current_price);
      } else {
        setError(snap?.data_note || 'Live price unavailable right now');
      }
    } catch { setError('Could not fetch live price'); }
    setFetching(false);
  }

  const result = PositionSizeService.calculate({
    accountBalance: accountBalance, riskPct: risk, entry, stopLoss, takeProfit, instrument: market,
  });

  const gold = market === 'XAUUSD';
  const fmt = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: gold ? 2 : 5 });

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-gold" />
          <span className="text-xs font-semibold uppercase tracking-wider">Live Trade Calculator</span>
        </div>
        <button onClick={fetchLive} disabled={fetching} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
          {fetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          {fetching ? 'Fetching...' : 'Use Live Price'}
        </button>
      </div>
      {livePrice && (
        <div className="text-xs text-muted-foreground">
          Live {SYMBOL_META[market]?.display}: <span className="text-foreground font-semibold tabular-nums">{fmt(livePrice)}</span>
          <span className="text-muted-foreground/60 ml-2">filled into Entry</span>
        </div>
      )}
      {error && <div className="text-xs text-bearish">{error}</div>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Cell label="Risk Amount" value={result.riskAmount ? `$${result.riskAmount.toFixed(2)}` : '—'} tone={result.withinLimit ? 'bullish' : 'bearish'} />
        <Cell label="Stop Distance" value={result.stopDistance ? fmt(result.stopDistance) : '—'} />
        <Cell label="Position Size" value={result.lots ? `${result.lots.toFixed(3)} lots` : '—'} tone="gold" />
        <Cell label="Risk / Reward" value={result.riskReward ? `1:${result.riskReward.toFixed(1)}` : '—'} tone={result.riskReward >= DEFAULTS.minRiskReward ? 'bullish' : 'bearish'} />
      </div>
      {!result.withinLimit && Number(risk) > 0 && (
        <div className="text-xs text-bearish bg-bearish/10 border border-bearish/30 rounded-lg px-3 py-2">
          Risk exceeds the {DEFAULTS.maxRisk}% maximum. Reduce position size or risk percentage.
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('text-sm font-semibold tabular-nums mt-0.5', tone === 'bullish' ? 'text-bullish' : tone === 'bearish' ? 'text-bearish' : tone === 'gold' ? 'text-gold' : 'text-foreground')}>{value}</div>
    </div>
  );
}