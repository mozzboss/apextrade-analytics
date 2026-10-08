import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Globe, Clock, AlertCircle } from 'lucide-react';

const SESSIONS = [
  { key: 'asian', label: 'Asian', startUTC: 0, endUTC: 8 },
  { key: 'london', label: 'London', startUTC: 7, endUTC: 16 },
  { key: 'ny', label: 'New York', startUTC: 12, endUTC: 21 },
];

function activeSessions(nowUTC) {
  const h = nowUTC.getUTCHours();
  const active = [];
  for (const s of SESSIONS) {
    if (h >= s.startUTC && h < s.endUTC) active.push(s.key);
  }
  const overlap = active.includes('london') && active.includes('ny');
  return { active, overlap };
}

export default function SessionIndicator({ nextEvent }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { active, overlap } = activeSessions(now);
  const marketOpen = active.length > 0;

  const [countdown, setCountdown] = useState('');
  useEffect(() => {
    if (!nextEvent?.datetime) { setCountdown(''); return; }
    const t = setInterval(() => {
      const diff = new Date(nextEvent.datetime).getTime() - Date.now();
      if (diff <= 0) { setCountdown('Imminent'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h}h ${m}m ${s}s`);
    }, 1000);
    return () => clearInterval(t);
  }, [nextEvent?.datetime]);

  const sessionLabel = overlap ? 'London / NY Overlap' : active.includes('ny') ? 'New York' : active.includes('london') ? 'London' : active.includes('asian') ? 'Asian' : 'Closed';

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Globe className="w-4 h-4 text-gold" />
          Market Status
        </div>
        <div className={cn('flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border',
          marketOpen ? 'bg-bullish/10 text-bullish border-bullish/30' : 'bg-muted text-muted-foreground border-border')}>
          <span className={cn('w-1.5 h-1.5 rounded-full', marketOpen ? 'bg-bullish animate-pulse' : 'bg-muted-foreground')} />
          {marketOpen ? 'Open' : 'Closed'}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {SESSIONS.map((s) => {
          const on = active.includes(s.key);
          return (
            <div key={s.key} className={cn('rounded-lg border px-3 py-2 text-center transition-colors',
              on ? 'border-bullish/40 bg-bullish/10' : 'border-border bg-muted/40')}>
              <div className={cn('text-[10px] uppercase tracking-wider', on ? 'text-bullish' : 'text-muted-foreground')}>{s.label}</div>
              <div className={cn('text-xs font-medium mt-0.5', on ? 'text-bullish' : 'text-muted-foreground')}>
                {on ? 'Active' : 'Inactive'}
              </div>
            </div>
          );
        })}
        <div className={cn('rounded-lg border px-3 py-2 text-center transition-colors',
          overlap ? 'border-gold/40 bg-gold/10' : 'border-border bg-muted/40')}>
          <div className={cn('text-[10px] uppercase tracking-wider', overlap ? 'text-gold' : 'text-muted-foreground')}>Overlap</div>
          <div className={cn('text-xs font-medium mt-0.5', overlap ? 'text-gold' : 'text-muted-foreground')}>
            {overlap ? 'Active' : 'Inactive'}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium tabular-nums">
            {now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-foreground font-medium tabular-nums">
            {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
        <div className="text-muted-foreground">Session: <span className="text-foreground font-medium">{sessionLabel}</span></div>
      </div>

      {nextEvent?.event && (
        <div className="mt-3 pt-3 border-t border-border flex items-start gap-2 text-xs">
          <AlertCircle className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', nextEvent.impact === 'HIGH' ? 'text-bearish' : 'text-warn')} />
          <div>
            <span className="text-muted-foreground">Next event: </span>
            <span className="text-foreground font-medium">{nextEvent.event}</span>
            {nextEvent.time && <span className="text-muted-foreground"> · {nextEvent.time}</span>}
            {countdown && <span className="text-gold font-medium ml-2">in {countdown}</span>}
          </div>
        </div>
      )}
    </div>
  );
}