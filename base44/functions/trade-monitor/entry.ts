import { createClientFromRequest } from 'npm:@base44/sdk';

// ---------------------------------------------------------------------------
// trade-monitor — runs every 15 min via the "Trade Monitor" workflow.
// For each open OANDA position:
//   1. Breakeven: when trade reaches +1R, move SL to entry (no-loss lock)
//   2. Trailing:  when trade reaches +2R, trail SL to lock in 1R profit
//   3. Time stop: if open >4h and in a loss, close to free capital
// Also syncs recently closed OANDA trades back to the journal so P/L and
// win/loss results stay accurate without manual entry.
// ---------------------------------------------------------------------------

const OANDA_BASE: Record<string, string> = { practice: 'https://api-fxpractice.oanda.com', live: 'https://api-fxtrade.oanda.com' };
const SYMBOL_TO_OANDA: Record<string, string> = { XAUUSD: 'XAU_USD', EURUSD: 'EUR_USD', GBPUSD: 'GBP_USD', USDJPY: 'USD_JPY', AUDUSD: 'AUD_USD', USDCAD: 'USD_CAD', NZDUSD: 'NZD_USD', USDCHF: 'USD_CHF' };
const OANDA_TO_SYMBOL: Record<string, string> = Object.fromEntries(Object.entries(SYMBOL_TO_OANDA).map(([s, i]) => [i, s]));
const DECIMALS: Record<string, number> = { XAUUSD: 2, USDJPY: 3, EURUSD: 5, GBPUSD: 5, AUDUSD: 5, USDCAD: 5, NZDUSD: 5, USDCHF: 5 };

function roundPrice(symbol: string, price: number): number {
  const d = DECIMALS[symbol] ?? 5;
  return Number(price.toFixed(d));
}

async function oandaRequest(settings: any, path: string, options: RequestInit = {}, query: Record<string, string> = {}) {
  const token = settings.oanda_api_token || '';
  const account = settings.oanda_account_id || '';
  if (!token || !account) throw new Error('OANDA credentials not configured');
  const base = OANDA_BASE[settings.oanda_environment || 'practice'] || OANDA_BASE.practice;
  const url = new URL(`${base}${path.replace('{account}', encodeURIComponent(account))}`);
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept-Datetime-Format': 'RFC3339', ...(options.headers || {}) }, signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`OANDA: ${data?.errorMessage || data?.message || `HTTP ${response.status}`}`);
  return data;
}

async function getPricing(settings: any, symbol: string): Promise<{ bid: number; ask: number; mid: number } | null> {
  const data = await oandaRequest(settings, '/v3/accounts/{account}/pricing', {}, { instruments: SYMBOL_TO_OANDA[symbol] });
  const p = data?.prices?.[0];
  if (!p) return null;
  const bid = Number(p.bids?.[0]?.price);
  const ask = Number(p.asks?.[0]?.price);
  return { bid, ask, mid: (bid + ask) / 2 };
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const user = await base44.auth.me().catch(() => null);
    const isScheduled = body?.source === 'scheduled';
    if (!user && !isScheduled) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const sdk = base44.asServiceRole;

    // 1. Get settings
    const { items: settingsItems } = await sdk.entities.AppSettings.filter({}, { sort: '-created_date', limit: 1 });
    const settings = settingsItems?.[0] || {};
    if (!settings.oanda_connected || settings.paper_mode) {
      return Response.json({ status: 'skip', message: 'OANDA not connected or paper mode active' });
    }

    // 2. Get open OANDA trades
    const oandaData = await oandaRequest(settings, '/v3/accounts/{account}/openTrades');
    const oandaTrades: any[] = oandaData?.trades || [];

    // 3. Get journal trades (open, oanda) to match by broker_trade_id
    const { items: journalTrades } = await sdk.entities.Trade.filter(
      { status: 'open', broker_provider: 'oanda' },
      { limit: 50 }
    );
    const journalMap = new Map((journalTrades || []).map((t: any) => [t.broker_trade_id, t]));

    const actions: any[] = [];

    // 4. Manage open trades
    for (const ot of oandaTrades) {
      const symbol = OANDA_TO_SYMBOL[ot.instrument];
      if (!symbol) continue;

      const journal = journalMap.get(ot.id);
      const entry = Number(ot.price);
      const currentSL = ot.stopLossOrder ? Number(ot.stopLossOrder.price) : null;
      const direction = Number(ot.currentUnits) > 0 ? 'BUY' : 'SELL';
      const sign = direction === 'BUY' ? 1 : -1;

      // Get current price
      let px: any;
      try { px = await getPricing(settings, symbol); } catch { continue; }
      if (!px) continue;
      const currentPrice = direction === 'BUY' ? px.bid : px.ask;

      // Calculate R multiple from the original stop distance (from journal)
      const origStop = journal ? Number(journal.stop_loss) : currentSL;
      const stopDistance = origStop ? Math.abs(entry - origStop) : 0;
      if (!stopDistance || stopDistance <= 0) continue;

      const profit = (currentPrice - entry) * sign;
      const rMultiple = profit / stopDistance;

      // Trade open time
      const openTime = new Date(ot.openTime).getTime();
      const hoursOpen = (Date.now() - openTime) / (1000 * 60 * 60);

      // Rule 1: Trailing stop at 2R+ (lock in 1R profit)
      if (rMultiple >= 2) {
        const newSL = roundPrice(symbol, entry + sign * stopDistance);
        if (currentSL == null || (sign > 0 && newSL > currentSL) || (sign < 0 && newSL < currentSL)) {
          try {
            await oandaRequest(settings, `/v3/accounts/{account}/trades/${encodeURIComponent(ot.id)}/orders`, {
              method: 'PUT',
              body: JSON.stringify({ stopLoss: { timeInForce: 'GTC', price: String(newSL) } }),
            });
            if (journal) await sdk.entities.Trade.update(journal.id, { stop_loss: newSL });
            actions.push({ symbol, tradeId: ot.id, r: +rMultiple.toFixed(2), action: `Trailing stop moved to ${newSL} — locked in 1R profit (trade at ${rMultiple.toFixed(1)}R)` });
          } catch (e: any) { actions.push({ symbol, tradeId: ot.id, action: `Trail failed: ${e.message}` }); }
        }
      }
      // Rule 2: Breakeven at 1R (lock in no loss)
      else if (rMultiple >= 1) {
        const breakevenSL = roundPrice(symbol, entry);
        if (currentSL == null || (sign > 0 && breakevenSL > currentSL) || (sign < 0 && breakevenSL < currentSL)) {
          try {
            await oandaRequest(settings, `/v3/accounts/{account}/trades/${encodeURIComponent(ot.id)}/orders`, {
              method: 'PUT',
              body: JSON.stringify({ stopLoss: { timeInForce: 'GTC', price: String(breakevenSL) } }),
            });
            if (journal) await sdk.entities.Trade.update(journal.id, { stop_loss: breakevenSL });
            actions.push({ symbol, tradeId: ot.id, r: +rMultiple.toFixed(2), action: `Stop loss moved to breakeven at ${breakevenSL} (trade at ${rMultiple.toFixed(1)}R)` });
          } catch (e: any) { actions.push({ symbol, tradeId: ot.id, action: `Breakeven failed: ${e.message}` }); }
        }
      }
      // Rule 3: Time stop — close if open >4h and in a loss (free up capital)
      else if (hoursOpen > 4 && rMultiple < 0) {
        try {
          const closeData = await oandaRequest(settings, `/v3/accounts/{account}/trades/${encodeURIComponent(ot.id)}/close`, { method: 'PUT' });
          const realizedPL = Number(closeData?.orderFillTransaction?.pl || 0);
          if (journal) await sdk.entities.Trade.update(journal.id, {
            status: 'closed', result: 'loss', profit_loss: realizedPL,
            prediction_outcome: journal.predicted_probability != null ? 'incorrect' : undefined,
          });
          actions.push({ symbol, tradeId: ot.id, r: +rMultiple.toFixed(2), action: `Time stop closed trade (open ${hoursOpen.toFixed(1)}h, P/L $${realizedPL.toFixed(2)})` });
        } catch (e: any) { actions.push({ symbol, tradeId: ot.id, action: `Time stop failed: ${e.message}` }); }
      }
    }

    // 5. Sync closed trades — update journal for trades that hit SL/TP at OANDA
    const closedData = await oandaRequest(settings, '/v3/accounts/{account}/trades', {}, { state: 'CLOSED', count: '20' });
    const closedTrades: any[] = closedData?.trades || [];
    const closedActions: any[] = [];
    const openTradeIds = new Set(oandaTrades.map((t: any) => t.id));

    for (const ct of closedTrades) {
      const journal = journalMap.get(ct.id);
      if (!journal) continue;

      const realizedPL = Number(ct.realizedPL || 0);
      const result = realizedPL > 0 ? 'win' : realizedPL < 0 ? 'loss' : 'breakeven';
      const predictionOutcome = journal.predicted_probability != null
        ? (result === 'win' ? 'correct' : result === 'loss' ? 'incorrect' : 'pending')
        : undefined;

      await sdk.entities.Trade.update(journal.id, {
        status: 'closed',
        result,
        profit_loss: realizedPL,
        prediction_outcome: predictionOutcome,
      });

      closedActions.push({
        symbol: OANDA_TO_SYMBOL[ct.instrument] || ct.instrument,
        tradeId: ct.id,
        result,
        profit_loss: realizedPL,
      });
    }

    return Response.json({
      status: 'ok',
      openTrades: oandaTrades.length,
      managed: actions.length,
      actions,
      synced: closedActions.length,
      closedActions,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}