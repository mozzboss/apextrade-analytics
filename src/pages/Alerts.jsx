import React from 'react';
import { Bell, Activity, Radio } from 'lucide-react';
import AlertList from '@/components/AlertList';
import SectionCard from '@/components/SectionCard';
import { useAlertMonitor } from '@/hooks/useAlertMonitor';

export default function Alerts() {
  const { checkNow, lastCheck, checking } = useAlertMonitor();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-display font-semibold">Alerts</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Monitor price action, structure breaks, liquidity sweeps, and news approaching.</p>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Radio className="w-4 h-4 text-bullish" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-bullish animate-pulse" />
          </div>
          <div>
            <div className="text-sm font-medium">Live Monitoring</div>
            <div className="text-xs text-muted-foreground">
              {checking ? 'Checking conditions…' : lastCheck ? `Last checked ${lastCheck.toLocaleTimeString()}` : 'Idle — checking every 2 min'}
            </div>
          </div>
        </div>
        <button onClick={checkNow} disabled={checking}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
          <Activity className="w-3.5 h-3.5" /> Check Now
        </button>
      </div>

      <SectionCard title="Configured Alerts" icon={Bell}>
        <AlertList />
      </SectionCard>
    </div>
  );
}