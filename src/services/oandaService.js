import { SettingsService } from './storage';

// ---------------------------------------------------------------------------
// OandaService — OANDA v20 REST API client.
// Symbol mapping: XAUUSD -> XAU_USD, EURUSD -> EUR_USD.
// Credentials (API token, account id, environment) are read from AppSettings
// (owner-only via RLS). Practice and live environments are supported.
// ---------------------------------------------------------------------------

const SYMBOL_TO_OANDA = { XAUUSD: 'XAU_USD', EURUSD: 'EUR_USD' };
const OANDA_TO_SYMBOL = { XAU_USD: 'XAUUSD', EUR_USD: 'EURUSD' };

const BASE = {
  practice: 'https://api-fxpractice.oanda.com',
  live: 'https://api-fxtrade.oanda.com',
};

async function creds() {
  const s = (await SettingsService.get().catch(() => null)) || {};
  return {
    token: s.oanda_api_token || '',
    account: s.oanda_account_id || '',
    env: s.oanda_environment || 'practice',
  };
}

async function req(path, { method = 'GET', body, query } = {}) {
  const { token, account, env } = await creds();
  if (!token) throw new Error('OANDA API token not configured');
  const base = BASE[env] || BASE.practice;
  const url = new URL(base + path.replace('{account}', encodeURIComponent(account)));
  if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept-Datetime-Format': 'RFC3339',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.errorMessage || data?.message || `HTTP ${res.status}`;
    throw new Error(`OANDA: ${msg}`);
  }
  return data;
}

export const OandaService = {
  SYMBOL_TO_OANDA,
  OANDA_TO_SYMBOL,

  async testConnection() {
    const { token, env } = await creds();
    if (!token) throw new Error('No API token configured');
    const base = BASE[env] || BASE.practice;
    const res = await fetch(`${base}/v3/accounts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.errorMessage || `HTTP ${res.status}`);
    return data.accounts || [];
  },

  async getAccountSummary() {
    return req('/v3/accounts/{account}/summary');
  },

  async getPricing(symbol) {
    const inst = SYMBOL_TO_OANDA[symbol];
    if (!inst) throw new Error(`Unsupported symbol ${symbol}`);
    const data = await req('/v3/accounts/{account}/pricing', { query: { instruments: inst } });
    const p = data?.prices?.[0];
    if (!p) return null;
    const bid = Number(p.bids?.[0]?.price);
    const ask = Number(p.asks?.[0]?.price);
    return { symbol, instrument: inst, bid, ask, mid: (bid + ask) / 2, time: p.time };
  },

  async getPricingAll(symbols) {
    const insts = symbols.map((s) => SYMBOL_TO_OANDA[s]).filter(Boolean).join(',');
    if (!insts) return [];
    const data = await req('/v3/accounts/{account}/pricing', { query: { instruments: insts } });
    return (data?.prices || []).map((p) => {
      const bid = Number(p.bids?.[0]?.price);
      const ask = Number(p.asks?.[0]?.price);
      return {
        symbol: OANDA_TO_SYMBOL[p.instrument] || p.instrument,
        instrument: p.instrument,
        bid, ask, mid: (bid + ask) / 2, time: p.time,
      };
    });
  },

  async placeOrder(order) {
    const inst = SYMBOL_TO_OANDA[order.market];
    if (!inst) throw new Error(`Unsupported symbol ${order.market}`);
    const entry = Number(order.entry);
    const sl = Number(order.stop_loss);
    const tp = Number(order.take_profit);
    const riskAmount = Number(order.risk) || 0;
    const stopDist = Math.abs(entry - sl);
    if (!stopDist || !riskAmount) throw new Error('Cannot size position: need entry, stop_loss and risk');
    // units = riskAmount(USD) / stopDistance(price) — valid for USD-quoted instruments
    let units = Math.max(1, Math.round(riskAmount / stopDist));
    if (order.direction === 'SELL') units = -units;
    const body = {
      order: {
        type: 'MARKET',
        instrument: inst,
        units: String(units),
        ...(sl ? { stopLossOnFill: { price: String(sl) } } : {}),
        ...(tp ? { takeProfitOnFill: { price: String(tp) } } : {}),
      },
    };
    const data = await req('/v3/accounts/{account}/orders', { method: 'POST', body });
    const fill = data?.orderFillTransaction;
    return {
      ok: true,
      provider: 'oanda',
      mode: 'live',
      orderId: fill?.orderID || data?.orderCreateTransaction?.id,
      tradeId: fill?.tradeOpened?.tradeID || null,
      units,
      fillPrice: fill?.price ? Number(fill.price) : null,
      pnl: fill?.pl ? Number(fill.pl) : 0,
    };
  },

  async closeTrade(tradeId) {
    if (!tradeId) return { ok: true };
    return req(`/v3/accounts/{account}/trades/${encodeURIComponent(tradeId)}/close`, { method: 'PUT' });
  },

  async getCandles(symbol, granularity = 'M1', count = 50) {
    const inst = SYMBOL_TO_OANDA[symbol];
    if (!inst) throw new Error(`Unsupported symbol ${symbol}`);
    const data = await req(`/v3/instruments/${inst}/candles`, { query: { granularity, count, price: 'M' } });
    return (data?.candles || []).map((c) => ({
      time: c.time,
      open: Number(c.mid.o),
      high: Number(c.mid.h),
      low: Number(c.mid.l),
      close: Number(c.mid.c),
    }));
  },
};