# NexusTrade - Platform Trading AI Hibrida

## 🎯 Visi & Misi

NexusTrade adalah platform Software-as-a-Service (SaaS) generasi berikutnya yang memdemokratisasi akses terhadap teknologi trading algoritmik canggih untuk trader retail. Platform ini menggabungkan kekuatan AI generatif untuk pembuatan strategi, eksekusi trading berlatensi rendah, dan kontrol penuh melalui perangkat mobile.

### Proposisi Nilai Utama
- **AI-Powered Strategy Generation**: Ubah ide trading dalam bahasa natural menjadi algoritma yang dapat dieksekusi
- **Low-Latency Execution**: Eksekusi lokal untuk performa maksimal
- **Full Remote Control**: Monitor dan kontrol trading dari mana saja
- **Comprehensive Backtesting**: Uji strategi dengan data historis sebelum deployment
- **Risk Management**: Supervisi AI untuk manajemen risiko real-time

## 📋 Struktur Dokumentasi

### Dokumentasi Teknis
- [**Arsitektur Sistem**](docs/architecture.md) - Gambaran lengkap arsitektur terdistribusi
- [**Spesifikasi API**](docs/api-specification.md) - Dokumentasi lengkap endpoint API
- [**Keamanan & Compliance**](docs/security.md) - Standar keamanan dan regulasi

### Komponen Sistem
- [**Supervisor (Vercel Platform)**](docs/components/supervisor.md) - Platform web terpusat
- [**Executor (Windows Client)**](docs/components/executor.md) - Aplikasi klien dan Expert Advisor
- [**Mobile Control**](docs/components/mobile.md) - Aplikasi kontrol mobile

### Panduan Operasional
- [**User Workflows**](docs/workflows.md) - Alur kerja pengguna detail
- [**Development Roadmap**](docs/roadmap.md) - Tahapan pengembangan dan timeline

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ dan npm/yarn
- Python 3.9+ (untuk Executor)
- MetaTrader 5 Terminal
- React Native development environment (untuk mobile app)

### Installation Steps

1. **Clone Repository**
```bash
git clone https://github.com/yourusername/nexustrade.git
cd nexustrade
```

2. **Setup Supervisor (Vercel Platform)**
```bash
cd supervisor
npm install
cp .env.example .env.local
# Configure environment variables
npm run dev
```

3. **Setup Executor (Windows Client)**
```bash
cd executor
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

4. **Setup Mobile App**
```bash
cd mobile
npm install
npx react-native run-android # atau run-ios
```

## 🏗️ Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────┐
│                      USER INTERFACE LAYER                   │
├──────────────┬────────────────┬────────────────────────────┤
│   Web App    │  Mobile App    │    Desktop Client          │
│  (Next.js)   │ (React Native) │    (Python/PyQt)          │
└──────┬───────┴────────┬───────┴──────────┬─────────────────┘
       │                │                   │
       ▼                ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                     SUPERVISOR (VERCEL)                     │
├─────────────────────────────────────────────────────────────┤
│  • Authentication & Authorization                           │
│  • Strategy Management & AI Generation                      │
│  • Backtesting Engine                                      │
│  • Subscription & Billing                                  │
│  • Command Queue & Reporting                               │
└──────────────────────────┬──────────────────────────────────┘
                          │
                          │ WebSocket/REST API
                          │
┌─────────────────────────▼──────────────────────────────────┐
│                    EXECUTOR (CLIENT-SIDE)                   │
├─────────────────────────────────────────────────────────────┤
│  Windows Application     │        MT5 Expert Advisor       │
│  • Strategy Execution    │        • Market Interface       │
│  • Risk Management       │        • Order Management       │
│  • AI Supervision       │        • Data Collection         │
│  • Local Optimization   │        • Trade Execution         │
└──────────────────────────┴──────────────────────────────────┘
                          │
                          │ ZeroMQ IPC
                          ▼
                    MetaTrader 5 Terminal
```

## 📊 Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | Next.js, TypeScript, Tailwind CSS | Web platform UI |
| **Backend** | Vercel Functions, Node.js | API & business logic |
| **Database** | Vercel Postgres, Vercel KV | Data persistence & caching |
| **AI/ML** | OpenRouter API | Strategy generation & supervision |
| **Desktop** | Python, PyQt6, ZeroMQ | Windows client application |
| **Trading** | MQL5, MT5 API | Trading execution |
| **Mobile** | React Native, TypeScript | Cross-platform mobile app |
| **Payment** | Stripe, Midtrans | Subscription management |
| **Monitoring** | Sentry, Vercel Analytics | Error tracking & analytics |

## 🔄 Development Status

| Phase | Status | Target | Description |
|-------|--------|--------|-------------|
| **Phase 1: MVP** | 🚧 In Progress | Q1 2025 | Core platform & strategy builder |
| **Phase 2: Executor** | 📋 Planned | Q2 2025 | Live trading capability |
| **Phase 3: AI Enhancement** | 📋 Planned | Q3 2025 | Deep AI integration |
| **Phase 4: Mobile** | 📋 Planned | Q4 2025 | Mobile control app |
| **Phase 5: Production** | 📋 Planned | 2026 | Scale & optimization |

## 🤝 Contributing

Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is proprietary software. All rights reserved.

## 📞 Contact

- **Email**: support@nexustrade.com
- **Discord**: [Join our community](https://discord.gg/nexustrade)
- **Documentation**: [docs.nexustrade.com](https://docs.nexustrade.com)

---

**NexusTrade** - Empowering Retail Traders with Institutional-Grade Technology
