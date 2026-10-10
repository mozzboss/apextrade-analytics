import { createClientFromRequest } from "npm:@base44/sdk";

const SYMBOL_TO_OANDA: Record<string, string> = {
  XAUUSD: "XAU_USD", EURUSD: "EUR_USD", GBPUSD: "GBP_USD", USDJPY: "USD_JPY",
  AUDUSD: "AUD_USD", USDCAD: "USD_CAD", NZDUSD: "NZD_USD", USDCHF: "USD_CHF",
};
const OANDA_TO_SYMBOL = Object.fromEntries(Object.entries(SYMBOL_TO_OANDA).map(([symbol, instrument]) => [instrument, symbol]));
const QUOTE: Record<string, string> = { XAUUSD: "USD", EURUSD: "USD", GBPUSD: "USD", USDJPY: "JPY", AUDUSD: "USD", USDCAD: "CAD", NZDUSD: "USD", USDCHF: "CHF" };
const BASE: Record<string, string> = { practice: "https://api-fxpractice.oanda.com", live: "https://api-fxtrade.oanda.com" };

type Settings = {
  oanda_api_token?: string;
  oanda_account_id?: string;
  oanda_environment?: string;
  account_balance?: number;
  max_risk?: number;
  min_risk_reward?: number;
  kill_switch?: boolean;
  max_trades_per_day?: number;
  daily_loss_limit?: number;
};
const message = (error: unknown) => error instanceof Error ? error.message : String(error);

async function getSettings(base44: any): Promise<Settings> {
  const settings = await base44.entities.AppSettings.list("-created_date", 1);
  return settings?.[0] || {};
}

function instrument(symbol: string) {
  const value = SYMBOL_TO_OANDA[symbol];
  if (!value) throw new Error(`Unsupported symbol ${symbol}`);
  return value;
}

async function request(settings: Settings, path: string, options: RequestInit = {}, query: Record<string, string | number> = {}) {
  const token = settings.oanda_api_token || "";
  const account = settings.oanda_account_id || "";
  if (!token || !account) throw new Error("OANDA credentials are not configured");
  const base = BASE[settings.oanda_environment || "practice"] || BASE.practice;
  const url = new URL(`${base}${path.replace("{account}", encodeURIComponent(account))}`);
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Accept-Datetime-Format": "RFC3339", ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`OANDA: ${data?.errorMessage || data?.message || `HTTP ${response.status}`}`);
  return data;
}

async function testConnection(settings: Settings) {
  const token = settings.oanda_api_token || "";
  if (!token) throw new Error("OANDA API token is not configured");
  const base = BASE[settings.oanda_environment || "practice"] || BASE.practice;
  const response = await fetch(`${base}/v3/accounts`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.errorMessage || `HTTP ${response.status}`);
  return data.accounts || [];
}

async function pricing(settings: Settings, symbol: string) {
  const data = await request(settings, "/v3/accounts/{account}/pricing", {}, { instruments: instrument(symbol) });
  const p = data?.prices?.[0];
  if (!p) return null;
  const bid = Number(p.bids?.[0]?.price); const ask = Number(p.asks?.[0]?.price);
  return { symbol, instrument: instrument(symbol), bid, ask, mid: (bid + ask) / 2, time: p.time };
}

async function pricingAll(settings: Settings, symbols: string[]) {
  const instruments = symbols.map(instrument).join(",");
  const data = await request(settings, "/v3/accounts/{account}/pricing", {}, { instruments });
  return (data?.prices || []).map((p: any) => {
    const bid = Number(p.bids?.[0]?.price); const ask = Number(p.asks?.[0]?.price);
    return { symbol: OANDA_TO_SYMBOL[p.instrument] || p.instrument, instrument: p.instrument, bid, ask, mid: (bid + ask) / 2, time: p.time };
  });
}

async function candles(settings: Settings, symbol: string, granularity = "M1", count = 50) {
  const data = await request(settings, `/v3/instruments/${instrument(symbol)}/candles`, {}, { granularity, count, price: "M" });
  return (data?.candles || []).map((c: any) => ({ time: c.time, open: Number(c.mid.o), high: Number(c.mid.h), low: Number(c.mid.l), close: Number(c.mid.c) }));
}

async function placeOrder(base44: any, settings: Settings, order: any, userId: string) {
  const market = String(order?.market || ""); const direction = String(order?.direction || "").toUpperCase();
  if (!market || !["BUY", "SELL"].includes(direction)) throw new Error("A valid market and direction are required");
  const entry = Number(order.entry); const stopLoss = Number(order.stop_loss); const takeProfit = Number(order.take_profit); const risk = Number(order.risk) || 0;
  const stopDistance = Math.abs(entry - stopLoss);
  if (settings.kill_switch) throw new Error("Kill switch is active");
  if (![entry, stopLoss, takeProfit].every(Number.isFinite) || entry <= 0 || stopLoss <= 0 || takeProfit <= 0 || !stopDistance || !risk) {
    throw new Error("Entry, stop-loss, take-profit, and risk are required");
  }
  if ((direction === "BUY" && stopLoss >= entry) || (direction === "SELL" && stopLoss <= entry)) throw new Error("Stop-loss is on the wrong side of entry");
  if ((direction === "BUY" && takeProfit <= entry) || (direction === "SELL" && takeProfit >= entry)) throw new Error("Take-profit is on the wrong side of entry");
  const riskReward = Math.abs(takeProfit - entry) / stopDistance;
  const minRiskReward = Number(settings.min_risk_reward ?? 2);
  if (!Number.isFinite(riskReward) || riskReward < minRiskReward) throw new Error(`Risk/reward ${riskReward.toFixed(2)} is below the minimum ${minRiskReward}`);
  const balance = Number(settings.account_balance ?? 10000);
  const maxRiskPercent = Number(settings.max_risk ?? 1);
  const maxRiskAmount = balance * maxRiskPercent / 100;
  if (risk > maxRiskAmount + 0.01) throw new Error(`Risk $${risk.toFixed(2)} exceeds the server limit of $${maxRiskAmount.toFixed(2)}`);
  const trades = await base44.entities.Trade.list("-created_date", 200);
  const today = new Date().toISOString().slice(0, 10);
  const todayTrades = (trades || []).filter((trade: any) => (trade.date || String(trade.created_date || "").slice(0, 10)) === today);
  const maxTrades = Number(settings.max_trades_per_day ?? 5);
  if (todayTrades.length >= maxTrades) throw new Error(`Maximum trades per day reached (${todayTrades.length}/${maxTrades})`);
  const todayPnl = todayTrades.reduce((sum: number, trade: any) => sum + (Number(trade.profit_loss) || 0), 0);
  const dailyLossLimit = Math.abs(Number(settings.daily_loss_limit ?? 0));
  if (dailyLossLimit > 0 && todayPnl <= -dailyLossLimit) throw new Error(`Daily loss limit reached ($${todayPnl.toFixed(2)})`);
  let units = risk / stopDistance;
  if ((QUOTE[market] || "USD") !== "USD") units *= entry;
  units = Math.max(1, Math.round(units)); if (direction === "SELL") units = -units;
  const data = await request(settings, "/v3/accounts/{account}/orders", { method: "POST", body: JSON.stringify({ order: { type: "MARKET", instrument: instrument(market), units: String(units), ...(Number.isFinite(stopLoss) ? { stopLossOnFill: { price: String(stopLoss) } } : {}), ...(Number.isFinite(takeProfit) ? { takeProfitOnFill: { price: String(takeProfit) } } : {}) } }) });
  const fill = data?.orderFillTransaction; const brokerOrderId = fill?.orderID || data?.orderCreateTransaction?.id; const brokerTradeId = fill?.tradeOpened?.tradeID;
  const trade = await base44.entities.Trade.create({ market, direction, entry: fill?.price ? Number(fill.price) : entry, stop_loss: stopLoss, take_profit: takeProfit, risk, risk_percent: order.risk_percent, size_profile: order.size_profile, risk_reward: riskReward, setup_quality: order.setup_quality, reason: `[OANDA ${brokerOrderId || ""}] ${order.reason || ""}`.trim(), result: "open", profit_loss: 0, date: new Date().toISOString().slice(0, 10), session: order.session, status: "open", strategy: order.strategy, timeframe: order.timeframe, market_condition: order.market_condition, entry_conditions: order.entry_conditions, predicted_probability: order.predicted_probability, expected_value: order.expected_value, prediction_outcome: order.predicted_probability != null ? "pending" : undefined, broker_provider: "oanda", broker_order_id: brokerOrderId, broker_trade_id: brokerTradeId, execution_mode: "live", broker_user_id: userId });
  return { ok: true, provider: "oanda", mode: "live", orderId: brokerOrderId, tradeId: brokerTradeId || null, journalTradeId: trade?.id, units, fillPrice: fill?.price ? Number(fill.price) : null, pnl: fill?.pl ? Number(fill.pl) : 0 };
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req); const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({})); const settings = await getSettings(base44);
    let result: any;
    switch (body?.action) {
      case "testConnection": result = await testConnection(settings); break;
      case "getAccountSummary": result = await request(settings, "/v3/accounts/{account}/summary"); break;
      case "getPricing": result = await pricing(settings, body.symbol); break;
      case "getPricingAll": result = await pricingAll(settings, body.symbols || []); break;
      case "getCandles": result = await candles(settings, body.symbol, body.granularity, body.count); break;
      case "placeOrder": result = await placeOrder(base44, settings, body.order, user.id); break;
      case "closeTrade":
        if (!body.tradeId) result = { ok: true };
        else {
          result = await request(settings, `/v3/accounts/{account}/trades/${encodeURIComponent(body.tradeId)}/close`, { method: "PUT" });
          if (body.journalTradeId) await base44.entities.Trade.update(body.journalTradeId, { result: "cancelled", status: "cancelled" });
        }
        break;
      default: return Response.json({ error: "Unsupported OANDA action" }, { status: 400 });
    }
    return Response.json(result);
  } catch (error) { return Response.json({ error: message(error) }, { status: 400 }); }
}
