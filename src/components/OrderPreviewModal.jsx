import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ShieldCheck, AlertTriangle, Loader2, CheckCircle2, Brain, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { evaluateTrade } from '@/services/tradeGuards';
import { evaluateSignalQuality } from '@/services/signalFilter';
import { computeSignalScore } from '@/services/signalEngine';
import { estimateWinProbability, inferStrategy } from '@/services/probabilityEngine';
import { computeAdvancedStats, expectedValueForSetup } from '@/services/performanceStats';
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
  const fmt = (n) => (n != null ? Number(n).toLocaleString(undefined, { maximumFractionDigits: gold ? 2 : 5 }) : '—');

  const order = setup && (setup.direction === 'BUY' || setup.direction === 'SELL')
    ? {
        market: symbol,
        direction: setup.direction,
        entry: setup.entry_zone_high ?? setup.entry_zone_low,
        stop_loss: setup.stop_loss,
        take_profit: setup.tp1,
        risk_reward: setup.risk_reward,
        setup_quality: setup.quality_grade,
        reason: (setup.reasons || []).join('; '),
        session: snap?.session,
        strategy: inferStrategy(setup),
        timeframe: '1H',
        market_condition: classifyCondition(snap),
        entry_conditions: (setup.reasons || []).join('; '),
      }
    : null;

  // Fetch guard context + historical trades for probability estimation when opened
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
      let highImpactSoon = false;
      try {
        const c = await EconomicCalendarService.getUpcoming();
        const ev = (c?.events || []).find((e) => e.impact === 'HIGH');
        if (ev) {
          nextHigh = new Date(`${ev.date} ${ev.time || ''}`).getTime() || null;
          if (nextHigh) {
            const mins = (nextHigh - Date.now()) / 60000;
            const blackout = Number(settings?.news_blackout_minutes ?? 30);
            highImpactSoon = mins > 0 && mins < blackout;
          }
        }
      } catch {}
      if (active) setCtx({ settings: settings || {}, trades: trades || [], todayTrades, todayPnL, nextHighEventTime: nextHigh, highImpactSoon });
    })();
    return () => { active = false; };
  }, [open]);

  const riskPct = ctx?.settings?.risk_per_trade ?? 0.5;
  const balance = ctx?.settings?.account_balance ?? 10000;
  const riskUsd = (balance * riskPct) / 100;
  if (order) { order.risk_percent = riskPct; order.risk = riskUsd; }

  // Probability + EV from historical similar trades (never invented)
  const prob = useMemo(() => {
    if (!order || !ctx) return null;
    return estimateWinProbability(setup, analysis, ctx.trades, { symbol, highImpactNewsSoon: ctx.highImpactSoon });
  }, [order, ctx, setup, analysis, symbol]);

  const adv = useMemo(() => (ctx?.trades ? computeAdvancedStats(ctx.trades) : null), [ctx]);

  const ev = useMemo(() => {
    if (!prob || !adv) return null;
    if (!prob.sufficient) return null;
    return expectedValueForSetup(prob.probability, adv.avgWin, adv.avgLoss, adv.avgCosts);
  }, [prob, adv]);

  if (order && prob) {
    order.predicted_probability = prob.sufficient ? prob.probability : null;
    order.expected_value = ev;
  }

  const guards = order && ctx
    ? evaluateTrade({
        trade: order,
        settings: ctx.settings,
        todayTrades: ctx.todayTrades,
        todayPnL: ctx.todayPnL,
        nextHighEventTime: ctx.nextHighEventTime,
        qualityScore: analysis ? computeSignalScore(analysis)?.total : null,
      })
    : { allowed: false, reasons: ['Loading risk checks…'] };

  const signal = order && ctx
    ? evaluateSignalQuality({ analysis, setup, settings: ctx.settings, ctx: { risk_percent: riskPct, highImpactNewsSoon: ctx.highImpactSoon } })
    : { decision: 'WAIT', hardFails: [], cautions: [], confirmations: [] };

  const brokerMode = ctx?.settings?.oanda_connected && ctx?.settings?.oanda_api_token && !ctx?.settings?.paper_mode
    ? `OANDA ${ctx?.settings?.oanda_environment === 'live' ? 'Live' : 'Practice'}`
    : 'Paper';

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
            <div className="text-sm font-medium">Trade recorded</div>
            <div className="text-xs text-muted-foreground mt-1">Saved to your journal with its prediction for later validation.</div>
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

            {/* Win probability + EV */}
            <div className="rounded-lg border border-border bg-muted/20 px-3.5 py-3 mt-3">
              <div className="flex items-center gap-2 text-xs font-semibold mb-2">
                <Brain className="w-3.5 h-3.5 text-gold" /> Historical Win Probability
              </div>
              {!ctx ? (
                <div className="text-xs text-muted-foreground">Loading historical data…</div>
              ) : prob?.sufficient ? (
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Est. Probability</div>
                    <div className="text-sm font-semibold text-foreground tabular-nums">{prob.probability.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Sample</div>
                    <div className="text-sm font-semibold tabular-nums">n={prob.sampleSize}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">95% CI</div>
                    <div className="text-sm font-semibold tabular-nums">{prob.confidenceInterval.low.toFixed(0)}–{prob.confidenceInterval.high.toFixed(0)}%</div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-warn">Insufficient Data — fewer than 20 similar closed trades (n={prob?.sampleSize ?? 0}). No probability estimate shown.</div>
              )}
              {ev != null && (
                <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Expected Value / trade</span>
                  <span className={cn('font-semibold tabular-nums', ev >= 0 ? 'text-bullish' : 'text-bearish')}>{ev >= 0 ? '+' : ''}${ev.toFixed(2)}</span>
                </div>
              )}
              {prob?.confirmations?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {prob.confirmations.slice(0, 3).map((c, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-bullish/10 text-bullish border border-bullish/20">{c}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Signal quality gate */}
            <div className={cn('rounded-lg border px-3.5 py-3 mt-2', signal.allowed ? 'border-bullish/30 bg-bullish/5' : 'border-warn/30 bg-warn/5')}>
              <div className="flex items-center gap-2 text-xs font-semibold mb-1.5">
                <Gauge className="w-3.5 h-3.5 text-gold" /> Signal Quality: <span className={signal.decision === 'GO' ? 'text-bullish' : signal.decision === 'WAIT' ? 'text-warn' : 'text-bearish'}>{signal.decision}</span>
              </div>
              {signal.confirmations.length > 0 && <div className="text-[11px] text-bullish mb-1">✓ {signal.confirmations.join(' · ')}</div>}
              {signal.cautions.length > 0 && <div className="text-[11px] text-warn mb-1">⚠ {signal.cautions.join(' · ')}</div>}
              {signal.hardFails.length > 0 && <div className="text-[11px] text-bearish">✗ {signal.hardFails.join(' · ')}</div>}
            </div>

            {/* Pre-trade risk checks */}
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
              Mode: <span className="text-foreground font-medium">{brokerMode}</span> · Manual confirmation required. Probability is empirical, not a guarantee.
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

function classifyCondition(snap) {
  const v = String(snap?.volatility || '').toLowerCase();
  const t = String(snap?.trend || '').toLowerCase();
  if (v.includes('high') || v.includes('extreme')) return 'volatile';
  if (t.includes('range') || t.includes('sideway')) return 'ranging';
  if (t.includes('up') || t.includes('down') || t.includes('bull') || t.includes('bear')) return 'trending';
  return 'mixed';
}

function Detail({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('text-sm font-semibold tabular-nums', tone === 'bullish' ? 'text-bullish' : tone === 'bearish' ? 'text-bearish' : 'text-foreground')}>{value ?? '—'}</div>
    </div>
  );
}