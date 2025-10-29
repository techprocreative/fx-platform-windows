from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import asyncio
import os
import logging
from logging.handlers import RotatingFileHandler

# Local modules (skeletons)
from core.mt5_client import MT5Client
from core.pusher_client import PusherClient
from ml.engine import MLEngine
from ai.supervisor import Supervisor, Decision
from core.strategy_executor import StrategyExecutor
from utils.paths import get_logs_dir
from utils.config_store import load_config, save_config, get_stored_secret


class BootstrapRequest(BaseModel):
    api_key: str
    api_secret: str


class BootstrapResponse(BaseModel):
    executor_id: str
    platform_url: str
    pusher_key: str
    pusher_cluster: str
    heartbeat_interval: int


app = FastAPI(title="Windows Executor V2 Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


mt5 = MT5Client()
pusher_client = PusherClient()
ml_engine = MLEngine()
supervisor = Supervisor()
_strategy_executor: Optional[StrategyExecutor] = None
_cached_config: Dict[str, Any] = load_config()


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "mt5_initialized": mt5.initialized,
        "supervisor_mode": supervisor.mode,
        "config_loaded": bool(_cached_config.get("executorId")),
    }


@app.post("/bootstrap", response_model=BootstrapResponse)
async def bootstrap(req: BootstrapRequest):
    """Bootstrap using API key/secret from web platform.
    Fetch /api/executor/config to auto-configure runtime.
    """
    # Persist credentials securely (Windows Credential Manager via keyring)
    # Persist input API key temporarily in config store (secret handled separately)

    # Fetch config from platform
    import httpx
    platform_url = os.getenv("PLATFORM_URL", "https://fx.nusanexus.com")
    url = f"{platform_url}/api/executor/config"

    headers = {
        "X-API-Key": req.api_key,
        "X-API-Secret": req.api_secret,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(url, headers=headers)
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail=r.text)

        data = r.json()
        if not data.get("success"):
            raise HTTPException(status_code=500, detail="Failed to bootstrap config")

        cfg = data["config"]

    # Initialize Pusher subscription (executor private channel)
    await pusher_client.connect(
        app_key=cfg["pusherKey"],
        cluster=cfg["pusherCluster"],
        api_key=req.api_key,
        api_secret=req.api_secret,
        executor_id=cfg["executorId"],
        platform_url=cfg["platformUrl"],
    )

    # Prepare full strategy executor
    global _strategy_executor
    _strategy_executor = StrategyExecutor(mt5, cfg["platformUrl"], req.api_key, req.api_secret, cfg["executorId"])
    save_config({
        "executorId": cfg["executorId"],
        "platformUrl": cfg["platformUrl"],
        "apiKey": req.api_key,
        "pusherKey": cfg["pusherKey"],
        "pusherCluster": cfg["pusherCluster"],
        "heartbeatInterval": cfg.get("heartbeatInterval", 60),
    }, api_secret=req.api_secret)
    _cached_config.update({
        "executorId": cfg["executorId"],
        "platformUrl": cfg["platformUrl"],
        "apiKey": req.api_key,
        "pusherKey": cfg["pusherKey"],
        "pusherCluster": cfg["pusherCluster"],
        "heartbeatInterval": cfg.get("heartbeatInterval", 60),
    })

    return BootstrapResponse(
        executor_id=cfg["executorId"],
        platform_url=cfg["platformUrl"],
        pusher_key=cfg["pusherKey"],
        pusher_cluster=cfg["pusherCluster"],
        heartbeat_interval=cfg.get("heartbeatInterval", 60),
    )


@app.get("/account")
def get_account() -> Dict[str, Any]:
    if not mt5.initialized:
        # Lazy init MT5 with auto-detect
        if not mt5.initialize():
            raise HTTPException(status_code=500, detail="MT5 initialize failed")

    info = mt5.get_account_info()
    return {"success": True, "account": info}


class SupervisorEvalRequest(BaseModel):
    context: Dict[str, Any]


@app.post("/supervisor/evaluate")
async def supervisor_evaluate(req: SupervisorEvalRequest) -> Dict[str, Any]:
    decision: Decision = await supervisor.evaluate(req.context)
    return {
        "decision": {
            "action": decision.action,
            "reason": decision.reason,
            "risks": decision.risks,
            "suggestions": decision.suggestions,
            "score": decision.score,
        }
    }


class StartStrategyRequest(BaseModel):
    command: Dict[str, Any]


@app.post("/strategies/start")
async def start_strategy(req: StartStrategyRequest) -> Dict[str, Any]:
    if _strategy_executor is None:
        raise HTTPException(status_code=400, detail="Bootstrap first")
    return _strategy_executor.start(req.command)


class EvalOnceRequest(BaseModel):
    strategyId: str


@app.post("/strategies/evaluate-once")
async def evaluate_once(req: EvalOnceRequest) -> Dict[str, Any]:
    if _strategy_executor is None:
        raise HTTPException(status_code=400, detail="Bootstrap first")
    return await _strategy_executor.evaluate_once(req.strategyId)


@app.get("/config")
def get_config() -> Dict[str, Any]:
    cfg = dict(_cached_config)
    if cfg.get("executorId"):
        secret = get_stored_secret(cfg["executorId"])
        cfg["hasSecret"] = bool(secret)
    return cfg


def configure_logging() -> None:
    logs_dir = get_logs_dir()
    log_path = logs_dir / 'backend.log'
    handler = RotatingFileHandler(log_path, maxBytes=5_000_000, backupCount=3)
    formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(name)s - %(message)s')
    handler.setFormatter(formatter)
    logging.basicConfig(level=logging.INFO, handlers=[handler])


configure_logging()


@app.on_event("shutdown")
def shutdown_event():
    try:
        mt5.shutdown()
    except Exception:
        pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=int(os.getenv("PORT", 8732)))
