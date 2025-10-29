# Rancangan Windows Executor V2 (Python Backend + React Frontend)

## Tujuan
- User hanya input API Key & API Secret dari web platform.
- Tidak memakai EA & ZeroMQ: akses langsung MT5 via Python MetaTrader5.
- Real-time command via Pusher, reporting status/hasil via REST.
- Strategy engine FULL parity dengan format strategi di web platform (siap eksekusi).
- Tambah ML untuk kualitas sinyal, deteksi rezim volatilitas, dan anomaly guard.

## Prinsip Kompatibilitas Strategi (Parity dengan Web Platform)
- Executor membaca perintah START_STRATEGY dari Pusher (event `command-received`).
- Struktur `parameters.rules` mengikuti format web (entry/exit/filters/risk/options) tanpa transform manual oleh user.
- Engine menyediakan pemetaan indikator dan operator: `ema_9`, `sma_50`, `rsi`, `macd/macd_signal`, `bb`, `stoch`, `atr`, `adx`, `cci`, `price`, `volume`.
- Operator: `crosses_above`, `crosses_below`, `greater_than`, `less_than`, `equal`, `in_range`, `outside_range`.
- Logic: `AND`/`OR`, termasuk nested group sederhana (AND dengan child AND/OR) — dievaluasi deterministik.

## Arsitektur (Backend FastAPI)
- Bootstrap: GET `/api/executor/config` (headers `X-API-Key` & `X-API-Secret`).
- Pusher client: subscribe `private-executor-{executorId}` via `/api/pusher/auth` (header kunci yang sama).
- Heartbeat: POST `/api/executor/{id}/heartbeat` → terima `pendingCommands` (fallback delivery).
- Strategy Engine (inti):
  - Strategy Registry & Lifecycle: start/stop/pause/resume/update per strategi.
  - Scheduler: evaluasi per timeframe (bar-close aligned) + opsi intrabar.
  - Market Data Manager: fetch candles MT5, deteksi bar baru, sinkronisasi multi-timeframe.
  - Indicator Service: berbasis numpy/pandas (tanpa TA-Lib untuk menghindari dependensi binary di distribusi Windows), cache per simbol/timeframe/period.
  - Condition Evaluator: evaluasi rules (logical tree) + operators termasuk cross.
  - Filters: session, spread, volatilitas (ATR range), korelasi, news (opsional hook).
  - Risk Manager: sizing (fixed, %equity, ATR-based), batasan harian & per simbol.
  - Order Executor: open/modify/close, trailing stop, break-even, partial exit.
  - Exit Manager: SL/TP, trailing, smart exit (RR ratio/ATR/resistance), partial exits.
  - ML Engine: signal quality classifier (score gate), regime detector, anomaly guard.
  - Persistence: SQLite untuk state strategi, posisi per strategi, statistik, audit.
  - Reporter: PATCH `/api/executor/{id}/command` untuk status command, (opsional) trade report.

## Format Strategi Web (Ringkasan) → Internal Mapping
- `parameters.strategyId`, `strategyName`, `symbol`, `timeframe`
- `rules.entry`:
  - `logic`: `AND` | `OR`
  - `conditions[]`: { `indicator`, `condition`, `value` | `indicatorRef` | literal number, `and`? }
- `rules.exit`:
  - `stopLoss`: { `type`: `pips`|`percentage`|`atr`|`fixed`, nilai terkait }
  - `takeProfit`: { `type`: `pips`|`percentage`|`rr_ratio`|`partial`|`fixed`, konfigurasi partial exits }
  - `trailing`: { `enabled`, `distance` (pips) | `atrMult` }
  - `smartExit`: kombinasi fixed/atr/rr/partial + `maxHoldingHours`
- `riskManagement`: { `lotSize`, `maxPositions`, `maxDailyLoss` }
- `dynamicRisk`: { `riskPercentage`, `useATRSizing`, `volatilityThreshold`, `reduceInHighVolatility` }
- `filters`: `sessionFilter`, `spreadFilter`, `volatilityFilter`, `correlationFilter`

Contoh pemetaan:
- `ema_9 crosses_above ema_21` → hitung EMA(9) & EMA(21); sinyal saat crossing pada bar penutupan (bar-close). Opsi intrabar akan cek tick/partial bar.
- `price greater_than ema_50` → bandingkan close harga terakhir dengan EMA(50).
- `macd crosses_below macd_signal` → kalkulasi MACD dan signal line; deteksi cross.

## Evaluasi & Penjadwalan
- Mode default: evaluasi pada bar-close sesuai `timeframe` strategi (M1/M5/M15/H1/H4/D1).
- Scheduler global per timeframe: setiap timeframe punya task yang membangunkan strategi terkait saat bar baru.
- Intrabar (opsional per strategi): evaluasi setiap N detik, tetap hormati filter spread/ATR; rekomendasi untuk scalping.
- Multi-timeframe (opsional): indikator dari timeframe lebih tinggi diload paralel; cache per TF untuk efisiensi.

## Market Data & Indicator
- Sumber: MT5 `copy_rates_from_pos` untuk candles; `symbol_info_tick` untuk harga saat ini.
- Cache: per simbol/TF/length; invalidasi pada bar baru.
- Indikator yang didukung (awal): EMA, SMA, RSI, MACD, Stochastic (K/D), Bollinger Bands, ATR, ADX, CCI, VWAP sederhana.
- Operator cross: gunakan nilai historis bar-1 vs bar-2 agar tidak repaint; sinyal dikonfirmasi pada bar-close.

## Filters
- Session Filter: allowedSessions [London, NewYork, Asia]; mapping jam broker → local; aksi: disable/scale risk.
- Spread Filter: `enabled`, `maxSpread`, `action`: `SKIP` atau `REDUCE_SIZE` (menerapkan multiplier sizing).
- Volatility Filter: ATR min/max/optimal → aksi `SKIP`/`NORMAL` (atau adjust lot via multiplier).
- Correlation Filter: cek korelasi rolling antar pasangan (window harian), skip jika > threshold saat ada posisi di pair korelasi tinggi.

## Risk & Sizing
- Fixed lots: gunakan `riskManagement.lotSize` jika ada.
- %Equity: hitung lot berdasarkan `riskPercentage` dan SL jarak (pips → nilai moneter per lot via tickValue/tickSize).
- ATR sizing: lot ∝ 1/ATR; gunakan `dynamicRisk.useATRSizing` dan `atrMultiplier` untuk SL.
- Batasan: `maxPositions` per strategi/simbol, `maxDailyLoss` (nominal/%), `maxDrawdown%` global (emergency stop semua strategi).

## Eksekusi Order & Manajemen Posisi
- Open posisi: BUY/SELL dengan SL/TP dihitung dari rules exit; slippage/deviation configurable.
- Modify: update SL/TP saat trailing atau smart exit.
- Trailing stop: jarak pips constant atau ATR; trigger saat profit melebihi threshold.
- Break-even: pindahkan SL ke BE saat RR ≥ X.
- Partial exits: daftar {atRR, percentage}; eksekusi bertahap via market order dengan volume proporsional.
- Close by rule: sinyal lawan atau exit condition terpenuhi.

## ML Integration (Opsional tapi siap pakai)
- Signal Quality Classifier: input fitur (indikator, spread, ATR, sesi, rezim), output score 0-1; gate eksekusi (threshold configurable).
- Regime Detector: klasifikasi trend/range/high-vol untuk adjust sizing/TP/SL.
- Anomaly Guard: deteksi slippage ekstrem, spike spread, latency order → skip/close cepat.
- Mode: `observe-only` (log score) → `enforce` (gate keputusan) setelah kalibrasi.

## LLM Supervisor (AI LLM di Web Platform)
- Arsitektur: Executor TIDAK memanggil LLM langsung. Executor mengirim permintaan supervisi ke Web Platform; Web Platform yang mengeksekusi LLM (tersentralisasi) dan mengembalikan keputusan.
- Keuntungan: kontrol biaya/kuota terpusat, konsistensi kebijakan, audit terpusat, dan keamanan data (prompt sanitization server-side).
- Mode operasi (ditentukan di platform, dikembalikan ke executor): `off` | `observe` | `enforce`.
- Triggers di executor (kapan meminta keputusan):
  - Pre-trade: sebelum OPEN saat kondisi borderline (spread/ATR di tepi batas), ML score rendah (< 0.6), daily loss mendekati limit (> 80%), atau exposure korelasi tinggi.
  - Post-trade & anomaly: slippage/latency outlier, spike spread, reject rate tinggi.
- Kontrak API (di Web Platform):
  - `POST /api/executor/{executorId}/supervisor/evaluate`
    - Headers: `X-API-Key`, `X-API-Secret` (binding ke `executorId`).
    - Body: `{ context: {...}, policyVersion?: string, timeoutMs?: number }`
      - `context` berisi ringkasan fitur: simbol, timeframe, proposed_action, risk, filters, ml summary, posisi singkat.
    - Response (200):
      `{ action: 'allow'|'deny'|'require_confirmation', reason: string, risks: string[], suggestions: string[], score?: number, mode: 'observe'|'enforce'|'off', policyVersion: string, ttlMs?: number }`
    - Error/Timeout: executor fallback sesuai mode lokal (lihat di bawah).
- Fallback & Time Budget di executor:
  - Timeout ketat (mis. 3–6s). Jika tidak ada jawaban:
    - Jika mode platform = `observe`: lanjutkan (allow) sambil log peringatan.
    - Jika mode platform = `enforce`: degrade ke `require_confirmation` atau policy lokal konservatif.
  - Caching: gunakan `ttlMs` untuk reuse keputusan pada konteks yang identik/sejenis (hemat kuota & latensi).
- Keamanan & Audit:
  - Auth via `X-API-Key`/`X-API-Secret` + binding ke `executorId` (konsisten dengan endpoint lain).
  - Minimalkan data yang dikirim (tanpa kredensial/order id sensitif). Platform melakukan masking tambahan sebelum memanggil LLM.
  - Platform mencatat audit lengkap (prompt ringkas, keputusan, alasan, waktu respons, versi model/policy).
- Implementasi executor:
  - Menambah klien HTTP kecil untuk memanggil endpoint platform di atas.
  - Menyimpan keputusan beserta `policyVersion` dan `ttlMs` ke cache lokal (SQLite/memory) untuk reuse singkat.
  - Endpoint lokal `POST /supervisor/evaluate` (opsional) menjadi proxy ke platform untuk keperluan UI/debug.

## Lifecycle & Command Flow
- START_STRATEGY: buat state strategi, pasang scheduler, mulai evaluasi.
- STOP_STRATEGY: hentikan evaluasi, opsi tutup semua posisi milik strategi.
- PAUSE/RESUME: toggle evaluasi tanpa mengubah posisi.
- UPDATE_STRATEGY: muat rules terbaru, reinit evaluator tanpa hentikan jika aman.
- OPEN/CLOSE/MODIFY (manual override dari platform) → kirim order langsung; engine menjaga konsistensi state.
- Reporting: PATCH `/api/executor/{id}/command` dengan status: `received` → `executing` → `executed|failed` + payload hasil (ticket, harga, error).

## Persistensi & Recovery
- Simpan: strategi aktif, konfigurasi, posisi per strategi (mirror dari MT5), statistik harian.
- Startup: pulihkan strategi yang `shouldAutoRestart` (opsional) atau menunggu command (rekomendasi default: command-only).
- Konsistensi: rekonsiliasi posisi lokal vs MT5 saat startup dan setiap heartbeat.

## Kinerja & Reliabilitas
- Caching indikator per simbol/TF; batch fetch candles untuk beberapa strategi yang sama TF/simbol.
- Concurrency: worker pool per TF; batasi jumlah request MT5 bersamaan; retry/backoff order.
- Observability: logging terstruktur, metrik (latensi evaluasi, waktu order, spread, reject rate).

## API Lokal (untuk React UI)
- `GET /health`, `GET /account`, `GET /positions`, `GET /strategies/active`
- `POST /strategies/start|stop|pause|resume|update`
- `POST /orders/open|close|modify`
- `GET /logs/stream` (SSE/WS)
- `POST /supervisor/evaluate` (opsional, untuk preview keputusan LLM di UI)

## Rencana Implementasi (Direvisi)
- Fase 1: Engine inti siap eksekusi (entry/exit parity, EMA/SMA/RSI/MACD/ATR/BB/Stoch, filters session/spread/ATR, sizing fixed/%equity, open/close/modify, trailing, BE, partial exits). UI dasar status.
- Fase 2: MTF, korelasi, dynamic risk (ATR sizing lengkap), smart exit (RR/ATR/resistance), persistence & recovery.
- Fase 3: ML observe-only → enforce, anomaly guard, dashboard ML metrics; LLM Supervisor observe.
- Fase 4: Optimasi kinerja, packaging Windows, QA multi-broker.
- Fase 5: LLM Supervisor enforce (opsional) setelah kalibrasi & UAT.

## Keamanan
- Semua endpoint executor-platform: header `X-API-Key`/`X-API-Secret` + binding `executorId` (sudah di-hardening pada heartbeat/config/command PATCH/active-strategies).
- Kredensial disimpan via Windows Credential Manager (keyring); tidak ditulis ke file teks.
- Rate limit & retry dengan backoff; audit log lokal.

## Catatan
- `windows-executor-v2/backend` menjadi basis implementasi; modul engine akan ditambahkan sesuai rancangan ini.
- UI React mengikuti API lokal; tidak perlu EA/ZeroMQ.
- Backend menyimpan konfigurasi dan log di `%APPDATA%/FXExecutorV2`, sementara API secret disimpan terenkripsi melalui Windows Credential Manager (`keyring`).

## Packaging & Distribusi Windows Executor V2
- Bangun executable backend dengan `windows-executor-v2/backend/build-backend.ps1` → menghasilkan `backend-service.exe`.
- Salin executable ke `windows-executor/resources/backend/backend-service.exe` sebelum menjalankan `electron-builder`; konfigurasi sudah ditambahkan agar resource ini masuk paket.
- Electron main process otomatis meluncurkan backend ketika aplikasi packaged dijalankan dan mematikannya saat keluar (beserta restart otomatis bila backend crash).
- Semua log backend & konfigurasi tersimpan di `%APPDATA%/FXExecutorV2`, sehingga instalasi di `Program Files` tidak membutuhkan hak tulis ekstra.

## Integrasi Web Platform & Delta Endpoint

- Endpoint Supervisi LLM (di Web Platform)
  - `POST /api/executor/{executorId}/supervisor/evaluate`
    - Headers: `X-API-Key`, `X-API-Secret` (dibinding ke `{executorId}`)
    - Body:
      - `context`: ringkasan fitur aman: `{ symbol, timeframe, proposed_action, risk: { lot, sl_pips, tp_pips, daily_loss_pct }, filters: { spread, session, atr }, ml: { signal_score, regime, anomaly }, positions_snapshot: { count, exposureBySymbol? } }`
      - `policyVersion?`: string (opsional untuk audit/konsistensi kebijakan)
      - `timeoutMs?`: number (mis. 3000–6000)
    - Response 200:
      - `{ action: 'allow'|'deny'|'require_confirmation', reason: string, risks: string[], suggestions: string[], score?: number, mode: 'observe'|'enforce'|'off', policyVersion: string, ttlMs?: number }`
    - Error/Timeout:
      - 401/403 untuk kredensial tidak valid/akses channel salah
      - 429 untuk rate-limit (lihat di bawah)
      - 504 untuk timeout LLM; executor lakukan fallback (lihat Fallback)
    - Keamanan & Audit:
      - Validasi header dan binding `executorId`
      - Masking/sanitasi context sebelum panggil LLM (tidak ada kredensial/ticket)
      - Audit: simpan prompt ringkas, latency, model, keputusan, `policyVersion`, userId/executorId
    - Rate Limit & Caching:
      - Rate-limit per executor, mis. 20 req/menit
      - Cache berdasarkan hash context (subset fitur kunci) dengan TTL = `ttlMs` (jika disediakan), untuk hemat kuota & latensi

- Pelaporan Trade (opsi implementasi di Web Platform)
  - Opsi A — Endpoint khusus executor:
    - `POST /api/trades` (Headers: `X-API-Key`, `X-API-Secret`)
    - Body: `open/close/modify` payload standar (ticket, symbol, type, lots, prices, times, sl/tp, profit/commission/swap, strategyId, executorId)
    - Validasi binding ke `executorId` dan ownership `userId`
  - Opsi B — Worker dari hasil command:
    - Executor mengirim hasil lewat `PATCH /api/executor/{id}/command` (sudah ada)
    - Worker di server menulis record `Trade` berdasarkan `result` sukses/closed
  - Rekomendasi: mulai dengan Opsi B (minim endpoint baru), lanjutkan Opsi A jika diperlukan latensi rendah

- Konsistensi & Keamanan Tambahan
  - Semua endpoint executor gunakan `X-API-Key`/`X-API-Secret` + binding `executorId` (config, heartbeat, pusher auth, command PATCH, active-strategies, supervisor evaluate)
  - Logging & audit konsisten; status code standar; CORS hanya jika perlu

## Adapter Normalisasi Rules Web → Engine

- Dukungan dua bentuk rules:
  - Bentuk A (umum): `rules.entry.logic` + `rules.entry.conditions[]`
  - Bentuk B (MTF style): `rules.entry.primary[]` + `rules.entry.confirmation[]`
- Strategi adapter (di executor):
  - Jika ada `conditions[]`: gunakan langsung sebagai Entry set
  - Jika ada `primary/confirmation`: mapping ke evaluator internal:
    - `primary[]` → kondisi dasar timeframe utama
    - `confirmation[]` → daftar konfirmasi (dengan `required`/timeframe) → evaluator MTF
  - Nilai `value` bisa berupa literal (angka) atau referensi indikator/series (mis. `ema_50`, `bollinger_upper`, `price`)
  - Operator `crosses_*` dievaluasi pada bar-close (default) untuk mencegah repaint

## Klien Supervisor di Executor (Proxy ke Platform)

- Klien HTTP kecil memanggil `POST /api/executor/{id}/supervisor/evaluate` dengan headers kunci executor
- Fallback & Time Budget:
  - Timeout 3–6 detik; jika gagal:
    - mode platform `observe` → allow + log
    - mode platform `enforce` → `require_confirmation` atau kebijakan lokal konservatif
- TTL Cache Keputusan:
  - Simpan hasil berdasarkan hash context (subset fitur) dengan TTL dari response `ttlMs`
  - Hindari spam keputusan untuk context identik intraday (hemat kuota)

## Rencana Implementasi Platform (Delta)

- Tambah route: `src/app/api/executor/[id]/supervisor/evaluate/route.ts`
  - Validasi header, binding `id`, rate-limit
  - Panggil layanan LLM Supervisor (reuse util/gaya di `src/lib/supervisor/llm-supervisor.ts`)
  - Terapkan caching keputusan dengan TTL (in‑memory/Redis)
- Pilih mekanisme pelaporan trade:
  - Opsi B (worker dari command result) sebagai langkah awal
  - Opsi A (POST /api/trades untuk executor) jika dibutuhkan real‑time pelaporan langsung

## Kompatibilitas Vercel (Serverless Next.js)

- Runtime dan batasan waktu
  - Gunakan `runtime = 'nodejs'` untuk route supervisor (perlu `bcryptjs` dan Node API). Tambahkan `export const dynamic = 'force-dynamic'` agar tidak di-cache.
  - Batasi waktu eksekusi LLM ≤ 6 detik (batas Vercel serverless umum: 10–60 detik). Kembalikan 504 jika timeout dan terapkan fallback di executor.

- Rate limit dan cache pada lingkungan serverless
  - Hindari in‑memory untuk rate‑limit/caching (tidak persist antar invokasi). Gunakan Upstash Redis / Vercel KV.
  - Skema kunci:
    - Rate limit: `ratelimit:executor:${executorId}` dengan window 60s.
    - Cache keputusan: `supervisor:ctx:${hash(context)}` dengan TTL dari `ttlMs`.

- Panggilan LLM di serverless
  - Lakukan HTTP call ke OpenRouter/OpenAI menggunakan util yang ringan (reuse `src/lib/llm/openrouter.ts`).
  - Simpan API key di Vercel Project Env (Production/Preview/Development), jangan hardcode.

- Pusher & real‑time
  - Endpoint auth Pusher sudah kompatibel serverless; pastikan ringan dan cepat. Tidak perlu WebSocket server sendiri di Vercel.

- Prisma/Database
  - Gunakan koneksi yang kompatibel serverless (pooling provider/Prisma Data Proxy) untuk menghindari connection storm.
  - Tulis data ringkas di route supervisor (audit), hindari operasi berat.

- Pelaporan trade tanpa worker berat
  - Opsi B‑1 (disarankan di Vercel): Tuliskan record `Trade` langsung di handler `PATCH /api/executor/{id}/command` saat status `executed`/`closed` dan payload `result` memiliki data trade lengkap. Ini menghindari job background.
  - Alternatif worker: gunakan Vercel Cron (jadwal) untuk memproses command results tertunda jika diperlukan.

- Keamanan dan logging
  - Seluruh route executor gunakan header `X-API-Key`/`X-API-Secret` + binding `executorId` (sudah dipraktikkan di config/heartbeat/pusher auth/command PATCH/active‑strategies/supervisor evaluate).
  - Logging via `console` (stream ke Vercel), atau integrasi Sentry (sudah ada util sentry di repo).

- Pengurangan ukuran bundle
  - Pisahkan util supervisor gating dari modul optimisasi yang berat; import hanya yang minimal pada route supervisor.
  - Hindari dependensi besar per route agar cold start cepat.
