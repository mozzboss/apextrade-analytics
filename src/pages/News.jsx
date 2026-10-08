import React, { useState, useEffect } from 'react';
import { Newspaper, RefreshCw } from 'lucide-react';
import { NewsService, clearCache } from '@/services/marketData';
import SectionCard from '@/components/SectionCard';
import { cn } from '@/lib/utils';

export default function News() {
  const [symbol, setSymbol] = useState('XAUUSD');
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { const n = await NewsService.getForSymbol(symbol); setNews(n?.headlines || []); } catch { setNews([]); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [symbol]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-display font-semibold">Market News</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Price-moving headlines sourced live from the web.</p>
        </div>
        <div className="flex gap-2">
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="input-field !w-auto !py-1.5 text-xs">
            <option value="XAUUSD">XAUUSD</option>
            <option value="EURUSD">EURUSD</option>
          </select>
          <button onClick={() => { clearCache(`news_${symbol}`); load(); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <SectionCard title={`${symbol} News`} icon={Newspaper}>
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />)}</div>
        ) : news.length ? (
          <div className="space-y-3">
            {news.map((n, i) => (
              <div key={i} className="border-b border-border/60 pb-3 last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium leading-snug">{n.headline}</div>
                  <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0', n.impact === 'HIGH' ? 'text-bearish bg-bearish/10' : n.impact === 'MEDIUM' ? 'text-warn bg-warn/10' : 'text-muted-foreground bg-muted')}>{n.impact}</span>
                </div>
                {n.summary && <p className="text-xs text-muted-foreground mt-1">{n.summary}</p>}
                <div className="text-[11px] text-muted-foreground mt-1">{n.source} · {n.time}</div>
              </div>
            ))}
          </div>
        ) : <div className="text-sm text-muted-foreground py-6 text-center">No news available.</div>}
      </SectionCard>
    </div>
  );
}