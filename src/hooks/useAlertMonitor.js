import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { AlertService } from '@/services/storage';
import { MarketDataService, EconomicCalendarService } from '@/services/marketData';
import { checkAllAlerts } from '@/services/alertMonitor';

const POLL_INTERVAL = 120000; // 2 minutes

/**
 * App-wide alert monitor. Polls live snapshots and evaluates alert conditions,
 * firing toasts and persisting triggered state. Only burns LLM calls when
 * active untriggered alerts exist.
 */
export function useAlertMonitor() {
  const { toast } = useToast();
  const [lastCheck, setLastCheck] = useState(null);
  const [checking, setChecking] = useState(false);

  const checkNow = useCallback(async () => {
    setChecking(true);
    try {
      let alerts = [];
      try { alerts = await AlertService.list() || []; } catch { setChecking(false); return; }
      const activeAlerts = alerts.filter((a) => a.active && !a.triggered);
      if (!activeAlerts.length) { setLastCheck(new Date()); setChecking(false); return; }

      const [xau, eur] = await Promise.all([
        MarketDataService.getSnapshot('XAUUSD').catch(() => null),
        MarketDataService.getSnapshot('EURUSD').catch(() => null),
      ]);

      let nextHighTime = null;
      try {
        const c = await EconomicCalendarService.getUpcoming();
        const ev = (c?.events || []).find((e) => e.impact === 'HIGH');
        if (ev) nextHighTime = new Date(`${ev.date} ${ev.time || ''}`).getTime() || null;
      } catch { /* ignore */ }

      const contexts = {
        XAUUSD: { snapshot: xau, nextHighEventTime: nextHighTime },
        EURUSD: { snapshot: eur, nextHighEventTime: nextHighTime },
      };
      // enrich XAUUSD/EURUSD with their own analysis for setup alerts
      if (activeAlerts.some((a) => a.market === 'XAUUSD' && a.type === 'High-quality setup appears'))
        contexts.XAUUSD.analysis = await MarketDataService.getFullAnalysis('XAUUSD').catch(() => null);
      if (activeAlerts.some((a) => a.market === 'EURUSD' && a.type === 'High-quality setup appears'))
        contexts.EURUSD.analysis = await MarketDataService.getFullAnalysis('EURUSD').catch(() => null);

      const triggered = checkAllAlerts(activeAlerts, contexts);
      for (const t of triggered) {
        await AlertService.update(t.alert.id, { triggered: true }).catch(() => {});
        toast({
          title: `${t.alert.market} Alert — ${t.alert.type}`,
          description: t.reason,
        });
      }
      setLastCheck(new Date());
    } catch { /* ignore */ }
    setChecking(false);
  }, [toast]);

  useEffect(() => {
    checkNow();
    const id = setInterval(checkNow, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [checkNow]);

  return { checkNow, lastCheck, checking };
}