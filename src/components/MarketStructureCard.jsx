import React from 'react';
import SectionCard from './SectionCard';
import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

const LABEL_TONE = {
  'BULLISH STRUCTURE': 'bullish',
  'BEARISH STRUCTURE': 'bearish',
  RANGE: 'warn',
  'REVERSAL POSSIBLE': 'warn',
  'WAITING FOR CONFIRMATION': 'muted',
};

export default function MarketStructureCard({ structure }) {
  const label = structure?.label || '—';
  const tone = LABEL_TONE[label] || 'muted';
  const toneClass = tone === 'bullish' ? 'text-bullish bg-bullish/10 border-bullish/30' : tone === 'bearish' ? 'text-bearish bg-bearish/10 border-bearish/30' : tone === 'warn' ? 'text-warn bg-warn/10 border-warn/30' : 'text-muted-foreground bg-muted border-border';

  return (
    <SectionCard title="Market Structure" icon={Layers}>
      <div className={cn('inline-flex px-3 py-1.5 rounded-lg text-sm font-semibold border mb-4', toneClass)}>
        {label}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm mb-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Higher Highs</span>
          <span className={structure?.higher_highs ? 'text-bullish font-medium' : 'text-muted-foreground'}>{structure?.higher_highs ? 'Yes' : 'No'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Higher Lows</span>
          <span className={structure?.higher_lows ? 'text-bullish font-medium' : 'text-muted-foreground'}>{structure?.higher_lows ? 'Yes' : 'No'}</span>
        </div>
      </div>
      {(structure?.break_of_structure || structure?.change_of_character) && (
        <div className="space-y-1.5 text-xs mb-3">
          {structure.break_of_structure && <div><span className="text-muted-foreground">BOS: </span><span className="text-foreground">{structure.break_of_structure}</span></div>}
          {structure.change_of_character && <div><span className="text-muted-foreground">CHoCH: </span><span className="text-foreground">{structure.change_of_character}</span></div>}
        </div>
      )}
      {structure?.notes && <p className="text-xs text-muted-foreground leading-relaxed">{structure.notes}</p>}
    </SectionCard>
  );
}