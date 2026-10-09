// ---------------------------------------------------------------------------
// ProbabilityEngine — empirical win-probability estimation for a candidate
// setup. The estimate is the HISTORICAL BASE RATE of similar closed trades,
// never an invented number. When the matched sample is too small for a
// statistically calibrated estimate we return "Insufficient Data" rather
// than a guess.
//
// Confirmation factors (trend, RSI, MACD, EMA, S/R, volatility, multi-
// timeframe, correlation, news, spread) are reported as qualitative flags
// that feed the signal-quality filter. They do NOT inflate the probability.
// ---------------------------------------------------------------------------

import { wilsonInterval } from './performanceStats';

const MIN_SAMPLE = 20;       // minimum decisive trades for a calibrated estimate
const SOFT_MIN = 8;          // below this we never narrow further

function gradeBucket(grade) {
  const g = String(grade || '').toUpperCase();
  if (g === 'A+' || g === 'A') return 'A';
  if (g === 'B') return 'B';
  if (g === 'C') return 'C';
  return null;
}

/** Infer a strategy label from a setup's confirmation reasons. */
export function inferStrategy(setup) {
  const text = (setup?.reasons || [setup?.reason || '']).join(' ').toLowerCase();
  if (/liquidity|sweep|order block|fair value|imbalance/.test(text)) return 'Liquidity Sweep';
  if (/breakout|break of structure|\bbos\b|choch/.test(text)) return 'Breakout';
  if (/pullback|retest|rejection|bounce/.test(text)) return 'Pullback';
  if (/trend|continuation|momentum/.test(text)) return 'Trend Continuation';
  if (/range|support|resistance|reversal/.test(text)) return 'Range Reversal';
  return 'Unspecified';
}

/**
 * Estimate the win probability for a candidate setup.
 * @returns { sufficient, probability, sampleSize, wins, losses, confidenceInterval,
 *            basis, confirmations, cautions, label }
 */
export function estimateWinProbability(setup, analysis, trades, opts = {}) {
  const all = (trades || []).filter(
    (t) => !t.parent_trade_id && (t.result === 'win' || t.result === 'loss')
  );
  const symbol = opts.symbol || setup?.market || analysis?.snapshot?.symbol;
  const direction = (setup?.direction || '').toUpperCase();

  // Match by market + direction first (the core similarity key).
  let matched = all.filter(
    (t) => t.market === symbol && (t.direction || '').toUpperCase() === direction
  );

  const gb = gradeBucket(setup?.quality_grade);
  if (gb && matched.length >= SOFT_MIN) {
    const same = matched.filter((t) => gradeBucket(t.setup_quality) === gb);
    if (same.length >= SOFT_MIN) matched = same;
  }

  const strategy = inferStrategy(setup);
  if (strategy !== 'Unspecified' && matched.length >= SOFT_MIN) {
    const same = matched.filter((t) => (t.strategy || inferStrategy({ reasons: [t.reason] })) === strategy);
    if (same.length >= SOFT_MIN) matched = same;
  }

  const wins = matched.filter((t) => t.result === 'win').length;
  const decisive = matched.length;
  const probability = decisive ? (wins / decisive) * 100 : 0;
  const sufficient = decisive >= (opts.minSample || MIN_SAMPLE);

  const flags = buildConfirmationFlags(analysis, setup, opts);

  return {
    sufficient,
    probability,
    sampleSize: decisive,
    wins,
    losses: decisive - wins,
    confidenceInterval: wilsonInterval(wins, decisive),
    basis: { symbol, direction, grade: gb, strategy, poolSize: all.length },
    confirmations: flags.confirmations,
    cautions: flags.cautions,
    label: sufficient ? 'Statistically validated' : 'Insufficient Data',
  };
}

function buildConfirmationFlags(analysis, setup, opts = {}) {
  const confirmations = [];
  const cautions = [];
  const dir = (setup?.direction || '').toLowerCase();
  const mtf = analysis?.multi_timeframe || {};
  const ind = analysis?.indicators || {};
  const snap = analysis?.snapshot || {};

  // Higher-timeframe alignment (daily + H4)
  const htfOk = ['daily', 'h4'].every((tf) => {
    const v = String(mtf[tf] || '').toLowerCase();
    if (!v) return false;
    return (dir === 'buy' && v.includes('bull')) || (dir === 'sell' && v.includes('bear'));
  });
  if (htfOk) confirmations.push('Higher-timeframe trend aligned');
  else cautions.push('Higher-timeframe trend not aligned');

  // RSI
  if (ind.rsi != null) {
    const favorable = (dir === 'buy' && ind.rsi >= 45 && ind.rsi <= 68) || (dir === 'sell' && ind.rsi >= 32 && ind.rsi <= 55);
    favorable ? confirmations.push('RSI in favorable zone') : cautions.push('RSI outside favorable zone');
  }

  // MACD
  const macdBull = /bull|positive|above|rising/i.test(ind.macd || '');
  const macdBear = /bear|negative|below|falling/i.test(ind.macd || '');
  if ((dir === 'buy' && macdBull) || (dir === 'sell' && macdBear)) confirmations.push('MACD confirms momentum');
  else cautions.push('MACD not confirming direction');

  // EMA alignment
  if (ind.ema20 != null && ind.ema50 != null && ind.ema200 != null) {
    const stacked = dir === 'buy'
      ? ind.ema20 > ind.ema50 && ind.ema50 > ind.ema200
      : ind.ema20 < ind.ema50 && ind.ema50 < ind.ema200;
    stacked ? confirmations.push('EMA stack aligned') : cautions.push('EMA stack not aligned');
  }

  // Support / resistance proximity
  if (snap.current_price && snap.support && snap.resistance) {
    const range = snap.resistance - snap.support;
    if (range > 0 && Math.min(Math.abs(snap.current_price - snap.support), Math.abs(snap.current_price - snap.resistance)) / range < 0.25)
      confirmations.push('Price near key support/resistance');
  }

  // Volatility
  if (/extreme|very high/i.test(snap.volatility || '')) cautions.push('Elevated volatility');

  // Spread / costs
  if (opts.spread != null && opts.maxSpread != null && opts.spread > opts.maxSpread)
    cautions.push(`Spread ${opts.spread} exceeds max ${opts.maxSpread}`);

  // News
  if (opts.highImpactNewsSoon) cautions.push('High-impact news imminent');

  // Correlation
  if (opts.correlationTooHigh) cautions.push('Portfolio correlation too high');

  return { confirmations, cautions };
}