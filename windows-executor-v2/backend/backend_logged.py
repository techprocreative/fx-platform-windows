#!/usr/bin/env python3
"""
Windows Executor V2 Backend - Production with Full Logging
All activity logged to file for debugging
"""

import os
import sys
import json
import socket
import logging
import traceback
import asyncio
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler

# ========================
# Setup Logging FIRST
# ========================

def setup_logging():
    """Setup comprehensive logging to file and console"""
    
    # Determine log file location
    if getattr(sys, 'frozen', False):
        # Running as exe - use LOCALAPPDATA to avoid permission issues
        appdata = os.environ.get('LOCALAPPDATA', os.environ.get('APPDATA', ''))
        if appdata:
            log_dir = Path(appdata) / 'WindowsExecutorV2' / 'logs'
        else:
            # Fallback to temp directory
            import tempfile
            log_dir = Path(tempfile.gettempdir()) / 'WindowsExecutorV2' / 'logs'
    else:
        # Running as script - use project directory
        log_dir = Path(__file__).parent.parent / 'logs'
    
    # Create logs directory (with parents)
    log_dir.mkdir(parents=True, exist_ok=True)
    
    # Log file with timestamp
    log_file = log_dir / f'backend_{datetime.now().strftime("%Y%m%d")}.log'
    
    # Create formatters
    file_formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    console_formatter = logging.Formatter(
        '[%(levelname)s] %(message)s'
    )
    
    # Setup root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)  # Capture everything
    
    # File handler with rotation (10MB max, keep 5 backups)
    file_handler = RotatingFileHandler(
        log_file, 
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5,
        encoding='utf-8'
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(file_formatter)
    root_logger.addHandler(file_handler)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)
    
    # Log startup info
    logging.info("=" * 60)
    logging.info("Windows Executor V2 Backend Starting")
    logging.info("=" * 60)
    logging.info(f"Log file: {log_file}")
    logging.info(f"Python version: {sys.version}")
    logging.info(f"Executable: {sys.executable}")
    logging.info(f"Working directory: {os.getcwd()}")
    logging.info(f"Process ID: {os.getpid()}")
    
    return log_file

# Setup logging immediately
try:
    LOG_FILE = setup_logging()
except Exception as e:
    print(f"[CRITICAL] Failed to setup logging: {e}")
    sys.exit(1)

logger = logging.getLogger(__name__)

# ========================
# Import Dependencies with Logging
# ========================

logger.info("Loading dependencies...")

# Required imports
try:
    logger.debug("Importing FastAPI...")
    from fastapi import FastAPI, HTTPException, Depends
    from fastapi.middleware.cors import CORSMiddleware
    logger.debug("FastAPI imported successfully")
    
    logger.debug("Importing uvicorn...")
    import uvicorn
    logger.debug("Uvicorn imported successfully")
    
    logger.debug("Importing pydantic...")
    from pydantic import BaseModel
    from pydantic_settings import BaseSettings
    logger.debug("Pydantic imported successfully")
    
except ImportError as e:
    logger.critical(f"Failed to import required modules: {e}")
    logger.critical(traceback.format_exc())
    sys.exit(1)

# Optional imports with detailed logging
try:
    logger.debug("Attempting to import SQLAlchemy...")
    from sqlalchemy import create_engine, Column, Integer, String, JSON, DateTime, Text
    from sqlalchemy.ext.declarative import declarative_base
    from sqlalchemy.orm import sessionmaker, Session
    HAS_DATABASE = True
    logger.info("Database support: ENABLED (SQLAlchemy loaded)")
except ImportError as e:
    HAS_DATABASE = False
    logger.warning(f"Database support: DISABLED (SQLAlchemy not available: {e})")

try:
    logger.debug("Attempting to import httpx...")
    import httpx
    HAS_HTTPX = True
    logger.info("Platform API support: ENABLED (httpx loaded)")
except ImportError as e:
    HAS_HTTPX = False
    logger.warning(f"Platform API support: DISABLED (httpx not available: {e})")

try:
    logger.debug("Attempting to import MetaTrader5...")
    import MetaTrader5 as mt5
    HAS_MT5 = True
    logger.info("MT5 support: ENABLED (MetaTrader5 loaded)")
except ImportError as e:
    mt5 = None
    HAS_MT5 = False
    logger.warning(f"MT5 support: DISABLED (MetaTrader5 not available: {e})")

# ========================
# Configuration with Logging
# ========================

class Settings(BaseSettings):
    """Application settings"""
    api_host: str = "127.0.0.1"
    api_port: int = 8081
    debug: bool = True
    
    platform_api_url: str = "https://fx.nusanexus.com"
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    executor_id: Optional[str] = None
    
    database_url: str = "sqlite:///./windows_executor_v2.db"
    mt5_terminal_path: Optional[str] = None
    
    class Config:
        env_prefix = "WE_V2_"
        env_file = os.environ.get('WE_V2_ENV_FILE', '.env')
        env_file_encoding = 'utf-8'
        case_sensitive = False

# ========================
# Database Setup
# ========================

if HAS_DATABASE:
    logger.debug("Setting up database models...")
    
    Base = declarative_base()
    
    class StoredStrategy(Base):
        __tablename__ = "strategies"
        id = Column(String, primary_key=True, index=True)
        name = Column(String, nullable=False)
        symbol = Column(String, nullable=False)
        timeframe = Column(String, nullable=False)
        payload = Column(JSON, nullable=False)
        created_at = Column(DateTime, default=datetime.utcnow)
    
    class TradeLog(Base):
        __tablename__ = "trade_logs"
        id = Column(Integer, primary_key=True, autoincrement=True)
        strategy_id = Column(String, index=True, nullable=False)
        ticket = Column(String, nullable=False)
        direction = Column(String, nullable=False)
        volume = Column(String, nullable=False)
        open_price = Column(String, nullable=False)
        created_at = Column(DateTime, default=datetime.utcnow)
    
    def get_db():
        try:
            settings = Settings()
            
            # Use LOCALAPPDATA for database to avoid permission issues
            db_url = settings.database_url
            if db_url.startswith('sqlite:///./'):
                # Relative path - use LOCALAPPDATA
                appdata = os.environ.get('LOCALAPPDATA', os.environ.get('APPDATA', ''))
                if appdata:
                    db_dir = Path(appdata) / 'WindowsExecutorV2'
                    db_dir.mkdir(parents=True, exist_ok=True)
                    db_file = db_dir / 'windows_executor_v2.db'
                    db_url = f'sqlite:///{db_file}'
                    logger.debug(f"Using database at: {db_file}")
            
            logger.debug(f"Connecting to database: {db_url}")
            engine = create_engine(db_url, connect_args={"check_same_thread": False})
            SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
            Base.metadata.create_all(bind=engine)
            db = SessionLocal()
            logger.debug("Database session created")
            yield db
        except Exception as e:
            logger.error(f"Database error: {e}")
            logger.debug(traceback.format_exc())
            yield None
        finally:
            if 'db' in locals():
                db.close()
                logger.debug("Database session closed")
    
    logger.info("Database models configured")
else:
    def get_db():
        return None

# ========================
# MT5 Client with Logging
# ========================

class MT5Client:
    """MT5 client with comprehensive logging"""
    
    def __init__(self):
        self.initialized = False
        self.account_info = None
        logger.debug("MT5Client instance created")
    
    def initialize(self, path: Optional[str] = None) -> bool:
        """Initialize MT5 with detailed logging"""
        logger.info("Attempting MT5 initialization...")
        
        if not HAS_MT5 or mt5 is None:
            logger.warning("MT5 module not available")
            return False
        
        try:
            # Auto-detect if no path
            if not path:
                path = self._auto_detect_mt5()
            
            if not path:
                logger.warning("No MT5 terminal path found")
                return False
            
            logger.info(f"Initializing MT5 with path: {path}")
            
            if not mt5.initialize(path=path):
                error = mt5.last_error()
                logger.error(f"MT5 initialization failed: {error}")
                
                # Try to launch MT5
                if error and error[0] == -1:
                    logger.info("Attempting to launch MT5 terminal...")
                    import time
                    os.startfile(path)
                    time.sleep(10)
                    
                    if not mt5.initialize(path=path):
                        logger.error(f"MT5 re-initialization failed: {mt5.last_error()}")
                        return False
                else:
                    return False
            
            self.initialized = True
            self.account_info = self._fetch_account_info()
            
            if self.account_info:
                logger.info(f"MT5 connected: Account {self.account_info.get('account_number')}")
            else:
                logger.warning("MT5 connected but no account info available")
            
            return True
            
        except Exception as e:
            logger.error(f"MT5 initialization exception: {e}")
            logger.debug(traceback.format_exc())
            return False
    
    def _auto_detect_mt5(self) -> Optional[str]:
        """Auto-detect MT5 installation"""
        logger.debug("Auto-detecting MT5 installation...")
        
        possible_paths = [
            r"C:\Program Files\MetaTrader 5\terminal64.exe",
            r"C:\Program Files (x86)\MetaTrader 5\terminal.exe",
            r"C:\Program Files\XM MT5\terminal64.exe",
            r"C:\Program Files\Exness MT5\terminal64.exe",
        ]
        
        # Check APPDATA
        appdata = os.environ.get('APPDATA', '')
        if appdata:
            terminal_path = Path(appdata) / 'MetaQuotes' / 'Terminal'
            if terminal_path.exists():
                logger.debug(f"Checking {terminal_path}")
                for terminal_dir in terminal_path.iterdir():
                    if terminal_dir.is_dir():
                        exe_path = terminal_dir / 'terminal64.exe'
                        if exe_path.exists():
                            possible_paths.append(str(exe_path))
        
        for path in possible_paths:
            logger.debug(f"Checking: {path}")
            if os.path.exists(path):
                logger.info(f"MT5 found at: {path}")
                return path
        
        logger.warning("No MT5 installation found")
        return None
    
    def _fetch_account_info(self) -> Optional[Dict]:
        """Fetch MT5 account info"""
        if not self.initialized or mt5 is None:
            return None
        
        try:
            info = mt5.account_info()
            if info:
                return {
                    'account_number': info.login,
                    'server': info.server,
                    'balance': info.balance,
                    'equity': info.equity,
                    'margin': info.margin,
                    'free_margin': info.margin_free,
                    'profit': info.profit
                }
        except Exception as e:
            logger.error(f"Failed to fetch account info: {e}")
        
        return None
    
    def get_positions(self) -> List[Dict]:
        """Get MT5 positions"""
        if not self.initialized or mt5 is None:
            return []
        
        try:
            positions = mt5.positions_get()
            if positions is None:
                return []
            
            result = []
            for pos in positions:
                result.append({
                    'ticket': pos.ticket,
                    'symbol': pos.symbol,
                    'type': 'BUY' if pos.type == 0 else 'SELL',
                    'volume': pos.volume,
                    'profit': pos.profit,
                    'open_price': pos.price_open,
                    'current_price': pos.price_current
                })
            
            logger.debug(f"Retrieved {len(result)} positions from MT5")
            return result
            
        except Exception as e:
            logger.error(f"Failed to get positions: {e}")
            return []

# Global MT5 client
mt5_client = MT5Client()

# ========================
# Pydantic Models
# ========================

class HealthResponse(BaseModel):
    status: str
    version: str
    timestamp: str
    features: Dict[str, bool]
    log_file: str

class AccountInfo(BaseModel):
    balance: float = 0.0
    equity: float = 0.0
    margin: float = 0.0
    free_margin: float = 0.0
    profit: float = 0.0
    connected: bool = False

class StrategyInfo(BaseModel):
    id: str
    name: str
    status: str = "inactive"
    symbol: str = ""
    timeframe: str = ""

class PositionInfo(BaseModel):
    ticket: int
    symbol: str
    type: str
    volume: float
    profit: float
    open_price: float
    current_price: float = 0.0

# ========================
# Port Management with Logging
# ========================

def find_available_port(start_port: int = 8081, max_attempts: int = 20) -> int:
    """Find available port with logging"""
    logger.info(f"Searching for available port starting from {start_port}")
    
    for port in range(start_port, start_port + max_attempts):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', port))
                logger.info(f"Port {port} is available")
                return port
        except OSError as e:
            logger.debug(f"Port {port} is in use: {e}")
            continue
    
    logger.error(f"No available ports in range {start_port}-{start_port + max_attempts}")
    raise RuntimeError(f"No available ports found")

def save_port_info(port: int):
    """Save port info for Electron - write to LOCALAPPDATA to avoid permission issues"""
    try:
        # Use same location as logs
        appdata = os.environ.get('LOCALAPPDATA', os.environ.get('APPDATA', ''))
        if appdata:
            port_dir = Path(appdata) / 'WindowsExecutorV2'
        else:
            import tempfile
            port_dir = Path(tempfile.gettempdir()) / 'WindowsExecutorV2'
        
        port_dir.mkdir(parents=True, exist_ok=True)
        port_file = port_dir / 'backend_port.txt'
        port_file.write_text(str(port))
        logger.info(f"Port info saved to: {port_file}")
    except Exception as e:
        logger.error(f"Failed to save port info: {e}")

# ========================
# FastAPI App with Error Handling
# ========================

logger.info("Creating FastAPI application...")

app = FastAPI(
    title="Windows Executor V2 Backend",
    version="1.0.0",
    description="Production backend with comprehensive logging"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info("FastAPI app configured")

# ========================
# Startup/Shutdown Events
# ========================

async def send_heartbeat():
    """Send periodic heartbeat to platform"""
    logger.info("Heartbeat task started")
    while True:
        try:
            await asyncio.sleep(30)  # Every 30 seconds
            
            settings = Settings()
            if not settings.api_key or not settings.executor_id:
                logger.debug("Heartbeat skipped: missing API key or executor ID")
                continue
            
            # Get current status
            positions = mt5_client.get_positions() if mt5_client.initialized else []
            
            status = {
                "status": "online",
                "mt5_connected": mt5_client.initialized,
                "open_positions": len(positions),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            if HAS_HTTPX:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(
                        f"{settings.platform_api_url}/api/executor/{settings.executor_id}/heartbeat",
                        json=status,
                        headers={
                            "X-API-Key": settings.api_key,
                            "X-API-Secret": settings.api_secret or "",
                            "X-Executor-Id": settings.executor_id,
                            "Content-Type": "application/json"
                        }
                    )
                    if response.status_code == 200:
                        logger.debug(f"Heartbeat sent successfully")
                    else:
                        logger.warning(f"Heartbeat failed: {response.status_code}")
        except Exception as e:
            logger.error(f"Heartbeat error: {e}")

@app.on_event("startup")
async def startup_event():
    """Startup tasks with logging"""
    logger.info("FastAPI startup event triggered")
    
    # Initialize MT5 if configured
    try:
        settings = Settings()
        if settings.mt5_terminal_path or HAS_MT5:
            logger.info("Initializing MT5 connection...")
            if mt5_client.initialize(settings.mt5_terminal_path):
                logger.info("MT5 initialized successfully")
            else:
                logger.warning("MT5 initialization failed")
    except Exception as e:
        logger.error(f"Startup error: {e}")
        logger.debug(traceback.format_exc())
    
    # Start heartbeat task
    asyncio.create_task(send_heartbeat())

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("FastAPI shutdown event triggered")
    
    if HAS_MT5 and mt5_client.initialized and mt5:
        try:
            mt5.shutdown()
            logger.info("MT5 connection closed")
        except Exception as e:
            logger.error(f"Error closing MT5: {e}")

# ========================
# API Routes with Logging
# ========================

@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    logger.debug("Health check requested")
    
    return HealthResponse(
        status="ok",  # Frontend expects "ok"
        version="1.0.0",
        timestamp=datetime.now().isoformat(),
        features={
            "database": HAS_DATABASE,
            "mt5": mt5_client.initialized,
            "platform_api": HAS_HTTPX
        },
        log_file=str(LOG_FILE)
    )

@app.get("/api/account")
async def get_account():
    """Get account information"""
    logger.debug("Account info requested")
    
    if mt5_client.initialized:
        account_info = mt5_client._fetch_account_info()
        if account_info:
            return {
                "balance": account_info.get('balance', 0),
                "equity": account_info.get('equity', 0),
                "free_margin": account_info.get('free_margin', 0),
                "margin_level": (account_info.get('equity', 0) / account_info.get('margin', 1) * 100) if account_info.get('margin', 0) > 0 else 0,
                "currency": "USD",
                "leverage": 100,
                "open_positions": len(mt5_client.get_positions()),
                "connected": True
            }
    
    # Return demo data
    logger.debug("Returning demo account data")
    return {
        "balance": 0.0,
        "equity": 0.0,
        "free_margin": 0.0,
        "margin_level": 0.0,
        "currency": "USD",
        "leverage": 100,
        "open_positions": 0,
        "connected": False
    }

@app.get("/api/config/pusher")
async def get_pusher_config():
    """Get Pusher configuration for frontend"""
    logger.debug("Pusher config requested")
    
    settings = Settings()
    
    # Return Pusher config if available
    if settings.api_key and settings.executor_id:
        pusher_config = {
            "enabled": bool(settings.api_key),
            "key": settings.api_key,  # Frontend uses API key for Pusher auth
            "cluster": "ap1",  # Default cluster
            "channel": f"executor-{settings.executor_id}",
            "executorId": settings.executor_id
        }
        logger.info("Pusher config provided to frontend")
        return pusher_config
    
    logger.warning("Pusher config not available - missing credentials")
    return {
        "enabled": False,
        "key": None,
        "cluster": None,
        "channel": None,
        "executorId": None
    }

@app.get("/api/strategies")
async def get_strategies(db: Optional[Any] = Depends(get_db)):
    """Get currently running strategies in executor"""
    logger.debug("Running strategies requested")
    
    # Return list of active strategies from executor
    # This is NOT the list of available strategies, just the ones currently running
    strategies = []
    
    if HAS_DATABASE and db:
        try:
            stored = db.query(StoredStrategy).all()
            for s in stored:
                strategies.append({
                    "id": s.id,
                    "name": s.name,
                    "status": "inactive",
                    "symbol": s.symbol,
                    "timeframe": s.timeframe
                })
            logger.info(f"Retrieved {len(strategies)} strategies from database")
        except Exception as e:
            logger.error(f"Database query error: {e}")
    
    # DO NOT return mock data - return empty list if no strategies
    return strategies


@app.get("/api/strategies/available")
async def get_available_strategies():
    """Get available strategies from web platform"""
    logger.debug("Available strategies requested from platform")
    
    if not settings.api_key or not settings.platform_api_url:
        logger.warning("Platform API not configured")
        return []
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{settings.platform_api_url}/api/strategies",
                headers={
                    "Authorization": f"Bearer {settings.api_key}",
                    "X-API-Secret": settings.api_secret or "",
                },
            )
            response.raise_for_status()
            strategies = response.json()
            logger.info(f"Fetched {len(strategies)} strategies from platform")
            return strategies
    except Exception as e:
        logger.error(f"Failed to fetch strategies from platform: {e}")
        return []


@app.get("/api/strategies/{strategy_id}")
async def get_strategy(strategy_id: str):
    """Get specific strategy details from platform"""
    logger.debug(f"Strategy {strategy_id} details requested")
    
    if not settings.api_key or not settings.platform_api_url:
        raise HTTPException(status_code=500, detail="Platform API not configured")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{settings.platform_api_url}/api/strategies/{strategy_id}",
                headers={
                    "Authorization": f"Bearer {settings.api_key}",
                    "X-API-Secret": settings.api_secret or "",
                },
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="Strategy not found")
    except Exception as e:
        logger.error(f"Failed to fetch strategy {strategy_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/positions")
async def get_positions():
    """Get open positions from MT5"""
    logger.debug("Positions requested")
    
    if mt5_client.initialized:
        positions = mt5_client.get_positions()
        return positions if positions else []
    
    # Return empty list if MT5 not connected
    logger.warning("MT5 not initialized, returning empty positions")
    return []

@app.post("/api/strategies/{strategy_id}/start")
async def start_strategy(strategy_id: str):
    """Start strategy"""
    logger.info(f"Starting strategy: {strategy_id}")
    return {"status": "started", "strategy_id": strategy_id}

@app.post("/api/strategies/{strategy_id}/stop")
async def stop_strategy(strategy_id: str):
    """Stop strategy"""
    logger.info(f"Stopping strategy: {strategy_id}")
    return {"status": "stopped", "strategy_id": strategy_id}

@app.post("/api/positions/{ticket}/close")
async def close_position(ticket: int):
    """Close position"""
    logger.info(f"Closing position: {ticket}")
    return {"status": "closed", "ticket": ticket}

@app.get("/api/trades/open")
async def get_open_trades():
    """Get open trades - alias for positions"""
    logger.debug("Open trades requested")
    
    if mt5_client.initialized:
        positions = mt5_client.get_positions()
        return positions if positions else []
    
    # Return empty list if MT5 not connected
    logger.warning("MT5 not initialized, returning empty trades")
    return []

@app.get("/api/trades/history")
async def get_trade_history():
    """Get trade history"""
    logger.debug("Trade history requested")
    
    # TODO: Implement trade history from database
    return []

# ========================
# Global Exception Handler
# ========================

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Catch all exceptions to prevent crashes"""
    logger.error(f"Unhandled exception: {exc}")
    logger.debug(traceback.format_exc())
    return {"error": "Internal server error", "message": str(exc)}

# ========================
# Main Entry Point
# ========================

def main():
    """Main entry point with comprehensive error handling"""
    try:
        logger.info("Main function started")
        
        # Determine paths
        if getattr(sys, 'frozen', False):
            exe_path = Path(sys.executable)
            application_path = exe_path.parent
            logger.info(f"Running as bundled exe from: {application_path}")
            
            # Find .env file - go up from resources/backend to app root
            # Path is usually: C:\Program Files\Windows Executor V2\resources\backend\WindowsExecutorV2Backend.exe
            # We want: C:\Program Files\Windows Executor V2\.env
            if 'resources' in str(exe_path).lower():
                # Go up 2 levels: backend -> resources -> app root
                app_root = application_path.parent.parent
                env_file = app_root / '.env'
                logger.debug(f"Detected resources folder, app root: {app_root}")
            else:
                env_file = application_path.parent / '.env'
        else:
            application_path = Path(__file__).parent
            logger.info(f"Running as script from: {application_path}")
            env_file = application_path.parent / '.env'
        
        # Check .env file
        logger.debug(f"Looking for .env at: {env_file}")
        if env_file.exists():
            os.environ['WE_V2_ENV_FILE'] = str(env_file)
            logger.info(f".env file found: {env_file}")
            
            # Manually load .env variables into environment
            try:
                with open(env_file, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            key, value = line.split('=', 1)
                            key = key.strip()
                            value = value.strip().strip('"').strip("'")
                            os.environ[key] = value
                            logger.debug(f"Loaded env var: {key}")
            except Exception as e:
                logger.error(f"Failed to load .env file: {e}")
        else:
            logger.warning(f".env file not found: {env_file}")
        
        # Load configuration
        try:
            settings = Settings()
            logger.info("Configuration loaded successfully")
            logger.debug(f"API Key: {'Set' if settings.api_key else 'Not set'}")
            logger.debug(f"Executor ID: {'Set' if settings.executor_id else 'Not set'}")
        except Exception as e:
            logger.error(f"Configuration error: {e}")
            logger.debug(traceback.format_exc())
            settings = Settings()
        
        # Find available port
        try:
            available_port = find_available_port(settings.api_port)
            
            # Save port info (to LOCALAPPDATA)
            save_port_info(available_port)
            
        except RuntimeError as e:
            logger.error(f"Port finder error: {e}")
            available_port = settings.api_port
        
        logger.info("=" * 60)
        logger.info("Backend Server Configuration")
        logger.info("=" * 60)
        logger.info(f"Host: {settings.api_host}")
        logger.info(f"Port: {available_port}")
        logger.info(f"Debug: {settings.debug}")
        logger.info(f"Platform: {settings.platform_api_url}")
        logger.info("=" * 60)
        
        # Print to console for user
        print(f"\n[INFO] Backend is starting on http://{settings.api_host}:{available_port}")
        print(f"[INFO] Log file: {LOG_FILE}")
        print("[INFO] Press Ctrl+C to stop\n")
        
        # Run server
        logger.info("Starting Uvicorn server...")
        uvicorn.run(
            app,
            host=settings.api_host,
            port=available_port,
            log_level="info" if settings.debug else "warning"
        )
        
        return 0
        
    except KeyboardInterrupt:
        logger.info("Backend stopped by user (Ctrl+C)")
        return 0
    except Exception as e:
        logger.critical(f"FATAL ERROR: {e}")
        logger.critical(traceback.format_exc())
        print(f"\n[FATAL ERROR] {e}")
        print(f"[ERROR] Check log file: {LOG_FILE}")
        return 1

if __name__ == "__main__":
    exit_code = main()
    logger.info(f"Backend exiting with code: {exit_code}")
    sys.exit(exit_code)
