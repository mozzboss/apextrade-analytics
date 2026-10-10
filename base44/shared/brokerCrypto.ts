// AES-GCM encryption for broker credentials at rest.
// The key lives in the BROKER_ENC_KEY secret (32 bytes = 64 hex chars).
// Credentials are encrypted here, server-side, and only ever decrypted inside
// backend functions — the browser never receives plaintext credentials.

import { secrets } from "base44:runtime";

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64encode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function hexDecode(hex: string): Uint8Array {
  const clean = hex.trim();
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  return out;
}

async function getKey(): Promise<CryptoKey> {
  const raw = (secrets.get("BROKER_ENC_KEY") || "").trim();
  if (!raw) throw new Error("Encryption key is not configured. Set the BROKER_ENC_KEY secret (openssl rand -hex 32).");
  const bytes = hexDecode(raw);
  if (bytes.length !== 32) throw new Error("BROKER_ENC_KEY must be 32 bytes (64 hex characters).");
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptString(plain: string): Promise<string> {
  if (!plain) return "";
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain)));
  const combined = new Uint8Array(iv.length + ct.length);
  combined.set(iv, 0);
  combined.set(ct, iv.length);
  return b64encode(combined);
}

export async function decryptString(blob: string): Promise<string> {
  if (!blob) return "";
  const key = await getKey();
  const combined = b64decode(blob);
  const iv = combined.slice(0, 12);
  const ct = combined.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return dec.decode(pt);
}