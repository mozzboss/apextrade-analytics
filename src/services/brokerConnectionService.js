import { base44 } from '@/api/base44Client';

// Frontend service for MT5 broker connections. Credentials are never handled
// here — they go straight to the mt5-broker backend function, which encrypts
// them server-side. Listing uses field projection so the encrypted blob is
// never sent to the browser.

const CONNECTION_FIELDS = [
  'id', 'provider', 'environment', 'label', 'server', 'account_id',
  'account_name', 'account_currency', 'status', 'live_authorized',
  'emergency_stop', 'last_error', 'last_synced_at', 'risk_per_trade',
  'max_daily_loss', 'max_exposure', 'max_open_positions', 'default_sl_pips',
  'default_tp_pips', 'created_date',
];

const LOG_FIELDS = [
  'id', 'connection_id', 'provider', 'environment', 'action', 'status',
  'error', 'response_summary', 'created_date',
];

async function invoke(action, payload = {}) {
  const res = await base44.functions.invoke('mt5-broker', { action, ...payload });
  return res.data;
}

export const BrokerConnectionService = {
  status: () => invoke('status'),

  list: async () => {
    const page = await base44.entities.BrokerConnection.filter({}, { sort: '-created_date', limit: 50, fields: CONNECTION_FIELDS });
    return page.items || [];
  },

  listLogs: async () => {
    const page = await base44.entities.ExecutionLog.filter({}, { sort: '-created_date', limit: 100, fields: LOG_FIELDS });
    return page.items || [];
  },

  testMT5: (creds) => invoke('testConnection', creds),
  saveMT5: (data) => invoke('saveConnection', data),
  getAccountSummary: (connectionId) => invoke('getAccountSummary', { connectionId }),
  getOpenPositions: (connectionId) => invoke('getOpenPositions', { connectionId }),
  closeAllPositions: (connectionId) => invoke('closeAllPositions', { connectionId, confirm: true }),
  setEmergencyStop: (connectionId, emergency_stop) => invoke('setEmergencyStop', { connectionId, emergency_stop }),
  disconnect: (connectionId) => invoke('disconnect', { connectionId }),

  remove: (id) => base44.entities.BrokerConnection.delete(id),
};