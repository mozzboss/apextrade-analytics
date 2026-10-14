// Shared logic for the auto-scan backend function: signal scoring, trade
// guards, analysis prompts, and OANDA API helpers. Mirrors the frontend
// services (signalEngine, tradeGuards, riskEngine, marketData, oandaService)
// but lives server-side for scheduled execution without a browser session.

export const SYMBOLS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'NZDUSD', 'USDCHF'];

export const SYMBOL_META: Record<string, any> = {
  XAUUSD: { display: 'XAU/USD', name: 'Gold vs US Dollar', macroFocus: 'DXY, US Treasury yields, Federal Reserve expectations, inflation (CPI/PPI/PCE), NFP, unemployment, GDP, interest rates, FOMC, Fed speeches, geopolitical risk, risk-on/risk-off sentiment, gold futures positioning.' },
  EURUSD: { display: 'EUR/USD', name: 'Euro vs US Dollar', macroFocus: 'DXY, Federal Reserve, ECB, US rates, European rates, CPI, PCE, NFP, European inflation, European GDP, PMI, ECB speeches, Fed speeches, interest rate expectations, US vs European economic strength.' },
  GBPUSD: { display: 'GBP/USD', name: 'British Pound vs US Dollar', macroFocus: 'DXY, Federal Reserve, Bank of England, US rates, UK rates, CPI, PCE, NFP, UK inflation, UK GDP, PMI, BoE speeches, Fed speeches, US vs UK economic strength.' },
  USDJPY: { display: 'USD/JPY', name: 'US Dollar vs Japanese Yen', macroFocus: 'DXY, Federal Reserve, Bank of Japan, US rates, JGB yields, CPI, PCE, NFP, Japan inflation, Japan GDP, BoJ speeches, Fed speeches, intervention risk, US vs Japan rate differential.' },
  AUDUSD: { display: 'AUD/USD', name: 'Australian Dollar vs US Dollar', macroFocus: 'DXY, Federal Reserve, RBA, China data, iron ore, commodities, US vs Australia rates, CPI, NFP, Australia inflation, GDP, RBA speeches, Fed speeches, risk sentiment.' },
  USDCAD: { display: 'USD/CAD', name: 'US Dollar vs Canadian Dollar', macroFocus: 'DXY, Federal Reserve, Bank of Canada, oil prices, US vs Canada rates, CPI, NFP, Canada inflation, GDP, BoC speeches, Fed speeches, crude oil impact on CAD.' },
  NZDUSD: { display: 'NZD/USD', name: 'New Zealand Dollar vs US Dollar', macroFocus: 'DXY, Federal Reserve, RBNZ, China data, dairy prices, commodities, US vs NZ rates, CPI, NFP, NZ inflation, GDP, RBNZ speeches, Fed speeches, risk sentiment.' },
  USDCHF: { display: 'USD/CHF', name: 'US Dollar vs Swiss Franc', macroFocus: 'DXY, Federal Reserve, SNB, US vs Switzerland rates, safe-haven flows, CPI, NFP, SNB speeches, Fed speeches, EUR/CHF flows.' },
};

export const DEFAULTS = { riskPerTrade: 0.5, maxRisk: 1, minRiskReward: 2, newsBlackoutMinutes: 30 };

export function gradeFromScore(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  return 'NO TRADE';
}

export function getAutoRiskPercent(settings: any): number {
  const maxRisk = Math.max(0, Number(settings.max_risk ?? DEFAULTS.maxRisk));
  const standard = Math.max(0, Number(settings.risk_per_trade ?? DEFAULTS.riskPerTrade));
  const profile = settings.auto_size_profile || 'small';
  if (profile === 'big') return Math.min(maxRisk, Math.max(standard, maxRisk));
  if (profile === 'standard') return Math.min(maxRisk, standard);
  return Math.min(maxRisk, standard, 0.25);
}

export function inferStrategy(setup: any): string {
  const text = (setup?.reasons || [setup?.reason || '']).join(' ').toLowerCase();
  if (/liquidity|sweep|order block|fair value|imbalance/.test(text)) return 'Liquidity Sweep';
  if (/breakout|break of structure|\bbos\b|choch/.test(text)) return 'Breakout';
  if (/pullback|retest|rejection|bounce/.test(text)) return 'Pullback';
  if (/trend|continuation|momentum/.test(text)) return 'Trend Continuation';
  if (/range|support|resistance|reversal/.test(text)) return 'Range Reversal';
  return 'Unspecified';
}

export function classifyCondition(snap: any): string {
  const v = String(snap?.volatility || '').toLowerCase();
  const t = String(snap?.trend || '').toLowerCase();
  if (v.includes('high') || v.includes('extreme')) return 'volatile';
  if (t.includes('range') || t.includes('sideway')) return 'ranging';
  if (t.includes('up') || t.includes('down') || t.includes('bull') || t.includes('bear')) return 'trending';
  return 'mixed';
}

export function computeSignalScore(analysis: any): any {
  if (!analysis) return null;
  const structure = analysis.market_structure;
  const mtf = analysis.multi_timeframe;
  const ind = analysis.indicators;
  const setup = analysis.setup;
  const macro = analysis.macro;
  const snap = analysis.snapshot;
  const news = analysis.news;

  let marketStructure = 0;
  const label = String(structure?.label || '').toUpperCase();
  if (label.includes('BULLISH') || label.includes('BEARISH')) marketStructure += 12;
  else if (label.includes('RANGE')) marketStructure += 4;
  if (structure?.higher_highs) marketStructure += 4;
  if (structure?.higher_lows) marketStructure += 4;
  marketStructure = Math.min(20, marketStructure);

  const htfVals = [mtf?.monthly, mtf?.weekly, mtf?.daily, mtf?.h4].map((v: any) => String(v || '').toLowerCase());
  const bullCount = htfVals.filter((v: string) => v.includes('bull')).length;
  const bearCount = htfVals.filter((v: string) => v.includes('bear')).length;
  const aligned = Math.max(bullCount, bearCount);
  const htf = Math.round((aligned / 4) * 20);

  let liquidity = 6;
  if (snap?.current_price && snap?.support && snap?.resistance) {
    const range = snap.resistance - snap.support;
    if (range > 0) {
      const minDist = Math.min(Math.abs(snap.current_price - snap.support), Math.abs(snap.current_price - snap.resistance));
      if (minDist / range < 0.2) liquidity = 12;
      else if (minDist / range < 0.4) liquidity = 8;
    }
  }
  if (setup?.reasons?.some((r: string) => /sweep|liquidity|order block|fair value/i.test(r))) liquidity = Math.min(15, liquidity + 3);
  liquidity = Math.min(15, liquidity);

  let momentum = 0;
  if (ind?.rsi != null) {
    if (ind.rsi >= 45 && ind.rsi <= 68) momentum += 5;
    else if (ind.rsi >= 40 && ind.rsi <= 70) momentum += 3;
    else momentum += 1;
  }
  if (ind?.macd && /bull|positive|above|rising/i.test(ind.macd)) momentum += 4;
  if (ind?.ema20 != null && ind?.ema50 != null && ind?.ema200 != null) {
    if (ind.ema20 > ind.ema50 && ind.ema50 > ind.ema200) momentum += 6;
    else if (ind.ema20 > ind.ema50) momentum += 3;
  }
  momentum = Math.min(15, momentum);

  const factors = macro?.factors || [];
  const pos = factors.filter((f: any) => String(f.impact).toLowerCase() === 'positive').length;
  const neg = factors.filter((f: any) => String(f.impact).toLowerCase() === 'negative').length;
  const macroScore = Math.max(0, Math.min(15, Math.round(7.5 + (pos - neg) * 2.5)));

  const rr = Number(setup?.risk_reward) || 0;
  const rrScore = Math.min(10, Math.round(rr * 2.5));

  let timing = 3;
  const sess = String(snap?.session || '').toLowerCase();
  if (sess.includes('overlap')) timing = 5;
  else if (sess.includes('london') || sess.includes('new york') || sess.includes('ny')) timing = 4;
  else if (sess.includes('asian')) timing = 2;
  else if (sess.includes('closed')) timing = 1;
  if (news?.some((n: any) => String(n.impact).toUpperCase() === 'HIGH')) timing = Math.max(0, timing - 2);
  timing = Math.max(0, Math.min(5, timing));

  const total = marketStructure + htf + liquidity + momentum + macroScore + rrScore + timing;
  return { marketStructure, htf, liquidity, momentum, macro: macroScore, rr: rrScore, timing, total };
}

export function evaluateTrade(params: any): { allowed: boolean; reasons: string[] } {
  const { trade, settings, todayTrades = [], todayPnL = 0, nextHighEventTime = null, qualityScore = null, openTrades = [] } = params;
  const reasons: string[] = [];
  const s = settings || {};

  if (s.kill_switch) reasons.push('Kill switch is active');
  if (s.daily_loss_limit != null && todayPnL <= -Math.abs(Number(s.daily_loss_limit))) reasons.push(`Daily loss limit reached ($${todayPnL.toFixed(2)})`);
  if (s.max_trades_per_day != null && todayTrades.length >= Number(s.max_trades_per_day)) reasons.push(`Max trades per day reached (${todayTrades.length}/${Number(s.max_trades_per_day)})`);
  if (nextHighEventTime) {
    const mins = (nextHighEventTime - Date.now()) / 60000;
    const blackout = Number(s.news_blackout_minutes ?? 30);
    if (mins > 0 && mins < blackout) reasons.push(`High-impact news in ${Math.round(mins)} min`);
  }
  const riskPct = trade?.risk_percent == null ? NaN : Number(trade.risk_percent);
  if (s.max_risk != null) {
    if (!Number.isFinite(riskPct)) reasons.push('Risk percent missing');
    else if (riskPct > Number(s.max_risk)) reasons.push(`Risk ${riskPct}% exceeds max ${Number(s.max_risk)}%`);
  }
  const rr = trade?.risk_reward == null ? NaN : Number(trade.risk_reward);
  if (s.min_risk_reward != null) {
    if (!Number.isFinite(rr)) reasons.push('R/R missing');
    else if (rr < Number(s.min_risk_reward)) reasons.push(`R/R 1:${rr.toFixed(2)} below min 1:${Number(s.min_risk_reward)}`);
  }
  if (qualityScore != null) {
    const grade = gradeFromScore(Number(qualityScore));
    if (grade === 'NO TRADE') reasons.push(`Setup grade ${grade}`);
  }
  if (!trade?.direction || (trade.direction !== 'BUY' && trade.direction !== 'SELL')) {
    reasons.push('No valid direction');
  } else {
    const entry = Number(trade.entry); const sl = Number(trade.stop_loss); const tp = Number(trade.take_profit);
    const sign = trade.direction === 'BUY' ? 1 : -1;
    if (!Number.isFinite(entry) || !Number.isFinite(sl) || (entry - sl) * sign <= 0) reasons.push('Stop loss missing or wrong side');
    if (Number.isFinite(tp) && (tp - entry) * sign <= 0) reasons.push('Take profit wrong side');
  }
  if (trade?.market && openTrades.some((t: any) => t.market === trade.market && (t.status || t.result) === 'open')) {
    reasons.push(`${trade.market} position already open`);
  }
  return { allowed: reasons.length === 0, reasons };
}

// --- OANDA API helpers ---
const OANDA_BASE: Record<string, string> = { practice: 'https://api-fxpractice.oanda.com', live: 'https://api-fxtrade.oanda.com' };
const SYMBOL_TO_OANDA: Record<string, string> = { XAUUSD: 'XAU_USD', EURUSD: 'EUR_USD', GBPUSD: 'GBP_USD', USDJPY: 'USD_JPY', AUDUSD: 'AUD_USD', USDCAD: 'USD_CAD', NZDUSD: 'NZD_USD', USDCHF: 'USD_CHF' };
const QUOTE: Record<string, string> = { XAUUSD: 'USD', EURUSD: 'USD', GBPUSD: 'USD', USDJPY: 'JPY', AUDUSD: 'USD', USDCAD: 'CAD', NZDUSD: 'USD', USDCHF: 'CHF' };
export const DECIMALS: Record<string, number> = { XAUUSD: 2, USDJPY: 3, EURUSD: 5, GBPUSD: 5, AUDUSD: 5, USDCAD: 5, NZDUSD: 5, USDCHF: 5 };

export function roundPrice(symbol: string, price: number): number {
  const d = DECIMALS[symbol] ?? 5;
  return Number(price.toFixed(d));
}

const MAX_UNITS = 500000;

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

export async function oandaPricing(settings: any, symbol: string): Promise<any> {
  const data = await oandaRequest(settings, '/v3/accounts/{account}/pricing', {}, { instruments: SYMBOL_TO_OANDA[symbol] });
  const p = data?.prices?.[0];
  if (!p) return null;
  const bid = Number(p.bids?.[0]?.price); const ask = Number(p.asks?.[0]?.price);
  return { symbol, bid, ask, mid: (bid + ask) / 2 };
}

export async function oandaPlaceOrder(settings: any, order: any): Promise<any> {
  const market = String(order.market);
  const direction = String(order.direction).toUpperCase();
  const entry = Number(order.entry); const sl = Number(order.stop_loss); const tp = Number(order.take_profit);
  const risk = Number(order.risk) || 0;
  const stopDistance = Math.abs(entry - sl);
  if (!stopDistance || !risk) throw new Error('Invalid stop distance or risk');
  let units = risk / stopDistance;
  if ((QUOTE[market] || 'USD') !== 'USD') units *= entry;
  units = Math.max(1, Math.round(units));
  if (units > MAX_UNITS) throw new Error(`Position size ${units} exceeds cap`);
  if (direction === 'SELL') units = -units;
  const data = await oandaRequest(settings, '/v3/accounts/{account}/orders', {
    method: 'POST',
    body: JSON.stringify({ order: { type: 'MARKET', instrument: SYMBOL_TO_OANDA[market], units: String(units), stopLossOnFill: { price: String(sl) }, takeProfitOnFill: { price: String(tp) } } }),
  });
  const fill = data?.orderFillTransaction;
  return { orderId: fill?.orderID || data?.orderCreateTransaction?.id, tradeId: fill?.tradeOpened?.tradeID || null, fillPrice: fill?.price ? Number(fill.price) : null, units };
}

// --- Analysis prompt + schemas ---
export const fullAnalysisSchema = {
  type: 'object',
  properties: {
    data_available: { type: 'boolean' },
    snapshot: {
      type: 'object',
      properties: {
        data_available: { type: 'boolean' }, symbol: { type: 'string' },
        current_price: { type: 'number' }, daily_change: { type: 'number' }, daily_change_pct: { type: 'number' },
        market_direction: { type: 'string' }, trend: { type: 'string' }, volatility: { type: 'string' },
        support: { type: 'number' }, resistance: { type: 'number' },
        today_high: { type: 'number' }, today_low: { type: 'number' },
        prev_day_high: { type: 'number' }, prev_day_low: { type: 'number' },
        session: { type: 'string' }, signal: { type: 'string' },
        confidence: { type: 'number' }, risk_level: { type: 'string' },
      },
    },
    market_structure: {
      type: 'object',
      properties: { label: { type: 'string' }, higher_highs: { type: 'boolean' }, higher_lows: { type: 'boolean' }, break_of_structure: { type: 'string' }, change_of_character: { type: 'string' }, notes: { type: 'string' } },
    },
    multi_timeframe: {
      type: 'object',
      properties: { monthly: { type: 'string' }, weekly: { type: 'string' }, daily: { type: 'string' }, h4: { type: 'string' }, h1: { type: 'string' }, overall_bias: { type: 'string' }, overall_status: { type: 'string' } },
    },
    indicators: {
      type: 'object',
      properties: { ema20: { type: 'number' }, ema50: { type: 'number' }, ema100: { type: 'number' }, ema200: { type: 'number' }, rsi: { type: 'number' }, macd: { type: 'string' }, atr: { type: 'number' }, vwap: { type: 'number' } },
    },
    setup: {
      type: 'object',
      properties: {
        status: { type: 'string' }, bias: { type: 'string' }, direction: { type: 'string' },
        entry_zone_low: { type: 'number' }, entry_zone_high: { type: 'number' },
        stop_loss: { type: 'number' }, tp1: { type: 'number' }, tp2: { type: 'number' }, tp3: { type: 'number' },
        risk_reward: { type: 'number' }, confidence: { type: 'number' }, risk_level: { type: 'string' },
        quality_score: { type: 'number' }, quality_grade: { type: 'string' },
        reasons: { type: 'array', items: { type: 'string' } }, invalidation: { type: 'string' },
      },
    },
    macro: {
      type: 'object',
      properties: { factors: { type: 'array', items: { type: 'object', properties: { factor: { type: 'string' }, impact: { type: 'string' }, note: { type: 'string' } } } } },
    },
    news: { type: 'array', items: { type: 'object', properties: { headline: { type: 'string' }, source: { type: 'string' }, time: { type: 'string' }, impact: { type: 'string' } } } },
  },
};

export const calendarSchema = {
  type: 'object',
  properties: {
    events: { type: 'array', items: { type: 'object', properties: { event: { type: 'string' }, country: { type: 'string' }, date: { type: 'string' }, time: { type: 'string' }, impact: { type: 'string' } } } },
  },
};

export function buildAnalysisPrompt(symbol: string, meta: any, livePrice?: number): string {
  const priceNote = livePrice != null ? `A reliable live mid price for ${meta.display} is ${livePrice}, sourced from the user's connected OANDA broker. Use this exact value as current_price. You MUST set data_available=true and complete the full analysis. ` : '';
  return `${priceNote}You are a senior market analyst with 20+ years experience. Provide a COMPLETE professional analysis of ${meta.display} (${meta.name}) as of right now, ${new Date().toUTCString()}, using live web data. Include:
1) snapshot: live current price, daily change, direction, trend, volatility, support, resistance, today/prev day highs/lows, session, signal, confidence, risk_level.
2) market_structure: label (BULLISH STRUCTURE/BEARISH STRUCTURE/RANGE/REVERSAL POSSIBLE/WAITING FOR CONFIRMATION), higher_highs, higher_lows, break_of_structure, change_of_character, notes.
3) multi_timeframe: monthly, weekly, daily, h4, h1 (Bullish/Bearish/Neutral/Pullback/Range), overall_bias, overall_status.
4) indicators: ema20, ema50, ema100, ema200, rsi, macd, atr, vwap.
5) setup: a high-quality trade setup (or NO TRADE). status (WATCHING/WAITING FOR CONFIRMATION/READY/NO TRADE), bias, direction (BUY/SELL/NONE), entry_zone_low, entry_zone_high, stop_loss (just beyond the nearest swing high/low), tp1 (at least 2x the stop distance from the entry zone midpoint), tp2, tp3, risk_reward (MUST be >= 2.0 — if you cannot achieve 2.0, return NO TRADE), confidence, risk_level, quality_score (0-100), quality_grade (A+/A/B/C/NO TRADE), reasons (multiple confirmations), invalidation. If no valid setup or risk_reward below 2.0, return NO TRADE.
6) macro: factors array ({factor, impact: Positive/Negative/Neutral, note}). Cover: ${meta.macroFocus}
7) news: relevant recent headlines ({headline, source, time, impact}).
Never fabricate prices. If no live price was provided and you cannot find reliable live data, set data_available=false. Return JSON.`;
}

export function buildCalendarPrompt(): string {
  const today = new Date().toDateString();
  return `You are a macroeconomic calendar analyst with live web access. List the most important upcoming economic events from today (${today}) onward for the next ~7 days that are relevant to Gold (XAUUSD) and EUR/USD. Prioritize high-impact: CPI, PPI, PCE, NFP, FOMC, Fed/ECB rate decisions, Powell/Lagarde speeches, GDP, Unemployment, Retail Sales, PMI. Each event: event, country, date (YYYY-MM-DD), time (e.g. "8:30 AM ET"), impact (LOW/MEDIUM/HIGH). Only include events from today forward. Return JSON.`;
}