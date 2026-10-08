import React, { useState, useEffect } from 'react';
import { MarketDataService, TIMEFRAMES, SYMBOL_META } from '@/services/marketData';
import PriceChart from '@/components/PriceChart';
import SectionCard from '@/components/SectionCard';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Chart() {
  const [symbol, setSymbol] = useState('XAUUSD');
  const [tf, setTf] = useState('1H');
  const [chart, setChart] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    MarketDataService.getChart(symbol, tf).then(c => { if (alive) setChart(c); }).catch(() => { if (alive) setChart(null); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [symbol, tf]);

  const gold = symbol === 'XAUUSD';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-display font-semibold">Chart</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Interactive candlestick view with support &amp; resistance overlays.</p>
      </div>
      <SectionCard title={`${symbol} · ${tf}`} icon={BarChart3}
        action={
          <div className="flex flex-wrap gap-2">
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="input-field !w-auto !py-1 text-xs">
              {Object.keys(SYMBOL_META).map((s) => <option key={s}>{s}</option>)}
            </select>
            <div className="flex gap-1">
              {TIMEFRAMES.map((t) => (
                <button key={t} onClick={() => setTf(t)} className={cn('px-2.5 py-1 rounded-md text-xs font-medium', tf === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>{t}</button>
              ))}
            </div>
          </div>
        }>
        <PriceChart candles={chart?.candles} gold={gold} loading={loading} />
        {!loading && chart && !chart.data_available && <div className="text-xs text-muted-foreground mt-3 text-center">Live market data is unavailable for this timeframe.</div>}
      </SectionCard>
    </div>
  );
}