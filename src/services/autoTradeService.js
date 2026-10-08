import { MarketDataService, EconomicCalendarService, clearCache } from './marketData';
import { SettingsService, TradingJournalService } from './storage';
import { evaluateTrade } from './tradeGuards';
import { computeSignalScore, isBestSetup, gradeFromScore } from './signalEngine';
import { BrokerService } from './brokerService';
import { OandaService } from './oandaService';

const SYMBOLS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'NZDUSD', 'USDCHF'];

// ---------------------------------------------------------------------------
// AutoTradeService — full automated trading engine.
// Scans markets → finds A+/A setups → runs pre-trade guards → executes via
// BrokerService (paper). Every step is logged for transparency. Respects
// kill_switch, auto_mode, daily loss limit, max trades/day, news blackout,
// risk cap, min R/R, and quality grade — the same guards as manual trades.
// ---------------------------------------------------------------------------

export const AutoTradeService = {
  async runScan(onProgress) {
    const log = [];
    const add = (step, detail, status) => {
      const entry = { step, detail, status, time: new Date().toISOString() };
      log.push(entry);
      onProgress?.({ step, detail, status, log: [...log] });
    };

    add('init', 'Loading settings & today’s trades…', 'running');
    const settings = (await SettingsService.get().catch(() => null)) || {};
    const trades = await TradingJournalService.list().catch(() => []);
    const today = new Date().toISOString().slice(0, 10);
    const todayTrades = (trades || []).filter((t) => (t.date || (t.created_date || '').slice(0, 10)) === today);
    const todayPnL = todayTrades.reduce((s, t) => s + (Number(t.profit_loss) || 0), 0);

    if (settings.kill_switch) {
      add('guard', 'Kill switch is ACTIVE — auto-trade aborted.', 'blocked');
      return { executed: [], candidates: [], blocked: true, autoMode: false, log };
    }

    const autoMode = !!settings.auto_mode;
    if (!autoMode) {
      add('guard', 'Auto mode is OFF — scan will run but no orders will be placed. Enable in Settings.', 'warn');
    } else {
      add('init', `Auto mode ON — qualifying trades execute automatically${settings.oanda_connected && !settings.paper_mode ? ' via OANDA (live)' : ' (paper)'}.`, 'ok');
    }

    let nextHigh = null;
    try {
      const c = await EconomicCalendarService.getUpcoming();
      const ev = (c?.events || []).find((e) => e.impact === 'HIGH');
      if (ev) nextHigh = new Date(`${ev.date} ${ev.time || ''}`).getTime() || null;
    } catch {}

    add('scan', `Scanning ${SYMBOLS.length} markets for A+/A setups…`, 'running');
    const analyses = {};
    for (const sym of SYMBOLS) {
      add('scan', `Fetching live analysis for ${sym}…`, 'running');
      clearCache(`full_${sym}`);
      const a = await MarketDataService.getFullAnalysis(sym).catch(() => null);
      analyses[sym] = a;
      const grade = a?.setup?.quality_grade || gradeFromScore(a?.setup?.quality_score);
      const dir = a?.setup?.direction || 'NONE';
      const status = a?.setup?.status || '—';
      const good = a && isBestSetup(grade) && dir !== 'NONE' && String(status).toUpperCase() !== 'NO TRADE';
      add('scan', `${sym}: grade ${grade || '—'}, ${dir}, ${status}`, good ? 'candidate' : 'skip');
    }

    const candidates = [];
    for (const sym of SYMBOLS) {
      const a = analyses[sym];
      const setup = a?.setup;
      const grade = setup?.quality_grade || gradeFromScore(setup?.quality_score);
      if (!setup || !isBestSetup(grade) || setup.direction === 'NONE') continue;
      if (String(setup.status || '').toUpperCase() === 'NO TRADE') continue;
      const score = computeSignalScore(a);
      const order = {
        market: sym,
        direction: setup.direction,
        entry: setup.entry_zone_high ?? setup.entry_zone_low,
        stop_loss: setup.stop_loss,
        take_profit: setup.tp1,
        risk_reward: setup.risk_reward,
        setup_quality: grade,
        reason: (setup.reasons || []).join('; '),
        session: a?.snapshot?.session,
        risk_percent: settings.risk_per_trade ?? 0.5,
        risk: ((settings.account_balance ?? 10000) * (settings.risk_per_trade ?? 0.5)) / 100,
      };
      if (settings.oanda_connected) {
        try {
          const px = await OandaService.getPricing(sym);
          if (px?.mid) { order.entry = px.mid; add('scan', `${sym}: live OANDA price ${px.mid} used for entry.`, 'ok'); }
        } catch (e) { add('scan', `${sym}: OANDA price unavailable — ${e.message}`, 'warn'); }
      }
      const guards = evaluateTrade({
        trade: order, settings, todayTrades, todayPnL, nextHighEventTime: nextHigh, qualityScore: score?.total,
      });
      candidates.push({ symbol: sym, order, guards, grade, score: score?.total });
    }

    add('evaluate', `${candidates.length} candidate(s) found. Running pre-trade guards…`, 'running');

    const executed = [];
    for (const c of candidates) {
      if (c.guards.allowed) {
        if (autoMode) {
          add('execute', `${c.symbol}: guards passed — placing ${settings.oanda_connected && !settings.paper_mode ? 'live OANDA' : 'paper'} order…`, 'running');
          try {
            const res = await BrokerService.placeOrder(c.order);
            executed.push({ ...c, result: res });
            add('execute', `${c.symbol}: ✅ ${c.order.direction} placed (${c.result?.mode === 'live' ? 'live OANDA' : 'paper'}). Entry ${c.order.entry}, R/R 1:${c.order.risk_reward?.toFixed(1)}`, 'success');
          } catch (e) {
            add('execute', `${c.symbol}: execution failed — ${e.message}`, 'error');
          }
        } else {
          add('execute', `${c.symbol}: guards PASSED but auto mode OFF — not executed.`, 'warn');
        }
      } else {
        add('guard', `${c.symbol}: blocked — ${c.guards.reasons.join('; ')}`, 'blocked');
      }
    }

    add('done', `Scan complete — ${candidates.length} candidate(s), ${executed.length} executed.`, 'done');
    return { executed, candidates, analyses, blocked: false, autoMode, log };
  },
};