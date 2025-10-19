# 🚨 CRITICAL FIXES - Immediate Action Required

## 🔴 Security Emergency (Fix TODAY)

### 1. Exposed Credentials in .env
**DANGER**: Your production credentials are exposed in the repository!

```bash
# IMMEDIATELY run these commands:
# 1. Generate new secrets
openssl rand -base64 32  # For NEXTAUTH_SECRET
openssl rand -hex 32     # For JWT_SECRET

# 2. Rotate database password in Neon dashboard
# 3. Regenerate all API keys (Pusher, OpenRouter, etc.)
# 4. Update Vercel environment variables
```

### 2. Create .env.example (Safe template)
```bash
# Create this file immediately
cat > .env.example << 'EOF'
# Database
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
DATABASE_URL_NON_POOLING="postgresql://user:password@host/database?sslmode=require"

# Auth - Generate with: openssl rand -base64 32
NEXTAUTH_SECRET=""
NEXTAUTH_URL="https://yourdomain.vercel.app"

# APIs - Get from respective dashboards
PUSHER_APP_ID=""
NEXT_PUBLIC_PUSHER_KEY=""
PUSHER_SECRET=""
NEXT_PUBLIC_PUSHER_CLUSTER=""

OPENROUTER_API_KEY=""
TWELVEDATA_API_KEY=""

# Redis
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""

# Security
JWT_SECRET=""  # Generate with: openssl rand -hex 32
API_RATE_LIMIT_MAX_REQUESTS="100"
API_RATE_LIMIT_WINDOW_MS="60000"
EOF
```

### 3. Add .env to .gitignore
```bash
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo ".env.production" >> .gitignore
git rm --cached .env  # Remove from git history
git commit -m "Remove exposed credentials"
```

---

## ⚠️ Performance Critical Issues

### 1. Fix N+1 Query Problem
**File**: `src/app/api/dashboard/stats/route.ts`

```typescript
// WRONG - Multiple queries
const strategies = await prisma.strategy.findMany({ where: { userId } });
for (const strategy of strategies) {
  const trades = await prisma.trade.findMany({ 
    where: { strategyId: strategy.id } 
  });
}

// CORRECT - Single query with include
const strategies = await prisma.strategy.findMany({
  where: { userId },
  include: {
    trades: {
      select: {
        id: true,
        profit: true,
        status: true
      }
    },
    _count: {
      select: {
        trades: true,
        backtests: true
      }
    }
  }
});
```

### 2. Add Database Indexes
**File**: `prisma/schema.prisma`

```prisma
model Trade {
  // ... existing fields ...
  
  @@index([userId, createdAt])
  @@index([strategyId])
  @@index([executorId])
  @@index([status])
}

model Strategy {
  // ... existing fields ...
  
  @@index([userId, status])
  @@index([userId, createdAt])
}

model Backtest {
  // ... existing fields ...
  
  @@index([userId, status])
  @@index([strategyId])
}
```

Run migration:
```bash
npx prisma migrate dev --name add-performance-indexes
```

---

## 🐛 Fix Error Handling

### 1. Create Global Error Handler
**File**: `src/lib/error-handler.ts`

```typescript
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function handleError(error: unknown): NextResponse {
  console.error('API Error:', error);

  // Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Validation error',
        details: error.errors,
      },
      { status: 400 }
    );
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Duplicate record exists' },
        { status: 409 }
      );
    }
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Record not found' },
        { status: 404 }
      );
    }
  }

  // App errors
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }

  // Default error
  return NextResponse.json(
    { 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' 
        ? (error as Error).message 
        : undefined
    },
    { status: 500 }
  );
}

// Wrapper for async route handlers
export function withErrorHandler(
  handler: Function
) {
  return async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleError(error);
    }
  };
}
```

### 2. Use in API Routes
```typescript
// src/app/api/strategy/route.ts
import { withErrorHandler } from '@/lib/error-handler';

export const POST = withErrorHandler(async (request: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new AppError(401, 'Unauthorized');
  }

  const body = await request.json();
  const validated = strategySchema.parse(body); // Will throw ZodError if invalid
  
  const strategy = await prisma.strategy.create({
    data: validated
  });
  
  return NextResponse.json(strategy, { status: 201 });
});
```

---

## 🧪 Add Basic Tests (Minimum Viable Testing)

### 1. Install Testing Dependencies
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom jest-environment-jsdom
```

### 2. Create Test for Critical Function
**File**: `src/lib/backtest/__tests__/engine.test.ts`

```typescript
import { transformStrategyRules } from '../engine';

describe('Backtest Engine', () => {
  describe('transformStrategyRules', () => {
    it('should transform valid strategy rules', () => {
      const input = {
        entry: {
          conditions: [{
            indicator: 'RSI',
            condition: 'less_than',
            value: 30,
            period: 14
          }],
          logic: 'AND'
        },
        exit: {
          takeProfit: { type: 'pips', value: 50 },
          stopLoss: { type: 'pips', value: 25 }
        },
        riskManagement: {
          lotSize: 0.1,
          maxPositions: 5,
          maxDailyLoss: 500
        }
      };

      const result = transformStrategyRules(input);
      
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Entry Rule');
      expect(result[0].conditions[0].indicator).toBe('RSI');
      expect(result[0].conditions[0].operator).toBe('LT');
    });

    it('should return default rules for invalid input', () => {
      const result = transformStrategyRules(null);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Default Entry');
    });
  });
});
```

### 3. Add API Route Test
**File**: `src/app/api/strategy/__tests__/route.test.ts`

```typescript
import { POST } from '../route';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    strategy: {
      create: jest.fn(),
      count: jest.fn()
    }
  }
}));

describe('POST /api/strategy', () => {
  it('should create strategy with valid data', async () => {
    const mockStrategy = { id: '123', name: 'Test Strategy' };
    (prisma.strategy.create as jest.Mock).mockResolvedValue(mockStrategy);
    (prisma.strategy.count as jest.Mock).mockResolvedValue(0);

    const request = new Request('http://localhost:3000/api/strategy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Strategy',
        symbol: 'EURUSD',
        timeframe: 'H1',
        rules: {}
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe('123');
  });
});
```

### 4. Run Tests
```bash
npm test                  # Run all tests
npm run test:coverage     # Check coverage
npm run test:watch       # Watch mode for development
```

---

## 📊 Add Monitoring (Quick Setup)

### 1. Add Sentry for Error Tracking
```bash
npm install @sentry/nextjs
npx @sentry/wizard -i nextjs
```

**File**: `sentry.client.config.ts`
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  beforeSend(event) {
    // Don't send events in development
    if (process.env.NODE_ENV === 'development') {
      return null;
    }
    return event;
  },
});
```

### 2. Add Basic Logging
**File**: `src/lib/logger.ts`

```typescript
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class Logger {
  private log(level: LogLevel, message: string, meta?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta
    };

    // Console log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(JSON.stringify(logEntry, null, 2));
    }

    // Send to logging service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to CloudWatch, LogRocket, etc.
      fetch('/api/logs', {
        method: 'POST',
        body: JSON.stringify(logEntry)
      }).catch(() => {});
    }
  }

  info(message: string, meta?: any) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: any) {
    this.log('warn', message, meta);
  }

  error(message: string, error?: Error, meta?: any) {
    this.log('error', message, {
      ...meta,
      error: error?.message,
      stack: error?.stack
    });
  }

  debug(message: string, meta?: any) {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message, meta);
    }
  }
}

export const logger = new Logger();
```

Use in API routes:
```typescript
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  logger.info('Strategy creation started', { 
    ip: getClientIP(request) 
  });

  try {
    // ... strategy creation logic ...
    logger.info('Strategy created', { strategyId: strategy.id });
    return NextResponse.json(strategy);
  } catch (error) {
    logger.error('Strategy creation failed', error);
    throw error;
  }
}
```

---

## 🚀 Quick Deployment Fix

### Update `vercel.json`:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "env": {
    "DATABASE_URL": "@database_url",
    "NEXTAUTH_SECRET": "@nextauth_secret",
    "NEXTAUTH_URL": "@nextauth_url"
  },
  "functions": {
    "src/app/api/backtest/route.ts": {
      "maxDuration": 60
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options", 
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

---

## ✅ Action Checklist (Do in Order)

1. **Hour 1**: 
   - [ ] Rotate all credentials
   - [ ] Remove .env from git
   - [ ] Create .env.example

2. **Hour 2**:
   - [ ] Fix error handling
   - [ ] Add database indexes
   - [ ] Fix N+1 queries

3. **Day 1**:
   - [ ] Add Sentry monitoring
   - [ ] Create basic tests
   - [ ] Add logging

4. **Week 1**:
   - [ ] Achieve 30% test coverage
   - [ ] Fix all security headers
   - [ ] Optimize performance

Remember: **Security first, then stability, then features!**

---

*Critical fixes identified by platform audit*  
*Priority: IMMEDIATE ACTION REQUIRED*
