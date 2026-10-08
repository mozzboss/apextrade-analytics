import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, X } from 'lucide-react';
import { TradingJournalService } from '@/services/storage';
import TradeJournalTable from '@/components/TradeJournalTable';
import SectionCard from '@/components/SectionCard';
import { cn } from '@/lib/utils';

export default function Journal() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterMarket, setFilterMarket] = useState('ALL');
  const [filterResult, setFilterResult] = useState('ALL');
  const [filterSession, setFilterSession] = useState('ALL');

  const [form, setForm] = useState({
    market: 'XAUUSD', direction: 'BUY', entry: '', stop_loss: '', take_profit: '',
    risk: '', risk_reward: '', setup_quality: 'A', reason: '', session: 'London',
    date: new Date().toISOString().slice(0, 10), result: 'open', profit_loss: '', mistakes: '', lessons: '',
  });

  async function load() {
    setLoading(true);
    try { setTrades(await TradingJournalService.list() || []); } catch { setTrades([]); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    const data = {
      ...form,
      entry: form.entry ? Number(form.entry) : null,
      stop_loss: form.stop_loss ? Number(form.stop_loss) : null,
      take_profit: form.take_profit ? Number(form.take_profit) : null,
      risk: form.risk ? Number(form.risk) : null,
      risk_reward: form.risk_reward ? Number(form.risk_reward) : null,
      profit_loss: form.profit_loss ? Number(form.profit_loss) : 0,
    };
    await TradingJournalService.create(data);
    setShowForm(false);
    setForm({ ...form, entry: '', stop_loss: '', take_profit: '', risk: '', risk_reward: '', reason: '', profit_loss: '', mistakes: '', lessons: '' });
    load();
  }
  async function remove(id) { await TradingJournalService.remove(id); load(); }

  const filtered = trades.filter((t) =>
    (filterMarket === 'ALL' || t.market === filterMarket) &&
    (filterResult === 'ALL' || t.result === filterResult) &&
    (filterSession === 'ALL' || t.session === filterSession)
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-display font-semibold">Trade Journal</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Record every trade — wins and losses. Review to improve.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {showForm ? 'Close' : 'New Trade'}
        </button>
      </div>

      {showForm && (
        <SectionCard title="Log a Trade">
          <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <FormField label="Market"><select value={form.market} onChange={(e) => setForm({ ...form, market: e.target.value })} className="input-field"><option>XAUUSD</option><option>EURUSD</option></select></FormField>
            <FormField label="Direction"><select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })} className="input-field"><option>BUY</option><option>SELL</option></select></FormField>
            <FormField label="Entry"><input value={form.entry} onChange={(e) => setForm({ ...form, entry: e.target.value })} type="number" step="0.00001" className="input-field" /></FormField>
            <FormField label="Stop Loss"><input value={form.stop_loss} onChange={(e) => setForm({ ...form, stop_loss: e.target.value })} type="number" step="0.00001" className="input-field" /></FormField>
            <FormField label="Take Profit"><input value={form.take_profit} onChange={(e) => setForm({ ...form, take_profit: e.target.value })} type="number" step="0.00001" className="input-field" /></FormField>
            <FormField label="Risk ($)"><input value={form.risk} onChange={(e) => setForm({ ...form, risk: e.target.value })} type="number" step="0.01" className="input-field" /></FormField>
            <FormField label="Risk/Reward"><input value={form.risk_reward} onChange={(e) => setForm({ ...form, risk_reward: e.target.value })} type="number" step="0.1" placeholder="2.4" className="input-field" /></FormField>
            <FormField label="Setup Quality"><select value={form.setup_quality} onChange={(e) => setForm({ ...form, setup_quality: e.target.value })} className="input-field"><option>A+</option><option>A</option><option>B</option><option>C</option></select></FormField>
            <FormField label="Session"><select value={form.session} onChange={(e) => setForm({ ...form, session: e.target.value })} className="input-field"><option>London</option><option>New York</option><option>Asian</option><option>Overlap</option></select></FormField>
            <FormField label="Date"><input value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} type="date" className="input-field" /></FormField>
            <FormField label="Result"><select value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} className="input-field"><option value="open">Open</option><option value="win">Win</option><option value="loss">Loss</option><option value="breakeven">Breakeven</option><option value="cancelled">Cancelled</option></select></FormField>
            <FormField label="P/L ($)"><input value={form.profit_loss} onChange={(e) => setForm({ ...form, profit_loss: e.target.value })} type="number" step="0.01" className="input-field" /></FormField>
            <div className="sm:col-span-3 lg:col-span-4">
              <FormField label="Reason for Trade"><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="input-field" /></FormField>
            </div>
            <div className="sm:col-span-3 lg:col-span-2"><FormField label="Mistakes"><input value={form.mistakes} onChange={(e) => setForm({ ...form, mistakes: e.target.value })} className="input-field" /></FormField></div>
            <div className="sm:col-span-3 lg:col-span-2"><FormField label="Lessons"><input value={form.lessons} onChange={(e) => setForm({ ...form, lessons: e.target.value })} className="input-field" /></FormField></div>
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={create} className="px-5 py-2 rounded-lg bg-bullish text-bullish-foreground text-sm font-medium">Save Trade</button>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Trade History" icon={BookOpen}
        action={
          <div className="flex flex-wrap gap-1.5">
            <FilterSelect value={filterMarket} onChange={setFilterMarket} options={['ALL', 'XAUUSD', 'EURUSD']} />
            <FilterSelect value={filterResult} onChange={setFilterResult} options={['ALL', 'open', 'win', 'loss', 'breakeven', 'cancelled']} />
            <FilterSelect value={filterSession} onChange={setFilterSession} options={['ALL', 'London', 'New York', 'Asian', 'Overlap']} />
          </div>
        }>
        <TradeJournalTable trades={filtered} onDelete={remove} />
      </SectionCard>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function FilterSelect({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-muted/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground outline-none capitalize">
      {options.map((o) => <option key={o} value={o} className="capitalize">{o === 'ALL' ? 'All' : o}</option>)}
    </select>
  );
}