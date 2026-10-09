import { useState, useEffect } from 'react';
import { OandaService } from '@/services/oandaService';

// Polls OANDA live prices for the given symbols and loads the daily candle so
// each quote carries change / day high / day low. Symbols the account can't
// price (e.g. not enabled on the account) are skipped.
export default function useLiveQuotes(symbols, intervalMs = 5000) {
  const [quotes, setQuotes] = useState({});
  const [ready, setReady] = useState(false);
  const key = symbols.join(',');

  useEffect(() => {
    let alive = true;
    let timer;
    const daily = {};

    const merge = (prices) => setQuotes((prev) => {
      const next = { ...prev };
      prices.forEach((p) => {
        const d = daily[p.symbol];
        const change = d ? p.mid - d.prevClose : null;
        next[p.symbol] = {
          ...p,
          spread: p.ask - p.bid,
          change,
          changePct: d?.prevClose ? (change / d.prevClose) * 100 : null,
          high: d ? Math.max(d.high, p.mid) : null,
          low: d ? Math.min(d.low, p.mid) : null,
        };
      });
      return next;
    });

    (async () => {
      const list = key.split(',');
      const results = await Promise.allSettled(list.map((s) => OandaService.getPricing(s)));
      const first = results.filter((r) => r.status === 'fulfilled' && r.value?.mid).map((r) => r.value);
      const working = first.map((p) => p.symbol);

      await Promise.allSettled(working.map(async (s) => {
        const c = await OandaService.getCandles(s, 'D', 2);
        const today = c[c.length - 1];
        const prev = c[c.length - 2];
        if (today) daily[s] = { high: today.high, low: today.low, prevClose: prev?.close ?? today.open };
      }));
      if (!alive) return;
      merge(first);
      setReady(true);
      if (!working.length) return;

      timer = setInterval(() => {
        OandaService.getPricingAll(working).then((p) => alive && merge(p)).catch(() => {});
      }, intervalMs);
    })();

    return () => { alive = false; clearInterval(timer); };
  }, [key, intervalMs]);

  return { quotes, ready };
}