import React, { useState, useEffect } from 'react';
import { Bot, Play, ShieldAlert, Loader2, CheckCircle2, XCircle, AlertTriangle, Zap, Power } from 'lucide-react';
import { AutoTradeService } from '@/services/autoTradeService';
import { SettingsService } from '@/services/storage';
import SectionCard from '@/components/SectionCard';
import { cn } from '@/lib/utils';
import { AUTO_SIZE_LABELS, getAutoRiskPercent } from '@/services/riskEngine';

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
  const [approving, setApproving] = useState(null);
  const [approvalErrors, setApprovalErrors] = useState({});

  useEffect(() => {
    SettingsService.get().then(s => setSettings(s)).catch(() => {});
  }, []);

  async function runScan() {
    setRunning(true); setLog([]); setResult(null); setApprovalErrors({});
    const res = await AutoTradeService.runScan((p) => setLog(p.log));
    setResult(res); setRunning(false);
    SettingsService.get().then(s => setSettings(s));
  }

  async function approveCandidate(candidate) {
    setApproving(candidate.symbol);
    setApprovalErrors((current) => ({ ...current, [candidate.symbol]: '' }));
    try {
      const executed = await AutoTradeService.executeCandidate(candidate);
      setResult((current) => ({ ...current, executed: [...current.executed, executed] }));
    } catch (error) {
      setApprovalErrors((current) => ({ ...current, [candidate.symbol]: error.message || 'Trade approval failed' }));
    }
    setApproving(null);
  }

  const autoOn = settings?.auto_mode;
  const kill = settings?.kill_switch;
  const reviewFirst = settings?.auto_require_confirmation !== false;
  const riskPct = getAutoRiskPercent(settings || {});

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
            <><span className="font-semibold text-bullish">Auto mode ON</span> <span className="text-muted-foreground">— {reviewFirst ? 'trades wait for your review before execution.' : 'qualifying trades execute automatically.'}</span></>
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
          <Rail label="Auto Size" value={`${AUTO_SIZE_LABELS[settings?.auto_size_profile || 'small']} · ${riskPct.toFixed(2)}%`} tone={settings?.auto_size_profile === 'big' ? 'bearish' : 'gold'} />
          <Rail label="Review" value={reviewFirst ? 'Required' : 'Automatic'} tone={reviewFirst ? 'bullish' : 'bearish'} />
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
          {result.candidates.length > 0 && (
            <div className="space-y-2 mb-4">
              {result.candidates.map((candidate, index) => {
                const executed = result.executed.some((item) => item.symbol === candidate.symbol);
                const order = candidate.order;
                return (
                  <div key={`${candidate.symbol}-${index}`} className={cn('rounded-xl border p-3.5', candidate.guards.allowed ? 'border-gold/30 bg-gold/5' : 'border-bearish/30 bg-bearish/5')}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted">{candidate.symbol}</span>
                        <span className={cn('text-xs font-medium', order.direction === 'BUY' ? 'text-bullish' : 'text-bearish')}>{order.direction}</span>
                        <span className="text-xs text-muted-foreground">{AUTO_SIZE_LABELS[order.size_profile] || order.size_profile} · {order.risk_percent.toFixed(2)}%</span>
                      </div>
                      {result.reviewRequired && autoOn && (
                        <button onClick={() => approveCandidate(candidate)} disabled={!candidate.guards.allowed || executed || approving === candidate.symbol}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
                          {approving === candidate.symbol ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          {executed ? 'Executed' : approving === candidate.symbol ? 'Rechecking…' : 'Approve Trade'}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mt-3 text-xs">
                      <TradeValue label="Entry" value={order.entry} />
                      <TradeValue label="Stop Loss" value={order.stop_loss} tone="bearish" />
                      <TradeValue label="Take Profit" value={order.take_profit} tone="bullish" />
                      <TradeValue label="Max Loss" value={`$${order.estimated_loss.toFixed(2)}`} tone="bearish" />
                      <TradeValue label="Target Profit" value={`$${order.estimated_profit.toFixed(2)}`} tone="bullish" />
                      <TradeValue label="Risk / Reward" value={`1:${order.risk_reward.toFixed(2)}`} />
                    </div>
                    {!candidate.guards.allowed && <div className="text-xs text-bearish mt-2">Blocked: {candidate.guards.reasons.join('; ')}</div>}
                    {approvalErrors[candidate.symbol] && <div className="text-xs text-bearish mt-2">Approval stopped: {approvalErrors[candidate.symbol]}</div>}
                  </div>
                );
              })}
            </div>
          )}
          {result.executed.length > 0 ? (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Executed trades</div>
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
          ) : null}
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

function TradeValue({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 px-2.5 py-2">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('font-semibold tabular-nums mt-0.5', tone === 'bullish' ? 'text-bullish' : tone === 'bearish' ? 'text-bearish' : 'text-foreground')}>{value}</div>
    </div>
  );
}
