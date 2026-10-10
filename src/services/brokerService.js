import { TradingJournalService, SettingsService } from '@/services/storage';
import { OandaService } from './oandaService';

// ---------------------------------------------------------------------------
// BrokerService — adapter seam for order execution.
// Default provider is "paper" (records to the journal). When OANDA is
// connected and paper mode is off, orders route to OANDA as live market orders
// (and are also logged to the journal for tracking).
// ---------------------------------------------------------------------------

const paperProvider = {
  name: 'paper',
  async placeOrder(order) {
    const trade = await TradingJournalService.create({
      market: order.market,
      direction: order.direction,
      entry: order.entry,
      stop_loss: order.stop_loss,
      take_profit: order.take_profit,
      risk: order.risk,
      risk_percent: order.risk_percent,
      size_profile: order.size_profile,
      risk_reward: order.risk_reward,
      setup_quality: order.setup_quality,
      reason: order.reason,
      result: 'open',
      profit_loss: 0,
      date: new Date().toISOString().slice(0, 10),
      session: order.session,
      status: 'open',
      strategy: order.strategy,
      timeframe: order.timeframe,
      market_condition: order.market_condition,
      entry_conditions: order.entry_conditions,
      predicted_probability: order.predicted_probability,
      expected_value: order.expected_value,
      prediction_outcome: order.predicted_probability != null ? 'pending' : undefined,
      broker_provider: 'paper',
      execution_mode: 'paper',
    });
    return { ok: true, provider: 'paper', mode: 'paper', tradeId: trade.id };
  },
  async cancelOrder(id) {
    await TradingJournalService.update(id, { result: 'cancelled', status: 'cancelled' });
    return { ok: true };
  },
};

const oandaProvider = {
  name: 'oanda',
  async placeOrder(order) {
    const res = await OandaService.placeOrder(order);
    return res;
  },
  async cancelOrder(id, journalTradeId) {
    if (!id) return { ok: true };
    return OandaService.closeTrade(id, journalTradeId);
  },
};

async function selectProvider() {
  const s = (await SettingsService.get().catch(() => null)) || {};
  if (s.oanda_connected && !s.paper_mode) return oandaProvider;
  return paperProvider;
}

export function setBrokerProvider() {}
export function getBrokerProvider() {
  return null;
}

export const BrokerService = {
  async mode() {
    return (await selectProvider()).name;
  },
  async placeOrder(order) {
    return (await selectProvider()).placeOrder(order);
  },
  async cancelOrder(id, journalTradeId) {
    return (await selectProvider()).cancelOrder?.(id, journalTradeId);
  },
};
