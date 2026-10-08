import { base44 } from '@/api/base44Client';

// ---------------------------------------------------------------------------
// Entity-backed services: journal, alerts, setups, settings.
// ---------------------------------------------------------------------------

export const TradingJournalService = {
  list: () => base44.entities.Trade.list('-created_date', 200),
  create: (data) => base44.entities.Trade.create(data),
  update: (id, data) => base44.entities.Trade.update(id, data),
  remove: (id) => base44.entities.Trade.delete(id),
};

export const AlertService = {
  list: () => base44.entities.Alert.list('-created_date', 100),
  create: (data) => base44.entities.Alert.create(data),
  update: (id, data) => base44.entities.Alert.update(id, data),
  remove: (id) => base44.entities.Alert.delete(id),
};

export const SetupService = {
  list: () => base44.entities.Setup.list('-created_date', 100),
  create: (data) => base44.entities.Setup.create(data),
  update: (id, data) => base44.entities.Setup.update(id, data),
  remove: (id) => base44.entities.Setup.delete(id),
};

export const SettingsService = {
  async get() {
    const items = await base44.entities.AppSettings.list('-created_date', 5);
    return items?.[0] || null;
  },
  async save(data) {
    const existing = await SettingsService.get();
    if (existing) return base44.entities.AppSettings.update(existing.id, data);
    return base44.entities.AppSettings.create(data);
  },
};