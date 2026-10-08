import React, { useState, useMemo } from 'react';
import SectionCard from './SectionCard';
import { Calculator } from 'lucide-react';
import { PositionSizeService, DEFAULTS } from '@/services/riskEngine';
import { SYMBOL_META } from '@/services/marketData';
import { cn } from '@/lib/utils';

export default function PositionSizeCalculator({ defaultBalance = 10000, instrument = 'XAUUSD', presetEntry, presetStop }) {
  const [balance, setBalance] = useState(String(defaultBalance));
  const [risk, setRisk] = useState(String(DEFAULTS.riskPerTrade));
  const [entry, setEntry] = useState(presetEntry ? String(presetEntry) : '');
  const [stop, setStop] = useState(presetStop ? String(presetStop) : '');
  const [tp, setTp] = useState('');
  const [instr, setInstr] = useState(instrument);

  const result = useMemo(() => PositionSizeService.calculate({
    accountBalance: balance, riskPct: risk, entry, stopLoss: stop, takeProfit: tp, instrument: instr,
  }), [balance, risk, entry, stop, tp, instr]);

  const gold = instr === 'XAUUSD';
  const fmt = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: gold ? 2 : 5 });

  return (
    <SectionCard title="Position Size Calculator" icon={Calculator}>
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <Field label="Account Balance ($)">
          <input value={balance} onChange={(e) => setBalance(e.target.value)} type="number" className="input-field" />
        </Field>
        <Field label="Risk per Trade (%)">
          <input value={risk} onChange={(e) => setRisk(e.target.value)} type="number" step="0.1" className="input-field" />
        </Field>
        <Field label="Instrument">
          <select value={instr} onChange={(e) => setInstr(e.target.value)} className="input-field">
            {Object.keys(SYMBOL_META).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Entry Price">
          <input value={entry} onChange={(e) => setEntry(e.target.value)} type="number" step="0.00001" className="input-field" />
        </Field>
        <Field label="Stop Loss">
          <input value={stop} onChange={(e) => setStop(e.target.value)} type="number" step="0.00001" className="input-field" />
        </Field>
        <Field label="Take Profit (optional)">
          <input value={tp} onChange={(e) => setTp(e.target.value)} type="number" step="0.00001" className="input-field" />
        </Field>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Result label="Max Loss ($)" value={`$${result.riskAmount.toFixed(2)}`} tone={result.withinLimit ? 'bullish' : 'bearish'} />
        <Result label="Stop Distance" value={result.stopDistance ? fmt(result.stopDistance) : '—'} />
        <Result label="Position Size" value={result.lots ? `${result.lots.toFixed(3)} lots` : '—'} tone="gold" />
        <Result label="Risk / Reward" value={result.riskReward ? `1:${result.riskReward.toFixed(1)}` : '—'} tone={result.riskReward >= DEFAULTS.minRiskReward ? 'bullish' : 'bearish'} />
      </div>
      {!result.withinLimit && (
        <div className="mt-3 text-xs text-bearish bg-bearish/10 border border-bearish/30 rounded-lg px-3 py-2">
          Risk exceeds the 1% maximum recommended limit. Reduce position size or risk percentage.
        </div>
      )}
      <div className="mt-3 text-[11px] text-muted-foreground">
        Position size is calculated from risk, never from desired profit. Default risk {DEFAULTS.riskPerTrade}% · max {DEFAULTS.maxRisk}% · min R/R 1:{DEFAULTS.minRiskReward}.
      </div>
    </SectionCard>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Result({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('text-sm font-semibold tabular-nums mt-0.5', tone === 'bullish' ? 'text-bullish' : tone === 'bearish' ? 'text-bearish' : tone === 'gold' ? 'text-gold' : 'text-foreground')}>{value}</div>
    </div>
  );
}