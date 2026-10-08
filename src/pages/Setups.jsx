import React, { useState, useEffect } from 'react';
import { RefreshCw, Bookmark } from 'lucide-react';
import { MarketDataService, clearCache } from '@/services/marketData';
import { SetupService } from '@/services/storage';
import SetupCard from '@/components/SetupCard';
import SectionCard from '@/components/SectionCard';
import { isBestSetup, gradeFromScore } from '@/services/signalEngine';
import { cn } from '@/lib/utils';

const SYMBOLS = ['XAUUSD', 'EURUSD'];

export default function Setups() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState([]);

  async function load() {
    setLoading(true);
    try {
      const [a, e] = await Promise.all([
        MarketDataService.getFullAnalysis('XAUUSD'),
        MarketDataService.getFullAnalysis('EURUSD'),
      ]);
      setData({ XAUUSD: a, EURUSD: e });
    } catch { /* ignore */ }
    setLoading(false);
  }
  useEffect(() => { load(); SetupService.list().then(s => setSaved(s || [])).catch(() => {}); }, []);

  function refresh() { clearCache('full_XAUUSD'); clearCache('full_EURUSD'); load(); }

  const setups = SYMBOLS.map((s) => ({ symbol: s, setup: data[s]?.setup, snapshot: data[s]?.snapshot, grade: data[s]?.setup?.quality_grade || gradeFromScore(data[s]?.setup?.quality_score) }));
  const best = setups.filter((x) => isBestSetup(x.grade) && x.setup && x.setup.direction !== 'NONE');
  const other = setups.filter((x) => !isBestSetup(x.grade));

  async function saveSetup(symbol, setup) {
    await SetupService.create({
      market: symbol, bias: setup.bias, direction: setup.direction,
      entry_zone_low: setup.entry_zone_low, entry_zone_high: setup.entry_zone_high,
      stop_loss: setup.stop_loss, tp1: setup.tp1, tp2: setup.tp2, tp3: setup.tp3,
      risk_reward: setup.risk_reward, confidence: setup.confidence, risk_level: setup.risk_level,
      quality_score: setup.quality_score, quality_grade: setup.quality_grade,
      status: setup.status || 'WATCHING', reasons: setup.reasons, invalidation: setup.invalidation,
    });
    SetupService.list().then(s => setSaved(s || []));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-display font-semibold">Trade Setups</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Only A+ and A setups appear in Best Setups. The engine says NO TRADE when quality is insufficient.</p>
        </div>
        <button onClick={refresh} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Analysis
        </button>
      </div>

      <SectionCard title="Best Setups (A+ / A)" icon={Bookmark}>
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-48 rounded-xl bg-muted/40 animate-pulse" />)}</div>
        ) : best.length ? (
          <div className="grid lg:grid-cols-2 gap-4">
            {best.map((x) => (
              <div key={x.symbol}>
                <SetupCard symbol={x.symbol} setup={x.setup} snapshot={x.snapshot} />
                <button onClick={() => saveSetup(x.symbol, x.setup)} className="mt-2 w-full py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40">Save to Journal</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center">
            <div className="text-sm text-muted-foreground mb-1">No A+ or A setups right now.</div>
            <div className="text-xs text-muted-foreground">Discipline over frequency — waiting for high-quality confirmation is the correct action.</div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Other Setups">
        {loading ? <div className="h-40 rounded-xl bg-muted/40 animate-pulse" /> : (
          <div className="grid lg:grid-cols-2 gap-4">
            {other.map((x) => <SetupCard key={x.symbol} symbol={x.symbol} setup={x.setup} snapshot={x.snapshot} />)}
          </div>
        )}
      </SectionCard>

      {saved.length > 0 && (
        <SectionCard title={`Saved Setups (${saved.length})`}>
          <div className="space-y-2">
            {saved.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted">{s.market}</span>
                  <span className={cn('text-xs font-medium', s.direction === 'BUY' ? 'text-bullish' : 'text-bearish')}>{s.direction}</span>
                  <span className="text-xs text-muted-foreground">Grade: <span className="text-gold">{s.quality_grade}</span></span>
                  <span className="text-xs text-muted-foreground">R/R 1:{s.risk_reward?.toFixed(1)}</span>
                </div>
                <span className="text-xs text-muted-foreground">{s.status}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}