import React, { useState } from 'react';
import { Plug, Loader2, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { BrokerConnectionService } from '@/services/brokerConnectionService';
import { cn } from '@/lib/utils';

export default function AddBrokerConnectionForm({ onSaved, onCancel }) {
  const [form, setForm] = useState({
    environment: 'demo',
    label: '',
    server: '',
    login: '',
    password: '',
    risk_per_trade: '',
    max_daily_loss: '',
    max_open_positions: '',
    default_sl_pips: '',
    default_tp_pips: '',
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testError, setTestError] = useState(null);
  const [saving, setSaving] = useState(false);

  function set(k, v) { setForm({ ...form, [k]: v }); setTestResult(null); setTestError(null); }

  async function test() {
    setTesting(true); setTestError(null); setTestResult(null);
    try {
      const res = await BrokerConnectionService.testMT5({
        login: Number(form.login), password: form.password, server: form.server, environment: form.environment,
      });
      setTestResult(res.account);
    } catch (e) {
      setTestError(e.message || 'Connection failed');
    }
    setTesting(false);
  }

  async function save() {
    setSaving(true);
    try {
      await BrokerConnectionService.saveMT5({
        environment: form.environment,
        label: form.label,
        server: form.server,
        login: Number(form.login),
        password: form.password,
        accountName: testResult?.name,
        currency: testResult?.currency,
        risk_per_trade: form.risk_per_trade ? Number(form.risk_per_trade) : undefined,
        max_daily_loss: form.max_daily_loss ? Number(form.max_daily_loss) : undefined,
        max_open_positions: form.max_open_positions ? Number(form.max_open_positions) : undefined,
        default_sl_pips: form.default_sl_pips ? Number(form.default_sl_pips) : undefined,
        default_tp_pips: form.default_tp_pips ? Number(form.default_tp_pips) : undefined,
      });
      onSaved?.();
    } catch (e) {
      setTestError(e.message || 'Save failed');
    }
    setSaving(false);
  }

  const canTest = form.login && form.password && form.server;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Plug className="w-4 h-4 text-gold" /> Connect MetaTrader 5
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Environment">
          <div className="flex items-center gap-3 mt-1">
            <label className="flex items-center gap-2 text-sm"><input type="radio" checked={form.environment === 'demo'} onChange={() => set('environment', 'demo')} /> Demo</label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="radio" checked={form.environment === 'live'} onChange={() => set('environment', 'live')} disabled /> Live (gated)</label>
          </div>
        </Field>
        <Field label="Label (optional)"><input value={form.label} onChange={(e) => set('label', e.target.value)} placeholder="e.g. ICMarkets Demo" className="input-field" /></Field>
        <Field label="Broker Server" hint="The server name you select in the MT5 terminal"><input value={form.server} onChange={(e) => set('server', e.target.value)} placeholder="e.g. ICMarketsSC-Demo" className="input-field" /></Field>
        <Field label="Login (account number)"><input type="number" value={form.login} onChange={(e) => set('login', e.target.value)} className="input-field" /></Field>
        <Field label="Password" hint="Sent only to the server, encrypted at rest"><input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} className="input-field" autoComplete="off" /></Field>
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Risk overrides (optional)</summary>
        <div className="grid sm:grid-cols-3 gap-3 mt-3">
          <Field label="Risk / trade (%)"><input type="number" step="0.1" value={form.risk_per_trade} onChange={(e) => set('risk_per_trade', e.target.value)} className="input-field" /></Field>
          <Field label="Max daily loss ($)"><input type="number" value={form.max_daily_loss} onChange={(e) => set('max_daily_loss', e.target.value)} className="input-field" /></Field>
          <Field label="Max open positions"><input type="number" value={form.max_open_positions} onChange={(e) => set('max_open_positions', e.target.value)} className="input-field" /></Field>
          <Field label="Default SL (pips)"><input type="number" value={form.default_sl_pips} onChange={(e) => set('default_sl_pips', e.target.value)} className="input-field" /></Field>
          <Field label="Default TP (pips)"><input type="number" value={form.default_tp_pips} onChange={(e) => set('default_tp_pips', e.target.value)} className="input-field" /></Field>
        </div>
      </details>

      {testResult && (
        <div className="rounded-lg border border-bullish/30 bg-bullish/5 px-3 py-2.5 text-xs space-y-1">
          <div className="flex items-center gap-1.5 text-bullish font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Connected — {testResult.name} ({testResult.currency})</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-foreground">
            <span>Balance: <b className="tabular-nums">{testResult.balance}</b></span>
            <span>Equity: <b className="tabular-nums">{testResult.equity}</b></span>
            <span>Free margin: <b className="tabular-nums">{testResult.margin_free}</b></span>
            <span>Leverage: <b>1:{testResult.leverage}</b></span>
          </div>
        </div>
      )}
      {testError && (
        <div className="rounded-lg border border-bearish/30 bg-bearish/5 px-3 py-2 text-xs text-bearish flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {testError}
        </div>
      )}

      <div className="flex items-center gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground">Cancel</button>
        <button onClick={test} disabled={!canTest || testing}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent disabled:opacity-50">
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />} Test
        </button>
        <button onClick={save} disabled={!canTest || saving || !testResult}
          className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium',
            canTest && testResult ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground cursor-not-allowed')}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Save Connection
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</label>
      {children}
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}