import { createClientFromRequest } from 'npm:@base44/sdk';
import {
  SYMBOLS, SYMBOL_META, gradeFromScore, computeSignalScore, evaluateTrade,
  getAutoRiskPercent, inferStrategy, classifyCondition,
  oandaPricing, oandaPlaceOrder, buildAnalysisPrompt, buildCalendarPrompt,
  fullAnalysisSchema, calendarSchema,
} from './util.ts';

// ---------------------------------------------------------------------------
// auto-scan — scheduled automated market scan. Runs hourly during forex
// hours via the "Auto Trade Scan" workflow. For each of 8 symbols, calls
// InvokeLLM (web-enabled) for full analysis, scores the setup, runs the same
// pre-trade guards as manual trades, and executes A+/A/B setups through
// OANDA (live/practice) or paper. Respects kill_switch, auto_mode, daily
// loss limit, max trades/day, news blackout, risk cap, min R/R, and quality.
// ---------------------------------------------------------------------------

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Auth: allow admin users (manual trigger) or scheduled workflow calls
    const user = await base44.auth.me().catch(() => null);
    const isScheduled = body?.source === 'scheduled';
    if (!user && !isScheduled) return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (user && user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const sdk = base44.asServiceRole;

    // 1. Read settings
    const { items: settingsItems } = await sdk.entities.AppSettings.filter({}, { sort: '-created_date', limit: 1 });
    const settings = settingsItems?.[0] || {};
    if (settings.kill_switch) return Response.json({ status: 'kill_switch', executed: [] });
    if (!settings.auto_mode) return Response.json({ status: 'auto_off', executed: [] });

    // 2. Check daily limits
    const today = new Date().toISOString().slice(0, 10);
    const { items: todayTradesItems } = await sdk.entities.Trade.filter({ date: today }, { limit: 100 });
    const todayTrades = todayTradesItems || [];
    const maxTrades = Number(settings.max_trades_per_day || 10);
    if (todayTrades.length >= maxTrades) return Response.json({ status: 'max_trades_reached', executed: [], count: todayTrades.length, max: maxTrades });

    const todayPnL = todayTrades.reduce((s: number, t: any) => s + (Number(t.profit_loss) || 0), 0);
    const dailyLossLimit = Math.abs(Number(settings.daily_loss_limit || 0));
    if (dailyLossLimit > 0 && todayPnL <= -dailyLossLimit) return Response.json({ status: 'daily_loss_reached', executed: [], todayPnL });

    // 3. Check news blackout
    let nextHigh: number | null = null;
    try {
      const calendar: any = await sdk.integrations.Core.InvokeLLM({
        prompt: buildCalendarPrompt(),
        add_context_from_internet: true,
        model: 'gemini_3_flash',
        response_json_schema: calendarSchema,
      });
      const ev = (calendar?.events || []).find((e: any) => e.impact === 'HIGH');
      if (ev) nextHigh = new Date(`${ev.date} ${ev.time || ''}`).getTime() || null;
    } catch {}

    if (nextHigh) {
      const mins = (nextHigh - Date.now()) / 60000;
      const blackout = Number(settings.news_blackout_minutes ?? 30);
      if (mins > 0 && mins < blackout) return Response.json({ status: 'news_blackout', executed: [], minsToNews: Math.round(mins) });
    }

    // 4. Get open trades
    const { items: openTradesItems } = await sdk.entities.Trade.filter({ status: 'open' }, { limit: 50 });
    const openTrades = openTradesItems || [];

    // 5. Scan each symbol
    const executed: any[] = [];
    const scanned: any[] = [];
    const useOanda = settings.oanda_connected && !settings.paper_mode;

    for (const symbol of SYMBOLS) {
      if (todayTrades.length + executed.length >= maxTrades) break;
      if (openTrades.some((t: any) => t.market === symbol) || executed.some((e: any) => e.symbol === symbol)) {
        scanned.push({ symbol, skip: 'position already open' });
        continue;
      }

      // Get live price for OANDA-connected accounts
      let livePrice: number | undefined;
      if (settings.oanda_connected) {
        try { const px = await oandaPricing(settings, symbol); if (px?.mid) livePrice = px.mid; } catch {}
      }

      // Get analysis via InvokeLLM
      let analysis: any;
      try {
        analysis = await sdk.integrations.Core.InvokeLLM({
          prompt: buildAnalysisPrompt(symbol, SYMBOL_META[symbol], livePrice),
          add_context_from_internet: true,
          model: 'gemini_3_flash',
          response_json_schema: fullAnalysisSchema,
        });
      } catch (e: any) { scanned.push({ symbol, error: e.message }); continue; }

      if (!analysis?.setup) { scanned.push({ symbol, grade: '—' }); continue; }

      const grade = analysis.setup.quality_grade || gradeFromScore(analysis.setup.quality_score);
      if (!['A+', 'A', 'B'].includes(grade)) { scanned.push({ symbol, grade }); continue; }
      if (analysis.setup.direction === 'NONE') { scanned.push({ symbol, grade, direction: 'NONE' }); continue; }
      if (String(analysis.setup.status || '').toUpperCase() === 'NO TRADE') { scanned.push({ symbol, grade, status: 'NO TRADE' }); continue; }

      // Build order — use the AI's entry zone midpoint (NOT the live price)
      // so the R/R matches the setup the AI designed. The MARKET order fills
      // at whatever the current price is; SL/TP are absolute levels that stay
      // correct regardless of fill price.
      const entryLow = Number(analysis.setup.entry_zone_low);
      const entryHigh = Number(analysis.setup.entry_zone_high);
      let entry = (entryLow && entryHigh) ? (entryLow + entryHigh) / 2 : (entryHigh || entryLow);
      const stopLoss = Number(analysis.setup.stop_loss);
      let takeProfit = Number(analysis.setup.tp1);
      const stopDistance = Math.abs(entry - stopLoss);
      // Enforce minimum R/R by extending TP outward if the AI's TP is too close
      const minRR = Number(settings.min_risk_reward ?? 2);
      let riskReward = stopDistance > 0 ? Math.abs(takeProfit - entry) / stopDistance : 0;
      if (stopDistance > 0 && riskReward < minRR) {
        const sign = analysis.setup.direction === 'BUY' ? 1 : -1;
        takeProfit = entry + sign * stopDistance * minRR;
        riskReward = minRR;
      }
      const riskPercent = getAutoRiskPercent(settings);
      const risk = (Number(settings.account_balance ?? 10000) * riskPercent) / 100;

      const order: any = {
        market: symbol,
        direction: analysis.setup.direction,
        entry,
        stop_loss: stopLoss,
        take_profit: takeProfit,
        risk_reward: riskReward,
        setup_quality: grade,
        reason: (analysis.setup.reasons || []).join('; '),
        session: analysis?.snapshot?.session,
        risk_percent: riskPercent,
        risk,
        size_profile: settings.auto_size_profile || 'small',
        strategy: inferStrategy(analysis.setup),
        timeframe: '1H',
        market_condition: classifyCondition(analysis?.snapshot),
        entry_conditions: (analysis.setup.reasons || []).join('; '),
      };

      // Run guards
      const guards = evaluateTrade({
        trade: order,
        settings,
        todayTrades: [...todayTrades, ...executed.map((e: any) => ({ market: e.symbol, status: 'open' }))],
        todayPnL,
        nextHighEventTime: nextHigh,
        qualityScore: analysis.setup.quality_score,
        openTrades: [...openTrades, ...executed.map((e: any) => ({ market: e.symbol, status: 'open' }))],
      });

      if (!guards.allowed) { scanned.push({ symbol, grade, blocked: guards.reasons }); continue; }

      // Place order
      try {
        if (useOanda) {
          const result = await oandaPlaceOrder(settings, order);
          await sdk.entities.Trade.create({
            ...order,
            entry: result.fillPrice || entry,
            result: 'open', profit_loss: 0, date: today, status: 'open',
            broker_provider: 'oanda', broker_order_id: result.orderId, broker_trade_id: result.tradeId,
            execution_mode: settings.oanda_environment === 'live' ? 'live' : 'practice',
            broker_user_id: user?.id,
          });
          executed.push({ symbol, direction: order.direction, grade, orderId: result.orderId });
        } else {
          const trade = await sdk.entities.Trade.create({
            ...order, result: 'open', profit_loss: 0, date: today, status: 'open',
            broker_provider: 'paper', execution_mode: 'paper',
          });
          executed.push({ symbol, direction: order.direction, grade, tradeId: trade.id });
        }
      } catch (e: any) { scanned.push({ symbol, grade, error: e.message }); }
    }

    return Response.json({ status: 'ok', executed, scanned, count: executed.length, maxTrades, todayCount: todayTrades.length });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}