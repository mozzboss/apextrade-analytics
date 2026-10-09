// ---------------------------------------------------------------------------
// SignalFilter — trade-quality gate. Evaluates a candidate signal against
// configurable conditions before it is approved. Returns GO / WAIT / NO TRADE.
// Quality over quantity: the bot never forces a trade.
//
// Hard failures -> NO TRADE. Soft cautions -> WAIT. All clear -> GO.
// ---------------------------------------------------------------------------

import { validateSetup } from './signalEngine';

export function evaluateSignalQuality({ analysis, setup, settings = {}, ctx = {} }) {
  const hardFails = [];
  const cautions = [];
  const confirmations = [];

  const dir = (setup?.direction || '').toUpperCase();
  if (dir !== 'BUY' && dir !== 'SELL') hardFails.push('No valid trade direction');

  // Clear entry & invalidation levels
  const valid = validateSetup(setup, analysis?.snapshot);
  if (!valid.valid) {
    valid.reasons.forEach((r) => {
      if (/entry|stop|NO TRADE|data is unavailable/i.test(r)) hardFails.push(r);
      else cautions.push(r);
    });
  } else {
    confirmations.push('Clear entry and invalidation levels');
  }

  // Higher-timeframe trend confirmation (daily + H4 agree with direction)
  const mtf = analysis?.multi_timeframe || {};
  const htfOk = ['daily', 'h4'].every((tf) => {
    const v = String(mtf[tf] || '').toLowerCase();
    return (dir === 'BUY' && v.includes('bull')) || (dir === 'SELL' && v.includes('bear'));
  });
  if (htfOk) confirmations.push('Higher-timeframe trend confirmed');
  else hardFails.push('Higher-timeframe trend not confirmed');

  // Acceptable spread
  if (ctx.spread != null && settings.max_spread != null && ctx.spread > settings.max_spread)
    hardFails.push(`Spread ${ctx.spread} exceeds max ${settings.max_spread}`);

  // Sufficient liquidity (price near a key level)
  const snap = analysis?.snapshot || {};
  if (snap.current_price && snap.support && snap.resistance) {
    const range = snap.resistance - snap.support;
    if (range > 0 && Math.min(Math.abs(snap.current_price - snap.support), Math.abs(snap.current_price - snap.resistance)) / range < 0.3)
      confirmations.push('Sufficient liquidity near key level');
    else cautions.push('Price away from key liquidity level');
  }

  // Favorable volatility
  if (/extreme|very high/i.test(snap.volatility || '')) hardFails.push('Extreme volatility — avoid');
  else if (/low/i.test(snap.volatility || '')) cautions.push('Low volatility — limited movement');
  else confirmations.push('Favorable volatility');

  // No prohibited high-impact news exposure
  if (ctx.highImpactNewsSoon) hardFails.push('High-impact news within blackout window');

  // Risk within account limits
  const riskPct = Number(ctx.risk_percent ?? setup?.risk_percent);
  if (!Number.isNaN(riskPct) && settings.max_risk != null && riskPct > settings.max_risk)
    hardFails.push(`Risk ${riskPct}% exceeds max ${settings.max_risk}%`);

  // Acceptable portfolio correlation
  if (ctx.correlationTooHigh) hardFails.push('Portfolio correlation exceeds limit');

  const decision = hardFails.length ? 'NO TRADE' : cautions.length ? 'WAIT' : 'GO';
  return { decision, hardFails, cautions, confirmations, allowed: decision === 'GO' };
}