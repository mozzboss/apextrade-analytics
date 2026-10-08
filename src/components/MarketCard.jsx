import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import SignalBadge from './SignalBadge';
import StatTile from './StatTile';

export default function MarketCard({ symbol, snapshot, loading, to }) {
  const gold = symbol === 'XAUUSD';

  return (
    <Link
      to={to || `/market/${symbol}`}
      className="block rounded-2xl border border-border bg-card hover:border-primary/40 transition-colors group"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold',
            gold ? 'bg-gold/15 text-gold' : 'bg-chart-4/15 text-chart-4')}>
            {gold ? 'Au' : '€'}
          </div>
          <div>
            <div className="font-semibold text-sm">{symbol}</div>
            <div className="text-[11px] text-muted-foreground">{gold ? 'Gold vs US Dollar' : 'Euro vs US Dollar'}</div>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <div className="space-y-3">
            <div className="h-9 w-40 rounded-md bg-muted animate-pulse" />
            <div className="h-4 w-28 rounded bg-muted animate-pulse" />
          </div>
        ) : !snapshot?.data_available ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Live market data is unavailable.
          </div>
        ) : (
          <>
            <div className="flex items-end gap-3 mb-1">
              <div className="text-3xl font-display font-semibold tabular-nums tracking-tight">
                {snapshot.current_price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: gold ? 2 : 5 })}
              </div>
              <div className={cn('flex items-center gap-1 text-sm font-medium pb-1.5',
                (snapshot.daily_change || 0) >= 0 ? 'text-bullish' : 'text-bearish')}>
                {(snapshot.daily_change || 0) >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {(snapshot.daily_change || 0) >= 0 ? '+' : ''}{snapshot.daily_change?.toFixed(gold ? 2 : 5)}
                <span className="text-xs opacity-80">({(snapshot.daily_change_pct || 0) >= 0 ? '+' : ''}{snapshot.daily_change_pct?.toFixed(2)}%)</span>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <SignalBadge signal={snapshot.signal} />
              <span className="text-xs text-muted-foreground">Confidence <span className="text-foreground font-medium">{snapshot.confidence ?? '—'}%</span></span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{snapshot.session}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatTile label="Direction" value={snapshot.market_direction} tone={snapshot.market_direction?.toLowerCase().includes('bull') ? 'bullish' : snapshot.market_direction?.toLowerCase().includes('bear') ? 'bearish' : undefined} />
              <StatTile label="Trend" value={snapshot.trend} />
              <StatTile label="Volatility" value={snapshot.volatility} tone={snapshot.volatility?.toLowerCase() === 'high' ? 'bearish' : snapshot.volatility?.toLowerCase() === 'low' ? 'bullish' : 'gold'} />
              <StatTile label="Risk" value={snapshot.risk_level} />
              <StatTile label="Support" value={snapshot.support?.toLocaleString(undefined, { maximumFractionDigits: gold ? 2 : 5 })} tone="bullish" />
              <StatTile label="Resistance" value={snapshot.resistance?.toLocaleString(undefined, { maximumFractionDigits: gold ? 2 : 5 })} tone="bearish" />
              <StatTile label="Day High" value={snapshot.today_high?.toLocaleString(undefined, { maximumFractionDigits: gold ? 2 : 5 })} />
              <StatTile label="Day Low" value={snapshot.today_low?.toLocaleString(undefined, { maximumFractionDigits: gold ? 2 : 5 })} />
            </div>
          </>
        )}
      </div>
    </Link>
  );
}