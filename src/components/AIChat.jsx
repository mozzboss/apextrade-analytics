import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, Send, User } from 'lucide-react';
import { AIAnalystService } from '@/services/marketData';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  'Analyze gold right now',
  'Should I buy gold?',
  'What is the trend on XAUUSD?',
  'Give me today\'s best setup',
  'Analyze EURUSD',
  'Where is Gold support?',
  'What\'s happening with DXY?',
  'What news could move gold today?',
  'Should I wait until CPI?',
  'Calculate my position size',
];

export default function AIChat({ symbol }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'I\'m your AI market analyst, grounded in live web data. Ask me to analyze Gold or EUR/USD, find today\'s best setup, or assess risk. I never promise profits — capital preservation comes first.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setLoading(true);
    try {
      const res = await AIAnalystService.ask(q, symbol);
      setMessages((m) => [...m, { role: 'assistant', content: typeof res === 'string' ? res : JSON.stringify(res) }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: 'I ran into an issue fetching live data. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)] lg:h-[calc(100vh-7rem)]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin space-y-4 pr-1">
        {messages.map((m, i) => (
          <div key={i} className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
              m.role === 'assistant' ? 'bg-gold/15 text-gold' : 'bg-muted text-foreground')}>
              {m.role === 'assistant' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div className={cn('max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
              m.role === 'assistant' ? 'bg-card border border-border' : 'bg-primary text-primary-foreground')}>
              {m.role === 'assistant'
                ? <div className="prose prose-invert prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                : m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-gold/15 text-gold flex items-center justify-center shrink-0"><Bot className="w-4 h-4" /></div>
            <div className="bg-card border border-border rounded-2xl px-4 py-3 flex gap-1">
              <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 my-3">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} className="text-xs px-3 py-1.5 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-3 border-t border-border">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask about Gold, EURUSD, DXY, setups, risk…"
          className="flex-1 bg-card border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50 placeholder:text-muted-foreground"
        />
        <button onClick={() => send()} disabled={loading || !input.trim()}
          className="px-4 rounded-xl bg-primary text-primary-foreground disabled:opacity-40 flex items-center gap-2 text-sm font-medium">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}