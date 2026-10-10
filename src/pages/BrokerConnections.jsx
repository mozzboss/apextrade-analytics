import React, { useState, useCallback } from 'react';
import { Plug, Plus, AlertTriangle, ShieldCheck, Activity, X } from 'lucide-react';
import { BrokerConnectionService } from '@/services/brokerConnectionService';
import SectionCard from '@/components/SectionCard';
import AddBrokerConnectionForm from '@/components/AddBrokerConnectionForm';
import BrokerConnectionCard from '@/components/BrokerConnectionCard';
import ExecutionLogTable from '@/components/ExecutionLogTable';

export default function BrokerConnections() {
  const [connections, setConnections] = useState([]);
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState(null);
  const [summaries, setSummaries] = useState({});
  const [loadingSummary, setLoadingSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [conns, lg, st] = await Promise.all([
        BrokerConnectionService.list().catch(() => []),
        BrokerConnectionService.listLogs().catch(() => []),
        BrokerConnectionService.status().catch(() => null),
      ]);
      setConnections(conns);
      setLogs(lg);
      setStatus(st);
      conns.filter((c) => c.status === 'connected').forEach(async (c) => {
        try {
          const res = await BrokerConnectionService.getAccountSummary(c.id);
          setSummaries((s) => ({ ...s, [c.id]: res }));
        } catch (e) {
          setSummaries((s) => ({ ...s, [c.id]: { error: e.message } }));
        }
      });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { loadAll(); }, [loadAll]);

  async function refreshSummary(conn) {
    setLoadingSummary((s) => ({ ...s, [conn.id]: true }));
    try {
      const res = await BrokerConnectionService.getAccountSummary(conn.id);
      setSummaries((s) => ({ ...s, [conn.id]: res }));
    } catch (e) {
      setSummaries((s) => ({ ...s, [conn.id]: { error: e.message } }));
    } finally {
      setLoadingSummary((s) => ({ ...s, [conn.id]: false }));
      setConnections(await BrokerConnectionService.list().catch(() => []));
    }
  }

  async function reloadLogs() { setLogs(await BrokerConnectionService.listLogs().catch(() => [])); }

  async function handle(action, conn, ...args) {
    await action(conn.id, ...args);
    await loadAll();
    await reloadLogs();
  }

  const encKeyMissing = status && !status.encKeyConfigured;
  const serviceMissing = status && !status.serviceConfigured;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-display font-semibold flex items-center gap-2"><Plug className="w-5 h-5 text-gold" /> Broker Connections</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Connect MetaTrader 5 (demo first). Credentials are encrypted server-side and never sent to the browser.</p>
        </div>
        <button onClick={() => setShowAdd((v) => !v)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
          {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {showAdd ? 'Close' : 'Add Connection'}
        </button>
      </div>

      {(encKeyMissing || serviceMissing) && (
        <div className="rounded-xl border border-warn/30 bg-warn/5 px-4 py-3 text-xs space-y-1">
          <div className="flex items-center gap-1.5 text-warn font-medium"><AlertTriangle className="w-4 h-4" /> Setup required</div>
          {encKeyMissing && <div>• <b>BROKER_ENC_KEY</b> secret is not set — connections cannot be saved. Generate one with <code className="bg-muted px-1 rounded">openssl rand -hex 32</code> and set it in Secrets.</div>}
          {serviceMissing && <div>• <b>MT5_SERVICE_URL</b> is not set — deploy the MT5 bridge service (see <code className="bg-muted px-1 rounded">base44/functions/mt5-broker/mt5_service.py</code>) on a Windows VPS and point this secret at its URL.</div>}
        </div>
      )}

      {showAdd && <AddBrokerConnectionForm onSaved={() => { setShowAdd(false); loadAll().then(reloadLogs); }} onCancel={() => setShowAdd(false)} />}

      <SectionCard title="Connections" icon={ShieldCheck}>
        {loading ? (
          <div className="h-32 rounded-xl bg-muted/40 animate-pulse" />
        ) : connections.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">No broker connections yet. Click <b>Add Connection</b> to connect MetaTrader 5.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {connections.map((conn) => (
              <BrokerConnectionCard
                key={conn.id}
                conn={conn}
                summary={summaries[conn.id]}
                loadingSummary={loadingSummary[conn.id]}
                onRefresh={refreshSummary}
                onEmergencyStop={(c, v) => handle(BrokerConnectionService.setEmergencyStop, c, v)}
                onDisconnect={(c) => handle(BrokerConnectionService.disconnect, c)}
                onCloseAll={(c) => handle(BrokerConnectionService.closeAllPositions, c)}
                onDelete={async (c) => { await BrokerConnectionService.remove(c.id); loadAll().then(reloadLogs); }}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Execution & Activity Log" icon={Activity}>
        <ExecutionLogTable logs={logs} />
      </SectionCard>
    </div>
  );
}