# NexusTrade Supervisor

Platform web untuk NexusTrade - pusat komando untuk manajemen strategi trading, backtesting, dan supervisi AI.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your database URL and secrets

# 3. Setup database
npm run db:push

# 4. Run development server
npm run dev
```

Visit `http://localhost:3000`

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v5
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (to be added)
- **State Management**: Zustand (optional)
- **HTTP Client**: Axios/SWR

## Project Structure

```
src/
├── app/                  # Next.js App Router
│   ├── (auth)/          # Authentication pages
│   ├── (dashboard)/     # Protected dashboard pages
│   ├── api/            # API routes
│   └── layout.tsx      # Root layout
├── components/          # Reusable React components
│   ├── ui/            # Base UI components
│   ├── strategy/      # Strategy-related components
│   └── common/        # Common components
├── lib/                # Utilities and configurations
│   ├── auth.ts       # NextAuth configuration
│   ├── prisma.ts     # Prisma client
│   ├── crypto.ts     # Encryption utilities
│   └── utils.ts      # Helper functions
├── types/              # TypeScript type definitions
├── hooks/              # Custom React hooks
└── styles/             # Global CSS files
```

## Key Features (Phase 1)

### ✅ Implemented
- User authentication with email/password
- Account lockout protection
- Database schema for all components
- Landing page and login UI
- Protected routes with middleware

### 🚧 In Progress
- User registration
- Dashboard layout
- Strategy management

### 📋 Planned
- Strategy builder UI
- Backtesting engine
- AI integration
- Real-time features

## Development Commands

```bash
npm run dev              # Start dev server
npm run build           # Build for production
npm start               # Run production server
npm run lint            # Lint code
npm run format          # Format with Prettier
npm run type-check      # TypeScript check
npm run db:push         # Sync Prisma schema
npm run db:studio       # Prisma admin UI
```

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - JWT secret (generate with `openssl rand -base64 32`)
- `NEXTAUTH_URL` - Site URL (http://localhost:3000 for dev)

Optional:
- `OPENROUTER_API_KEY` - For AI features
- `STRIPE_SECRET_KEY` - For payments
- `SENTRY_DSN` - For error tracking

## Database

Uses PostgreSQL with Prisma ORM. Schema includes:
- User management with authentication
- Strategy storage and versioning
- Backtest records and results
- Trade execution logs
- API key management
- Audit logging

Run migrations with:
```bash
npm run db:push       # Sync schema
npm run db:migrate    # Create migration
npm run db:studio     # View/edit data
```

## Authentication

- Credentials provider (email/password)
- Account lockout after 5 failed attempts
- Session-based with JWT tokens
- 30-day expiration with 24-hour refresh

OAuth providers (Google, GitHub) to be added in Phase 2.

## Deployment

Ready for Vercel:
```bash
npm run build
```

Environment variables should be set in Vercel dashboard.

## Contributing

1. Follow TypeScript strict mode
2. Use Prettier for formatting
3. Create feature branches from `main`
4. Follow commit message conventions
5. All code must pass linting

## Support

See main documentation in `../docs/` folder for:
- Architecture details
- API specification
- Security guidelines
- Roadmap

---

**Status**: Phase 1 MVP in progress
**Next Update**: Week of Jan 22, 2024
