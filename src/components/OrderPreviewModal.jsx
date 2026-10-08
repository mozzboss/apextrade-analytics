import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ShieldCheck, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { evaluateTrade } from '@/services/tradeGuards';
import { computeSignalScore } from '@/services/signalEngine';
import { BrokerService } from '@/services/brokerService';
import { SettingsService, TradingJournalService } from '@/services/storage';
import { EconomicCalendarService } from '@/services/marketData';

export default function OrderPreviewModal({ open, analysis, symbol, onClosed, onPlaced }) {
  const [ctx, setCtx] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const setup = analysis?.setup;
  const snap = analysis?.snapshot;
  const gold = symbol === 'XAUUSD';
  const fmt = (n) => n != null ? Number(n).toLocaleString(undefined, { maximumFractionDigits: gold ? 2 : 5 }) : '—';

  // Build the order from the current setup
  const order = setup && (setup.direction === 'BUY' || setup.direction === 'SELL') ? {
    market: symbol,
    direction: setup.direction,
    entry: setup.entry_zone_high ?? setup.entry_zone_low,
    stop_loss: setup.stop_loss,
    take_profit: setup.tp1,
    risk_reward: setup.risk_reward,
    setup_quality: setup.quality_grade,
    reason: (setup.reasons || []).join('; '),
    session: snap?.session,
  } : null;

  // Fetch guard context when opened
  useEffect(() => {
    if (!open) { setResult(null); setError(null); return; }
    let active = true;
    (async () => {
      const settings = await SettingsService.get().catch(() => null);
      const trades = await TradingJournalService.list().catch(() => []);
      const today = new Date().toISOString().slice(0, 10);
      const todayTrades = (trades || []).filter((t) => (t.date || (t.created_date || '').slice(0, 10)) === today);
      const todayPnL = todayTrades.reduce((s, t) => s + (Number(t.profit_loss) || 0), 0);
      let nextHigh = null;
      try {
        const c = await EconomicCalendarService.getUpcoming();
        const ev = (c?.events || []).find((e) => e.impact === 'HIGH');
        if (ev) nextHigh = new Date(`${ev.date} ${ev.time || ''}`).getTime() || null;
      } catch {}
      if (active) setCtx({ settings: settings || {}, todayTrades, todayPnL, nextHighEventTime: nextHigh });
    })();
    return () => { active = false; };
  }, [open]);

  const riskPct = ctx?.settings?.risk_per_trade ?? 0.5;
  const balance = ctx?.settings?.account_balance ?? 10000;
  const riskUsd = (balance * riskPct) / 100;
  if (order) order.risk_percent = riskPct;
  if (order) order.risk = riskUsd;

  const guards = order && ctx ? evaluateTrade({
    trade: order, settings: ctx.settings, todayTrades: ctx.todayTrades,
    todayPnL: ctx.todayPnL, nextHighEventTime: ctx.nextHighEventTime,
    qualityScore: analysis ? (computeSignalScore(analysis)?.total) : null,
  }) : { allowed: false, reasons: ['Loading risk checks…'] };

  async function confirm() {
    setSubmitting(true); setError(null);
    try {
      const res = await BrokerService.placeOrder(order);
      setResult(res);
      onPlaced?.(res);
    } catch (e) { setError(e.message || 'Order failed'); }
    setSubmitting(false);
  }

  return (
    <Dialog open={open && !!order} onOpenChange={(o) => { if (!o) onClosed?.(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="w-5 h-5 text-gold" /> Confirm Trade
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="w-10 h-10 text-bullish mx-auto mb-3" />
            <div className="text-sm font-medium">Paper trade recorded</div>
            <div className="text-xs text-muted-foreground mt-1">Saved to your journal as an open trade.</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Detail label="Market" value={symbol} />
              <Detail label="Direction" value={order?.direction} tone={order?.direction === 'BUY' ? 'bullish' : 'bearish'} />
              <Detail label="Entry" value={fmt(order?.entry)} />
              <Detail label="Stop Loss" value={fmt(order?.stop_loss)} tone="bearish" />
              <Detail label="Take Profit" value={fmt(order?.take_profit)} tone="bullish" />
              <Detail label="Risk/Reward" value={order?.risk_reward ? `1:${order.risk_reward}` : '—'} />
              <Detail label="Risk %" value={`${riskPct}%`} />
              <Detail label="Max $ Risk" value={`$${riskUsd.toFixed(2)}`} tone="bearish" />
            </div>

            <div className={cn('rounded-lg border px-3.5 py-3 mt-1', guards.allowed ? 'border-bullish/30 bg-bullish/5' : 'border-bearish/30 bg-bearish/5')}>
              <div className="flex items-center gap-2 text-xs font-semibold mb-1.5">
                {guards.allowed ? <CheckCircle2 className="w-3.5 h-3.5 text-bullish" /> : <AlertTriangle className="w-3.5 h-3.5 text-bearish" />}
                Pre-Trade Risk Checks
              </div>
              {guards.allowed ? (
                <div className="text-xs text-muted-foreground">All guards passed. This trade is within your risk limits.</div>
              ) : (
                <ul className="text-xs text-bearish space-y-0.5 list-disc list-inside">
                  {guards.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              )}
            </div>

            {error && <div className="text-xs text-bearish mt-2">{error}</div>}

            <div className="text-[11px] text-muted-foreground mt-2">
              Mode: <span className="text-foreground font-medium">{BrokerService.mode()}</span> · Manual confirmation required. No auto-execution.
            </div>
          </>
        )}

        <DialogFooter className="gap-2">
          <button onClick={onClosed} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground">
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button onClick={confirm} disabled={!guards.allowed || submitting || !ctx}
              className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium',
                guards.allowed ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground cursor-not-allowed')}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              CONFIRM TRADE
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('text-sm font-semibold tabular-nums', tone === 'bullish' ? 'text-bullish' : tone === 'bearish' ? 'text-bearish' : 'text-foreground')}>{value ?? '—'}</div>
    </div>
  );
}