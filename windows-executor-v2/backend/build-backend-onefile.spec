# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for Windows Executor V2 Backend
Creates a SINGLE FILE standalone executable with all dependencies
"""

import sys
import os
from PyInstaller.utils.hooks import collect_data_files, collect_submodules, collect_all

block_cipher = None

# Get the backend directory
backend_dir = os.path.dirname(os.path.abspath('start_backend.py'))

# Collect all data files from packages
datas = []
datas += collect_data_files('pydantic')
datas += collect_data_files('fastapi')
datas += collect_data_files('starlette')
datas += collect_data_files('uvicorn')
datas += collect_data_files('sqlalchemy')

# Collect all submodules
hiddenimports = []
hiddenimports += collect_submodules('pydantic')
hiddenimports += collect_submodules('pydantic_settings')
hiddenimports += collect_submodules('pydantic_core')
hiddenimports += collect_submodules('fastapi')
hiddenimports += collect_submodules('starlette')
hiddenimports += collect_submodules('uvicorn')
hiddenimports += collect_submodules('sqlalchemy')
hiddenimports += collect_submodules('httpx')
hiddenimports += collect_submodules('dotenv')

# Uvicorn specific imports
hiddenimports += [
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.http.h11_impl',
    'uvicorn.protocols.http.httptools_impl',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.protocols.websockets.wsproto_impl',
    'uvicorn.protocols.websockets.websockets_impl',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'uvicorn.lifespan.off',
    'uvicorn.middleware',
    'uvicorn.middleware.proxy_headers',
    'uvicorn.workers',
    'h11',
    'httptools',
    'websockets',
    'wsproto',
]

# Our backend modules
hiddenimports += [
    'config', 
    'main',
    # Database modules
    'database',
    'database.connection',
    'database.models',
    # Model modules
    'models',
    'models.account',
    'models.command',
    'models.strategy',
    'models.trade',
    # API modules
    'api',
    'api.health',
    'api.strategies',
    'api.trades',
    'api.account',
    'api.system',
    # Core modules
    'core',
    'core.condition_evaluator',
    'core.correlation_filter',
    'core.dynamic_risk',
    'core.mt5_client',
    'core.mtf_analyzer',
    'core.news_filter',
    'core.partial_exits',
    'core.platform_api',
    'core.platform_config',
    'core.pusher_client',
    'core.regime_detector',
    'core.risk_manager',
    'core.smart_exits',
    'core.strategy_executor',
    # Filter modules
    'filters',
    'filters.session_filter',
    'filters.spread_filter',
    'filters.volatility_filter',
    # Indicator modules
    'indicators',
    'indicators.talib_wrapper',
    # Utils
    'utils',
    'utils.logger',
    # External dependencies
    'pusher',
    'MetaTrader5',
    'orjson',
    'passlib',
    'passlib.context',
    'jose',
    'python-jose',
    'cryptography',
    'cffi',
    'pycparser',
    'anyio',
    'sniffio',
    'typing_extensions',
    'annotated_types',
]

# Analysis - we'll be more aggressive with including files
a = Analysis(
    ['start_backend.py',
     'config.py',
     'main.py'],  # Include main modules directly
    pathex=[backend_dir],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'numpy', 'pandas', 'scipy'],  # Exclude unused heavy packages
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(
    a.pure,
    a.zipped_data,
    cipher=block_cipher
)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='WindowsExecutorV2Backend',
    debug=False,  # Set to True for debugging
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # Keep console for backend logs
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='../installer/icon.ico'
)
