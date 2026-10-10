import { MarketDataService, EconomicCalendarService, clearCache } from './marketData';
import { SettingsService, TradingJournalService } from './storage';
import { evaluateTrade } from './tradeGuards';
import { computeSignalScore, isBestSetup, gradeFromScore } from './signalEngine';
import { BrokerService } from './brokerService';
import { OandaService } from './oandaService';
import { getAutoRiskPercent } from './riskEngine';

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
    const reviewRequired = settings.auto_require_confirmation !== false;
    if (!autoMode) {
      add('guard', 'Auto mode is OFF — scan will run but no orders will be placed. Enable in Settings.', 'warn');
    } else {
      add('init', reviewRequired
        ? 'Auto mode ON — qualifying trades will wait for your entry, stop-loss, take-profit, and size review.'
        : `Auto mode ON — qualifying trades execute automatically${settings.oanda_connected && !settings.paper_mode ? ' via OANDA (live)' : ' (paper)'}.`, 'ok');
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
      const riskPercent = getAutoRiskPercent(settings);
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
        risk_percent: riskPercent,
        risk: ((settings.account_balance ?? 10000) * riskPercent) / 100,
        size_profile: settings.auto_size_profile || 'small',
      };
      if (settings.oanda_connected) {
        try {
          const px = await OandaService.getPricing(sym);
          if (px?.mid) { order.entry = px.mid; add('scan', `${sym}: live OANDA price ${px.mid} used for entry.`, 'ok'); }
        } catch (e) { add('scan', `${sym}: OANDA price unavailable — ${e.message}`, 'warn'); }
      }
      const stopDistance = Math.abs(Number(order.entry) - Number(order.stop_loss));
      const targetDistance = Math.abs(Number(order.take_profit) - Number(order.entry));
      order.risk_reward = stopDistance > 0 ? targetDistance / stopDistance : 0;
      order.estimated_loss = order.risk;
      order.estimated_profit = order.risk * order.risk_reward;
      const guards = evaluateTrade({
        trade: order, settings, todayTrades, todayPnL, nextHighEventTime: nextHigh, qualityScore: score?.total, openTrades: (trades || []).filter((t) => t.status === 'open'),
      });
      candidates.push({ symbol: sym, order, guards, grade, score: score?.total });
    }

    add('evaluate', `${candidates.length} candidate(s) found. Running pre-trade guards…`, 'running');

    const executed = [];
    for (const c of candidates) {
      // Re-run guards so earlier fills in this scan count toward limits and open positions
      if (c.guards.allowed && executed.length) {
        c.guards = evaluateTrade({
          trade: c.order, settings,
          todayTrades: todayTrades.concat(executed.map((e) => ({ market: e.symbol, status: 'open' }))),
          todayPnL, nextHighEventTime: nextHigh, qualityScore: c.score,
          openTrades: (trades || []).filter((t) => t.status === 'open').concat(executed.map((e) => ({ market: e.symbol, status: 'open' }))),
        });
      }
      if (c.guards.allowed) {
        if (autoMode && reviewRequired) {
          add('review', `${c.symbol}: ready for review — max loss $${c.order.estimated_loss.toFixed(2)}, target profit $${c.order.estimated_profit.toFixed(2)}, SL ${c.order.stop_loss}, TP ${c.order.take_profit}.`, 'candidate');
        } else if (autoMode) {
          add('execute', `${c.symbol}: guards passed — placing ${settings.oanda_connected && !settings.paper_mode ? 'live OANDA' : 'paper'} order…`, 'running');
          try {
            const res = await BrokerService.placeOrder(c.order);
            executed.push({ ...c, result: res });
            add('execute', `${c.symbol}: ✅ ${c.order.direction} placed (${res?.provider === 'oanda' ? `OANDA ${res.mode}` : 'paper'}). Entry ${c.order.entry}, R/R 1:${c.order.risk_reward?.toFixed(1)}`, 'success');
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
    return { executed, candidates, analyses, blocked: false, autoMode, reviewRequired, log };
  },

  async executeCandidate(candidate) {
    const settings = (await SettingsService.get().catch(() => null)) || {};
    if (!settings.auto_mode) throw new Error('Auto mode is OFF');
    if (settings.kill_switch) throw new Error('Kill switch is active');

    const trades = await TradingJournalService.list().catch(() => []);
    const today = new Date().toISOString().slice(0, 10);
    const todayTrades = (trades || []).filter((t) => (t.date || (t.created_date || '').slice(0, 10)) === today);
    const todayPnL = todayTrades.reduce((sum, trade) => sum + (Number(trade.profit_loss) || 0), 0);
    const riskPercent = getAutoRiskPercent(settings);
    const order = {
      ...candidate.order,
      risk_percent: riskPercent,
      risk: ((settings.account_balance ?? 10000) * riskPercent) / 100,
      size_profile: settings.auto_size_profile || 'small',
    };

    if (settings.oanda_connected) {
      const price = await OandaService.getPricing(candidate.symbol);
      if (price?.mid) order.entry = price.mid;
    }
    const stopDistance = Math.abs(Number(order.entry) - Number(order.stop_loss));
    const targetDistance = Math.abs(Number(order.take_profit) - Number(order.entry));
    order.risk_reward = stopDistance > 0 ? targetDistance / stopDistance : 0;
    order.estimated_loss = order.risk;
    order.estimated_profit = order.risk * order.risk_reward;

    let nextHigh = null;
    try {
      const calendar = await EconomicCalendarService.getUpcoming();
      const event = (calendar?.events || []).find((item) => item.impact === 'HIGH');
      if (event) nextHigh = new Date(`${event.date} ${event.time || ''}`).getTime() || null;
    } catch {}

    const guards = evaluateTrade({
      trade: order,
      settings,
      todayTrades,
      todayPnL,
      nextHighEventTime: nextHigh,
      qualityScore: candidate.score,
      openTrades: (trades || []).filter((t) => t.status === 'open'),
    });
    if (!guards.allowed) throw new Error(guards.reasons.join('; '));
    const result = await BrokerService.placeOrder(order);
    return { ...candidate, order, guards, result };
  },
};
