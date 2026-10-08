import { SYMBOL_META } from './marketData';

// ---------------------------------------------------------------------------
// RiskEngine + PositionSizeService
// ---------------------------------------------------------------------------

export const DEFAULTS = {
  riskPerTrade: 0.5,
  maxRisk: 1,
  minRiskReward: 2,
  newsBlackoutMinutes: 30,
};

export const RiskEngine = {
  assess(riskLevel) {
    const r = String(riskLevel || '').toLowerCase();
    if (r.includes('high')) return { tone: 'bearish', label: 'High', note: 'Reduce size or stand aside' };
    if (r.includes('med')) return { tone: 'warn', label: 'Medium', note: 'Standard risk controls apply' };
    return { tone: 'bullish', label: 'Low', note: 'Favourable risk environment' };
  },

  riskAmount(accountBalance, riskPct) {
    return (Number(accountBalance) || 0) * (Number(riskPct) || 0) / 100;
  },

  isRiskWithinLimit(riskPct, maxRisk = DEFAULTS.maxRisk) {
    return (Number(riskPct) || 0) <= maxRisk;
  },

  meetsMinRR(rr, min = DEFAULTS.minRiskReward) {
    return (Number(rr) || 0) >= min;
  },
};

export const PositionSizeService = {
  /**
   * Calculate position size from risk parameters.
   * Returns units, lots, risk amount, stop distance and R/R.
   */
  calculate({ accountBalance, riskPct, entry, stopLoss, takeProfit, instrument }) {
    const meta = SYMBOL_META[instrument];
    const balance = Number(accountBalance) || 0;
    const risk = Number(riskPct) || 0;
    const e = Number(entry);
    const sl = Number(stopLoss);
    const tp = Number(takeProfit);
    const riskAmount = balance * risk / 100;
    const stopDistance = Math.abs(e - sl);

    let units = 0;
    let lots = 0;
    if (meta && stopDistance > 0) {
      if (instrument === 'XAUUSD') {
        // $1 move = $100 per lot (100 oz)
        lots = riskAmount / (stopDistance * meta.pointValuePerLot);
        units = lots * meta.contractSize;
      } else {
        // forex: 1 pip (0.0001) = $10 per lot
        const stopPips = stopDistance / meta.pipSize;
        lots = riskAmount / (stopPips * meta.pointValuePerLot);
        units = lots * meta.contractSize;
      }
    }

    const rr = tp && stopDistance ? Math.abs(tp - e) / stopDistance : 0;

    return {
      riskAmount,
      stopDistance,
      units,
      lots,
      riskReward: rr,
      withinLimit: risk <= DEFAULTS.maxRisk,
    };
  },
};