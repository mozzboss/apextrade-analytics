import React from 'react';
import { Bot } from 'lucide-react';
import AIChat from '@/components/AIChat';
import SectionCard from '@/components/SectionCard';

export default function AIAnalyst() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-display font-semibold flex items-center gap-2"><Bot className="w-5 h-5 text-gold" /> AI Analyst</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Ask about Gold, EURUSD, DXY, setups, risk, and macro. Responses use live web data — never fabricated prices.</p>
      </div>
      <SectionCard title="Conversation">
        <AIChat />
      </SectionCard>
    </div>
  );
}