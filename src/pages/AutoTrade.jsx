import React, { useState, useEffect } from 'react';
import { Bot, Play, ShieldAlert, Loader2, CheckCircle2, XCircle, AlertTriangle, Zap, Power } from 'lucide-react';
import { AutoTradeService } from '@/services/autoTradeService';
import { SettingsService } from '@/services/storage';
import SectionCard from '@/components/SectionCard';
import { cn } from '@/lib/utils';

const STATUS_STYLE = {
  running: { icon: Loader2, cls: 'text-muted-foreground', spin: true },
  ok: { icon: CheckCircle2, cls: 'text-bullish', spin: false },
  success: { icon: CheckCircle2, cls: 'text-bullish', spin: false },
  candidate: { icon: Zap, cls: 'text-gold', spin: false },
  skip: { icon: AlertTriangle, cls: 'text-muted-foreground', spin: false },
  warn: { icon: AlertTriangle, cls: 'text-yellow-500', spin: false },
  blocked: { icon: XCircle, cls: 'text-bearish', spin: false },
  error: { icon: XCircle, cls: 'text-bearish', spin: false },
  done: { icon: CheckCircle2, cls: 'text-bullish', spin: false },
};

export default function AutoTrade() {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const [result, setResult] = useState(null);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    SettingsService.get().then(s => setSettings(s)).catch(() => {});
  }, []);

  async function runScan() {
    setRunning(true); setLog([]); setResult(null);
    const res = await AutoTradeService.runScan((p) => setLog(p.log));
    setResult(res); setRunning(false);
    SettingsService.get().then(s => setSettings(s));
  }

  const autoOn = settings?.auto_mode;
  const kill = settings?.kill_switch;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-display font-semibold flex items-center gap-2">
            <Bot className="w-5 h-5 text-gold" /> Auto-Trade Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Scans markets, evaluates A+/A setups, and executes through your risk guards.</p>
        </div>
        <button onClick={runScan} disabled={running}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running ? 'Scanning…' : 'Run Auto-Trade Scan'}
        </button>
      </div>

      {/* Status banner */}
      <div className={cn('rounded-xl border px-4 py-3 flex items-center gap-3',
        kill ? 'border-bearish/40 bg-bearish/10' : autoOn ? 'border-bullish/40 bg-bullish/10' : 'border-border bg-muted/30')}>
        {kill ? <ShieldAlert className="w-5 h-5 text-bearish" /> : <Power className={cn('w-5 h-5', autoOn ? 'text-bullish' : 'text-muted-foreground')} />}
        <div className="text-sm">
          {kill ? (
            <><span className="font-semibold text-bearish">Kill switch active</span> <span className="text-muted-foreground">— all trading disabled.</span></>
          ) : autoOn ? (
            <><span className="font-semibold text-bullish">Auto mode ON</span> <span className="text-muted-foreground">— qualifying trades execute automatically (paper).</span></>
          ) : (
            <><span className="font-semibold">Auto mode OFF</span> <span className="text-muted-foreground">— scan runs but no orders placed. Enable in Settings.</span></>
          )}
        </div>
      </div>

      {/* Broker connection */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground uppercase tracking-wider">Broker:</span>
        {settings?.oanda_connected ? (
          <span className="flex items-center gap-1.5 text-bullish">
            <CheckCircle2 className="w-3.5 h-3.5" />
            OANDA {settings.oanda_environment === 'live' ? 'Live' : 'Practice'}
            {settings.paper_mode ? ' (paper mode)' : ' · live execution'}
          </span>
        ) : (
          <span className="text-muted-foreground">Paper — connect OANDA in Settings to go live</span>
        )}
      </div>

      {/* Safety rails summary */}
      <SectionCard title="Active Safety Rails" icon={ShieldAlert}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Rail label="Kill Switch" value={kill ? 'HALT' : 'Armed'} tone={kill ? 'bearish' : 'bullish'} />
          <Rail label="Auto Mode" value={autoOn ? 'ON' : 'OFF'} tone={autoOn ? 'bullish' : 'muted'} />
          <Rail label="Max Trades/Day" value={settings?.max_trades_per_day ?? '—'} />
          <Rail label="Daily Loss Limit" value={settings?.daily_loss_limit != null ? `$${settings.daily_loss_limit}` : '—'} />
          <Rail label="Risk per Trade" value={`${settings?.risk_per_trade ?? 0.5}%`} />
          <Rail label="Max Risk" value={`${settings?.max_risk ?? 1}%`} />
          <Rail label="Min R/R" value={`1:${settings?.min_risk_reward ?? 2}`} />
          <Rail label="News Blackout" value={`${settings?.news_blackout_minutes ?? 30}m`} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          Every candidate passes the same pre-trade guards as manual trades: kill switch, daily loss limit, max trades/day, news blackout, risk cap, min R/R, and A+/A quality grade.
        </p>
      </SectionCard>

      {/* Live scan log */}
      {(log.length > 0 || running) && (
        <SectionCard title={running ? 'Scan in Progress' : 'Scan Log'} icon={running ? Loader2 : Bot}>
          <div className="space-y-1.5 max-h-96 overflow-y-auto scrollbar-thin">
            {log.map((e, i) => {
              const st = STATUS_STYLE[e.status] || STATUS_STYLE.running;
              const Icon = st.icon;
              return (
                <div key={i} className="flex items-start gap-2.5 text-xs py-1.5 border-b border-border/40 last:border-0">
                  <Icon className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', st.cls, st.spin && 'animate-spin')} />
                  <div className="min-w-0">
                    <span className="text-muted-foreground uppercase tracking-wider text-[10px] mr-2">{e.step}</span>
                    <span className="text-foreground">{e.detail}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Results summary */}
      {result && !running && (
        <SectionCard title="Scan Results" icon={CheckCircle2}>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Summary label="Candidates" value={result.candidates.length} tone="gold" />
            <Summary label="Executed" value={result.executed.length} tone="bullish" />
            <Summary label="Blocked" value={result.candidates.filter(c => !c.guards.allowed).length} tone="bearish" />
          </div>
          {result.executed.length > 0 ? (
            <div className="space-y-2">
              {result.executed.map((c, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-bullish/30 bg-bullish/5 px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted">{c.symbol}</span>
                    <span className={cn('text-xs font-medium', c.order.direction === 'BUY' ? 'text-bullish' : 'text-bearish')}>{c.order.direction}</span>
                    <span className="text-xs text-muted-foreground">Grade {c.grade} · Score {c.score}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">R/R 1:{c.order.risk_reward?.toFixed(1)} · Entry {c.order.entry}</span>
                </div>
              ))}
            </div>
          ) : result.candidates.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">No A+/A setups found this scan. The engine says NO TRADE when quality is insufficient.</div>
          ) : (
            <div className="text-sm text-muted-foreground py-4 text-center">Candidates found but none passed all guards. See the log for details.</div>
          )}
        </SectionCard>
      )}
    </div>
  );
}

function Rail({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('text-sm font-semibold mt-0.5', tone === 'bullish' ? 'text-bullish' : tone === 'bearish' ? 'text-bearish' : tone === 'gold' ? 'text-gold' : 'text-foreground')}>{value}</div>
    </div>
  );
}

function Summary({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-3 text-center">
      <div className={cn('text-2xl font-bold tabular-nums', tone === 'bullish' ? 'text-bullish' : tone === 'bearish' ? 'text-bearish' : 'text-gold')}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
    </div>
  );
}