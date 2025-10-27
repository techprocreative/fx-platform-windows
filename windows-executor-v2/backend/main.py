from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import api_router
from config import get_settings
from core import mt5_client, pusher_client, pusher_emitter, strategy_executor
from core.platform_api import WebPlatformAPI
from core.platform_config import PlatformConfigService
from database import Base, engine
from models import ExecutorCommand, StrategyConfig
from utils.logger import configure_logging


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: D401
    """Configure services on startup and close gracefully on shutdown."""

    settings = get_settings()
    configure_logging("DEBUG" if settings.debug else "INFO")

    Base.metadata.create_all(bind=engine)

    # Fetch Pusher configuration from platform if credentials are provided
    if settings.api_key and not settings.pusher_key:
        logger = logging.getLogger(__name__)
        logger.info("🔄 Fetching Pusher configuration from platform...")
        config_service = PlatformConfigService()
        config_fetched = await config_service.fetch_and_apply()
        if config_fetched:
            logger.info("✅ Pusher configuration fetched successfully")
        else:
            logger.warning("⚠️ Failed to fetch Pusher config, will use manual configuration if provided")

    # Try to initialize MT5 (non-fatal if fails)
    try:
        if settings.mt5_terminal_path:
            mt5_initialized = mt5_client.initialize(settings.mt5_terminal_path)
        else:
            mt5_initialized = mt5_client.initialize()
        
        if not mt5_initialized:
            logging.getLogger(__name__).warning(
                "⚠️  MT5 initialization failed. "
                "Trading features will be limited. "
                "Please install MT5 and restart."
            )
    except Exception as exc:
        logging.getLogger(__name__).warning(
            f"⚠️  MT5 initialization error: {exc}. "
            "Backend will continue without MT5 integration."
        )

    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()
    command_queue: asyncio.Queue = asyncio.Queue()

    pusher_client.register_loop(loop)
    pusher_client.attach_queue(command_queue)
    
    # Sync active strategies from platform on startup
    await _sync_active_strategies()

    tasks = [
        asyncio.create_task(_monitor_loop(stop_event)),
        asyncio.create_task(_command_loop(stop_event, command_queue)),
    ]

    if settings.pusher_key and settings.pusher_cluster:
        channel = settings.pusher_channel or _default_channel(settings.executor_id)
        try:
            pusher_client.connect(settings.pusher_key, settings.pusher_cluster, channel)
            pusher_client.subscribe("command-received", None)
        except Exception as exc:  # pragma: no cover - external dependency
            logging.getLogger(__name__).warning("Failed to connect to Pusher: %s", exc)
        
        # Initialize Pusher emitter for sending events
        if settings.pusher_app_id and settings.pusher_secret:
            try:
                pusher_emitter.initialize(
                    settings.pusher_app_id,
                    settings.pusher_key,
                    settings.pusher_secret,
                    settings.pusher_cluster,
                    settings.executor_id or "default"
                )
                # Pass emitter to mt5_client
                mt5_client.pusher_emitter = pusher_emitter
            except Exception as exc:
                logging.getLogger(__name__).warning("Failed to initialize Pusher emitter: %s", exc)

    try:
        yield
    finally:
        stop_event.set()
        await asyncio.gather(*tasks, return_exceptions=True)
        mt5_client.shutdown()
        pusher_client.disconnect()


app = FastAPI(
    title="Windows Executor V2 Backend",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS Configuration - Secure for production
settings = get_settings()
allowed_origins = [settings.platform_api_url]  # https://fx.nusanexus.com
if settings.debug:
    allowed_origins.append("http://localhost:3000")  # Development only

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


async def _monitor_loop(stop_event: asyncio.Event) -> None:
    settings = get_settings()
    interval = max(settings.heartbeat_interval_seconds, 5)
    while not stop_event.is_set():
        await strategy_executor.run_cycle()
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=interval)
        except asyncio.TimeoutError:
            continue


async def _command_loop(stop_event: asyncio.Event, queue: asyncio.Queue) -> None:
    logger = logging.getLogger(__name__)
    while not stop_event.is_set():
        try:
            payload = await asyncio.wait_for(queue.get(), timeout=1.0)
        except asyncio.TimeoutError:
            continue
        try:
            command = ExecutorCommand.model_validate(payload)
        except Exception as exc:  # pragma: no cover - validation failures
            logger.debug("Invalid command payload: %s", exc)
            continue
        await strategy_executor.process_command(command)


def _default_channel(executor_id: Optional[str]) -> str:
    suffix = executor_id or "default"
    return f"private-executor-{suffix}"


async def _sync_active_strategies() -> None:
    """Sync active strategies from platform on startup."""
    logger = logging.getLogger(__name__)
    logger.info("🔄 Syncing active strategies from platform...")
    
    try:
        platform_api = WebPlatformAPI()
        
        # Fetch strategies assigned to this executor
        strategies = await platform_api.fetch_active_strategies()
        
        if not strategies:
            logger.info("📋 No active strategies assigned to this executor")
            return
        
        logger.info(f"✅ Found {len(strategies)} active strategies assigned to executor")
        
        # Start each assigned strategy
        started_count = 0
        failed_count = 0
        
        for strategy_data in strategies:
            try:
                # Convert platform format to executor format
                strategy_config = StrategyConfig(
                    id=strategy_data.get("id"),
                    name=strategy_data.get("name"),
                    symbol=strategy_data.get("symbol"),
                    timeframe=strategy_data.get("timeframe"),
                    positionSize=strategy_data.get("positionSize", 0.01),
                    entryConditions=strategy_data.get("entryConditions", []),
                    entryLogic=strategy_data.get("entryLogic", "AND"),
                    stopLoss=strategy_data.get("stopLoss", {"type": "pips", "value": 50}),
                    takeProfit=strategy_data.get("takeProfit", {"type": "pips", "value": 100}),
                    trailingStop=strategy_data.get("trailingStop"),
                    riskManagement=strategy_data.get("riskManagement", {
                        "maxRiskPerTrade": 1,
                        "maxOpenPositions": 1,
                        "maxDailyLoss": 5
                    }),
                    filters=strategy_data.get("filters", {}),
                )
                
                # Start the strategy
                status = await strategy_executor.start_strategy(strategy_config)
                if status:
                    started_count += 1
                    logger.info(f"✅ Started strategy: {strategy_config.name} ({strategy_config.id})")
                else:
                    failed_count += 1
                    logger.warning(f"⚠️ Failed to start strategy: {strategy_config.name}")
                    
            except Exception as exc:
                failed_count += 1
                logger.error(f"❌ Error starting strategy {strategy_data.get('name')}: {exc}")
        
        # Summary
        if started_count > 0:
            logger.info(f"🎯 Successfully started {started_count} strategies")
        if failed_count > 0:
            logger.warning(f"⚠️ Failed to start {failed_count} strategies")
            
    except Exception as exc:
        logger.error(f"❌ Failed to sync strategies from platform: {exc}")


__all__ = ["app"]
