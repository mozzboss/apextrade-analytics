import React, { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, Check } from 'lucide-react';
import { AlertService } from '@/services/storage';
import { cn } from '@/lib/utils';

const ALERT_TYPES = [
  'Price reaches entry zone',
  'Break of structure',
  'Liquidity sweep',
  'Major support break',
  'Major resistance break',
  'High-quality setup appears',
  'Stop loss approached',
  'TP1 reached',
  'Major news approaching',
  'Setup invalidated',
];

export default function AlertList() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [market, setMarket] = useState('XAUUSD');
  const [type, setType] = useState(ALERT_TYPES[0]);
  const [message, setMessage] = useState('');
  const [price, setPrice] = useState('');

  async function load() {
    setLoading(true);
    try { setAlerts(await AlertService.list() || []); } catch { setAlerts([]); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    await AlertService.create({ market, type, message: message || type, price_level: price ? Number(price) : null, active: true, triggered: false });
    setMessage(''); setPrice(''); setShowForm(false);
    load();
  }
  async function toggle(a) { await AlertService.update(a.id, { active: !a.active }); load(); }
  async function remove(id) { await AlertService.remove(id); load(); }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">Alerts monitor price action and setup conditions. Configure notifications for entries, structure breaks, and news.</p>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
          <Plus className="w-4 h-4" /> New Alert
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-4 mb-4 grid sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Market</label>
            <select value={market} onChange={(e) => setMarket(e.target.value)} className="input-field">
              <option>XAUUSD</option><option>EURUSD</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="input-field">
              {ALERT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Price Level</label>
            <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" step="0.00001" placeholder="optional" className="input-field" />
          </div>
          <div className="sm:col-span-4">
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Message</label>
            <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder={type} className="input-field" />
          </div>
          <div className="sm:col-span-4 flex justify-end">
            <button onClick={create} className="px-4 py-2 rounded-lg bg-bullish text-bullish-foreground text-sm font-medium">Create Alert</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />)}</div>
      ) : alerts.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No alerts configured yet.</div>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <Bell className={cn('w-4 h-4 shrink-0', a.active ? 'text-gold' : 'text-muted-foreground')} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-foreground">{a.market}</span>
                  <span className="text-sm font-medium truncate">{a.type}</span>
                  {a.triggered && <span className="text-[10px] px-1.5 py-0.5 rounded bg-warn/15 text-warn border border-warn/30">Triggered</span>}
                </div>
                {a.message && a.message !== a.type && <div className="text-xs text-muted-foreground mt-0.5 truncate">{a.message}</div>}
                {a.price_level != null && <div className="text-xs text-muted-foreground mt-0.5">Level: <span className="tabular-nums text-foreground">{a.price_level}</span></div>}
              </div>
              <button onClick={() => toggle(a)} className={cn('p-1.5 rounded-lg', a.active ? 'text-bullish hover:bg-bullish/10' : 'text-muted-foreground hover:bg-muted')}>
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => remove(a.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-bearish hover:bg-bearish/10"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}