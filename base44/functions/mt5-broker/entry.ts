// MT5 broker bridge.
//
// Base44 backend functions cannot run the MetaTrader5 Python package (it needs
// Windows + the MT5 terminal), so this function proxies to an external Python
// service (see mt5_service.py) deployed on a Windows VPS. Credentials are
// decrypted here server-side and forwarded to the bridge over HTTPS; they are
// never returned to the browser and never logged.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.53";
import { secrets } from "base44:runtime";
import { encryptString, decryptString } from "../../shared/brokerCrypto.ts";
import { getConnection, audit, safeJson } from "../../shared/brokerUtils.ts";

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

function serviceUrl(): string {
  const url = (secrets.get("MT5_SERVICE_URL") || "").trim();
  if (!url) throw new Error("MT5 external service is not configured. Set the MT5_SERVICE_URL secret to your VPS bridge URL.");
  return url.replace(/\/$/, "");
}

function serviceKey(): string {
  return (secrets.get("MT5_SERVICE_KEY") || "").trim();
}

async function mt5Call(path: string, creds: any, extra: any = {}): Promise<any> {
  const url = `${serviceUrl()}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Service-Key": serviceKey() },
    body: JSON.stringify({ ...creds, ...extra }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || data?.error || data?.message || `MT5 bridge HTTP ${res.status}`);
  return data;
}

function envOf(body: any): string {
  return body?.environment === "live" ? "live" : "demo";
}

export default async function (req: Request): Promise<Response> {
  let base44: any;
  let body: any = {};
  try {
    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
    body = await req.json().catch(() => ({}));
    let result: any;

    switch (body?.action) {
      case "status": {
        result = {
          serviceConfigured: Boolean((secrets.get("MT5_SERVICE_URL") || "").trim()),
          serviceKeyConfigured: Boolean((secrets.get("MT5_SERVICE_KEY") || "").trim()),
          encKeyConfigured: Boolean((secrets.get("BROKER_ENC_KEY") || "").trim()),
        };
        break;
      }

      case "testConnection": {
        const creds = {
          login: Number(body.login),
          password: String(body.password || ""),
          server: String(body.server || ""),
          environment: envOf(body),
        };
        if (!creds.login || !creds.password || !creds.server) throw new Error("Login, password, and server are required");
        result = await mt5Call("/test", creds);
        audit(base44, { provider: "mt5", environment: envOf(body), action: "testConnection", status: "success", response_summary: safeJson(result?.account) });
        break;
      }

      case "saveConnection": {
        const password = String(body.password || "");
        const login = Number(body.login);
        if (!login || !password || !body.server) throw new Error("Login, password, and server are required");
        const environment = envOf(body);
        const encrypted = await encryptString(password);
        const conn = await base44.entities.BrokerConnection.create({
          provider: "mt5",
          environment,
          label: body.label || `MT5 ${login}`,
          server: String(body.server),
          account_id: String(login),
          account_name: body.accountName || undefined,
          account_currency: body.currency || undefined,
          encrypted_credentials: encrypted,
          status: "connected",
          live_authorized: false,
          emergency_stop: false,
          risk_per_trade: body.risk_per_trade,
          max_daily_loss: body.max_daily_loss,
          max_exposure: body.max_exposure,
          max_open_positions: body.max_open_positions,
          default_sl_pips: body.default_sl_pips,
          default_tp_pips: body.default_tp_pips,
          last_synced_at: new Date().toISOString(),
        });
        audit(base44, { connection_id: conn.id, provider: "mt5", environment, action: "saveConnection", status: "success", response_summary: `connection ${conn.id}` });
        result = {
          id: conn.id, provider: conn.provider, environment: conn.environment, label: conn.label,
          server: conn.server, account_id: conn.account_id, status: conn.status,
        };
        break;
      }

      case "getAccountSummary": {
        const conn = await getConnection(base44, body.connectionId);
        const password = await decryptString(conn.encrypted_credentials || "");
        const creds = { login: Number(conn.account_id), password, server: conn.server, environment: conn.environment };
        try {
          result = await mt5Call("/account-summary", creds);
          await base44.entities.BrokerConnection.update(conn.id, {
            status: "connected",
            last_error: null,
            last_synced_at: new Date().toISOString(),
            account_name: result?.account?.name,
            account_currency: result?.account?.currency,
          });
          audit(base44, { connection_id: conn.id, provider: "mt5", environment: conn.environment, action: "getAccountSummary", status: "success", response_summary: safeJson(result?.account) });
        } catch (e) {
          await base44.entities.BrokerConnection.update(conn.id, { status: "error", last_error: message(e) }).catch(() => {});
          audit(base44, { connection_id: conn.id, provider: "mt5", environment: conn.environment, action: "getAccountSummary", status: "error", error: message(e) });
          throw e;
        }
        break;
      }

      case "getOpenPositions": {
        const conn = await getConnection(base44, body.connectionId);
        const password = await decryptString(conn.encrypted_credentials || "");
        const creds = { login: Number(conn.account_id), password, server: conn.server, environment: conn.environment };
        result = await mt5Call("/positions", creds);
        audit(base44, { connection_id: conn.id, provider: "mt5", environment: conn.environment, action: "getOpenPositions", status: "success", response_summary: `positions ${(result?.positions || []).length}` });
        break;
      }

      case "closeAllPositions": {
        if (!body.confirm) throw new Error("Confirmation required to close all positions");
        const conn = await getConnection(base44, body.connectionId);
        const password = await decryptString(conn.encrypted_credentials || "");
        const creds = { login: Number(conn.account_id), password, server: conn.server, environment: conn.environment };
        result = await mt5Call("/close-all", creds);
        audit(base44, { connection_id: conn.id, provider: "mt5", environment: conn.environment, action: "closeAllPositions", status: "success", response_summary: safeJson(result) });
        break;
      }

      case "setEmergencyStop": {
        const conn = await getConnection(base44, body.connectionId);
        await base44.entities.BrokerConnection.update(conn.id, { emergency_stop: Boolean(body.emergency_stop) });
        audit(base44, { connection_id: conn.id, provider: "mt5", environment: conn.environment, action: "setEmergencyStop", status: "success", response_summary: `emergency_stop=${Boolean(body.emergency_stop)}` });
        result = { ok: true, emergency_stop: Boolean(body.emergency_stop) };
        break;
      }

      case "disconnect": {
        const conn = await getConnection(base44, body.connectionId);
        await base44.entities.BrokerConnection.update(conn.id, { status: "disconnected" });
        audit(base44, { connection_id: conn.id, provider: "mt5", environment: conn.environment, action: "disconnect", status: "success" });
        result = { ok: true };
        break;
      }

      default:
        return Response.json({ error: "Unsupported MT5 action" }, { status: 400 });
    }

    return Response.json(result);
  } catch (error) {
    const msg = message(error);
    if (base44) {
      audit(base44, {
        connection_id: body?.connectionId,
        provider: "mt5",
        environment: envOf(body),
        action: body?.action || "unknown",
        status: "error",
        error: msg,
      });
    }
    return Response.json({ error: msg }, { status: 400 });
  }
}