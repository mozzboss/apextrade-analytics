import React, { useState, useEffect } from 'react';
import { Zap, ArrowUp, ArrowDown, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * QuickTradeBar — manual trade entry. Lets the user place a BUY or SELL with
 * custom entry, stop-loss and take-profit, independent of the AI setup.
 * Builds a synthetic setup and hands it to OrderPreviewModal via onPlace.
 */
export default function QuickTradeBar({ symbol, currentPrice, decimals, onPlace }) {
  const [dir, setDir] = useState('BUY');
  const [entry, setEntry] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');

  useEffect(() => {
    if (currentPrice != null) setEntry((prev) => prev || String(currentPrice));
  }, [currentPrice]);

  const e = Number(entry);
  const s = Number(sl);
  const t = Number(tp);
  const stopDist = Math.abs(e - s);
  const rr = t && stopDist ? Math.abs(t - e) / stopDist : 0;
  const validSl = Number.isFinite(e) && Number.isFinite(s) && stopDist > 0 && (dir === 'BUY' ? s < e : s > e);
  const validTp = !t || (dir === 'BUY' ? t > e : t < e);
  const canPlace = validSl && validTp;

  function fillFromLevels(support, resistance) {
    if (dir === 'BUY') {
      setEntry(String(resistance ?? currentPrice ?? ''));
      setSl(String(support ?? ''));
    } else {
      setEntry(String(support ?? currentPrice ?? ''));
      setSl(String(resistance ?? ''));
    }
  }

  function place() {
    if (!canPlace) return;
    onPlace({
      direction: dir,
      entry_zone_high: e,
      entry_zone_low: e,
      stop_loss: s,
      tp1: t || null,
      risk_reward: rr ? Number(rr.toFixed(2)) : null,
      quality_grade: 'Manual',
      reasons: [`Manual ${dir} entry`],
    });
  }

  const fmt = (n) => (n != null && Number.isFinite(n) ? Number(n).toLocaleString(undefined, { maximumFractionDigits: decimals }) : '—');

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-gold" />
          <h3 className="text-sm font-semibold">Quick Trade</h3>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground hidden sm:inline">Manual entry</span>
        </div>
        <div className="text-[11px] text-muted-foreground">{symbol} · live custom levels</div>
      </div>

      <div className="p-4 sm:p-5 space-y-3.5">
        {/* Direction toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setDir('BUY')}
            className={cn(
              'flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold border transition-colors',
              dir === 'BUY' ? 'bg-bullish/15 border-bullish/40 text-bullish' : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            <ArrowUp className="w-4 h-4" /> BUY
          </button>
          <button
            onClick={() => setDir('SELL')}
            className={cn(
              'flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold border transition-colors',
              dir === 'SELL' ? 'bg-bearish/15 border-bearish/40 text-bearish' : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            <ArrowDown className="w-4 h-4" /> SELL
          </button>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-3 gap-2.5">
          <Labeled label="Entry">
            <input value={entry} onChange={(ev) => setEntry(ev.target.value)} type="number" step="0.00001" className="input-field" placeholder={fmt(currentPrice)} />
          </Labeled>
          <Labeled label="Stop Loss">
            <input value={sl} onChange={(ev) => setSl(ev.target.value)} type="number" step="0.00001" className={cn('input-field', sl && !validSl && 'border-bearish/50')} placeholder="—" />
          </Labeled>
          <Labeled label="Take Profit">
            <input value={tp} onChange={(ev) => setTp(ev.target.value)} type="number" step="0.00001" className={cn('input-field', tp && !validTp && 'border-bearish/50')} placeholder="optional" />
          </Labeled>
        </div>

        {/* Live readout */}
        <div className="flex items-center justify-between text-xs">
          <div className="text-muted-foreground">
            Stop distance: <span className="text-foreground font-medium tabular-nums">{stopDist > 0 ? fmt(stopDist) : '—'}</span>
          </div>
          <div className="text-muted-foreground">
            Risk / Reward: <span className={cn('font-semibold tabular-nums', rr > 0 ? (rr >= 2 ? 'text-bullish' : 'text-warn') : 'text-muted-foreground')}>{rr > 0 ? `1:${rr.toFixed(1)}` : '—'}</span>
          </div>
        </div>

        {sl && !validSl && (
          <div className="text-[11px] text-bearish">Stop loss must be {dir === 'BUY' ? 'below' : 'above'} entry.</div>
        )}
        {tp && !validTp && (
          <div className="text-[11px] text-bearish">Take profit must be {dir === 'BUY' ? 'above' : 'below'} entry.</div>
        )}

        <button
          onClick={place}
          disabled={!canPlace}
          className={cn(
            'w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-colors',
            canPlace ? (dir === 'BUY' ? 'bg-bullish text-bullish-foreground' : 'bg-bearish text-bearish-foreground') : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          <ShieldCheck className="w-4 h-4" /> Place {dir} Trade
        </button>
      </div>
    </div>
  );
}

function Labeled({ label, children }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}