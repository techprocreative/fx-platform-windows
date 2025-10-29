# Backend Packaging Guide

## Requirements
- Python 3.11 (same version used during development)
- pip install -r requirements.txt
- PyInstaller 6+
- Windows build environment (tested on Windows 11)

## Steps
```powershell
cd windows-executor-v2/backend
pip install -r requirements.txt
pip install pyinstaller
./build-backend.ps1 -OutputDir dist-backend -ExecutableName backend-service
```

The resulting executable will be placed at `dist-backend/backend-service.exe`.

## Bundling With Electron
Copy the generated executable into the Electron resources folder before packaging:

```
windows-executor/resources/backend/backend-service.exe
```

During electron-builder packaging, this folder should be packaged automatically (see electron-builder config).

When the app runs, `electron/main.ts` starts the executable automatically (only in packaged mode).
