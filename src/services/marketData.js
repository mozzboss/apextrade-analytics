import { base44 } from '@/api/base44Client';

// ---------------------------------------------------------------------------
// Modular data services. All live data is sourced through the AI integration
// with web-search enabled (gemini_3_flash). Results are cached briefly so the
// UI does not spam the model on every render. Every response carries a
// `data_available` flag — when false the UI shows "Live market data is
// unavailable" and never fabricates prices.
// ---------------------------------------------------------------------------

const _cache = new Map();
const TTL = 60000;
const cached = (k) => {
  const e = _cache.get(k);
  return e && Date.now() - e.t < TTL ? e.v : null;
};
const setCache = (k, v) => _cache.set(k, { v, t: Date.now() });

// --- Provider adapter seam (Phase 2) ---
// The active data provider defaults to AI web-search. Swap in a live REST API
// provider via setMarketDataProvider({ getSnapshot, getFullAnalysis, getChart }).
let _marketDataProvider = null;
export function setMarketDataProvider(p) { _marketDataProvider = p; }
export function getMarketDataProvider() { return _marketDataProvider; }
export const clearCache = (k) => (k ? _cache.delete(k) : _cache.clear());

export const SYMBOL_META = {
  XAUUSD: {
    display: 'XAU/USD',
    name: 'Gold vs US Dollar',
    kind: 'metal',
    contractSize: 100,
    pointValuePerLot: 100,
    decimals: 2,
    macroFocus: 'DXY, US Treasury yields, Federal Reserve expectations, inflation (CPI/PPI/PCE), NFP, unemployment, GDP, interest rates, FOMC, Fed speeches, geopolitical risk, risk-on/risk-off sentiment, gold futures positioning.',
  },
  EURUSD: {
    display: 'EUR/USD',
    name: 'Euro vs US Dollar',
    kind: 'forex',
    contractSize: 100000,
    pointValuePerLot: 10,
    pipSize: 0.0001,
    decimals: 5,
    macroFocus: 'DXY, Federal Reserve, ECB, US rates, European rates, CPI, PCE, NFP, European inflation, European GDP, PMI, ECB speeches, Fed speeches, interest rate expectations, US vs European economic strength.',
  },
  GBPUSD: {
    display: 'GBP/USD',
    name: 'British Pound vs US Dollar',
    kind: 'forex',
    contractSize: 100000,
    pointValuePerLot: 10,
    pipSize: 0.0001,
    decimals: 5,
    macroFocus: 'DXY, Federal Reserve, Bank of England, US rates, UK rates, CPI, PCE, NFP, UK inflation, UK GDP, PMI, BoE speeches, Fed speeches, US vs UK economic strength.',
  },
  USDJPY: {
    display: 'USD/JPY',
    name: 'US Dollar vs Japanese Yen',
    kind: 'forex',
    contractSize: 100000,
    pointValuePerLot: 1000,
    pipSize: 0.01,
    decimals: 3,
    macroFocus: 'DXY, Federal Reserve, Bank of Japan, US rates, JGB yields, CPI, PCE, NFP, Japan inflation, Japan GDP, BoJ speeches, Fed speeches, intervention risk, US vs Japan rate differential.',
  },
  AUDUSD: {
    display: 'AUD/USD',
    name: 'Australian Dollar vs US Dollar',
    kind: 'forex',
    contractSize: 100000,
    pointValuePerLot: 10,
    pipSize: 0.0001,
    decimals: 5,
    macroFocus: 'DXY, Federal Reserve, RBA, China data, iron ore, commodities, US vs Australia rates, CPI, NFP, Australia inflation, GDP, RBA speeches, Fed speeches, risk sentiment.',
  },
  USDCAD: {
    display: 'USD/CAD',
    name: 'US Dollar vs Canadian Dollar',
    kind: 'forex',
    contractSize: 100000,
    pointValuePerLot: 10,
    pipSize: 0.0001,
    decimals: 5,
    macroFocus: 'DXY, Federal Reserve, Bank of Canada, oil prices, US vs Canada rates, CPI, NFP, Canada inflation, GDP, BoC speeches, Fed speeches, crude oil impact on CAD.',
  },
  NZDUSD: {
    display: 'NZD/USD',
    name: 'New Zealand Dollar vs US Dollar',
    kind: 'forex',
    contractSize: 100000,
    pointValuePerLot: 10,
    pipSize: 0.0001,
    decimals: 5,
    macroFocus: 'DXY, Federal Reserve, RBNZ, China data, dairy prices, commodities, US vs NZ rates, CPI, NFP, NZ inflation, GDP, RBNZ speeches, Fed speeches, risk sentiment.',
  },
  USDCHF: {
    display: 'USD/CHF',
    name: 'US Dollar vs Swiss Franc',
    kind: 'forex',
    contractSize: 100000,
    pointValuePerLot: 10,
    pipSize: 0.0001,
    decimals: 5,
    macroFocus: 'DXY, Federal Reserve, SNB, US vs Switzerland rates, safe-haven flows, CPI, NFP, SNB speeches, Fed speeches, EUR/CHF flows.',
  },
};

export const TIMEFRAMES = ['5M', '15M', '30M', '1H', '4H', 'D', 'W'];

const snapshotSchema = {
  type: 'object',
  properties: {
    data_available: { type: 'boolean' },
    data_note: { type: 'string' },
    symbol: { type: 'string' },
    current_price: { type: 'number' },
    daily_change: { type: 'number' },
    daily_change_pct: { type: 'number' },
    market_direction: { type: 'string' },
    trend: { type: 'string' },
    volatility: { type: 'string' },
    support: { type: 'number' },
    resistance: { type: 'number' },
    today_high: { type: 'number' },
    today_low: { type: 'number' },
    prev_day_high: { type: 'number' },
    prev_day_low: { type: 'number' },
    session: { type: 'string' },
    signal: { type: 'string' },
    confidence: { type: 'number' },
    risk_level: { type: 'string' },
    timestamp: { type: 'string' },
  },
};

const fullSchema = {
  type: 'object',
  properties: {
    data_available: { type: 'boolean' },
    data_note: { type: 'string' },
    snapshot: snapshotSchema,
    market_structure: {
      type: 'object',
      properties: {
        label: { type: 'string' },
        higher_highs: { type: 'boolean' },
        higher_lows: { type: 'boolean' },
        break_of_structure: { type: 'string' },
        change_of_character: { type: 'string' },
        notes: { type: 'string' },
      },
    },
    multi_timeframe: {
      type: 'object',
      properties: {
        monthly: { type: 'string' },
        weekly: { type: 'string' },
        daily: { type: 'string' },
        h4: { type: 'string' },
        h1: { type: 'string' },
        m30: { type: 'string' },
        m15: { type: 'string' },
        m5: { type: 'string' },
        overall_bias: { type: 'string' },
        overall_status: { type: 'string' },
      },
    },
    indicators: {
      type: 'object',
      properties: {
        ema20: { type: 'number' },
        ema50: { type: 'number' },
        ema100: { type: 'number' },
        ema200: { type: 'number' },
        rsi: { type: 'number' },
        macd: { type: 'string' },
        atr: { type: 'number' },
        vwap: { type: 'number' },
        volume_note: { type: 'string' },
      },
    },
    setup: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        bias: { type: 'string' },
        direction: { type: 'string' },
        entry_zone_low: { type: 'number' },
        entry_zone_high: { type: 'number' },
        stop_loss: { type: 'number' },
        tp1: { type: 'number' },
        tp2: { type: 'number' },
        tp3: { type: 'number' },
        risk_reward: { type: 'number' },
        confidence: { type: 'number' },
        risk_level: { type: 'string' },
        quality_score: { type: 'number' },
        quality_grade: { type: 'string' },
        reasons: { type: 'array', items: { type: 'string' } },
        invalidation: { type: 'string' },
      },
    },
    macro: {
      type: 'object',
      properties: {
        factors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              factor: { type: 'string' },
              impact: { type: 'string' },
              note: { type: 'string' },
            },
          },
        },
        dxy_note: { type: 'string' },
        yields_note: { type: 'string' },
        sentiment_note: { type: 'string' },
      },
    },
    news: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          headline: { type: 'string' },
          source: { type: 'string' },
          time: { type: 'string' },
          impact: { type: 'string' },
        },
      },
    },
  },
};

const chartSchema = {
  type: 'object',
  properties: {
    data_available: { type: 'boolean' },
    timeframe: { type: 'string' },
    candles: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          time: { type: 'string' },
          open: { type: 'number' },
          high: { type: 'number' },
          low: { type: 'number' },
          close: { type: 'number' },
        },
      },
    },
  },
};

const calendarSchema = {
  type: 'object',
  properties: {
    events: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          event: { type: 'string' },
          country: { type: 'string' },
          date: { type: 'string' },
          time: { type: 'string' },
          expected: { type: 'string' },
          previous: { type: 'string' },
          actual: { type: 'string' },
          impact: { type: 'string' },
        },
      },
    },
  },
};

const newsSchema = {
  type: 'object',
  properties: {
    headlines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          headline: { type: 'string' },
          source: { type: 'string' },
          time: { type: 'string' },
          impact: { type: 'string' },
          summary: { type: 'string' },
        },
      },
    },
  },
};

async function invoke(prompt, schema) {
  return base44.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: schema,
  });
}

export const MarketDataService = {
  async getSnapshot(symbol, opts = {}) {
    if (_marketDataProvider?.getSnapshot) return _marketDataProvider.getSnapshot(symbol, opts);
    const key = `snap_${symbol}`;
    const c = cached(key);
    if (c) return c;
    const meta = SYMBOL_META[symbol];
    const priceNote = opts.livePrice != null ? `A reliable live mid price for ${meta.display} is ${opts.livePrice}, sourced from the user's connected OANDA broker. Use this exact value as current_price. You MUST set data_available=true (a live price is available) and complete the snapshot. ` : '';
    const prompt = `${priceNote}You are a professional financial market analyst with access to live web data. Provide the CURRENT real-time market snapshot for ${meta.display} (${meta.name}) as of right now, ${new Date().toUTCString()}. Use live data from the web. Fields: current_price (live last price), daily_change (absolute), daily_change_pct, market_direction (Bullish/Bearish/Neutral), trend, volatility (Low/Medium/High), support, resistance, today_high, today_low, prev_day_high, prev_day_low, session (Asian/London/New York/Overlap/Closed), signal (STRONG BUY/BUY/WAIT/SELL/STRONG SELL/NO TRADE), confidence (0-100), risk_level (Low/Medium/High), timestamp. If no live price was provided and you cannot find reliable current live price data, set data_available=false and data_note explaining why, and leave numeric fields as 0. Never fabricate a price. Return JSON.`;
    const res = await invoke(prompt, snapshotSchema);
    setCache(key, res);
    return res;
  },

  async getFullAnalysis(symbol, opts = {}) {
    if (_marketDataProvider?.getFullAnalysis) return _marketDataProvider.getFullAnalysis(symbol, opts);
    const key = `full_${symbol}`;
    const c = cached(key);
    if (c) return c;
    const meta = SYMBOL_META[symbol];
    const macroFocus = meta.macroFocus || 'DXY, Federal Reserve, central bank policy, interest rates, CPI, NFP, GDP, PMI, relevant central bank speeches, US economic strength.';
    const priceNote = opts.livePrice != null ? `A reliable live mid price for ${meta.display} is ${opts.livePrice}, sourced from the user's connected OANDA broker. Use this exact value as current_price. You MUST set data_available=true (a live price is available) and complete the full analysis. For daily change, support, resistance, indicators, and the setup, use recent web data together with the provided price. ` : '';
    const prompt = `${priceNote}You are a senior market analyst with 20+ years experience. Provide a COMPLETE professional analysis of ${meta.display} (${meta.name}) as of right now, ${new Date().toUTCString()}, using live web data. Include:
1) snapshot: live current price, daily change, direction, trend, volatility, support, resistance, today/prev day highs/lows, session, signal, confidence, risk_level, timestamp.
2) market_structure: label (BULLISH STRUCTURE/BEARISH STRUCTURE/RANGE/REVERSAL POSSIBLE/WAITING FOR CONFIRMATION), higher_highs, higher_lows, break_of_structure, change_of_character, notes.
3) multi_timeframe: monthly, weekly, daily, h4, h1, m30, m15, m5 (Bullish/Bearish/Neutral/Pullback/Range), overall_bias, overall_status.
4) indicators: ema20, ema50, ema100, ema200, rsi, macd, atr, vwap, volume_note.
5) setup: a high-quality trade setup (or NO TRADE). status (WATCHING/WAITING FOR CONFIRMATION/READY/NO TRADE), bias, direction (BUY/SELL/NONE), entry_zone_low, entry_zone_high, stop_loss, tp1, tp2, tp3, risk_reward (e.g. 2.4), confidence, risk_level, quality_score (0-100), quality_grade (A+/A/B/C/NO TRADE), reasons (multiple confirmations, never single indicator), invalidation. If no valid setup, return NO TRADE with reasons.
6) macro: factors array ({factor, impact: Positive/Negative/Neutral, note}), dxy_note, yields_note, sentiment_note. Cover: ${macroFocus}
7) news: relevant recent headlines ({headline, source, time, impact}).
Never fabricate prices. If no live price was provided and you cannot find reliable live data, set data_available=false. When a live price is provided, set data_available=true and complete the analysis. Return JSON.`;
    const res = await invoke(prompt, fullSchema);
    setCache(key, res);
    return res;
  },

  async getChart(symbol, timeframe = '1H') {
    if (_marketDataProvider?.getChart) return _marketDataProvider.getChart(symbol, timeframe);
    const key = `chart_${symbol}_${timeframe}`;
    const c = cached(key);
    if (c) return c;
    const meta = SYMBOL_META[symbol];
    const prompt = `You are a market data analyst with live web access. Provide the most recent ~45 OHLC candle bars for ${meta.display} on the ${timeframe} timeframe as of right now, ${new Date().toUTCString()}. Each candle: time (short label like "14:00" or date), open, high, low, close. Use real recent price action from the web. If reliable data is unavailable, return data_available=false and an empty candles array. Do not fabricate. Return JSON.`;
    const res = await invoke(prompt, chartSchema);
    setCache(key, res);
    return res;
  },
};

export const GoldDataService = {
  analyze: () => MarketDataService.getFullAnalysis('XAUUSD'),
  snapshot: () => MarketDataService.getSnapshot('XAUUSD'),
};

export const ForexDataService = {
  analyze: (s) => MarketDataService.getFullAnalysis(s),
  snapshot: (s) => MarketDataService.getSnapshot(s),
};

export const EconomicCalendarService = {
  async getUpcoming() {
    const key = 'calendar';
    const c = cached(key);
    if (c) return c;
    const today = new Date().toDateString();
    const prompt = `You are a macroeconomic calendar analyst with live web access. List the most important upcoming economic events from today (${today}) onward for the next ~7 days that are relevant to Gold (XAUUSD) and EUR/USD. Prioritize high-impact: CPI, PPI, PCE, NFP, FOMC, Fed/ECB rate decisions, Powell/Lagarde speeches, GDP, Unemployment, Retail Sales, PMI. Each event: event, country (US/EU/etc), date (YYYY-MM-DD), time (e.g. "8:30 AM ET"), expected, previous, actual (empty if not yet released), impact (LOW/MEDIUM/HIGH). Only include events from today forward — never past events. Return JSON.`;
    const res = await invoke(prompt, calendarSchema);
    setCache(key, res);
    return res;
  },
};

export const NewsService = {
  async getForSymbol(symbol) {
    const key = `news_${symbol}`;
    const c = cached(key);
    if (c) return c;
    const meta = SYMBOL_META[symbol];
    const prompt = `You are a financial news analyst with live web access. Provide the most relevant recent news headlines affecting ${meta.display} (${meta.name}) as of right now, ${new Date().toUTCString()}. Each: headline, source, time, impact (LOW/MEDIUM/HIGH), summary (1-2 sentences). Focus on macro, central banks, geopolitics, and price-moving catalysts. Return JSON.`;
    const res = await invoke(prompt, newsSchema);
    setCache(key, res);
    return res;
  },
};

export const MacroDataService = {
  async getMacroContext(symbol) {
    const full = await MarketDataService.getFullAnalysis(symbol);
    return full?.macro || null;
  },
};

// ---------------------------------------------------------------------------
// AI Analyst — free-form chat grounded in live web data.
// ---------------------------------------------------------------------------
export const AIAnalystService = {
  async ask(question, symbol) {
    const ctx = symbol ? `The user is currently viewing ${SYMBOL_META[symbol]?.display || symbol}. ` : '';
    const prompt = `${ctx}You are a disciplined professional market analyst with 20+ years of experience in Gold (XAUUSD), EURUSD, forex, macroeconomics, technical analysis, price action and risk management. Answer the user's question using LIVE web data as of ${new Date().toUTCString()}. Prioritize capital preservation, risk management, high-quality setups and patience. Never promise profits or guaranteed wins. If the question asks for current prices or analysis, use real live data. If live market data is unavailable, say so clearly and do not fabricate prices. Keep the answer focused, professional and actionable. User question: "${question}"`;
    const res = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
    });
    return res;
  },
};