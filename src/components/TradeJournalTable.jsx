import React from 'react';
import { cn } from '@/lib/utils';
import { Trash2 } from 'lucide-react';

const RESULT_TONE = {
  win: 'text-bullish bg-bullish/10 border-bullish/30',
  loss: 'text-bearish bg-bearish/10 border-bearish/30',
  breakeven: 'text-muted-foreground bg-muted border-border',
  open: 'text-warn bg-warn/10 border-warn/30',
  cancelled: 'text-muted-foreground bg-muted border-border',
};

export default function TradeJournalTable({ trades = [], onDelete }) {
  if (!trades.length) {
    return <div className="py-12 text-center text-sm text-muted-foreground">No trades logged yet. Record your first trade to start building your performance data.</div>;
  }
  return (
    <div className="overflow-x-auto scrollbar-thin -mx-1">
      <table className="w-full text-sm min-w-[760px]">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
            <th className="font-medium px-3 py-2">Date</th>
            <th className="font-medium px-3 py-2">Market</th>
            <th className="font-medium px-3 py-2">Dir</th>
            <th className="font-medium px-3 py-2">Entry</th>
            <th className="font-medium px-3 py-2">SL</th>
            <th className="font-medium px-3 py-2">TP</th>
            <th className="font-medium px-3 py-2">R/R</th>
            <th className="font-medium px-3 py-2">Quality</th>
            <th className="font-medium px-3 py-2">Session</th>
            <th className="font-medium px-3 py-2">Result</th>
            <th className="font-medium px-3 py-2">P/L</th>
            {onDelete && <th className="px-3 py-2"></th>}
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr key={t.id} className="border-b border-border/60 hover:bg-muted/30">
              <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{t.date || '—'}</td>
              <td className="px-3 py-2.5 font-medium">{t.market}</td>
              <td className={cn('px-3 py-2.5 font-medium', t.direction === 'BUY' ? 'text-bullish' : 'text-bearish')}>{t.direction}</td>
              <td className="px-3 py-2.5 tabular-nums">{t.entry ?? '—'}</td>
              <td className="px-3 py-2.5 tabular-nums text-bearish">{t.stop_loss ?? '—'}</td>
              <td className="px-3 py-2.5 tabular-nums text-bullish">{t.take_profit ?? '—'}</td>
              <td className="px-3 py-2.5 tabular-nums">{t.risk_reward ? `1:${t.risk_reward.toFixed(1)}` : '—'}</td>
              <td className="px-3 py-2.5">{t.setup_quality || '—'}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{t.session || '—'}</td>
              <td className="px-3 py-2.5">
                <span className={cn('inline-block px-2 py-0.5 rounded text-[10px] font-semibold border capitalize', RESULT_TONE[t.result] || RESULT_TONE.open)}>{t.result || 'open'}</span>
              </td>
              <td className={cn('px-3 py-2.5 tabular-nums font-medium', (t.profit_loss || 0) > 0 ? 'text-bullish' : (t.profit_loss || 0) < 0 ? 'text-bearish' : 'text-muted-foreground')}>
                {t.profit_loss != null ? `${t.profit_loss > 0 ? '+' : ''}$${Number(t.profit_loss).toFixed(2)}` : '—'}
              </td>
              {onDelete && (
                <td className="px-3 py-2.5">
                  <button onClick={() => onDelete(t.id)} className="text-muted-foreground hover:text-bearish"><Trash2 className="w-3.5 h-3.5" /></button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}