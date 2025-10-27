# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for Backend with Full Logging
"""

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# Collect data files
datas = []
datas += collect_data_files('pydantic')
datas += collect_data_files('fastapi')
datas += collect_data_files('starlette')
datas += collect_data_files('uvicorn')
datas += collect_data_files('sqlalchemy')

# Hidden imports
hiddenimports = [
    # Core
    'pydantic',
    'pydantic_settings',
    'pydantic_core',
    'fastapi',
    'starlette',
    'uvicorn',
    'sqlalchemy',
    'sqlalchemy.ext.declarative',
    'sqlalchemy.orm',
    'httpx',
    'MetaTrader5',
    # NumPy for MT5
    'numpy',
    'numpy._core',
    'numpy._core.multiarray',
    'numpy.core',
    'numpy.core.multiarray',
    # Uvicorn
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
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'uvicorn.lifespan.off',
    'h11',
    'httptools',
    'websockets',
    'anyio',
    'sniffio',
    'typing_extensions',
    'annotated_types',
    'dotenv',
]

a = Analysis(
    ['backend_logged.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'pandas', 'scipy'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='WindowsExecutorV2Backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='../installer/icon.ico'
)
