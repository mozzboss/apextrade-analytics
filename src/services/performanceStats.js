// ---------------------------------------------------------------------------
// PerformanceStats — honest win-rate & performance statistics computed from
// closed Trade records.
//
// Win rate counts only DECISIVE closed trades (wins + losses). Break-even
// trades are reported separately and excluded from the win/loss denominator.
// Partial closures (trades carrying parent_trade_id) are grouped under their
// parent so a single position is never counted twice. Every win rate carries
// its sample size and a 95% Wilson confidence interval — never an invented
// number, and never displayed without its sample size.
// ---------------------------------------------------------------------------

const DECISIVE = new Set(['win', 'loss']);
const CLOSED = new Set(['win', 'loss', 'breakeven']);

/** 95% Wilson score interval for a binomial proportion, returned as %. */
export function wilsonInterval(wins, n, z = 1.96) {
  if (n <= 0) return { low: 0, high: 0 };
  const p = wins / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { low: Math.max(0, (center - half) * 100), high: Math.min(1, (center + half) * 100) };
}

/** Drop partial-closure children so each original position counts once. */
function dedupe(trades) {
  return (trades || []).filter((t) => !t.parent_trade_id);
}

function decisiveClosed(trades) {
  return trades.filter((t) => DECISIVE.has(t.result));
}

/**
 * Win rate across every requested dimension.
 * Returns overall stats plus groupings by market, strategy, session,
 * timeframe, market condition and direction. Each group carries its own
 * win rate, sample size and confidence interval.
 */
export function computeWinRate(trades) {
  const base = dedupe(trades);
  const closed = base.filter((t) => CLOSED.has(t.result));
  const decisive = decisiveClosed(base);
  const wins = decisive.filter((t) => t.result === 'win');
  const losses = decisive.filter((t) => t.result === 'loss');
  const breakeven = closed.filter((t) => t.result === 'breakeven');
  const winRate = decisive.length ? (wins.length / decisive.length) * 100 : 0;

  const byGroup = (keyFn) => {
    const groups = {};
    for (const t of closed) {
      const k = keyFn(t);
      if (!k) continue;
      const g = (groups[k] ||= { wins: 0, losses: 0, breakeven: 0, decisive: 0 });
      if (t.result === 'win') { g.wins += 1; g.decisive += 1; }
      else if (t.result === 'loss') { g.losses += 1; g.decisive += 1; }
      else g.breakeven += 1;
    }
    return Object.fromEntries(
      Object.entries(groups).map(([k, g]) => {
        const wr = g.decisive ? (g.wins / g.decisive) * 100 : 0;
        return [k, { ...g, winRate: wr, sampleSize: g.decisive, ci: wilsonInterval(g.wins, g.decisive) }];
      })
    );
  };

  return {
    total: base.length,
    closed: closed.length,
    decisive: decisive.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    winRate,
    ci: wilsonInterval(wins.length, decisive.length),
    byMarket: byGroup((t) => t.market),
    byStrategy: byGroup((t) => t.strategy),
    bySession: byGroup((t) => t.session),
    byTimeframe: byGroup((t) => t.timeframe),
    byMarketCondition: byGroup((t) => t.market_condition),
    byDirection: byGroup((t) => t.direction),
  };
}

/**
 * Advanced performance statistics: averages, profit factor, break-even win
 * rate, expected value per trade (after costs), drawdown and losing streaks.
 */
export function computeAdvancedStats(trades) {
  const base = dedupe(trades);
  const decisive = decisiveClosed(base);
  const wins = decisive.filter((t) => t.result === 'win');
  const losses = decisive.filter((t) => t.result === 'loss');

  const grossWin = wins.reduce((s, t) => s + (Number(t.profit_loss) || 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (Number(t.profit_loss) || 0), 0));
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const winRate = decisive.length ? (wins.length / decisive.length) * 100 : 0;
  const lossRate = 100 - winRate;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;

  const rrTrades = base.filter((t) => Number(t.risk_reward) > 0);
  const avgRR = rrTrades.length ? rrTrades.reduce((s, t) => s + Number(t.risk_reward), 0) / rrTrades.length : 0;

  // Break-even win rate: win rate at which avgWin wins exactly offset avgLoss losses.
  const breakEvenWinRate = avgWin + avgLoss > 0 ? (avgLoss / (avgWin + avgLoss)) * 100 : 0;

  const avgCosts = decisive.length
    ? decisive.reduce((s, t) => s + (Number(t.execution_costs) || 0), 0) / decisive.length
    : 0;
  const expectedValue = decisive.length ? (winRate / 100) * avgWin - (lossRate / 100) * avgLoss - avgCosts : 0;

  // Equity curve, drawdown and streaks over chronological decisive trades.
  const sorted = [...decisive].sort((a, b) => new Date(a.date || a.created_date) - new Date(b.date || b.created_date));
  let equity = 0, peak = 0, maxDD = 0, curDD = 0;
  let streak = 0, longestLossStreak = 0, currentLossStreak = 0;
  for (const t of sorted) {
    equity += Number(t.profit_loss) || 0;
    peak = Math.max(peak, equity);
    maxDD = Math.max(maxDD, peak - equity);
    curDD = peak - equity;
    if (t.result === 'loss') { streak += 1; longestLossStreak = Math.max(longestLossStreak, streak); }
    else if (t.result === 'win') streak = 0;
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].result === 'loss') currentLossStreak += 1;
    else break;
  }

  return {
    avgWin, avgLoss, grossWin, grossLoss, profitFactor, avgRR,
    breakEvenWinRate, expectedValue, avgCosts,
    maxDrawdown: maxDD, currentDrawdown: curDD,
    longestLossStreak, currentLossStreak,
    winRate, sampleSize: decisive.length,
    ci: wilsonInterval(wins.length, decisive.length),
    netPnL: base.reduce((s, t) => s + (Number(t.profit_loss) || 0), 0),
  };
}

/**
 * Expected value for a CANDIDATE setup, given an estimated win probability
 * (0-100), the historical average win and loss, and expected trading costs.
 * EV = (Pwin × AvgWin) − (Ploss × AvgLoss) − Costs.
 */
export function expectedValueForSetup(probability, avgWin, avgLoss, costs = 0) {
  const p = Number(probability) || 0;
  return (p / 100) * (Number(avgWin) || 0) - ((100 - p) / 100) * (Number(avgLoss) || 0) - Number(costs || 0);
}