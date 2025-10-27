# Clean User Database - Windows Executor V2

## Masalah
User melihat strategi aktif di aplikasi yang sudah terinstal, padahal web platform tidak menunjukkan strategi aktif.

## Penyebab
Database lokal aplikasi masih menyimpan data dari testing/development sebelumnya yang tidak terhubung ke web platform.

## Solusi: Hapus Database Lokal User

### Lokasi Database User

Windows Executor V2 menyimpan database di:
```
C:\Users\[USERNAME]\AppData\Local\WindowsExecutorV2\windows_executor_v2.db
```

atau

```
%LOCALAPPDATA%\WindowsExecutorV2\windows_executor_v2.db
```

### Cara 1: Manual Delete (Paling Mudah)

1. **Tutup aplikasi Windows Executor V2** jika sedang berjalan
2. Tekan `Win + R`, ketik:
   ```
   %LOCALAPPDATA%\WindowsExecutorV2
   ```
3. Klik OK
4. **Hapus file** `windows_executor_v2.db`
5. **Hapus folder** `logs` (optional, untuk bersihkan log juga)
6. Restart aplikasi

### Cara 2: Menggunakan Script PowerShell

Buat file `clean-executor-db.ps1`:

```powershell
# Clean Windows Executor V2 Database
Write-Host "=" -ForegroundColor Cyan -NoNewline; Write-Host ("=" * 59) -ForegroundColor Cyan
Write-Host "Windows Executor V2 - Database Cleaner" -ForegroundColor Yellow
Write-Host "=" -ForegroundColor Cyan -NoNewline; Write-Host ("=" * 59) -ForegroundColor Cyan

$localAppData = $env:LOCALAPPDATA
$executorPath = Join-Path $localAppData "WindowsExecutorV2"
$dbFile = Join-Path $executorPath "windows_executor_v2.db"
$logsFolder = Join-Path $executorPath "logs"

Write-Host "`nChecking database location..." -ForegroundColor White
Write-Host "Path: $executorPath" -ForegroundColor Gray

# Check if database exists
if (Test-Path $dbFile) {
    Write-Host "`n[FOUND] Database file exists" -ForegroundColor Green
    Write-Host "  Location: $dbFile" -ForegroundColor Gray
    
    # Get file size
    $size = (Get-Item $dbFile).Length / 1KB
    Write-Host "  Size: $([math]::Round($size, 2)) KB" -ForegroundColor Gray
    
    $confirm = Read-Host "`nDo you want to DELETE this database? (yes/no)"
    
    if ($confirm -eq "yes") {
        try {
            Remove-Item $dbFile -Force
            Write-Host "`n[SUCCESS] Database deleted!" -ForegroundColor Green
        } catch {
            Write-Host "`n[ERROR] Failed to delete database: $_" -ForegroundColor Red
            Write-Host "Make sure the application is closed." -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host "`n[CANCELLED] Database not deleted" -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "`n[INFO] Database file not found (already clean)" -ForegroundColor Cyan
}

# Ask about logs
if (Test-Path $logsFolder) {
    Write-Host "`n[FOUND] Logs folder exists" -ForegroundColor Green
    Write-Host "  Location: $logsFolder" -ForegroundColor Gray
    
    $confirmLogs = Read-Host "`nDelete logs folder too? (yes/no)"
    
    if ($confirmLogs -eq "yes") {
        try {
            Remove-Item $logsFolder -Recurse -Force
            Write-Host "`n[SUCCESS] Logs deleted!" -ForegroundColor Green
        } catch {
            Write-Host "`n[ERROR] Failed to delete logs: $_" -ForegroundColor Red
        }
    }
}

Write-Host "`n" -NoNewline
Write-Host "=" -ForegroundColor Cyan -NoNewline; Write-Host ("=" * 59) -ForegroundColor Cyan
Write-Host "[DONE] You can now restart Windows Executor V2" -ForegroundColor Green
Write-Host "=" -ForegroundColor Cyan -NoNewline; Write-Host ("=" * 59) -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to exit"
```

Jalankan:
```powershell
powershell -ExecutionPolicy Bypass -File clean-executor-db.ps1
```

### Cara 3: Menggunakan Command Prompt

```batch
@echo off
echo ========================================================
echo Windows Executor V2 - Database Cleaner
echo ========================================================
echo.

set EXECUTOR_PATH=%LOCALAPPDATA%\WindowsExecutorV2
set DB_FILE=%EXECUTOR_PATH%\windows_executor_v2.db

echo Checking: %DB_FILE%
echo.

if exist "%DB_FILE%" (
    echo [FOUND] Database exists
    echo.
    set /p CONFIRM="Delete database? (Y/N): "
    if /i "%CONFIRM%"=="Y" (
        del /f "%DB_FILE%"
        echo [SUCCESS] Database deleted!
    ) else (
        echo [CANCELLED] Database not deleted
    )
) else (
    echo [INFO] Database not found (already clean)
)

echo.
echo Done! You can now restart Windows Executor V2.
echo.
pause
```

Simpan sebagai `clean-executor-db.bat` dan double-click.

### Verifikasi Setelah Clean

Setelah menghapus database:

1. **Restart aplikasi**
2. **Buka tab "Strategies"**
3. Seharusnya menampilkan:
   - **"Available Strategies"** dari web platform (jika ada)
   - **"Running Strategies"** = kosong (karena belum ada yang di-start)

## Catatan Penting

⚠️ **Data yang akan hilang:**
- Strategi yang pernah di-save ke database lokal
- Trade logs lokal
- Tidak akan mempengaruhi data di web platform

✅ **Data yang tetap ada:**
- Strategi di web platform (tidak terpengaruh)
- Trade history di MT5
- Konfigurasi .env

## Troubleshooting

### Database masih muncul setelah dihapus

1. Pastikan aplikasi benar-benar tertutup (cek Task Manager)
2. Cek apakah ada proses `WindowsExecutorV2Backend.exe` yang masih jalan
3. Kill process backend:
   ```powershell
   taskkill /F /IM WindowsExecutorV2Backend.exe
   ```
4. Hapus database lagi
5. Restart aplikasi

### Aplikasi crash setelah delete database

Normal - database akan dibuat ulang otomatis saat aplikasi start. Tunggu 10-15 detik untuk backend initialize.

### Strategi masih muncul di "Running Strategies"

Ini berbeda dengan "Available Strategies":
- **"Running Strategies"** = strategi yang sedang aktif di executor (dari database lokal)
- **"Available Strategies"** = strategi dari web platform (real-time API)

Jika ada di "Running Strategies", klik tombol **Stop** untuk menghentikan.

## File Lokasi Lengkap

```
C:\Users\[USERNAME]\AppData\Local\WindowsExecutorV2\
├── windows_executor_v2.db          <- Database (hapus ini)
├── backend_port.txt                <- Port info (aman, biarkan)
└── logs\                           <- Log files (optional hapus)
    ├── backend_20251027.log
    ├── backend_20251026.log
    └── ...
```

## Prevention: Disable Local Strategy Persistence

Jika user ingin executor HANYA menggunakan data dari web platform tanpa save lokal, edit `backend/core/strategy_executor.py`:

```python
def _persist_strategy(self, strategy: StrategyConfig) -> None:
    # Disabled - do not persist strategies locally
    return
```

Rebuild aplikasi untuk apply perubahan.
