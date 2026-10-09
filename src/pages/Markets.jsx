import React, { useState, useEffect } from 'react';
import { MarketDataService, SYMBOL_META } from '@/services/marketData';
import MarketCard from '@/components/MarketCard';
import useLiveQuotes from '@/hooks/useLiveQuotes';

const SYMBOLS = Object.keys(SYMBOL_META);
const AI_SYMBOLS = ['XAUUSD', 'EURUSD'];

export default function Markets() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const { quotes, ready } = useLiveQuotes(SYMBOLS);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [a, e] = await Promise.all(AI_SYMBOLS.map((s) => MarketDataService.getSnapshot(s)));
        if (alive) setData({ XAUUSD: a, EURUSD: e });
      } catch { /* ignore */ }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-display font-semibold">Markets</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Live broker prices across all tracked instruments, updated every few seconds.</p>
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        {SYMBOLS.map((s) => (
          <MarketCard key={s} symbol={s} snapshot={data[s]} live={quotes[s]} to={`/market/${s}`}
            loading={!quotes[s] && (!ready || (AI_SYMBOLS.includes(s) && loading))} />
        ))}
      </div>
    </div>
  );
}