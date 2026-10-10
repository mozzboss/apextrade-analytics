import { gradeFromScore } from '@/services/signalEngine';

// ---------------------------------------------------------------------------
// TradeGuards — hard pre-trade risk checks. Every order (manual or auto)
// must pass these before execution. This is the gate that makes future
// automation safe: the same guards run whether a human or a bot triggers it.
// ---------------------------------------------------------------------------

export function evaluateTrade({ trade, settings, todayTrades = [], todayPnL = 0, nextHighEventTime = null, qualityScore = null }) {
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

  // 5. Risk-per-trade cap
  const riskPct = Number(trade?.risk_percent);
  if (!Number.isNaN(riskPct) && s.max_risk != null && riskPct > Number(s.max_risk)) {
    reasons.push(`Risk ${riskPct}% exceeds max ${Number(s.max_risk)}%`);
  }

  // 6. Entry, stop-loss, take-profit, and minimum risk/reward
  const entry = Number(trade?.entry);
  const stopLoss = Number(trade?.stop_loss);
  const takeProfit = Number(trade?.take_profit);
  const hasLevels = [entry, stopLoss, takeProfit].every(Number.isFinite);
  if (!hasLevels || entry <= 0 || stopLoss <= 0 || takeProfit <= 0) {
    reasons.push('Valid entry, stop-loss, and take-profit are required');
  } else {
    const buy = trade?.direction === 'BUY';
    const sell = trade?.direction === 'SELL';
    if ((buy && stopLoss >= entry) || (sell && stopLoss <= entry)) reasons.push('Stop-loss is on the wrong side of entry');
    if ((buy && takeProfit <= entry) || (sell && takeProfit >= entry)) reasons.push('Take-profit is on the wrong side of entry');
    const calculatedRR = Math.abs(takeProfit - entry) / Math.abs(entry - stopLoss);
    if (!Number.isFinite(calculatedRR) || calculatedRR < Number(s.min_risk_reward ?? 0)) {
      reasons.push(`R/R 1:${Number.isFinite(calculatedRR) ? calculatedRR.toFixed(2) : '0'} below minimum 1:${Number(s.min_risk_reward ?? 0)}`);
    }
  }

  const riskAmount = Number(trade?.risk);
  if (!Number.isFinite(riskAmount) || riskAmount <= 0) reasons.push('Trade risk amount must be greater than $0');

  // 7. Setup quality gate
  if (qualityScore != null) {
    const grade = gradeFromScore(Number(qualityScore));
    if (grade === 'NO TRADE') reasons.push(`Setup grade ${grade} — below tradeable threshold`);
  }

  // 8. Direction sanity
  if (!trade?.direction || (trade.direction !== 'BUY' && trade.direction !== 'SELL')) {
    reasons.push('No valid trade direction');
  }

  return { allowed: reasons.length === 0, reasons };
}
