import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Check, Loader2, Plug, CheckCircle2 } from 'lucide-react';
import { SettingsService } from '@/services/storage';
import { OandaService } from '@/services/oandaService';
import { DEFAULTS } from '@/services/riskEngine';
import SectionCard from '@/components/SectionCard';
import { cn } from '@/lib/utils';

export default function Settings() {
  const [form, setForm] = useState({
    account_balance: 10000, risk_per_trade: DEFAULTS.riskPerTrade, max_risk: DEFAULTS.maxRisk,
    min_risk_reward: DEFAULTS.minRiskReward, news_blackout_minutes: DEFAULTS.newsBlackoutMinutes, paper_mode: true,
    auto_mode: false, max_trades_per_day: 5, daily_loss_limit: 3, kill_switch: false,
    oanda_environment: 'practice', oanda_api_token: '', oanda_account_id: '', oanda_connected: false,
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [oandaStatus, setOandaStatus] = useState(null);

  useEffect(() => {
    SettingsService.get().then(s => {
      if (s) setForm(current => ({ ...current, ...s, oanda_api_token: '' }));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function save() {
    await SettingsService.save(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function set(k, v) { setForm({ ...form, [k]: v }); }

  async function testOanda() {
    setTesting(true);
    setOandaStatus(null);
    try {
      // persist first so oandaService reads the entered token/env
      await SettingsService.save({ ...form, oanda_connected: false });
      const accounts = await OandaService.testConnection();
      const matched = accounts.some((a) => a.id === form.oanda_account_id);
      setOandaStatus({ ok: true, count: accounts.length, matched });
      set('oanda_connected', true);
    } catch (e) {
      setOandaStatus({ ok: false, error: e.message });
      set('oanda_connected', false);
    }
    setTesting(false);
  }

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
                <label className={cn('flex items-center gap-2 text-sm', form.oanda_connected ? 'text-bearish' : 'text-muted-foreground')}><input type="radio" checked={!form.paper_mode} onChange={() => set('paper_mode', false)} disabled={!form.oanda_connected} /> Live {form.oanda_connected ? '(OANDA)' : '(connect OANDA)'}</label>
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

      <SectionCard title="OANDA Broker Connection" icon={Plug}>
        {loading ? <div className="h-40 rounded-xl bg-muted/40 animate-pulse" /> : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Connect your OANDA account to route auto-trade executions live. Use <span className="text-foreground font-medium">Practice</span> first to verify, then switch to Live.
              Your API token is stored in owner-scoped app settings and is used only by the server-side broker function.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Environment">
                <div className="flex items-center gap-3 mt-1">
                  <label className="flex items-center gap-2 text-sm"><input type="radio" checked={form.oanda_environment !== 'live'} onChange={() => set('oanda_environment', 'practice')} /> Practice</label>
                  <label className="flex items-center gap-2 text-sm text-bearish"><input type="radio" checked={form.oanda_environment === 'live'} onChange={() => set('oanda_environment', 'live')} /> Live</label>
                </div>
              </Field>
              <Field label="Account ID" hint="OANDA v20 account id (e.g. 101-001-...)">
                <input value={form.oanda_account_id} onChange={(e) => set('oanda_account_id', e.target.value)} className="input-field" />
              </Field>
              <Field label="API Token" hint="Enter a new token; leave blank to keep the saved token">
                <input type="password" value={form.oanda_api_token} onChange={(e) => set('oanda_api_token', e.target.value)} className="input-field" autoComplete="off" />
              </Field>
              <Field label="Connection">
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <button onClick={testOanda} disabled={testing || !form.oanda_api_token}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
                    {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
                    {testing ? 'Testing…' : 'Test & Connect'}
                  </button>
                  {form.oanda_connected && <span className="text-xs text-bullish flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Connected</span>}
                </div>
              </Field>
            </div>
            {oandaStatus && (
              <div className={cn('text-xs rounded-lg px-3 py-2 border', oandaStatus.ok ? 'text-bullish border-bullish/30 bg-bullish/5' : 'text-bearish border-bearish/30 bg-bearish/5')}>
                {oandaStatus.ok
                  ? <>Connected — {oandaStatus.count} account(s) found{form.oanda_account_id && (oandaStatus.matched ? ' · account ID matched ✓' : ' · account ID not in list — check it')}. Save settings to keep it.</>
                  : <>Connection failed — {oandaStatus.error}</>}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Broker requests and order execution run through the authenticated Base44 backend. The token is never returned to the frontend after it is saved.
            </p>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Live Execution Safety">
        <p className="text-xs text-muted-foreground leading-relaxed">
          When OANDA is connected and Paper Trading is off, the auto-trade engine routes qualifying orders to OANDA as live market orders with stop-loss and take-profit attached.
          All pre-trade guards still apply. Paper trading remains the default — never trade live until you have verified behavior on the practice environment.
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
