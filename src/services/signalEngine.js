// ---------------------------------------------------------------------------
// SignalEngine — computes a real, explainable trade-quality score (0-100)
// from live analysis data, plus display labels, grades and setup states.
// ---------------------------------------------------------------------------

export const SIGNAL_LABELS = {
  'STRONG BUY': { tone: 'bullish', text: 'STRONG BUY' },
  BUY: { tone: 'bullish', text: 'BUY' },
  WAIT: { tone: 'warn', text: 'WAIT' },
  SELL: { tone: 'bearish', text: 'SELL' },
  'STRONG SELL': { tone: 'bearish', text: 'STRONG SELL' },
  'NO TRADE': { tone: 'muted', text: 'NO TRADE' },
};

export const SETUP_STATES = [
  'WATCHING', 'WAITING FOR CONFIRMATION', 'READY', 'ACTIVE', 'TP1 HIT',
  'TP2 HIT', 'STOPPED', 'CANCELLED', 'INVALIDATED', 'ENTRY MISSED',
];

export function signalTone(signal) {
  const s = String(signal || '').toUpperCase();
  return SIGNAL_LABELS[s]?.tone || 'muted';
}

export function gradeFromScore(score) {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  return 'NO TRADE';
}

export function gradeTone(grade) {
  if (grade === 'A+' || grade === 'A') return 'bullish';
  if (grade === 'B') return 'warn';
  if (grade === 'C') return 'muted';
  return 'bearish';
}

export function isBestSetup(grade) {
  return grade === 'A+' || grade === 'A';
}

export function validateSetup(setup, snapshot) {
  const reasons = [];
  if (!setup) return { valid: false, reasons: ['No setup data'] };
  if (!snapshot?.data_available) reasons.push('Live market data is unavailable');
  if ((setup.direction || '').toUpperCase() === 'NONE' || (setup.status || '').toUpperCase() === 'NO TRADE')
    reasons.push('Engine returned NO TRADE');
  if (!setup.stop_loss) reasons.push('No stop loss defined');
  if (!setup.entry_zone_low || !setup.entry_zone_high) reasons.push('No entry zone defined');
  if (!setup.risk_reward || setup.risk_reward < 1.5) reasons.push('Risk/Reward below preferred minimum');
  if (!setup.reasons || setup.reasons.length < 2) reasons.push('Insufficient confirmations');
  return { valid: reasons.length === 0, reasons };
}

/**
 * Compute a real quality breakdown from live analysis data.
 * Each subscore is derived from actual fields, not a heuristic of the total.
 */
export function computeSignalScore(analysis) {
  if (!analysis) return null;
  const structure = analysis.market_structure;
  const mtf = analysis.multi_timeframe;
  const ind = analysis.indicators;
  const setup = analysis.setup;
  const macro = analysis.macro;
  const snap = analysis.snapshot;
  const news = analysis.news;

  // Market Structure (20)
  let marketStructure = 0;
  const label = String(structure?.label || '').toUpperCase();
  if (label.includes('BULLISH') || label.includes('BEARISH')) marketStructure += 12;
  else if (label.includes('RANGE')) marketStructure += 4;
  if (structure?.higher_highs) marketStructure += 4;
  if (structure?.higher_lows) marketStructure += 4;
  marketStructure = Math.min(20, marketStructure);

  // Higher-Timeframe Alignment (20) — monthly, weekly, daily, 4H
  const htfVals = [mtf?.monthly, mtf?.weekly, mtf?.daily, mtf?.h4].map((v) => String(v || '').toLowerCase());
  const bullCount = htfVals.filter((v) => v.includes('bull')).length;
  const bearCount = htfVals.filter((v) => v.includes('bear')).length;
  const aligned = Math.max(bullCount, bearCount);
  const htf = Math.round((aligned / 4) * 20);

  // Liquidity (15) — proximity to S/R + sweep mentions
  let liquidity = 6;
  if (snap?.current_price && snap?.support && snap?.resistance) {
    const range = snap.resistance - snap.support;
    if (range > 0) {
      const minDist = Math.min(Math.abs(snap.current_price - snap.support), Math.abs(snap.current_price - snap.resistance));
      if (minDist / range < 0.2) liquidity = 12;
      else if (minDist / range < 0.4) liquidity = 8;
    }
  }
  if (setup?.reasons?.some((r) => /sweep|liquidity|order block|fair value/i.test(r))) liquidity = Math.min(15, liquidity + 3);
  liquidity = Math.min(15, liquidity);

  // Momentum (15) — RSI, MACD, EMA stack
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

  // Macro Environment (15) — net factor impact
  const factors = macro?.factors || [];
  const pos = factors.filter((f) => String(f.impact).toLowerCase() === 'positive').length;
  const neg = factors.filter((f) => String(f.impact).toLowerCase() === 'negative').length;
  const macroScore = Math.max(0, Math.min(15, Math.round(7.5 + (pos - neg) * 2.5)));

  // Risk / Reward (10)
  const rr = Number(setup?.risk_reward) || 0;
  const rrScore = Math.min(10, Math.round(rr * 2.5));

  // News Risk (5) — elevated if high-impact headlines present
  let newsRisk = 4;
  if (news?.some((n) => String(n.impact).toUpperCase() === 'HIGH')) newsRisk = 2;
  else if (!news || news.length === 0) newsRisk = 3;

  const total = marketStructure + htf + liquidity + momentum + macroScore + rrScore + newsRisk;
  return { marketStructure, htf, liquidity, momentum, macro: macroScore, rr: rrScore, newsRisk, total };
}

/**
 * Heuristic fallback when only the setup object is available (no full analysis).
 */
export function buildQualityBreakdown(setup) {
  const total = Math.round(setup?.quality_score || 0);
  return {
    marketStructure: Math.min(20, Math.round((total / 100) * 20)),
    htf: Math.min(20, Math.round((total / 100) * 20)),
    liquidity: Math.min(15, Math.round((total / 100) * 15)),
    momentum: Math.min(15, Math.round((total / 100) * 15)),
    macro: Math.min(15, Math.round((total / 100) * 15)),
    rr: Math.min(10, Math.round((setup?.risk_reward || 0) * 2.5)),
    newsRisk: Math.max(0, 5 - Math.round((100 - total) / 20)),
    total,
  };
}