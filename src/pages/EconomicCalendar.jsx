import React, { useState, useEffect } from 'react';
import { CalendarDays, RefreshCw, AlertTriangle } from 'lucide-react';
import { EconomicCalendarService, clearCache } from '@/services/marketData';
import EconomicCalendarTable from '@/components/EconomicCalendarTable';
import SectionCard from '@/components/SectionCard';

export default function EconomicCalendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { const c = await EconomicCalendarService.getUpcoming(); setEvents(c?.events || []); } catch { setEvents([]); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-display font-semibold">Economic Calendar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Upcoming high-impact macro events. Never show past events as upcoming.</p>
        </div>
        <button onClick={() => { clearCache('calendar'); load(); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-xs">
        <AlertTriangle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
        <div>
          <span className="text-warn font-medium">News risk rule:</span> Do not open new positions within 15–30 minutes of major high-impact releases. Wait for volatility to stabilize after the event before re-entering.
        </div>
      </div>

      <SectionCard title="Upcoming Events" icon={CalendarDays}>
        <EconomicCalendarTable events={events} loading={loading} />
      </SectionCard>
    </div>
  );
}