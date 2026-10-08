import React, { useMemo } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { cn } from '@/lib/utils';

function CandleShape(props) {
  const { x, y, width, height, low, high, open, close, yAxis } = props;
  if (width == null || height == null) return null;
  const cx = x + width / 2;
  const yScale = yAxis.scale;
  const yHigh = yScale(high);
  const yLow = yScale(low);
  const yOpen = yScale(open);
  const yClose = yScale(close);
  const bull = close >= open;
  const color = bull ? 'hsl(142 68% 45%)' : 'hsl(0 72% 56%)';
  const bodyTop = Math.min(yOpen, yClose);
  const bodyH = Math.max(Math.abs(yClose - yOpen), 1);
  const bodyW = Math.max(width * 0.62, 1);
  const bodyX = cx - bodyW / 2;
  return (
    <g>
      <line x1={cx} x2={cx} y1={yHigh} y2={yLow} stroke={color} strokeWidth={1} />
      <rect x={bodyX} y={bodyTop} width={bodyW} height={bodyH} fill={color} rx={1} />
    </g>
  );
}

function ChartTooltip({ active, payload, gold }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const bull = d.close >= d.open;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-xl">
      <div className="text-muted-foreground mb-1">{d.time}</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 tabular-nums">
        <span className="text-muted-foreground">O</span><span>{d.open?.toFixed(gold ? 2 : 5)}</span>
        <span className="text-muted-foreground">H</span><span className="text-bullish">{d.high?.toFixed(gold ? 2 : 5)}</span>
        <span className="text-muted-foreground">L</span><span className="text-bearish">{d.low?.toFixed(gold ? 2 : 5)}</span>
        <span className="text-muted-foreground">C</span><span className={bull ? 'text-bullish' : 'text-bearish'}>{d.close?.toFixed(gold ? 2 : 5)}</span>
      </div>
    </div>
  );
}

export default function PriceChart({ candles = [], support, resistance, gold = false, loading }) {
  const data = useMemo(() => candles.map((c) => ({ ...c })), [candles]);
  const decimals = gold ? 2 : 5;

  if (loading) {
    return <div className="h-[340px] rounded-xl bg-muted/40 animate-pulse" />;
  }
  if (!data.length) {
    return (
      <div className="h-[340px] rounded-xl border border-border bg-muted/20 flex items-center justify-center text-sm text-muted-foreground">
        Live market data is unavailable for this timeframe.
      </div>
    );
  }

  return (
    <div className="h-[340px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="hsl(222 9% 17%)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="time" tick={{ fill: 'hsl(215 14% 58%)', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis domain={['auto', 'auto']} tick={{ fill: 'hsl(215 14% 58%)', fontSize: 10 }} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => Number(v).toFixed(decimals)} />
          <Tooltip content={<ChartTooltip gold={gold} />} />
          {support != null && <ReferenceLine y={support} stroke="hsl(142 68% 45%)" strokeDasharray="4 4" strokeOpacity={0.5} />}
          {resistance != null && <ReferenceLine y={resistance} stroke="hsl(0 72% 56%)" strokeDasharray="4 4" strokeOpacity={0.5} />}
          <Bar dataKey="high" fill="transparent" shape={<CandleShape gold={gold} />} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}