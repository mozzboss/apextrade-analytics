import { TradingJournalService } from '@/services/storage';

// ---------------------------------------------------------------------------
// BrokerService — adapter seam for order execution.
// Default provider is "paper" (records to the journal). A live broker (OANDA)
// provider plugs in via setBrokerProvider once a Builder+ backend function
// exists to call the broker API server-side with a stored API-key secret.
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
      risk_reward: order.risk_reward,
      setup_quality: order.setup_quality,
      reason: order.reason,
      result: 'open',
      profit_loss: 0,
      date: new Date().toISOString().slice(0, 10),
      session: order.session,
      status: 'open',
    });
    return { ok: true, provider: 'paper', mode: 'paper', tradeId: trade.id };
  },
  async cancelOrder(id) {
    await TradingJournalService.update(id, { result: 'cancelled', status: 'cancelled' });
    return { ok: true };
  },
};

let _provider = paperProvider;
export function setBrokerProvider(p) { _provider = p; }
export function getBrokerProvider() { return _provider; }

export const BrokerService = {
  mode() { return _provider.name || 'paper'; },
  async placeOrder(order) { return _provider.placeOrder(order); },
  async cancelOrder(id) { return _provider.cancelOrder?.(id); },
};