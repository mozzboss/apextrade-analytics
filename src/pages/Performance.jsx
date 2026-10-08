import React, { useState, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';
import { TradingJournalService } from '@/services/storage';
import PerformanceStats from '@/components/PerformanceStats';
import SectionCard from '@/components/SectionCard';

export default function Performance() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    TradingJournalService.list().then(t => setTrades(t || [])).catch(() => setTrades([])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-display font-semibold">Performance Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Honest metrics — including losing trades. Review to refine your edge.</p>
      </div>
      <SectionCard title="Performance Metrics" icon={BarChart3}>
        {loading ? <div className="h-40 rounded-xl bg-muted/40 animate-pulse" /> : <PerformanceStats trades={trades} />}
      </SectionCard>
    </div>
  );
}