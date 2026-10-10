import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ExecutionLogTable({ logs }) {
  if (!logs || logs.length === 0) {
    return <div className="text-xs text-muted-foreground py-6 text-center">No broker activity yet.</div>;
  }
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground border-b border-border">
            <th className="py-2 pr-3 font-medium">When</th>
            <th className="py-2 pr-3 font-medium">Action</th>
            <th className="py-2 pr-3 font-medium">Env</th>
            <th className="py-2 pr-3 font-medium">Status</th>
            <th className="py-2 pr-3 font-medium">Detail</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-border/50">
              <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{log.created_date ? new Date(log.created_date).toLocaleString() : '—'}</td>
              <td className="py-2 pr-3 font-medium">{log.action}</td>
              <td className="py-2 pr-3"><span className={cn('text-[10px] px-1.5 py-0.5 rounded uppercase', log.environment === 'live' ? 'bg-bearish/15 text-bearish' : 'bg-muted text-muted-foreground')}>{log.environment || 'demo'}</span></td>
              <td className="py-2 pr-3">
                {log.status === 'success'
                  ? <span className="flex items-center gap-1 text-bullish"><CheckCircle2 className="w-3.5 h-3.5" /> ok</span>
                  : <span className="flex items-center gap-1 text-bearish"><XCircle className="w-3.5 h-3.5" /> error</span>}
              </td>
              <td className="py-2 pr-3 text-muted-foreground max-w-xs truncate">{log.error || log.response_summary || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}