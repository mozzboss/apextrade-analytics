import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw, Activity, BarChart3, Newspaper, ShieldCheck, Brain } from 'lucide-react';
import { MarketDataService, TIMEFRAMES, SYMBOL_META, NewsService, clearCache } from '@/services/marketData';
import { SettingsService } from '@/services/storage';
import { OandaService } from '@/services/oandaService';
import { cn } from '@/lib/utils';

const TF_TO_GRAN = { '5M': 'M5', '15M': 'M15', '30M': 'M30', '1H': 'H1', '4H': 'H4', 'D': 'D', 'W': 'W' };
import PriceChart from '@/components/PriceChart';
import SectionCard from '@/components/SectionCard';
import SignalBadge from '@/components/SignalBadge';
import StatTile from '@/components/StatTile';
import SetupCard from '@/components/SetupCard';
import MarketStructureCard from '@/components/MarketStructureCard';
import MultiTimeframeCard from '@/components/MultiTimeframeCard';
import TradeQualityScore from '@/components/TradeQualityScore';
import PositionSizeCalculator from '@/components/PositionSizeCalculator';
import OrderPreviewModal from '@/components/OrderPreviewModal';

export default function MarketScreen() {
  const { symbol = 'XAUUSD' } = useParams();
  const meta = SYMBOL_META[symbol] || SYMBOL_META.XAUUSD;
  const gold = symbol === 'XAUUSD';

  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tf, setTf] = useState('1H');
  const [chart, setChart] = useState(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [news, setNews] = useState([]);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [live, setLive] = useState(null);
  const baseSym = symbol === 'XAUUSD' ? 'Au' : { EURUSD: '€', GBPUSD: '£', USDJPY: '¥', AUDUSD: 'A$', USDCAD: 'C$', NZDUSD: 'N$', USDCHF: '₣' }[symbol] || '$';

  const loadAnalysis = useCallback(async () => {
    setLoading(true);
    let livePrice = null;
    try {
      const s = await SettingsService.get();
      if (s?.oanda_connected) {
        const p = await OandaService.getPricing(symbol);
        if (p?.mid) { livePrice = p.mid; setLive({ bid: p.bid, ask: p.ask, mid: p.mid, time: p.time }); }
      }
    } catch {}
    try { setAnalysis(await MarketDataService.getFullAnalysis(symbol, { livePrice })); } catch { setAnalysis(null); }
    setLoading(false);
  }, [symbol]);

  const loadChart = useCallback(async () => {
    setChartLoading(true);
    let data = null;
    try {
      if (settings?.oanda_connected) {
        const gran = TF_TO_GRAN[tf] || 'M1';
        const candles = await OandaService.getCandles(symbol, gran, 60);
        if (candles?.length) data = { data_available: true, candles, timeframe: tf };
      }
    } catch {}
    if (!data) { try { data = await MarketDataService.getChart(symbol, tf); } catch { data = null; } }
    setChart(data);
    setChartLoading(false);
  }, [symbol, tf, settings]);

  useEffect(() => { loadAnalysis(); }, [loadAnalysis]);
  useEffect(() => { loadChart(); }, [loadChart]);
  useEffect(() => { NewsService.getForSymbol(symbol).then(n => setNews(n?.headlines || [])).catch(() => {}); }, [symbol]);
  useEffect(() => { SettingsService.get().then(setSettings).catch(() => {}); }, []);
  useEffect(() => {
    if (!settings?.oanda_connected) { setLive(null); return; }
    let alive = true;
    const tick = async () => {
      try { const p = await OandaService.getPricing(symbol); if (alive && p?.mid) setLive({ bid: p.bid, ask: p.ask, mid: p.mid, time: p.time }); }
      catch { if (alive) setLive(null); }
    };
    tick();
    const timer = setInterval(tick, 15000);
    return () => { alive = false; clearInterval(timer); };
  }, [symbol, settings]);

  const snap = analysis?.snapshot;
  const fmt = (n) => n != null ? Number(n).toLocaleString(undefined, { maximumFractionDigits: meta.decimals }) : '—';

  function refresh() {
    clearCache(`full_${symbol}`); clearCache(`chart_${symbol}_${tf}`); clearCache(`news_${symbol}`);
    loadAnalysis(); loadChart();
  }

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-card/60 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold', gold ? 'bg-gold/15 text-gold' : 'bg-chart-4/15 text-chart-4')}>{baseSym}</div>
              <div>
                <h1 className="text-xl font-display font-semibold">{symbol}</h1>
                <div className="text-xs text-muted-foreground">{meta.name}</div>
              </div>
            </div>
            {loading && !live ? (
              <div className="h-10 w-48 rounded-md bg-muted animate-pulse mt-2" />
            ) : live?.mid ? (
              <div className="mt-1">
                <div className="flex items-end gap-3">
                  <div className="text-4xl font-display font-semibold tabular-nums tracking-tight">{fmt(live.mid)}</div>
                  <div className="flex items-center gap-1.5 text-xs text-bullish pb-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-bullish animate-pulse" /> Live · OANDA
                  </div>
                  {analysis?.data_available && (
                    <div className={cn('flex items-center gap-1 text-sm font-medium pb-1.5', (snap?.daily_change || 0) >= 0 ? 'text-bullish' : 'text-bearish')}>
                      {(snap?.daily_change || 0) >= 0 ? '+' : ''}{snap?.daily_change?.toFixed(meta.decimals)} ({(snap?.daily_change_pct || 0) >= 0 ? '+' : ''}{snap?.daily_change_pct?.toFixed(2)}%)
                    </div>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">Bid {fmt(live.bid)} · Ask {fmt(live.ask)}</div>
              </div>
            ) : !analysis?.data_available ? (
              <div className="text-sm text-muted-foreground mt-2">Live market data is unavailable. Connect OANDA in Settings for real-time prices.</div>
            ) : (
              <div className="flex items-end gap-3 mt-1">
                <div className="text-4xl font-display font-semibold tabular-nums tracking-tight">{fmt(snap?.current_price)}</div>
                <div className={cn('flex items-center gap-1 text-sm font-medium pb-1.5', (snap?.daily_change || 0) >= 0 ? 'text-bullish' : 'text-bearish')}>
                  {(snap?.daily_change || 0) >= 0 ? '+' : ''}{snap?.daily_change?.toFixed(meta.decimals)} ({(snap?.daily_change_pct || 0) >= 0 ? '+' : ''}{snap?.daily_change_pct?.toFixed(2)}%)
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <button onClick={refresh} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <div className="flex items-center gap-2">
              <SignalBadge signal={snap?.signal} />
              <span className="text-xs text-muted-foreground">Session: <span className="text-foreground">{snap?.session || '—'}</span></span>
            </div>
            <span className="text-xs text-muted-foreground">Setup Quality: <span className="text-gold font-semibold">{analysis?.setup?.quality_grade || '—'}</span></span>
            {analysis?.setup && (analysis.setup.direction === 'BUY' || analysis.setup.direction === 'SELL') && (
              <button onClick={() => setTradeOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium">
                <ShieldCheck className="w-3.5 h-3.5" /> Place Paper Trade
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      <SectionCard title="Price Chart" icon={BarChart3}
        action={
          <div className="flex gap-1">
            {TIMEFRAMES.map((t) => (
              <button key={t} onClick={() => setTf(t)} className={cn('px-2.5 py-1 rounded-md text-xs font-medium transition-colors', tf === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>{t}</button>
            ))}
          </div>
        }>
        <PriceChart candles={chart?.candles} support={snap?.support} resistance={snap?.resistance} gold={gold} loading={chartLoading} />
        {!chartLoading && chart && !chart.data_available && <div className="text-xs text-muted-foreground mt-3 text-center">Chart data sourced via AI web search — approximate, for illustration.</div>}
      </SectionCard>

      {/* Levels + Structure */}
      <div className="grid lg:grid-cols-3 gap-5">
        <SectionCard title="Key Levels" icon={Activity} className="lg:col-span-1">
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="Support" value={fmt(snap?.support)} tone="bullish" />
            <StatTile label="Resistance" value={fmt(snap?.resistance)} tone="bearish" />
            <StatTile label="Today High" value={fmt(snap?.today_high)} />
            <StatTile label="Today Low" value={fmt(snap?.today_low)} />
            <StatTile label="Prev High" value={fmt(snap?.prev_day_high)} />
            <StatTile label="Prev Low" value={fmt(snap?.prev_day_low)} />
          </div>
        </SectionCard>
        <div className="lg:col-span-2"><MarketStructureCard structure={analysis?.market_structure} /></div>
      </div>

      <MultiTimeframeCard mtf={analysis?.multi_timeframe} />

      {/* Indicators */}
      <SectionCard title="Technical Indicators" icon={Activity}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <StatTile label="EMA 20" value={fmt(analysis?.indicators?.ema20)} />
          <StatTile label="EMA 50" value={fmt(analysis?.indicators?.ema50)} />
          <StatTile label="EMA 100" value={fmt(analysis?.indicators?.ema100)} />
          <StatTile label="EMA 200" value={fmt(analysis?.indicators?.ema200)} />
          <StatTile label="RSI" value={analysis?.indicators?.rsi?.toFixed(1)} tone={analysis?.indicators?.rsi >= 70 ? 'bearish' : analysis?.indicators?.rsi <= 30 ? 'bullish' : undefined} />
          <StatTile label="MACD" value={analysis?.indicators?.macd} />
          <StatTile label="ATR" value={fmt(analysis?.indicators?.atr)} />
          <StatTile label="VWAP" value={fmt(analysis?.indicators?.vwap)} />
        </div>
        {analysis?.indicators?.volume_note && <p className="text-xs text-muted-foreground mt-3">{analysis.indicators.volume_note}</p>}
        <p className="text-[11px] text-muted-foreground mt-3">Indicators are supporting information only — never used as standalone signals.</p>
      </SectionCard>

      {/* Setup + Quality */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2"><SetupCard symbol={symbol} setup={analysis?.setup} snapshot={snap} /></div>
        <TradeQualityScore analysis={analysis} setup={analysis?.setup} />
      </div>

      {/* Macro */}
      <SectionCard title={gold ? 'Gold-Specific Macro Analysis' : `${meta.display} Macro Analysis`} icon={Brain}>
        {analysis?.macro?.factors?.length ? (
          <div className="space-y-2.5">
            {analysis.macro.factors.map((f, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-3.5 py-3">
                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded border shrink-0 mt-0.5',
                  f.impact === 'Positive' ? 'text-bullish bg-bullish/10 border-bullish/30' : f.impact === 'Negative' ? 'text-bearish bg-bearish/10 border-bearish/30' : 'text-muted-foreground bg-muted border-border')}>{f.impact}</span>
                <div>
                  <div className="text-sm font-medium">{f.factor}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{f.note}</div>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="text-sm text-muted-foreground">Macro data unavailable.</div>}
        {(analysis?.macro?.dxy_note || analysis?.macro?.yields_note || analysis?.macro?.sentiment_note) && (
          <div className="grid sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
            {analysis.macro.dxy_note && <MacroNote label="DXY" note={analysis.macro.dxy_note} />}
            {analysis.macro.yields_note && <MacroNote label="Treasury Yields" note={analysis.macro.yields_note} />}
            {analysis.macro.sentiment_note && <MacroNote label="Risk Sentiment" note={analysis.macro.sentiment_note} />}
          </div>
        )}
      </SectionCard>

      {/* Risk + News */}
      <div className="grid lg:grid-cols-2 gap-5">
        <PositionSizeCalculator instrument={symbol} presetEntry={analysis?.setup?.entry_zone_high} presetStop={analysis?.setup?.stop_loss} />
        <SectionCard title="Relevant News" icon={Newspaper}>
          {news.length ? (
            <div className="space-y-3">
              {news.slice(0, 6).map((n, i) => (
                <div key={i} className="border-b border-border/60 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium leading-snug">{n.headline}</div>
                    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0', n.impact === 'HIGH' ? 'text-bearish bg-bearish/10' : n.impact === 'MEDIUM' ? 'text-warn bg-warn/10' : 'text-muted-foreground bg-muted')}>{n.impact}</span>
                  </div>
                  {n.summary && <p className="text-xs text-muted-foreground mt-1">{n.summary}</p>}
                  <div className="text-[11px] text-muted-foreground mt-1">{n.source} · {n.time}</div>
                </div>
              ))}
            </div>
          ) : <div className="text-sm text-muted-foreground">Loading news…</div>}
        </SectionCard>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-xl border border-border bg-card px-4 py-3">
        <ShieldCheck className="w-4 h-4 text-gold shrink-0" />
        Paper trading mode. Analysis is AI-sourced from live web data and may be approximate. Not financial advice. Capital preservation first.
      </div>

      <OrderPreviewModal open={tradeOpen} analysis={analysis} symbol={symbol} onClosed={() => setTradeOpen(false)} onPlaced={() => setTradeOpen(false)} />
    </div>
  );
}

function MacroNote({ label, note }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="text-xs text-foreground/90 leading-relaxed">{note}</div>
    </div>
  );
}