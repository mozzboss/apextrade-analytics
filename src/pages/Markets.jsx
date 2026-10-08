import React, { useState, useEffect } from 'react';
import { MarketDataService, SYMBOL_META } from '@/services/marketData';
import MarketCard from '@/components/MarketCard';

export default function Markets() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [a, e] = await Promise.all([
          MarketDataService.getSnapshot('XAUUSD'),
          MarketDataService.getSnapshot('EURUSD'),
        ]);
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
        <p className="text-sm text-muted-foreground mt-0.5">Live snapshots across tracked instruments. Architecture supports adding GBPUSD, USDJPY, US30, NAS100, SPX500.</p>
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        {Object.keys(SYMBOL_META).map((s) => (
          <MarketCard key={s} symbol={s} snapshot={data[s]} loading={loading} to={`/market/${s}`} />
        ))}
      </div>
    </div>
  );
}