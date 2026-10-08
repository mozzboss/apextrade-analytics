import React, { useState } from 'react';
import { cn } from '@/lib/utils';

const IMPACT_TONE = {
  HIGH: 'text-bearish bg-bearish/10 border-bearish/30',
  MEDIUM: 'text-warn bg-warn/10 border-warn/30',
  LOW: 'text-muted-foreground bg-muted border-border',
};

export default function EconomicCalendarTable({ events = [], loading }) {
  const [filter, setFilter] = useState('ALL');

  const filtered = filter === 'ALL' ? events : events.filter((e) => e.impact === filter);

  if (loading) {
    return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />)}</div>;
  }
  if (!filtered.length) {
    return <div className="py-10 text-center text-sm text-muted-foreground">No upcoming events found.</div>;
  }

  return (
    <div>
      <div className="flex gap-1.5 mb-4">
        {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              filter === f ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
            {f === 'ALL' ? 'All' : f}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto scrollbar-thin -mx-1">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="font-medium px-3 py-2">Impact</th>
              <th className="font-medium px-3 py-2">Event</th>
              <th className="font-medium px-3 py-2">Country</th>
              <th className="font-medium px-3 py-2">Date</th>
              <th className="font-medium px-3 py-2">Time</th>
              <th className="font-medium px-3 py-2">Forecast</th>
              <th className="font-medium px-3 py-2">Previous</th>
              <th className="font-medium px-3 py-2">Actual</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => (
              <tr key={i} className="border-b border-border/60 hover:bg-muted/30">
                <td className="px-3 py-2.5">
                  <span className={cn('inline-block px-2 py-0.5 rounded text-[10px] font-semibold border', IMPACT_TONE[e.impact] || IMPACT_TONE.LOW)}>{e.impact}</span>
                </td>
                <td className="px-3 py-2.5 font-medium">{e.event}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{e.country}</td>
                <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{e.date}</td>
                <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{e.time}</td>
                <td className="px-3 py-2.5 tabular-nums">{e.expected || '—'}</td>
                <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{e.previous || '—'}</td>
                <td className={cn('px-3 py-2.5 tabular-nums font-medium', e.actual ? 'text-foreground' : 'text-muted-foreground')}>{e.actual || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}