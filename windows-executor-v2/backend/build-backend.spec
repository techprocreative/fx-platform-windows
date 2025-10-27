# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for Windows Executor V2 Backend
Creates standalone executable with all dependencies
"""

import sys
import os
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# Get the backend directory
backend_dir = os.path.dirname(os.path.abspath('start_backend.py'))

# Collect all Python files from our backend
py_files = []
for root, dirs, files in os.walk(backend_dir):
    # Skip test and build directories
    if 'test' in root or 'build' in root or 'dist' in root or '__pycache__' in root:
        continue
    for file in files:
        if file.endswith('.py'):
            py_files.append(os.path.join(root, file))

# Collect all data files from packages
datas = []
datas += collect_data_files('pydantic')
datas += collect_data_files('fastapi')
datas += collect_data_files('starlette')

# Add our backend files as data
for py_file in py_files:
    if py_file != os.path.abspath('start_backend.py'):
        rel_path = os.path.relpath(py_file, backend_dir)
        datas.append((py_file, os.path.dirname(rel_path) if os.path.dirname(rel_path) else '.'))

# Collect all submodules
hiddenimports = []
hiddenimports += collect_submodules('pydantic')
hiddenimports += collect_submodules('fastapi')
hiddenimports += collect_submodules('starlette')
hiddenimports += collect_submodules('uvicorn')
hiddenimports += collect_submodules('sqlalchemy')
hiddenimports += ['uvicorn.logging', 'uvicorn.loops', 'uvicorn.loops.auto', 'uvicorn.protocols', 
                   'uvicorn.protocols.http', 'uvicorn.protocols.http.auto', 'uvicorn.protocols.websockets',
                   'uvicorn.protocols.websockets.auto', 'uvicorn.lifespan', 'uvicorn.lifespan.on']

# Add all our backend modules explicitly
hiddenimports += [
    'config', 'main',
    # Database
    'database', 'database.connection', 'database.models',
    # Models
    'models', 'models.account', 'models.command', 'models.strategy', 'models.trade',
    # API
    'api', 'api.health', 'api.strategies', 'api.trades', 'api.account', 'api.system',
    # Core
    'core', 'core.condition_evaluator', 'core.correlation_filter', 'core.dynamic_risk',
    'core.mt5_client', 'core.mtf_analyzer', 'core.news_filter', 'core.partial_exits',
    'core.platform_api', 'core.platform_config', 'core.pusher_client',
    'core.regime_detector', 'core.risk_manager', 'core.smart_exits', 'core.strategy_executor',
    # Filters
    'filters', 'filters.session_filter', 'filters.spread_filter', 'filters.volatility_filter',
    # Indicators
    'indicators', 'indicators.talib_wrapper',
    # Utils
    'utils', 'utils.logger',
    # Additional dependencies
    'pusher', 'httpx', 'dotenv', 'MetaTrader5', 'orjson', 'passlib'
]

a = Analysis(
    ['start_backend.py'],
    pathex=[backend_dir],  # Add backend directory to path
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='WindowsExecutorV2Backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='../installer/icon.ico'
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='WindowsExecutorV2Backend',
)
