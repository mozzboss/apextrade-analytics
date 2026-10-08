import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Check } from 'lucide-react';
import { SettingsService } from '@/services/storage';
import { DEFAULTS } from '@/services/riskEngine';
import SectionCard from '@/components/SectionCard';

export default function Settings() {
  const [form, setForm] = useState({
    account_balance: 10000, risk_per_trade: DEFAULTS.riskPerTrade, max_risk: DEFAULTS.maxRisk,
    min_risk_reward: DEFAULTS.minRiskReward, news_blackout_minutes: DEFAULTS.newsBlackoutMinutes, paper_mode: true,
    auto_mode: false, max_trades_per_day: 5, daily_loss_limit: 3, kill_switch: false,
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    SettingsService.get().then(s => { if (s) setForm(s); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function save() {
    await SettingsService.save(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function set(k, v) { setForm({ ...form, [k]: v }); }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-display font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Risk parameters and trading mode. Capital preservation first.</p>
      </div>

      <SectionCard title="Risk Management" icon={SettingsIcon}>
        {loading ? <div className="h-48 rounded-xl bg-muted/40 animate-pulse" /> : (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Account Balance ($)"><input type="number" value={form.account_balance} onChange={(e) => set('account_balance', Number(e.target.value))} className="input-field" /></Field>
            <Field label="Risk per Trade (%)" hint={`Default ${DEFAULTS.riskPerTrade}%`}><input type="number" step="0.1" value={form.risk_per_trade} onChange={(e) => set('risk_per_trade', Number(e.target.value))} className="input-field" /></Field>
            <Field label="Maximum Risk (%)" hint="Recommended max 1%"><input type="number" step="0.1" value={form.max_risk} onChange={(e) => set('max_risk', Number(e.target.value))} className="input-field" /></Field>
            <Field label="Minimum Risk/Reward" hint="Default 1:2 or greater"><input type="number" step="0.1" value={form.min_risk_reward} onChange={(e) => set('min_risk_reward', Number(e.target.value))} className="input-field" /></Field>
            <Field label="News Blackout (minutes)" hint="No new trades before major news"><input type="number" value={form.news_blackout_minutes} onChange={(e) => set('news_blackout_minutes', Number(e.target.value))} className="input-field" /></Field>
            <Field label="Trading Mode">
              <div className="flex items-center gap-3 mt-1">
                <label className="flex items-center gap-2 text-sm"><input type="radio" checked={form.paper_mode} onChange={() => set('paper_mode', true)} /> Paper Trading</label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="radio" checked={!form.paper_mode} onChange={() => set('paper_mode', false)} disabled /> Live (locked)</label>
              </div>
            </Field>
          </div>
        )}
        <div className="flex justify-end mt-5">
          <button onClick={save} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />} {saved ? 'Saved' : 'Save Settings'}
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Automation Safety" icon={SettingsIcon}>
        {loading ? <div className="h-40 rounded-xl bg-muted/40 animate-pulse" /> : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              These guards run before <span className="text-foreground font-medium">every</span> order — manual or automated.
              Automation is off by design; flipping it on later still requires these checks to pass.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Kill Switch" hint="Disables all trading immediately">
                <div className="flex items-center gap-3 mt-1">
                  <label className="flex items-center gap-2 text-sm"><input type="radio" checked={!form.kill_switch} onChange={() => set('kill_switch', false)} /> Armed</label>
                  <label className="flex items-center gap-2 text-sm text-bearish"><input type="radio" checked={form.kill_switch} onChange={() => set('kill_switch', true)} /> Halt All</label>
                </div>
              </Field>
              <Field label="Auto Mode" hint="ON = auto-trade engine executes qualifying setups (paper). OFF = scan only.">
                <div className="flex items-center gap-3 mt-1">
                  <label className="flex items-center gap-2 text-sm"><input type="radio" checked={!form.auto_mode} onChange={() => set('auto_mode', false)} /> Manual</label>
                  <label className="flex items-center gap-2 text-sm text-bullish"><input type="radio" checked={form.auto_mode} onChange={() => set('auto_mode', true)} /> Auto-Execute</label>
                </div>
              </Field>
              <Field label="Max Trades / Day"><input type="number" value={form.max_trades_per_day} onChange={(e) => set('max_trades_per_day', Number(e.target.value))} className="input-field" /></Field>
              <Field label="Daily Loss Limit ($)" hint="Stops new trades once hit"><input type="number" step="0.5" value={form.daily_loss_limit} onChange={(e) => set('daily_loss_limit', Number(e.target.value))} className="input-field" /></Field>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Live Execution Safety">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Live broker integration is a future phase. When added, the system will <span className="text-foreground font-medium">never</span> execute a live trade without explicit user confirmation.
          Before any order, it will display market, direction, entry, position size, stop loss, take profit, maximum dollar risk, and risk %, and require a manual CONFIRM TRADE action.
          Paper trading is the default and no live-money trading is connected.
        </p>
      </SectionCard>
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