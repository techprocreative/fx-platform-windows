# NexusTrade Setup Guide - Phase 1 MVP

## 🎯 Status Overview

I've initialized the **Supervisor** (Next.js platform) with the following completed:

### ✅ Completed
- Project structure with TypeScript configuration
- Tailwind CSS and styling setup
- Prisma ORM with PostgreSQL schema
- Authentication system (NextAuth.js) with Credentials provider
- Crypto utilities for password hashing
- Type definitions and utilities
- Landing page and login page UI
- Next.js middleware for protected routes
- API route structure for NextAuth

### 📁 Project Structure Created
```
supervisor/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (auth)/         # Auth pages (login, register)
│   │   ├── api/            # API routes
│   │   ├── layout.tsx
│   │   └── page.tsx        # Landing page
│   ├── components/          # React components (to be created)
│   ├── lib/                # Utilities and configurations
│   │   ├── auth.ts         # NextAuth config
│   │   ├── crypto.ts       # Password hashing
│   │   ├── prisma.ts       # Prisma client
│   │   └── utils.ts        # Helper utilities
│   ├── types/              # TypeScript types
│   ├── styles/             # Global CSS
│   └── middleware.ts       # Auth middleware
├── prisma/
│   └── schema.prisma       # Database schema
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
└── .env.example
```

## 🚀 Getting Started

### 1. Navigate to Supervisor Directory
```bash
cd supervisor
```

### 2. Install Dependencies
```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Setup Environment Variables
```bash
cp .env.example .env.local
```

Then edit `.env.local` and configure:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/nexustrade"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
NEXTAUTH_URL="http://localhost:3000"
NODE_ENV="development"
```

### 4. Setup Database

#### Option A: Local PostgreSQL
```bash
# Make sure PostgreSQL is running
# Create database
createdb nexustrade

# Run migrations
npm run db:push

# (Optional) Seed initial data
npm run seed
```

#### Option B: Using Docker
```bash
# Start PostgreSQL container
docker run --name postgres-nexustrade \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=nexustrade \
  -p 5432:5432 \
  -d postgres:15

# Update DATABASE_URL in .env.local:
# DATABASE_URL="postgresql://postgres:password@localhost:5432/nexustrade"

# Run migrations
npm run db:push
```

### 5. Run Development Server
```bash
npm run dev
```

Visit `http://localhost:3000` in your browser.

## 📋 Database Schema Overview

### Core Tables Created

**Users & Authentication:**
- `User` - User accounts with preferences
- `Account` - OAuth provider accounts
- `Session` - Session management
- `VerificationToken` - Email verification
- `UserPreferences` - User settings

**Subscription & Billing:**
- `Subscription` - User subscriptions
- `Invoice` - Payment invoices
- `APIKey` - API key management

**Trading Features:**
- `Strategy` - Trading strategies
- `StrategyVersion` - Strategy version history
- `Executor` - Client executors
- `Trade` - Executed trades
- `Command` - Remote commands
- `Backtest` - Backtest records

**System:**
- `AuditLog` - Security audit trail
- `ActivityLog` - User activity tracking
- `MarketData` - Historical market data

## 🔐 Authentication Setup

### Password Hashing
Using bcryptjs for secure password hashing. Configuration:
- Salt rounds: 10
- Algorithm: bcrypt with automatic salt generation

### Session Management
- Strategy: JWT
- Max age: 30 days
- Update age: 24 hours

### Features Ready
- ✅ Login with email/password
- ✅ Account lockout after 5 failed attempts (15 min)
- ✅ Session validation
- ✅ Middleware protection

### Still to Implement
- [ ] User registration endpoint
- [ ] Email verification
- [ ] Two-factor authentication
- [ ] Password reset flow
- [ ] OAuth providers (Google, GitHub)

## 🛠️ Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run start           # Start production server
npm run lint            # Run ESLint
npm run format          # Format code with Prettier
npm run type-check      # TypeScript check

# Database
npm run db:push         # Sync schema to database
npm run db:migrate      # Create and run migration
npm run db:studio       # Open Prisma Studio
npm run seed            # Seed database with demo data

# Testing (to be configured)
npm test                # Run tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Generate coverage report
```

## 📱 Creating UI Components

### Component Structure Example
```typescript
// src/components/Button.tsx
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'rounded-lg font-semibold transition-colors',
        variant === 'primary' && 'bg-primary-500 text-white hover:bg-primary-600',
        size === 'md' && 'px-4 py-2',
        className
      )}
      {...props}
    />
  );
}
```

## 🔄 API Route Structure

### Example Strategy API Route
```typescript
// src/app/api/strategy/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const body = await req.json();
  
  // Validate and create strategy
  const strategy = await prisma.strategy.create({
    data: {
      ...body,
      userId: session.user.id,
    },
  });

  return NextResponse.json(strategy, { status: 201 });
}
```

## 📊 Next Steps - Priority Order

### Phase 1 - Week 2-3
1. **Create Register Page & API**
   - User registration form
   - Email verification flow
   - Database constraints

2. **Build Dashboard Layout**
   - Sidebar navigation
   - Header with user menu
   - Protected route structure

3. **Strategy Management UI**
   - Strategy list page
   - Create strategy form
   - Strategy detail view
   - Edit/delete actions

### Phase 1 - Week 3-4
4. **Backtesting Engine**
   - Backtest request API
   - Historical data fetching
   - Calculation engine
   - Results visualization

5. **Strategy Builder**
   - Visual condition builder
   - Indicator selection
   - Preview functionality

## 🔗 Integration Points

### Ready to Connect
- NextAuth for authentication ✅
- Prisma for database operations ✅
- Tailwind for styling ✅

### To Configure
- [ ] OpenRouter API (for AI features in Phase 3)
- [ ] Stripe (for payments)
- [ ] Midtrans (for Asian payments)
- [ ] Sentry (for error tracking)
- [ ] Vercel (for deployment)

## 📚 Documentation References

- [Next.js App Router](https://nextjs.org/docs/app)
- [NextAuth.js v5](https://authjs.dev/)
- [Prisma ORM](https://www.prisma.io/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [TypeScript](https://www.typescriptlang.org/docs/)

## 🐛 Troubleshooting

### "DATABASE_URL not found"
Make sure `.env.local` exists in `supervisor/` directory with `DATABASE_URL` set.

### "Module not found" errors
Run `npm install` again and make sure all dependencies are installed.

### Port 3000 already in use
```bash
npm run dev -- -p 3001  # Use different port
```

### Prisma client issues
```bash
npx prisma generate   # Regenerate Prisma client
```

## 📝 Notes

- All passwords are hashed using bcryptjs (10 rounds)
- Sessions use JWT tokens with 30-day expiry
- Database uses PostgreSQL (required for advanced features)
- Tailwind CSS is configured with custom color scheme
- All code is TypeScript for type safety

## 🎓 Learning Resources

For team members new to the stack:
1. Review the `docs/` folder in the parent directory
2. Check out the created types in `src/types/`
3. Look at utility functions in `src/lib/utils.ts`
4. Study the Prisma schema for data relationships

---

**Ready to start development?** Run `npm install && npm run dev` in the `supervisor/` folder!
