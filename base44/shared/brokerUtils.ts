// Shared helpers for broker backend functions: load a connection record and
// write an audit entry to the ExecutionLog entity after the response is sent.

import { waitUntil } from "base44:runtime";

export async function getConnection(base44: any, id: string): Promise<any> {
  if (!id) throw new Error("Connection id is required");
  const conn = await base44.entities.BrokerConnection.get(id);
  if (!conn) throw new Error("Broker connection not found");
  return conn;
}

export function safeJson(data: any): string {
  try {
    return JSON.stringify(data).slice(0, 500);
  } catch {
    return "";
  }
}

export function audit(base44: any, entry: {
  connection_id?: string;
  provider: string;
  environment: string;
  action: string;
  status: "success" | "error";
  request_summary?: string;
  response_summary?: string;
  error?: string;
  idempotency_key?: string;
}): void {
  const payload: any = {
    connection_id: entry.connection_id || undefined,
    provider: entry.provider,
    environment: entry.environment,
    action: entry.action,
    status: entry.status,
    request_summary: entry.request_summary ? String(entry.request_summary).slice(0, 500) : undefined,
    response_summary: entry.response_summary ? String(entry.response_summary).slice(0, 500) : undefined,
    error: entry.error ? String(entry.error).slice(0, 500) : undefined,
    idempotency_key: entry.idempotency_key,
  };
  waitUntil(base44.entities.ExecutionLog.create(payload).catch(() => {}));
}