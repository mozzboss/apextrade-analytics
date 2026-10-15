import React, { useMemo } from 'react';
import { Award, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeWinRate, wilsonInterval } from '@/services/performanceStats';

const GRADE_ORDER = ['A+', 'A', 'B', 'C'];
const GRADE_META = {
  'A+': { label: 'A+', tone: 'bullish', desc: 'Elite confluence' },
  A: { label: 'A', tone: 'bullish', desc: 'High-quality setup' },
  B: { label: 'B', tone: 'warn', desc: 'Moderate confluence' },
  C: { label: 'C', tone: 'bearish', desc: 'Marginal setup' },
};

function fmtCI(ci) {
  if (!ci) return '';
  return `${ci.low.toFixed(0)}–${ci.high.toFixed(0)}%`;
}

export default function SetupQualityBreakdown({ trades = [] }) {
  const groups = useMemo(() => computeWinRate(trades).bySetupQuality, [trades]);

  const rows = useMemo(() => {
    const entries = Object.entries(groups || {});
    if (!entries.length) return [];
    return GRADE_ORDER
      .map((grade) => [grade, groups[grade]])
      .filter(([, g]) => g)
      .concat(
        entries.filter(([k]) => !GRADE_ORDER.includes(k))
      );
  }, [groups]);

  const totalDecisive = useMemo(
    () => rows.reduce((s, [, g]) => s + (g?.decisive || 0), 0),
    [rows]
  );

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <header className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-border">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Award className="w-4 h-4 text-primary" />
          Win Rate by Setup Quality
        </h3>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {totalDecisive} decisive trade{totalDecisive === 1 ? '' : 's'}
        </span>
      </header>

      <div className="p-4 sm:p-5">
        {rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            No closed trades yet. Win rates by setup grade will appear here once trades close.
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map(([grade, g]) => {
              const meta = GRADE_META[grade] || { label: grade || '—', tone: 'muted', desc: '' };
              const winPct = g.sampleSize ? g.winRate : 0;
              const lossPct = g.sampleSize ? 100 - g.winRate : 0;
              const barTone = g.sampleSize === 0 ? 'muted' : g.winRate >= 50 ? 'bullish' : g.winRate >= 40 ? 'warn' : 'bearish';
              return (
                <div key={grade} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2.5">
                      <span className={cn(
                        'inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold',
                        meta.tone === 'bullish' && 'bg-bullish/15 text-bullish',
                        meta.tone === 'warn' && 'bg-warn/15 text-warn',
                        meta.tone === 'bearish' && 'bg-bearish/15 text-bearish',
                        meta.tone === 'muted' && 'bg-muted text-muted-foreground',
                      )}>
                        {meta.label}
                      </span>
                      <div>
                        <div className="font-medium text-foreground">{meta.desc || meta.label}</div>
                        <div className="text-[11px] text-muted-foreground tabular-nums">
                          {g.wins}W · {g.losses}L{g.breakeven ? ` · ${g.breakeven}BE` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        'text-base font-semibold tabular-nums',
                        barTone === 'bullish' && 'text-bullish',
                        barTone === 'warn' && 'text-warn',
                        barTone === 'bearish' && 'text-bearish',
                        barTone === 'muted' && 'text-muted-foreground',
                      )}>
                        {g.sampleSize ? `${g.winRate.toFixed(1)}%` : '—'}
                      </div>
                      <div className="text-[10px] text-muted-foreground tabular-nums">
                        {g.sampleSize ? `n=${g.sampleSize} · CI ${fmtCI(g.ci)}` : 'no trades'}
                      </div>
                    </div>
                  </div>
                  {/* Visual bar */}
                  <div className="relative h-2.5 rounded-full bg-muted/50 overflow-hidden">
                    {g.sampleSize > 0 && (
                      <>
                        <div
                          className={cn(
                            'absolute inset-y-0 left-0 rounded-l-full transition-all',
                            barTone === 'bullish' && 'bg-bullish',
                            barTone === 'warn' && 'bg-warn',
                            barTone === 'bearish' && 'bg-bearish',
                            barTone === 'muted' && 'bg-muted-foreground',
                          )}
                          style={{ width: `${winPct}%` }}
                        />
                        <div
                          className="absolute inset-y-0 right-0 bg-muted-foreground/20 rounded-r-full transition-all"
                          style={{ width: `${lossPct}%` }}
                        />
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {totalDecisive > 0 && totalDecisive < 20 && (
              <div className="flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/5 px-3.5 py-2.5 text-xs text-warn mt-3">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Small sample (n={totalDecisive}). Win rates are indicative until ≥20 decisive trades per grade.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}