// ---------------------------------------------------------------------------
// LearningService — continuous performance improvement.
// After a trade closes we record the outcome and execution costs, compare the
// result against the original prediction, flag strategies that consistently
// underperform, and recommend recalibration. Live strategies are NEVER
// modified automatically — only flagged for human review and approval.
// ---------------------------------------------------------------------------

import { base44 } from '@/api/base44Client';
import { TradingJournalService } from './storage';
import { computeWinRate } from './performanceStats';

/**
 * Close a trade: persist result, P/L, costs and lessons, and score the
 * prediction against the actual outcome.
 */
export async function recordTradeOutcome(tradeId, { result, profit_loss, execution_costs, lessons, mistakes }) {
  if (!tradeId) throw new Error('tradeId is required');
  const existing = await base44.entities.Trade.get(tradeId).catch(() => null);
  const update = { result, profit_loss: Number(profit_loss) || 0 };
  if (execution_costs != null) update.execution_costs = Number(execution_costs) || 0;
  if (lessons != null) update.lessons = lessons;
  if (mistakes != null) update.mistakes = mistakes;
  if (existing?.predicted_probability != null) {
    const predictedWin = existing.predicted_probability >= 50;
    const actualWin = result === 'win';
    update.prediction_outcome = predictedWin === actualWin ? 'correct' : 'incorrect';
  }
  return TradingJournalService.update(tradeId, update);
}

/**
 * Flag strategies that consistently underperform: sufficient sample size and
 * win rate below the configured threshold. Returns the flagged strategies with
 * their stats so a human can review and recalibrate.
 */
export function flagUnderperformingStrategies(trades, opts = {}) {
  const wr = computeWinRate(trades);
  const minSample = opts.minSample || 15;
  const threshold = opts.threshold || 40;
  const flagged = [];
  for (const [strategy, g] of Object.entries(wr.byStrategy)) {
    if (strategy && g.sampleSize >= minSample && g.winRate < threshold) {
      flagged.push({ strategy, winRate: g.winRate, sampleSize: g.sampleSize, ci: g.ci });
    }
  }
  return flagged;
}

/** How often the pre-trade probability correctly predicted the outcome. */
export function predictionAccuracy(trades) {
  const scored = (trades || []).filter(
    (t) => t.prediction_outcome === 'correct' || t.prediction_outcome === 'incorrect'
  );
  const correct = scored.filter((t) => t.prediction_outcome === 'correct').length;
  return scored.length ? { correct, total: scored.length, accuracy: (correct / scored.length) * 100 } : null;
}