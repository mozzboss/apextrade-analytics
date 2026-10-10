"""
MT5 Bridge Service — external FastAPI service to deploy on a Windows VPS.

Base44 backend functions cannot run the MetaTrader5 Python package (it requires
Windows + the MT5 terminal), so the Base44 `mt5-broker` function proxies to
THIS service. Deploy it on a Windows machine/VPS that has MetaTrader 5 installed
and logged in at least once.

Setup
-----
1. Install Python 3.10+ (python.org) and, in a terminal:
       pip install fastapi "uvicorn[standard]" MetaTrader5 pydantic
2. Set environment variables (PowerShell) — use the SAME service-key value you
   stored as a secret in Base44, and the path to your MT5 terminal exe:
       $env:MT5_SERVICE_KEY = "<your service key>"
       $env:MT5_TERMINAL_PATH = "C:\\Program Files\\MetaTrader 5\\terminal64.exe"
3. Run:
       uvicorn mt5_service:app --host 0.0.0.0 --port 8000
4. Expose it over HTTPS (a reverse proxy such as Caddy/Nginx, or a Cloudflare
   tunnel). Point the Base44 service-URL secret at the public URL, e.g.
       https://your-vps.example.com

Security
--------
- Every request must send header `X-Service-Key` matching the service key.
- The service keeps a single MT5 terminal session and serializes MT5 calls
  with a lock (MetaTrader5 is not thread-safe).
- Credentials arrive per request from the Base44 function (which decrypts them
  server-side). They are never logged.

This demo build exposes: /health, /test, /account-summary, /positions and
/close-all. Order placement is intentionally not included yet.
"""

import os
import threading
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

import MetaTrader5 as mt5

SERVICE_KEY = os.getenv("MT5_SERVICE_KEY", "")
TERMINAL_PATH = os.getenv("MT5_TERMINAL_PATH", "")

app = FastAPI(title="ApexTrade MT5 Bridge")
_lock = threading.Lock()
_session = {"login": None, "server": None}


class Creds(BaseModel):
    login: int
    password: str
    server: str
    environment: Optional[str] = "demo"


def check_key(x_service_key: Optional[str]) -> None:
    if not SERVICE_KEY or x_service_key != SERVICE_KEY:
        raise HTTPException(status_code=401, detail="Invalid service key")


def ensure_session(creds: Creds) -> None:
    same = _session["login"] == creds.login and _session["server"] == creds.server
    if same and mt5.terminal_is_connected():
        return
    mt5.shutdown()
    init_kwargs = {}
    if TERMINAL_PATH:
        init_kwargs["path"] = TERMINAL_PATH
    if not mt5.initialize(**init_kwargs):
        raise RuntimeError(f"initialize failed: {mt5.last_error()}")
    if not mt5.login(creds.login, password=creds.password, server=creds.server):
        mt5.shutdown()
        _session["login"] = None
        _session["server"] = None
        raise RuntimeError(f"login failed: {mt5.last_error()}")
    _session["login"] = creds.login
    _session["server"] = creds.server


def account_info_dict() -> dict:
    info = mt5.account_info()
    if info is None:
        raise RuntimeError(f"account_info failed: {mt5.last_error()}")
    return {
        "login": info.login,
        "name": info.name,
        "server": info.server,
        "currency": info.currency,
        "leverage": info.leverage,
        "balance": info.balance,
        "equity": info.equity,
        "margin": info.margin,
        "margin_free": info.margin_free,
        "margin_level": info.margin_level,
        "profit": info.profit,
    }


def positions_list() -> list:
    positions = mt5.positions_get() or []
    out = []
    for p in positions:
        out.append({
            "ticket": p.ticket,
            "symbol": p.symbol,
            "volume": p.volume,
            "type": "buy" if p.type == mt5.POSITION_TYPE_BUY else "sell",
            "price_open": p.price_open,
            "sl": p.sl,
            "tp": p.tp,
            "profit": p.profit,
            "swap": p.swap,
            "comment": p.comment,
        })
    return out


@app.get("/health")
def health(x_service_key: Optional[str] = Header(None)):
    check_key(x_service_key)
    return {"ok": True, "connected": mt5.terminal_is_connected()}


@app.post("/test")
def test(creds: Creds, x_service_key: Optional[str] = Header(None)):
    check_key(x_service_key)
    with _lock:
        try:
            ensure_session(creds)
            return {"ok": True, "account": account_info_dict()}
        except Exception as e:
            mt5.shutdown()
            _session["login"] = None
            _session["server"] = None
            raise HTTPException(status_code=400, detail=str(e))


@app.post("/account-summary")
def account_summary(creds: Creds, x_service_key: Optional[str] = Header(None)):
    check_key(x_service_key)
    with _lock:
        try:
            ensure_session(creds)
            positions = positions_list()
            return {"ok": True, "account": account_info_dict(), "openPositions": len(positions)}
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))


@app.post("/positions")
def positions(creds: Creds, x_service_key: Optional[str] = Header(None)):
    check_key(x_service_key)
    with _lock:
        try:
            ensure_session(creds)
            return {"ok": True, "positions": positions_list()}
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))


@app.post("/close-all")
def close_all(creds: Creds, x_service_key: Optional[str] = Header(None)):
    check_key(x_service_key)
    with _lock:
        try:
            ensure_session(creds)
            positions = mt5.positions_get() or []
            closed = 0
            errors = []
            for p in positions:
                tick = mt5.symbol_info_tick(p.symbol)
                if tick is None:
                    errors.append(f"no tick for {p.symbol}")
                    continue
                is_buy = p.type == mt5.POSITION_TYPE_BUY
                request = {
                    "action": mt5.TRADE_ACTION_DEAL,
                    "symbol": p.symbol,
                    "volume": p.volume,
                    "type": mt5.ORDER_TYPE_SELL if is_buy else mt5.ORDER_TYPE_BUY,
                    "position": p.ticket,
                    "price": tick.bid if is_buy else tick.ask,
                    "deviation": 20,
                    "magic": 234000,
                    "comment": "apex close all",
                    "type_filling": mt5.ORDER_FILLING_IOC,
                }
                result = mt5.order_send(request)
                if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
                    err = mt5.last_error() if result is None else result.comment
                    errors.append(f"{p.symbol} ticket {p.ticket}: {err}")
                else:
                    closed += 1
            return {"ok": True, "closed": closed, "requested": len(positions), "errors": errors}
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))