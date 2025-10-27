# ⚡ Quick Start - Windows Executor V2

## 🎯 Setup dalam 3 Menit!

### Step 1: Install (2 menit)
1. Download `Windows Executor V2-Setup-1.0.0.exe`
2. Jalankan installer
3. Ikuti wizard (Next → Install)
4. Tunggu selesai

### Step 2: Konfigurasi Otomatis (1 menit)

**Saat pertama kali dibuka, aplikasi akan:**
1. ✅ Auto-create file `.env` 
2. ✅ Tampilkan dialog konfigurasi
3. ✅ Buka folder instalasi otomatis (jika dipilih)

**Dialog yang muncul:**
```
╔══════════════════════════════════════════╗
║  First Time Setup                        ║
╠══════════════════════════════════════════╣
║  Configuration file created!             ║
║                                          ║
║  Please edit the .env file in:           ║
║  C:\Program Files\Windows Executor V2    ║
║                                          ║
║  You need to fill in:                    ║
║  1. WE_V2_API_KEY                        ║
║  2. WE_V2_API_SECRET                     ║
║  3. WE_V2_EXECUTOR_ID                    ║
║                                          ║
║  See SETUP_GUIDE.md for details.         ║
╚══════════════════════════════════════════╝
   [Open Folder]    [OK]
```

### Step 3: Edit File .env

**Lokasi:** 
- `C:\Program Files\Windows Executor V2\.env` (default install)
- Atau cek di dialog yang muncul

**Buka dengan Notepad, isi 3 baris ini:**

```env
WE_V2_API_KEY=sk_xxxxxxxx          # Dari https://fx.nusanexus.com
WE_V2_API_SECRET=sec_xxxxxxxx      # Dari https://fx.nusanexus.com
WE_V2_EXECUTOR_ID=my_pc_executor   # Nama bebas (unik)
```

**Save file** (Ctrl+S)

### Step 4: Jalankan!

1. Klik icon di Desktop: **"Windows Executor V2"**
2. Tunggu backend connect (~10 detik)
3. UI akan terbuka
4. Lihat status "Backend OK" (hijau)
5. **Ready to trade!** ✅

---

## 📍 Lokasi Penting

### File Konfigurasi:
```
C:\Program Files\Windows Executor V2\.env
```

### Dokumentasi:
```
C:\Program Files\Windows Executor V2\SETUP_GUIDE.md
C:\Program Files\Windows Executor V2\USER_INSTALLATION_GUIDE.md
```

### Backend Executable:
```
C:\Program Files\Windows Executor V2\resources\backend\WindowsExecutorV2Backend.exe
```

### Database:
```
C:\Users\[YourName]\AppData\Local\windows-executor-v2\
```

---

## 🔧 Jika File .env Tidak Ada

**Manual create:**

1. Buka folder: `C:\Program Files\Windows Executor V2`
2. Klik kanan → New → Text Document
3. Rename jadi `.env` (hapus .txt)
4. Buka dengan Notepad
5. Copy-paste ini:

```env
# Windows Executor V2 Configuration
# Platform URL: https://fx.nusanexus.com (HARDCODED)

# REQUIRED: Fill these 3 settings:
WE_V2_API_KEY=your_api_key_here
WE_V2_API_SECRET=your_api_secret_here
WE_V2_EXECUTOR_ID=executor_001

# Optional: MT5 path (leave blank for auto-detection)
# WE_V2_MT5_PATH=

# Optional: Advanced settings (defaults are fine)
WE_V2_API_HOST=127.0.0.1
WE_V2_API_PORT=8081
WE_V2_DEBUG=true
```

6. Edit 3 baris yang REQUIRED
7. Save (Ctrl+S)
8. Restart aplikasi

---

## 🎓 Dapat API Credentials

### Login ke Platform:
```
https://fx.nusanexus.com
```

### Generate API Key:
1. Dashboard → Settings
2. Tab **"Executor API"**
3. Klik **"Generate New API Key"**
4. **Copy** API Key (sk_xxx)
5. **Copy** API Secret (sec_xxx) - **shown once!**
6. Save di tempat aman

### Pilih Executor ID:
Nama bebas, contoh:
- `my_laptop`
- `office_pc`
- `trading_station_1`

---

## ✅ Checklist Instalasi

Setelah install, cek:

- [ ] Desktop shortcut "Windows Executor V2" ada
- [ ] Aplikasi bisa dibuka
- [ ] File `.env` ada di folder instalasi
- [ ] Sudah isi 3 settings (API Key, Secret, ID)
- [ ] Backend status "OK" (hijau)
- [ ] MT5 terdetect (atau manual set path)
- [ ] Account info tampil
- [ ] Siap terima strategy dari platform

**Semua ✅?** Ready to trade! 🚀

---

## 🆘 Troubleshooting Cepat

### ❌ "File .env not found"
**Fix:** Jalankan aplikasi sekali lagi, dialog auto-create akan muncul

### ❌ "Backend offline"
**Fix:** 
1. Cek file `.env` sudah diisi 3 settings
2. Restart aplikasi
3. Cek internet connection

### ❌ "MT5 not found"
**Fix:** 
1. Install MT5 dari broker
2. Atau edit `.env`, tambah: `WE_V2_MT5_PATH=C:\Program Files\MetaTrader 5\terminal64.exe`

### ❌ "Platform connection failed"
**Fix:**
1. Cek API Key benar
2. Cek internet
3. Tunggu 1 menit, retry

---

## 📞 Butuh Bantuan?

**Support:**
- Email: support@nusanexus.com
- Platform: https://fx.nusanexus.com/support

**Dokumentasi Lengkap:**
- USER_INSTALLATION_GUIDE.md
- SETUP_GUIDE.md

---

**Happy Trading! 🚀💰**
