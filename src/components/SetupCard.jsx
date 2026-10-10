import React from 'react';
import { cn } from '@/lib/utils';
import { gradeTone } from '@/services/signalEngine';
import { CheckCircle2, XCircle, Target } from 'lucide-react';

export default function SetupCard({ symbol, setup, snapshot }) {
  if (!setup || (setup.status || '').toUpperCase() === 'NO TRADE' || (setup.direction || '').toUpperCase() === 'NONE') {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-2">
          <XCircle className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{symbol} — NO TRADE</h3>
        </div>
        <p className="text-xs text-muted-foreground">No high-quality setup right now. The engine is comfortable saying NO TRADE when structure is unclear, risk/reward is poor, or confirmation is missing.</p>
        {setup?.reasons?.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {setup.reasons.map((r, i) => <li key={i} className="flex gap-1.5"><span className="text-bearish">•</span>{r}</li>)}
          </ul>
        )}
      </div>
    );
  }

  const gold = symbol === 'XAUUSD';
  const fmt = (n) => n != null ? Number(n).toLocaleString(undefined, { maximumFractionDigits: gold ? 2 : 5 }) : '—';
  const grade = setup.quality_grade;
  const tone = gradeTone(grade);
  const dir = (setup.direction || '').toUpperCase();
  const dirTone = dir === 'BUY' ? 'bullish' : 'bearish';

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <Target className={cn('w-5 h-5', gold ? 'text-gold' : 'text-chart-4')} />
          <div>
            <div className="text-sm font-semibold">{symbol} Setup</div>
            <div className="text-[11px] text-muted-foreground">Status: {setup.status}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('px-2.5 py-1 rounded-md text-xs font-bold border', dirTone === 'bullish' ? 'bg-bullish/15 text-bullish border-bullish/30' : 'bg-bearish/15 text-bearish border-bearish/30')}>{dir}</span>
          {grade && <span className={cn('px-2 py-1 rounded-md text-xs font-bold border', tone === 'bullish' ? 'bg-bullish/15 text-bullish border-bullish/30' : tone === 'warn' ? 'bg-warn/15 text-warn border-warn/30' : 'bg-muted text-muted-foreground border-border')}>{grade}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-border">
        <Cell label="Bias" value={setup.bias} />
        <Cell label="Entry Zone" value={`${fmt(setup.entry_zone_low)} – ${fmt(setup.entry_zone_high)}`} tone="gold" />
        <Cell label="Stop Loss" value={fmt(setup.stop_loss)} tone="bearish" />
        <Cell label="TP1" value={fmt(setup.tp1)} tone="bullish" />
        <Cell label="TP2" value={fmt(setup.tp2)} tone="bullish" />
        <Cell label="TP3" value={fmt(setup.tp3)} tone="bullish" />
        <Cell label="Risk / Reward" value={setup.risk_reward ? `1:${setup.risk_reward.toFixed(1)}` : '—'} />
        <Cell label="Confidence" value={`${setup.confidence ?? '—'}%`} />
        <Cell label="Risk Level" value={setup.risk_level} />
      </div>

      {setup.reasons?.length > 0 && (
        <div className="px-5 py-4 border-t border-border">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Why this trade</div>
          <ul className="space-y-1.5">
            {setup.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-foreground/90">
                <CheckCircle2 className="w-3.5 h-3.5 text-bullish mt-0.5 shrink-0" />
                {r}
              </li>
            ))}
          </ul>
          {setup.invalidation && (
            <div className="mt-3 pt-3 border-t border-border text-xs">
              <span className="text-muted-foreground">Invalidation: </span>
              <span className="text-bearish">{setup.invalidation}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, tone }) {
  return (
    <div className="bg-card px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('text-sm font-semibold tabular-nums mt-0.5', tone === 'bullish' ? 'text-bullish' : tone === 'bearish' ? 'text-bearish' : tone === 'gold' ? 'text-gold' : 'text-foreground')}>{value}</div>
    </div>
  );
}
