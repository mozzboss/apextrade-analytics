import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Target, ArrowRight, ShieldCheck } from 'lucide-react';
import { MarketDataService, EconomicCalendarService } from '@/services/marketData';
import MarketCard from '@/components/MarketCard';
import SessionIndicator from '@/components/SessionIndicator';
import SectionCard from '@/components/SectionCard';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const [xau, setXau] = useState(null);
  const [eur, setEur] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calendar, setCalendar] = useState([]);
  const [calLoading, setCalLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [a, e] = await Promise.all([
          MarketDataService.getSnapshot('XAUUSD'),
          MarketDataService.getSnapshot('EURUSD'),
        ]);
        if (!alive) return;
        setXau(a); setEur(e);
      } catch { /* ignore */ }
      if (alive) setLoading(false);
    })();
    EconomicCalendarService.getUpcoming().then(c => { if (alive) setCalendar(c?.events || []); }).catch(() => {}).finally(() => { if (alive) setCalLoading(false); });
    return () => { alive = false; };
  }, []);

  const nextHigh = calendar.find((e) => e.impact === 'HIGH');
  const nextEventForCountdown = nextHigh ? { ...nextHigh, datetime: `${nextHigh.date} ${nextHigh.time || ''}` } : null;
  const upcoming = calendar.filter((e) => e.impact === 'HIGH').slice(0, 4);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-display font-semibold">Trading Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Live analysis for Gold &amp; Euro — disciplined, risk-first.</p>
        </div>
        <Link to="/ai" className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
          <Target className="w-4 h-4" /> Ask AI Analyst
        </Link>
      </div>

      <SessionIndicator nextEvent={nextEventForCountdown} />

      <div className="grid lg:grid-cols-2 gap-5">
        <MarketCard symbol="XAUUSD" snapshot={xau} loading={loading} />
        <MarketCard symbol="EURUSD" snapshot={eur} loading={loading} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <SectionCard title="Upcoming High-Impact Events" icon={TrendingUp} className="lg:col-span-2"
          action={<Link to="/calendar" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">Full calendar <ArrowRight className="w-3 h-3" /></Link>}>
          {calLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />)}</div>
          ) : upcoming.length ? (
            <div className="space-y-2">
              {upcoming.map((e, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3.5 py-2.5">
                  <div>
                    <div className="text-sm font-medium">{e.event}</div>
                    <div className="text-xs text-muted-foreground">{e.country} · {e.date} {e.time}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Forecast: <span className="text-foreground">{e.expected || '—'}</span></div>
                    <div className="text-xs text-muted-foreground">Previous: <span className="text-foreground">{e.previous || '—'}</span></div>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="text-sm text-muted-foreground py-6 text-center">No high-impact events in the coming week.</div>}
        </SectionCard>

        <SectionCard title="Trading Philosophy" icon={ShieldCheck}>
          <ul className="space-y-2 text-xs text-foreground/80">
            {['Capital preservation over opportunity', 'One excellent setup beats ten low-quality trades', 'Never chase price — wait for the zone', 'When uncertain: WAIT. When data is incomplete: NO TRADE.', 'Maximum recommended risk: 1% per trade'].map((p, i) => (
              <li key={i} className="flex items-start gap-2"><span className="text-gold mt-0.5">◆</span>{p}</li>
            ))}
          </ul>
          <Link to="/setups" className={cn('mt-4 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium')}>
            <Target className="w-4 h-4" /> View Today's Setups
          </Link>
        </SectionCard>
      </div>
    </div>
  );
}