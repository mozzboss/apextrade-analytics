import React, { useState } from 'react';
import { RefreshCw, Power, ShieldAlert, X, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(n, cur) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return `${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${cur ? ' ' + cur : ''}`;
}

export default function BrokerConnectionCard({ conn, summary, loadingSummary, onRefresh, onEmergencyStop, onDisconnect, onCloseAll, onDelete }) {
  const [confirmClose, setConfirmClose] = useState(false);
  const acc = summary?.account;
  const err = summary?.error || conn.last_error;

  return (
    <div className={cn('rounded-xl border bg-card p-4 space-y-3', conn.emergency_stop ? 'border-bearish/40' : 'border-border')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{conn.label || `MT5 ${conn.account_id}`}</span>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider',
              conn.environment === 'live' ? 'bg-bearish/15 text-bearish' : 'bg-muted text-muted-foreground')}>{conn.environment}</span>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider',
              conn.status === 'connected' ? 'bg-bullish/15 text-bullish' : conn.status === 'error' ? 'bg-bearish/15 text-bearish' : 'bg-muted text-muted-foreground')}>{conn.status}</span>
            {conn.emergency_stop && <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider bg-bearish/15 text-bearish flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Halted</span>}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{conn.server} · #{conn.account_id}</div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onRefresh(conn)} title="Refresh" className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground">
            {loadingSummary ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
          <button onClick={() => onEmergencyStop(conn, !conn.emergency_stop)} title={conn.emergency_stop ? 'Release emergency stop' : 'Emergency stop (block new trades)'}
            className={cn('p-1.5 rounded-lg hover:bg-accent', conn.emergency_stop ? 'text-bearish' : 'text-muted-foreground hover:text-bearish')}>
            <ShieldAlert className="w-4 h-4" />
          </button>
          <button onClick={() => onDisconnect(conn)} title="Disconnect" className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground">
            <Power className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(conn)} title="Delete" className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-bearish">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {err ? (
        <div className="rounded-lg border border-bearish/30 bg-bearish/5 px-3 py-2 text-xs text-bearish flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {err}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <Metric label="Balance" value={fmt(acc?.balance, acc?.currency)} />
          <Metric label="Equity" value={fmt(acc?.equity, acc?.currency)} />
          <Metric label="Free Margin" value={fmt(acc?.margin_free, acc?.currency)} />
          <Metric label="Open Positions" value={summary?.openPositions ?? '—'} />
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Last synced: {conn.last_synced_at ? new Date(conn.last_synced_at).toLocaleString() : 'never'}</span>
        {confirmClose ? (
          <span className="flex items-center gap-1.5">
            Close all positions?
            <button onClick={() => { onCloseAll(conn); setConfirmClose(false); }} className="px-2 py-1 rounded bg-bearish text-bearish-foreground text-[11px] font-medium">Yes, close</button>
            <button onClick={() => setConfirmClose(false)} className="px-2 py-1 rounded border border-border text-[11px]">Cancel</button>
          </span>
        ) : (
          <button onClick={() => setConfirmClose(true)} className="text-bearish hover:underline">Close all positions</button>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}