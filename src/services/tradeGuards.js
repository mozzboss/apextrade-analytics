import { gradeFromScore } from '@/services/signalEngine';

// ---------------------------------------------------------------------------
// TradeGuards — hard pre-trade risk checks. Every order (manual or auto)
// must pass these before execution. This is the gate that makes future
// automation safe: the same guards run whether a human or a bot triggers it.
// ---------------------------------------------------------------------------

export function evaluateTrade({ trade, settings, todayTrades = [], todayPnL = 0, nextHighEventTime = null, qualityScore = null, openTrades = [] }) {
  const reasons = [];
  const s = settings || {};

  // 1. Kill switch — absolute off switch
  if (s.kill_switch) reasons.push('Kill switch is active — all trading disabled');

  // 2. Daily loss limit
  if (s.daily_loss_limit != null && todayPnL <= -Math.abs(Number(s.daily_loss_limit))) {
    reasons.push(`Daily loss limit reached ($${todayPnL.toFixed(2)} vs -$${Number(s.daily_loss_limit)})`);
  }

  // 3. Max trades per day
  if (s.max_trades_per_day != null && todayTrades.length >= Number(s.max_trades_per_day)) {
    reasons.push(`Max trades per day reached (${todayTrades.length}/${Number(s.max_trades_per_day)})`);
  }

  // 4. News blackout
  if (nextHighEventTime) {
    const mins = (nextHighEventTime - Date.now()) / 60000;
    const blackout = Number(s.news_blackout_minutes ?? 30);
    if (mins > 0 && mins < blackout) reasons.push(`High-impact news in ${Math.round(mins)} min (blackout ${blackout}m)`);
  }

  // 5. Risk-per-trade cap (fails closed: missing risk data blocks the trade)
  const riskPct = trade?.risk_percent == null ? NaN : Number(trade.risk_percent);
  if (s.max_risk != null) {
    if (!Number.isFinite(riskPct)) reasons.push('Risk percent is missing — cannot verify risk cap');
    else if (riskPct > Number(s.max_risk)) reasons.push(`Risk ${riskPct}% exceeds max ${Number(s.max_risk)}%`);
  }

  // 6. Minimum risk/reward (fails closed)
  const rr = trade?.risk_reward == null ? NaN : Number(trade.risk_reward);
  if (s.min_risk_reward != null) {
    if (!Number.isFinite(rr)) reasons.push('Risk/reward is missing — cannot verify minimum R/R');
    else if (rr < Number(s.min_risk_reward)) reasons.push(`R/R 1:${rr.toFixed(2)} below minimum 1:${Number(s.min_risk_reward)}`);
  }

  // 7. Setup quality gate
  if (qualityScore != null) {
    const grade = gradeFromScore(Number(qualityScore));
    if (grade === 'NO TRADE') reasons.push(`Setup grade ${grade} — below tradeable threshold`);
  }

  // 8. Direction sanity
  if (!trade?.direction || (trade.direction !== 'BUY' && trade.direction !== 'SELL')) {
    reasons.push('No valid trade direction');
  } else {
    // 9. Stop / target must sit on the correct side of entry
    const entry = Number(trade.entry); const sl = Number(trade.stop_loss); const tp = Number(trade.take_profit);
    const sign = trade.direction === 'BUY' ? 1 : -1;
    if (!Number.isFinite(entry) || !Number.isFinite(sl) || (entry - sl) * sign <= 0) reasons.push('Stop loss is missing or on the wrong side of entry');
    if (Number.isFinite(tp) && (tp - entry) * sign <= 0) reasons.push('Take profit is on the wrong side of entry');
  }

  // 10. One open position per market
  if (trade?.market && openTrades.some((t) => t.market === trade.market && (t.status || t.result) === 'open')) {
    reasons.push(`A ${trade.market} position is already open`);
  }

  return { allowed: reasons.length === 0, reasons };
}
