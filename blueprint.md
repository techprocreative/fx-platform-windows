Rancangan Final: Ekosistem Trading AI Hibrida (Project Phoenix)

Visi Proyek

Menciptakan sebuah platform Software as a Service (SaaS) yang memberdayakan trader retail dengan alat canggih untuk merancang, menguji, dan mengeksekusi strategi trading secara otomatis. Platform ini menggabungkan kecerdasan buatan dari LLM untuk penciptaan strategi dan supervisi, dengan eksekusi berlatensi rendah melalui aplikasi klien-sisi, serta kontrol penuh melalui perangkat mobile.

Konsep Inti: Arsitektur Terdistribusi (Supervisor, Executor, Remote Control)

Sistem ini membagi tugas ke dalam tiga komponen independen namun terintegrasi, yang berkomunikasi melalui Vercel sebagai pusat saraf.

    Supervisor (Vercel): Otak terpusat untuk manajemen, strategi, dan analisis AI.

    Executor (Windows Client + MT5 EA): Tangan dan sensor di sisi pengguna untuk eksekusi real-time.

    Remote Control (Aplikasi Mobile): Pusat komando portabel untuk monitoring dan intervensi.

1. Arsitektur & Tumpukan Teknologi (Technology Stack)

[Gambar Arsitektur Sistem Lengkap]

1.1. Supervisor (Platform Vercel)

    Tujuan: Pusat komando, manajemen pengguna, dan laboratorium strategi.

    Teknologi:

        Framework: Next.js (TypeScript)

        Styling: Tailwind CSS

        Database Primer: Vercel Postgres

        Cache & Sesi: Vercel KV

        AI Provider: OpenRouter

    Komponen Backend (API Routes):

        /api/auth/...: Registrasi, Login, Manajemen Sesi.

        /api/payment/...: Webhook dari Stripe/Midtrans, manajemen langganan.

        /api/strategy/...: CRUD (Create, Read, Update, Delete) untuk strategi.

        /api/llm/generate-strategy: Menerima prompt bahasa natural -> Menerjemahkannya ke JSON strategi via OpenRouter.

        /api/llm/supervise: Menerima data pasar dari Executor -> Memberikan rekomendasi via OpenRouter.

        /api/backtest: Menjalankan simulasi strategi pada data historis.

        /api/credentials: Generate dan manajemen API Key untuk Executor.

        /api/reporting: Menerima data hasil trade dari Executor.

        /api/command: Menerima perintah dari Remote Control dan menyimpannya untuk dijemput oleh Executor.

1.2. Executor (Aplikasi Windows + EA)

    Tujuan: Eksekusi strategi dengan latensi minimal dan komunikasi efisien dengan Supervisor.

    Teknologi:

        Aplikasi Windows: Python 3.x dengan PyQt6/PySide6 (untuk GUI) dan library Requests (untuk API) & PyZMQ (untuk IPC).

        Expert Advisor (EA): MQL5.

        Komunikasi Internal: ZeroMQ (ZMQ) - Pustaka standar industri untuk Inter-Process Communication berkinerja tinggi.

1.3. Remote Control (Aplikasi Mobile)

    Tujuan: Memberikan kontrol dan visibilitas kepada pengguna dari mana saja.

    Teknologi:

        Framework: React Native (TypeScript) - untuk membangun aplikasi iOS dan Android dari satu basis kode.

2. Alur Kerja Kunci (Key Workflows)

2.1. Alur Pengguna Baru & Pembuatan Strategi

    Registrasi: Pengguna mendaftar di platform web (Vercel) dan memilih paket langganan.

    Pembuatan Strategi: Pengguna masuk ke Strategy Lab.

    Prompt AI: Pengguna mengetik: "Saya ingin strategi trading emas (XAUUSD) di timeframe H1, beli saat MACD cross ke atas dan jual saat cross ke bawah, tambahkan filter ADX di atas 25 untuk memastikan ada tren."

    Terjemahan AI: Vercel mengirim prompt ke OpenRouter, yang mengembalikan strategi dalam format JSON yang terstruktur.

    Backtest: Pengguna menjalankan backtest pada strategi JSON tersebut untuk melihat kinerjanya di masa lalu.

    Aktivasi: Pengguna puas dan mengaktifkan strategi tersebut untuk live trading.

    Setup Klien: Pengguna men-generate API Key dan mengunduh Aplikasi Windows serta file EA.

2.2. Alur Eksekusi Trading & Supervisi

    Inisialisasi: Pengguna menjalankan Aplikasi Windows, memasukkan API Key. Aplikasi melakukan heartbeat untuk validasi langganan dan mengunduh strategi JSON yang aktif dari Vercel.

    Koneksi Lokal: Aplikasi Windows terhubung ke EA di MT5 via ZMQ.

    Evaluasi Lokal: EA mengirim data pasar ke Aplikasi Windows. Aplikasi mengevaluasi data terhadap aturan di file JSON secara lokal di PC pengguna.

    Konsultasi (Opsional): Sebelum membuka trade pada jadwal berita penting, Aplikasi Windows memanggil /api/llm/supervise di Vercel. LLM merekomendasikan "PROCEED" atau "WAIT".

    Eksekusi Cepat: Jika semua kondisi terpenuhi, Aplikasi Windows mengirim perintah BUY/SELL ke EA via ZMQ. Eksekusi terjadi dalam milidetik.

    Pelaporan: Setelah trade ditutup, Aplikasi Windows mengirimkan hasilnya ke /api/reporting di Vercel.

2.3. Alur Intervensi Mobile

    Monitoring: Pengguna membuka aplikasi mobile dan melihat trade yang sedang berjalan (data diambil dari Vercel).

    Perintah: Pengguna menekan tombol "Hentikan Bot & Tutup Semua Posisi".

    Pusat Komando: Aplikasi mobile mengirim perintah ke /api/command di Vercel. Vercel menyimpannya di database.

    Penjemputan Perintah: Dalam siklus polling-nya (misal, setiap 30 detik), Aplikasi Windows menanyakan ke Vercel apakah ada perintah baru.

    Eksekusi Perintah: Aplikasi Windows menerima perintah "HENTIKAN" dan langsung meneruskannya ke EA untuk dieksekusi.

3. Rencana Pengembangan Bertahap (Phased Roadmap)

Fase 1: Minimum Viable Product (MVP) - The Core Platform (3-4 Bulan)

    Tujuan: Meluncurkan platform web yang fungsional di mana pengguna bisa merancang dan menguji strategi.

    Deliverables:

        Sistem Manajemen Pengguna & Langganan (Modul 1) berfungsi penuh.

        Perancang Strategi Visual & Laboratorium Backtesting (Modul 2, tanpa LLM).

        Hub Kredensial & Dashboard Pelaporan dasar (Modul 3).

        Hasil Akhir Fase 1: Platform web yang siap menerima pelanggan, memungkinkan mereka merancang dan menguji strategi, meskipun belum bisa dieksekusi secara otomatis.

Fase 2: The Executor - Menghidupkan Bot (2-3 Bulan)

    Tujuan: Memungkinkan pengguna menjalankan strategi mereka secara live.

    Deliverables:

        Pengembangan Expert Advisor (EA) untuk MT5 (Modul 4).

        Pengembangan Aplikasi Desktop Windows (Modul 5), termasuk sinkronisasi, eksekusi, heartbeat, dan pelaporan.

        Hasil Akhir Fase 2: Produk berfungsi penuh. Pengguna dapat merancang, menguji, dan mengeksekusi strategi secara otomatis.

Fase 3: AI Enhancement - The Brain Upgrade (2 Bulan)

    Tujuan: Mengintegrasikan kecerdasan buatan secara mendalam ke dalam platform.

    Deliverables:

        Integrasi LLM OpenRouter ke dalam Strategy Builder (Mode LLM).

        Implementasi endpoint dan logika Supervisi AI (/api/llm/supervise).

        Penambahan fitur konsultasi AI ke dalam Aplikasi Windows.

        Hasil Akhir Fase 3: Platform menjadi "AI-driven" dan memiliki keunggulan kompetitif yang signifikan.

Fase 4: Mobility & Expansion - The Remote Control (2-3 Bulan)

    Tujuan: Memberikan fleksibilitas penuh kepada pengguna untuk mengontrol bot dari mana saja.

    Deliverables:

        Pengembangan API untuk mendukung aplikasi mobile (/api/command, endpoint status, dll).

        Pengembangan dan peluncuran Aplikasi Mobile (React Native) untuk iOS dan Android.

        Hasil Akhir Fase 4: Ekosistem produk yang lengkap dan matang.

Fase 5: Production Hardening (Berkelanjutan)

    Tujuan: Memastikan keandalan, keamanan, dan skalabilitas platform seiring pertumbuhan pengguna.

    Aktivitas:

        Audit Keamanan (Security Audits).

        Optimasi Kinerja & Database.

        Implementasi sistem Logging, Monitoring, dan Alerting (misal: Sentry, Logtail).

        Pembangunan infrastruktur Customer Support (Help Desk, Dokumentasi).

Rancangan ini menyediakan peta jalan yang jelas dan komprehensif, dari konsep hingga produk yang siap bersaing di pasar, dengan mempertimbangkan skalabilitas, keamanan, dan pengalaman pengguna di setiap langkahnya.
