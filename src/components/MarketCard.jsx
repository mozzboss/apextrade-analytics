import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SYMBOL_META } from '@/services/marketData';
import SignalBadge from './SignalBadge';
import StatTile from './StatTile';
import LivePriceRow from './LivePriceRow';

const BASE_ICON = { XAU: 'Au', EUR: '€', GBP: '£', USD: '$', AUD: 'A$', NZD: 'N$' };

export default function MarketCard({ symbol, snapshot, live, loading, to }) {
  const meta = SYMBOL_META[symbol] || {};
  const gold = symbol === 'XAUUSD';
  const dp = meta.decimals ?? (gold ? 2 : 5);
  const f = (n) => (n != null ? Number(n).toLocaleString(undefined, { maximumFractionDigits: dp }) : undefined);
  const ai = !!snapshot?.data_available;
  const spread = live ? (meta.pipSize ? `${(live.spread / meta.pipSize).toFixed(1)} pips` : live.spread.toFixed(2)) : null;
  const dir = snapshot?.market_direction?.toLowerCase() || '';
  const vol = snapshot?.volatility?.toLowerCase();

  return (
    <Link to={to || `/market/${symbol}`} className="block rounded-2xl border border-border bg-card hover:border-primary/40 transition-colors group">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold', gold ? 'bg-gold/15 text-gold' : 'bg-chart-4/15 text-chart-4')}>
            {BASE_ICON[symbol.slice(0, 3)] || symbol.slice(0, 1)}
          </div>
          <div>
            <div className="font-semibold text-sm">{symbol}</div>
            <div className="text-[11px] text-muted-foreground">{meta.name}</div>
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
        ) : !live && !ai ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Live market data is unavailable.</div>
        ) : (
          <>
            <LivePriceRow price={live?.mid ?? snapshot?.current_price} change={live?.change ?? snapshot?.daily_change}
              pct={live?.changePct ?? snapshot?.daily_change_pct} dp={dp} isLive={!!live} />
            <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
              {ai && <SignalBadge signal={snapshot.signal} />}
              {ai && <span>Confidence <span className="text-foreground font-medium">{snapshot.confidence ?? '—'}%</span> · {snapshot.session}</span>}
              {spread && <span>{ai ? '· ' : ''}Spread <span className="text-foreground font-medium">{spread}</span></span>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ai && <StatTile label="Direction" value={snapshot.market_direction} tone={dir.includes('bull') ? 'bullish' : dir.includes('bear') ? 'bearish' : undefined} />}
              {ai && <StatTile label="Trend" value={snapshot.trend} />}
              {ai && <StatTile label="Volatility" value={snapshot.volatility} tone={vol === 'high' ? 'bearish' : vol === 'low' ? 'bullish' : 'gold'} />}
              {ai && <StatTile label="Risk" value={snapshot.risk_level} />}
              {ai && <StatTile label="Support" value={f(snapshot.support)} tone="bullish" />}
              {ai && <StatTile label="Resistance" value={f(snapshot.resistance)} tone="bearish" />}
              {!ai && <StatTile label="Bid" value={f(live?.bid)} tone="bearish" />}
              {!ai && <StatTile label="Ask" value={f(live?.ask)} tone="bullish" />}
              <StatTile label="Day High" value={f(live?.high ?? snapshot?.today_high)} />
              <StatTile label="Day Low" value={f(live?.low ?? snapshot?.today_low)} />
            </div>
          </>
        )}
      </div>
    </Link>
  );
}