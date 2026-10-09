import React, { useState, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';
import { TradingJournalService } from '@/services/storage';
import PerformanceStats from '@/components/PerformanceStats';
import SectionCard from '@/components/SectionCard';

export default function Performance() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calcDate, setCalcDate] = useState('');

  useEffect(() => {
    TradingJournalService.list()
      .then((t) => setTrades(t || []))
      .catch(() => setTrades([]))
      .finally(() => { setLoading(false); setCalcDate(new Date().toLocaleString()); });
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-display font-semibold">Performance Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Verified win rates from closed trades only. Sample sizes and confidence intervals shown — never an artificial percentage.</p>
        </div>
        <div className="text-[11px] text-muted-foreground">Last calculated: {calcDate || '—'}</div>
      </div>
      <SectionCard title="Performance Metrics" icon={BarChart3}>
        {loading ? <div className="h-40 rounded-xl bg-muted/40 animate-pulse" /> : <PerformanceStats trades={trades} />}
      </SectionCard>
      <div className="text-[11px] text-muted-foreground rounded-xl border border-border bg-card px-4 py-3">
        Actual trade results only. Backtested and estimated probabilities are shown separately on the trade preview and require sufficient historical samples (≥20 decisive trades). No strategy is modified automatically — underperforming setups are flagged for your review.
      </div>
    </div>
  );
}