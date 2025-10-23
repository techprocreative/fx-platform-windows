# LibZMQ DLL Setup Guide

## Overview

This directory contains the ZeroMQ (libzmq) DLL files required for the FX Platform Windows Executor to communicate with MetaTrader 5.

## Required Files

- `libzmq-x64.dll` - 64-bit version (required)
- `libzmq-x86.dll` - 32-bit version (optional, for 32-bit systems)

## Quick Setup

### Option 1: Automatic Download (Recommended)

Run one of these commands from the `windows-executor` directory:

```bash
# Using Node.js script (cross-platform)
npm run setup:libzmq

# Using PowerShell script (Windows only)
npm run setup:libzmq:win

# Force re-download
npm run setup:libzmq:force
npm run setup:libzmq:win:force
```

### Option 2: Manual Download from NuGet

1. **Visit NuGet Package**
   - Go to: https://www.nuget.org/packages/libzmq_vc142/
   - Click "Download package" button on the right side

2. **Extract the Package**
   ```powershell
   # Rename .nupkg to .zip
   Rename-Item libzmq_vc142.4.3.5.nupkg libzmq_vc142.4.3.5.zip
   
   # Extract the ZIP file
   Expand-Archive libzmq_vc142.4.3.5.zip -DestinationPath extracted
   ```

3. **Copy DLL Files**
   ```powershell
   # For x64 (64-bit)
   Copy-Item extracted/runtimes/win-x64/native/libzmq.dll libzmq-x64.dll
   
   # For x86 (32-bit)
   Copy-Item extracted/runtimes/win-x86/native/libzmq.dll libzmq-x86.dll
   ```

4. **Place in Resources**
   - Copy both DLLs to this directory (`resources/libs/`)

### Option 3: Using vcpkg

```bash
# Install vcpkg
git clone https://github.com/Microsoft/vcpkg.git
cd vcpkg
.\bootstrap-vcpkg.bat

# Install ZeroMQ
.\vcpkg install zeromq:x64-windows
.\vcpkg install zeromq:x86-windows

# Copy DLLs from vcpkg/installed/*/bin/libzmq.dll
copy vcpkg\installed\x64-windows\bin\libzmq.dll resources\libs\libzmq-x64.dll
copy vcpkg\installed\x86-windows\bin\libzmq.dll resources\libs\libzmq-x86.dll
```

### Option 4: Build from Source

```bash
# Clone the repository
git clone https://github.com/zeromq/libzmq.git
cd libzmq

# Create build directory
mkdir build && cd build

# Configure with CMake (requires Visual Studio)
cmake .. -G "Visual Studio 17 2022" -A x64
cmake --build . --config Release

# The DLL will be in build/bin/Release/libzmq.dll
```

## Verification

After placing the DLL files, verify they are valid:

### Quick Check

```bash
# Check if files exist and have reasonable size
dir libzmq-*.dll
```

Expected output:
- `libzmq-x64.dll` should be around 2-3 MB
- `libzmq-x86.dll` should be around 2-3 MB

### Test with Node.js

```bash
# From windows-executor directory
npm run test:zeromq
```

### Manual Validation

```powershell
# Check file properties
Get-Item libzmq-x64.dll | Select-Object Name, Length

# Verify PE header (should show "MZ" for valid Windows DLL)
$bytes = [System.IO.File]::ReadAllBytes("libzmq-x64.dll")
[System.Text.Encoding]::ASCII.GetString($bytes[0..1])  # Should output "MZ"
```

## File Requirements

### Architecture

- **x64**: Required for 64-bit Windows systems (most common)
- **x86**: Optional, only needed for 32-bit Windows systems

### Version Compatibility

- **Recommended**: libzmq 4.3.4 or 4.3.5
- **Minimum**: libzmq 4.3.0
- **Compiler**: Built with Visual Studio 2019 (vc142) or newer

### Size Guidelines

- Valid DLL files should be **at least 1 MB** in size
- Typical size is **2-3 MB**
- Files smaller than 100 KB are likely invalid/corrupt

## Important Notes

### For Development

The `zeromq` npm package includes libzmq source code and will compile it automatically during `npm install`. Pre-built DLLs in this directory are **OPTIONAL** for development.

```bash
# Install dependencies (will compile zeromq automatically)
npm install

# Rebuild for Electron runtime
npm run rebuild
```

### For Production Distribution

Pre-built DLLs are **RECOMMENDED** for production builds to ensure:
1. Consistent behavior across different systems
2. No build tools required on client machines
3. Faster installation for end users
4. Known working versions

The DLLs will be packaged with your application by electron-builder.

### For Windows Build Only

If you're only building the Windows executable (EXE), you **MUST** have:
- `libzmq-x64.dll` in this directory
- Or rely on the npm zeromq package build

## Troubleshooting

### "File not found" Error

**Solution:**
```bash
npm run setup:libzmq
```

### "Invalid DLL" Error

**Cause**: File is too small or corrupted

**Solution:**
```bash
# Force re-download
npm run setup:libzmq:force

# Or delete and re-download manually
del libzmq-*.dll
npm run setup:libzmq
```

### "Architecture mismatch" Error

**Cause**: Using x86 DLL on x64 system or vice versa

**Solution:**
- Verify you're using the correct DLL for your system
- For 64-bit Windows: use `libzmq-x64.dll`
- For 32-bit Windows: use `libzmq-x86.dll`

### NPM Script Fails

**Solution:**
```powershell
# Try PowerShell script directly
cd windows-executor
.\scripts\setup-libzmq-simple.ps1

# Or with verbose output
.\scripts\setup-libzmq-simple.ps1 -Verbose
```

### Cannot Download from NuGet

**Alternative URLs:**
- https://globalcdn.nuget.org/packages/libzmq_vc142.4.3.5.nupkg
- https://api.nuget.org/v3-flatcontainer/libzmq_vc142/4.3.5/libzmq_vc142.4.3.5.nupkg

Or use vcpkg or build from source as described above.

## Integration with Electron Builder

The DLLs in this directory are automatically included in the distribution by electron-builder:

```javascript
// electron-builder.config.js
extraResources: [
  {
    from: 'resources',
    to: 'resources',
    filter: ['**/*'],
  },
]
```

After building, the DLLs will be located at:
```
FXPlatformExecutor/
└── resources/
    └── libs/
        ├── libzmq-x64.dll
        └── libzmq-x86.dll
```

## Loading DLLs at Runtime

The application will automatically use the correct DLL based on the system architecture:

```typescript
// Example: Automatic architecture detection
const arch = process.arch; // 'x64' or 'ia32'
const dllPath = path.join(process.resourcesPath, 'resources', 'libs', `libzmq-${arch}.dll`);
```

## Additional Resources

- [ZeroMQ Official Website](https://zeromq.org/)
- [zeromq.js Documentation](https://github.com/zeromq/zeromq.js)
- [NuGet libzmq Package](https://www.nuget.org/packages/libzmq_vc142/)
- [vcpkg Package Manager](https://github.com/microsoft/vcpkg)
- [LibZMQ GitHub Repository](https://github.com/zeromq/libzmq)

## License

ZeroMQ is licensed under the **LGPL-3.0** with static linking exception.

This means you can:
- Use it in commercial applications
- Link statically or dynamically
- Distribute with your application

See: https://github.com/zeromq/libzmq/blob/master/COPYING.LESSER

## Support

If you encounter issues:

1. **Check file validity**:
   ```bash
   npm run setup:libzmq --verbose
   ```

2. **Check logs**:
   ```bash
   # Application logs
   type %APPDATA%\fx-platform-executor\logs\main.log
   ```

3. **Test ZeroMQ connection**:
   ```bash
   npm run test:zeromq
   ```

4. **Contact development team** with:
   - Error messages
   - System information (OS, Node version)
   - DLL file sizes and checksums

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm run setup:libzmq` | Download DLLs automatically (Node.js) |
| `npm run setup:libzmq:win` | Download DLLs (PowerShell) |
| `npm run setup:libzmq:force` | Force re-download |
| `npm run test:zeromq` | Test ZeroMQ connection |
| `npm install` | Install deps + compile zeromq |
| `npm run rebuild` | Rebuild for Electron |

## Status Files

This directory may contain:

- `libzmq-x64.dll.README.txt` - Placeholder/instructions
- `libzmq-x86.dll.README.txt` - Placeholder/instructions  
- `manifest.json` - Download metadata
- `README.md` - This file

After successful setup, you should see:
- ✅ `libzmq-x64.dll` (2-3 MB)
- ✅ `libzmq-x86.dll` (2-3 MB) [optional]
- ✅ `manifest.json`
