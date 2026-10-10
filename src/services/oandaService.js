import { base44 } from '@/api/base44Client';

const SYMBOL_TO_OANDA = {
  XAUUSD: 'XAU_USD', EURUSD: 'EUR_USD', GBPUSD: 'GBP_USD', USDJPY: 'USD_JPY',
  AUDUSD: 'AUD_USD', USDCAD: 'USD_CAD', NZDUSD: 'NZD_USD', USDCHF: 'USD_CHF',
};
const OANDA_TO_SYMBOL = Object.fromEntries(Object.entries(SYMBOL_TO_OANDA).map(([k, v]) => [v, k]));

async function invoke(action, payload = {}) {
  const response = await base44.functions.invoke('oanda-broker', { action, ...payload });
  return response.data;
}

export const OandaService = {
  SYMBOL_TO_OANDA,
  OANDA_TO_SYMBOL,
  testConnection: () => invoke('testConnection'),
  getAccountSummary: () => invoke('getAccountSummary'),
  getPricing: (symbol) => invoke('getPricing', { symbol }),
  getPricingAll: (symbols) => invoke('getPricingAll', { symbols }),
  placeOrder: (order) => invoke('placeOrder', { order }),
  closeTrade: (tradeId, journalTradeId) => invoke('closeTrade', { tradeId, journalTradeId }),
  getCandles: (symbol, granularity = 'M1', count = 50) => invoke('getCandles', { symbol, granularity, count }),
};
