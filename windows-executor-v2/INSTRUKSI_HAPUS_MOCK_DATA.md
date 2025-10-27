# Instruksi Menghapus Mock Data dari Aplikasi Terinstal
**Windows Executor V2 - Bahasa Indonesia**

## 🎯 Masalah

Anda melihat **strategi aktif** di aplikasi Windows Executor V2 yang sudah terinstal, padahal di **web platform tidak ada** strategi aktif.

**Contoh yang terlihat:**
- "Demo Strategy 1" - EURUSD
- "Demo Strategy 2" - GBPUSD
- Atau strategi lain yang tidak ada di platform

## ❓ Penyebab

**BUKAN** karena mock data di kode backend (sudah bersih ✅), tapi karena:

**Database lokal masih menyimpan data lama** dari testing/development sebelumnya yang tidak terhubung ke web platform.

Aplikasi menyimpan database di komputer Anda:
```
C:\Users\[NAMA_USER]\AppData\Local\WindowsExecutorV2\windows_executor_v2.db
```

## ✅ Solusi: Hapus Database Lokal

### 🚀 Cara 1: Menggunakan Script (TERMUDAH)

1. **Tutup** aplikasi Windows Executor V2 (pastikan benar-benar tertutup)

2. **Download dan jalankan script:**
   ```
   File: clean-user-executor-db.ps1
   ```

3. **Klik kanan** file → **Run with PowerShell**
   
   Atau buka PowerShell dan ketik:
   ```powershell
   powershell -ExecutionPolicy Bypass -File clean-user-executor-db.ps1
   ```

4. **Ikuti instruksi:**
   - Script akan menampilkan lokasi database
   - Ketik `DELETE` untuk konfirmasi hapus
   - Selesai!

5. **Restart** aplikasi Windows Executor V2

### 🖱️ Cara 2: Hapus Manual (MUDAH)

1. **Tutup** aplikasi Windows Executor V2 sepenuhnya

2. **Tekan** `Win + R` di keyboard

3. **Ketik:** 
   ```
   %LOCALAPPDATA%\WindowsExecutorV2
   ```

4. **Klik OK** - folder akan terbuka

5. **Hapus file:** `windows_executor_v2.db`

6. **Restart** aplikasi

### 💻 Cara 3: Menggunakan Command Prompt

1. **Tutup** aplikasi Windows Executor V2

2. **Buka Command Prompt** (Win + R → ketik `cmd` → Enter)

3. **Ketik command ini:**
   ```batch
   del /f "%LOCALAPPDATA%\WindowsExecutorV2\windows_executor_v2.db"
   ```

4. **Tekan Enter**

5. **Restart** aplikasi

---

## ✔️ Verifikasi Setelah Hapus

Setelah menghapus database dan restart aplikasi:

1. **Buka tab "Strategies"** di aplikasi

2. **Seharusnya terlihat:**
   - ✅ **"Running Strategies"** = Kosong (tidak ada strategi berjalan)
   - ✅ **"Available Strategies"** = Strategi dari web platform (jika ada)
   - ✅ Tidak ada lagi "Demo Strategy" atau strategi lama

---

## 🔧 Troubleshooting

### Masalah: Database tidak bisa dihapus

**Error: "File is being used by another process"**

**Solusi:**

1. **Tutup aplikasi** dari system tray (kanan bawah layar)

2. **Buka Task Manager** (Ctrl + Shift + Esc)

3. **Cari process:**
   - `Windows Executor V2.exe`
   - `WindowsExecutorV2Backend.exe`

4. **Klik kanan → End Task** untuk setiap process

5. **Tunggu 5 detik**, lalu coba hapus database lagi

### Masalah: Aplikasi crash setelah delete

**Ini NORMAL!** Database akan dibuat ulang otomatis.

**Solusi:**
1. Tunggu **10-15 detik** setelah start aplikasi
2. Backend butuh waktu untuk initialize
3. Jika masih crash, cek log di:
   ```
   %LOCALAPPDATA%\WindowsExecutorV2\logs\
   ```

### Masalah: Strategi masih muncul

**Bedakan 2 section:**

1. **"🟢 Running Strategies"** 
   - Strategi yang **sedang aktif** di executor
   - Data dari **database lokal**
   - Ini yang harus kosong setelah hapus database

2. **"📚 Available Strategies"**
   - Strategi **tersedia** dari web platform
   - Data dari **API real-time**
   - Ini normal jika ada

**Jika masih ada di "Running Strategies":**
- Klik tombol **"Stop Strategy"** untuk menghentikan
- Atau hapus database lagi (pastikan app tertutup)

---

## 📁 Detail Teknis

### Struktur Folder

```
C:\Users\[NAMA_USER]\AppData\Local\WindowsExecutorV2\
│
├── windows_executor_v2.db          ← HAPUS INI
├── backend_port.txt                ← Biarkan (tidak perlu dihapus)
└── logs\                           ← Optional: bisa dihapus untuk bersihkan log
    ├── backend_20251027.log
    ├── backend_20251026.log
    └── ...
```

### Apa yang Akan Dihapus?

❌ **Data yang hilang:**
- Strategi yang tersimpan di database lokal
- Trade logs lokal di aplikasi
- History strategi yang pernah di-start

✅ **Data yang TETAP ADA:**
- Strategi di web platform (https://fx.nusanexus.com)
- Trade history di MT5 terminal
- File konfigurasi .env
- Settings API key/secret

### Mengapa Database Tidak Otomatis Bersih?

Backend menyimpan strategi ke database lokal untuk:
1. **Persistence** - strategi tetap jalan meski backend restart
2. **Recovery** - bisa restore state setelah crash
3. **Performance** - tidak perlu query platform terus-menerus

**Tapi ada bug:** `stop_strategy()` hanya ubah status, **tidak delete** dari database.

Lihat file `FIX_DELETE_ENDPOINT.md` untuk solusi permanent.

---

## 🚀 Cara Mencegah di Masa Depan

### Opsi 1: Jangan Simpan ke Database Lokal

Edit file `backend/core/strategy_executor.py`:

```python
def _persist_strategy(self, strategy: StrategyConfig) -> None:
    # Disabled - tidak simpan ke database
    return
```

**Kelebihan:**
- ✅ Tidak ada data lama yang persist
- ✅ Selalu clean state

**Kekurangan:**
- ❌ Strategi hilang saat backend restart
- ❌ Harus start ulang strategi manual setelah crash

### Opsi 2: Auto-Delete Saat Stop

Tambahkan endpoint DELETE yang proper (lihat `FIX_DELETE_ENDPOINT.md`)

### Opsi 3: Clear Database Saat Startup

Tambah di backend untuk auto-clean saat startup.

---

## 📞 Butuh Bantuan?

Jika masih ada masalah setelah ikuti panduan ini:

1. **Check log file:**
   ```
   %LOCALAPPDATA%\WindowsExecutorV2\logs\backend_[DATE].log
   ```

2. **Screenshot error** yang muncul

3. **Kirim log file** ke support

4. **Informasi yang dibutuhkan:**
   - Versi Windows (Win 10/11)
   - Versi aplikasi Windows Executor V2
   - Screenshot tab "Strategies"
   - Log file dari folder logs

---

## 📝 Kesimpulan

| Item | Status |
|------|--------|
| Backend production code | ✅ Bersih (tidak ada mock data) |
| Database user lokal | ❌ Masih ada data lama |
| Solusi | ✅ Hapus database dengan script/manual |
| Rebuild aplikasi perlu? | ❌ **TIDAK PERLU** rebuild |

**Cukup hapus database lokal user, tidak perlu rebuild aplikasi!**

---

## ⚡ Quick Steps (TL;DR)

```
1. Tutup Windows Executor V2
2. Win + R → ketik: %LOCALAPPDATA%\WindowsExecutorV2
3. Hapus: windows_executor_v2.db
4. Restart aplikasi
5. ✅ Done!
```

Atau jalankan: `clean-user-executor-db.ps1`
