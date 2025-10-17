# Supervisor Component - Vercel Platform

## Overview

Supervisor adalah otak terpusat dari ekosistem NexusTrade, di-host di Vercel Edge Network untuk performa optimal dan skalabilitas global. Komponen ini menangani semua logika bisnis, manajemen data, dan integrasi AI.

## Arsitektur Teknis

### Technology Stack

```yaml
Runtime Environment:
  Platform: Vercel Edge Functions
  Runtime: Node.js 18.x LTS
  Language: TypeScript 5.x

Framework:
  Frontend: Next.js 14 (App Router)
  API: Next.js API Routes
  Rendering: Server Components + Client Components

Database:
  Primary: Vercel Postgres (Neon)
    - Connection Pooling: PgBouncer
    - Max Connections: 100
    - SSL: Required
  
  Cache: Vercel KV (Upstash Redis)
    - Max Requests: 10,000/day (Pro plan)
    - Max Storage: 1GB
    - TTL Support: Yes
  
  Blob Storage: Vercel Blob
    - Max File Size: 500MB
    - CDN: Automatic

Authentication:
  Library: NextAuth.js v5
  Strategies:
    - Credentials (Email/Password)
    - OAuth (Google, GitHub)
  Session: JWT with secure cookies
  2FA: TOTP via Speakeasy

Styling:
  CSS Framework: Tailwind CSS 3.4
  Component Library: shadcn/ui
  Icons: Lucide React
  Charts: Recharts

AI Integration:
  Provider: OpenRouter
  Models:
    - GPT-4 Turbo (strategy generation)
    - Claude 3 Opus (market analysis)
    - Mixtral 8x7B (fallback)
  
Payment Processing:
  International: Stripe
  Indonesia: Midtrans
  Webhook Security: Signature verification

Monitoring:
  Analytics: Vercel Analytics
  Error Tracking: Sentry
  Logging: Vercel Logs
  APM: Datadog
```

### Project Structure

```
supervisor/
├── app/                        # Next.js App Router
│   ├── (auth)/                # Auth group routes
│   │   ├── login/
│   │   ├── register/
│   │   └── forgot-password/
│   ├── (dashboard)/           # Protected routes
│   │   ├── strategies/
│   │   ├── backtest/
│   │   ├── analytics/
│   │   └── settings/
│   ├── api/                   # API routes
│   │   ├── auth/
│   │   ├── strategy/
│   │   ├── ai/
│   │   ├── executor/
│   │   └── webhook/
│   ├── layout.tsx
│   └── page.tsx
├── components/                 # React components
│   ├── ui/                    # Base UI components
│   ├── strategy/              # Strategy-specific
│   ├── charts/                # Data visualization
│   └── forms/                 # Form components
├── lib/                       # Utility functions
│   ├── db/                    # Database utilities
│   │   ├── schema.ts         # Prisma schema
│   │   ├── queries/          # Database queries
│   │   └── migrations/       # SQL migrations
│   ├── ai/                   # AI integrations
│   │   ├── openrouter.ts
│   │   ├── prompts.ts
│   │   └── parser.ts
│   ├── auth/                 # Auth utilities
│   ├── payment/              # Payment processing
│   └── utils/                # General utilities
├── hooks/                     # Custom React hooks
├── types/                     # TypeScript types
├── public/                    # Static assets
├── prisma/                    # Prisma ORM
│   ├── schema.prisma
│   └── seed.ts
└── middleware.ts              # Next.js middleware
```

## Database Schema

### Core Tables

```sql
-- Users table
CREATE TABLE users (
    id VARCHAR(20) PRIMARY KEY DEFAULT generate_id('usr'),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified TIMESTAMP,
    password_hash VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone_number VARCHAR(20),
    avatar_url TEXT,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Subscriptions table
CREATE TABLE subscriptions (
    id VARCHAR(20) PRIMARY KEY DEFAULT generate_id('sub'),
    user_id VARCHAR(20) REFERENCES users(id),
    plan_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL, -- active, cancelled, expired, paused
    payment_method VARCHAR(20), -- stripe, midtrans
    stripe_subscription_id VARCHAR(255),
    midtrans_order_id VARCHAR(255),
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Strategies table
CREATE TABLE strategies (
    id VARCHAR(20) PRIMARY KEY DEFAULT generate_id('stg'),
    user_id VARCHAR(20) REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    symbol VARCHAR(20) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    type VARCHAR(20) NOT NULL, -- manual, ai_generated
    status VARCHAR(20) DEFAULT 'draft', -- draft, active, paused, archived
    rules JSONB NOT NULL,
    version INTEGER DEFAULT 1,
    ai_prompt TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    INDEX idx_user_status (user_id, status)
);

-- Executors table
CREATE TABLE executors (
    id VARCHAR(20) PRIMARY KEY DEFAULT generate_id('exc'),
    user_id VARCHAR(20) REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    api_secret_hash VARCHAR(255) NOT NULL,
    platform VARCHAR(20) NOT NULL, -- MT5, MT4
    broker_server VARCHAR(255),
    account_number VARCHAR(50),
    status VARCHAR(20) DEFAULT 'offline',
    last_heartbeat TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Trades table
CREATE TABLE trades (
    id VARCHAR(20) PRIMARY KEY DEFAULT generate_id('trd'),
    user_id VARCHAR(20) REFERENCES users(id),
    strategy_id VARCHAR(20) REFERENCES strategies(id),
    executor_id VARCHAR(20) REFERENCES executors(id),
    ticket VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    type VARCHAR(10) NOT NULL, -- BUY, SELL
    lots DECIMAL(10,2) NOT NULL,
    open_time TIMESTAMP NOT NULL,
    open_price DECIMAL(20,5) NOT NULL,
    close_time TIMESTAMP,
    close_price DECIMAL(20,5),
    stop_loss DECIMAL(20,5),
    take_profit DECIMAL(20,5),
    commission DECIMAL(10,2),
    swap DECIMAL(10,2),
    profit DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_user_strategy (user_id, strategy_id),
    INDEX idx_open_time (open_time)
);

-- Commands table
CREATE TABLE commands (
    id VARCHAR(20) PRIMARY KEY DEFAULT generate_id('cmd'),
    user_id VARCHAR(20) REFERENCES users(id),
    executor_id VARCHAR(20) REFERENCES executors(id),
    command VARCHAR(50) NOT NULL,
    parameters JSONB,
    priority VARCHAR(20) DEFAULT 'NORMAL',
    status VARCHAR(20) DEFAULT 'pending',
    result JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    executed_at TIMESTAMP,
    acknowledged_at TIMESTAMP,
    INDEX idx_executor_pending (executor_id, status)
);

-- Backtests table
CREATE TABLE backtests (
    id VARCHAR(20) PRIMARY KEY DEFAULT generate_id('bkt'),
    user_id VARCHAR(20) REFERENCES users(id),
    strategy_id VARCHAR(20) REFERENCES strategies(id),
    status VARCHAR(20) DEFAULT 'pending',
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    initial_balance DECIMAL(10,2),
    settings JSONB,
    results JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    INDEX idx_user_status (user_id, status)
);
```

## Core Modules

### 1. Authentication Module

```typescript
// lib/auth/config.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { verifyPassword, hashPassword } from "./bcrypt";
import { generateTOTP, verifyTOTP } from "./totp";

export const authOptions = {
  providers: [
    Credentials({
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
        totp: { type: "text", optional: true }
      },
      async authorize(credentials) {
        const user = await getUserByEmail(credentials.email);
        
        if (!user || !await verifyPassword(credentials.password, user.passwordHash)) {
          throw new Error("Invalid credentials");
        }
        
        if (user.twoFactorEnabled) {
          if (!credentials.totp || !verifyTOTP(credentials.totp, user.twoFactorSecret)) {
            throw new Error("Invalid 2FA code");
          }
        }
        
        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          subscriptionTier: user.subscription?.planId
        };
      }
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.subscriptionTier = user.subscriptionTier;
      }
      return token;
    },
    async session({ session, token }) {
      session.userId = token.userId;
      session.subscriptionTier = token.subscriptionTier;
      return session;
    }
  },
  pages: {
    signIn: "/login",
    error: "/auth/error"
  }
};
```

### 2. Strategy Builder Module

```typescript
// components/strategy/StrategyBuilder.tsx
import { useState } from 'react';
import { IndicatorSelector } from './IndicatorSelector';
import { ConditionBuilder } from './ConditionBuilder';
import { RiskManagement } from './RiskManagement';
import { BacktestPanel } from './BacktestPanel';

interface StrategyBuilderProps {
  mode: 'visual' | 'ai' | 'code';
  onSave: (strategy: Strategy) => void;
}

export function StrategyBuilder({ mode, onSave }: StrategyBuilderProps) {
  const [strategy, setStrategy] = useState<Strategy>({
    name: '',
    symbol: 'EURUSD',
    timeframe: 'H1',
    rules: {
      entry: { conditions: [], logic: 'AND' },
      exit: { takeProfit: {}, stopLoss: {} },
      riskManagement: {}
    }
  });

  if (mode === 'ai') {
    return <AIStrategyGenerator onGenerate={setStrategy} />;
  }

  if (mode === 'code') {
    return <CodeEditor language="pinescript" onChange={setStrategy} />;
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-8">
        <Card>
          <CardHeader>
            <CardTitle>Strategy Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="entry">
              <TabsList>
                <TabsTrigger value="entry">Entry Conditions</TabsTrigger>
                <TabsTrigger value="exit">Exit Rules</TabsTrigger>
                <TabsTrigger value="risk">Risk Management</TabsTrigger>
              </TabsList>
              
              <TabsContent value="entry">
                <ConditionBuilder
                  conditions={strategy.rules.entry.conditions}
                  onChange={(conditions) => updateEntryRules(conditions)}
                />
              </TabsContent>
              
              <TabsContent value="exit">
                <ExitRulesEditor
                  rules={strategy.rules.exit}
                  onChange={(rules) => updateExitRules(rules)}
                />
              </TabsContent>
              
              <TabsContent value="risk">
                <RiskManagement
                  settings={strategy.rules.riskManagement}
                  onChange={(settings) => updateRiskSettings(settings)}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      
      <div className="col-span-4">
        <BacktestPanel
          strategy={strategy}
          onResults={(results) => setBacktestResults(results)}
        />
      </div>
    </div>
  );
}
```

### 3. AI Integration Module

```typescript
// lib/ai/strategy-generator.ts
import OpenRouter from 'openrouter';
import { z } from 'zod';

const strategySchema = z.object({
  entry: z.object({
    conditions: z.array(z.object({
      indicator: z.string(),
      condition: z.string(),
      value: z.number().optional(),
      period: z.number().optional()
    })),
    logic: z.enum(['AND', 'OR'])
  }),
  exit: z.object({
    takeProfit: z.object({
      type: z.enum(['pips', 'percentage', 'atr']),
      value: z.number()
    }),
    stopLoss: z.object({
      type: z.enum(['pips', 'percentage', 'atr']),
      value: z.number()
    })
  }),
  riskManagement: z.object({
    lotSize: z.number(),
    maxPositions: z.number(),
    maxDailyLoss: z.number().optional()
  })
});

export async function generateStrategy(prompt: string, context: StrategyContext) {
  const systemPrompt = `You are an expert trading strategy designer. Convert the user's natural language description into a structured trading strategy JSON.

Context:
- Symbol: ${context.symbol}
- Timeframe: ${context.timeframe}
- Risk Profile: ${context.riskProfile}

Important guidelines:
1. Use standard technical indicators (RSI, MACD, EMA, SMA, Bollinger Bands, etc.)
2. Ensure risk/reward ratio is at least 1:1.5
3. Include proper stop loss and take profit levels
4. Consider the timeframe when setting parameters`;

  const response = await openrouter.chat.completions.create({
    model: "openai/gpt-4-turbo",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt }
    ],
    temperature: 0.3,
    response_format: { type: "json_object" }
  });

  const strategyJson = JSON.parse(response.choices[0].message.content);
  
  // Validate and parse with Zod
  const validated = strategySchema.parse(strategyJson);
  
  return {
    ...validated,
    aiGenerated: true,
    originalPrompt: prompt,
    model: "gpt-4-turbo"
  };
}
```

### 4. Backtesting Engine

```typescript
// lib/backtest/engine.ts
import { Strategy, Candle, BacktestResult } from '@/types';

export class BacktestEngine {
  private strategy: Strategy;
  private candles: Candle[];
  private balance: number;
  private positions: Position[] = [];
  private trades: Trade[] = [];
  
  constructor(strategy: Strategy, candles: Candle[], initialBalance: number) {
    this.strategy = strategy;
    this.candles = candles;
    this.balance = initialBalance;
  }
  
  async run(): Promise<BacktestResult> {
    const startTime = Date.now();
    
    for (let i = 100; i < this.candles.length; i++) {
      const currentCandle = this.candles[i];
      const historicalData = this.candles.slice(i - 100, i);
      
      // Calculate indicators
      const indicators = await this.calculateIndicators(historicalData);
      
      // Check entry conditions
      if (this.shouldEnter(indicators)) {
        this.openPosition(currentCandle, indicators);
      }
      
      // Check exit conditions for open positions
      this.checkExitConditions(currentCandle, indicators);
      
      // Update P&L
      this.updatePositions(currentCandle);
    }
    
    // Close all remaining positions
    this.closeAllPositions(this.candles[this.candles.length - 1]);
    
    return this.generateReport(startTime);
  }
  
  private calculateIndicators(data: Candle[]): Indicators {
    const closes = data.map(c => c.close);
    
    return {
      RSI: calculateRSI(closes, 14),
      MACD: calculateMACD(closes),
      EMA: {
        20: calculateEMA(closes, 20),
        50: calculateEMA(closes, 50),
        200: calculateEMA(closes, 200)
      },
      ATR: calculateATR(data, 14),
      BollingerBands: calculateBB(closes, 20, 2)
    };
  }
  
  private shouldEnter(indicators: Indicators): boolean {
    const conditions = this.strategy.rules.entry.conditions;
    const logic = this.strategy.rules.entry.logic;
    
    const results = conditions.map(condition => {
      return this.evaluateCondition(condition, indicators);
    });
    
    if (logic === 'AND') {
      return results.every(r => r === true);
    } else {
      return results.some(r => r === true);
    }
  }
  
  private generateReport(startTime: number): BacktestResult {
    const stats = calculateStatistics(this.trades, this.balance);
    
    return {
      executionTime: Date.now() - startTime,
      initialBalance: this.initialBalance,
      finalBalance: this.balance,
      totalReturn: (this.balance - this.initialBalance) / this.initialBalance,
      totalTrades: this.trades.length,
      winningTrades: this.trades.filter(t => t.profit > 0).length,
      losingTrades: this.trades.filter(t => t.profit < 0).length,
      winRate: stats.winRate,
      profitFactor: stats.profitFactor,
      expectancy: stats.expectancy,
      maxDrawdown: stats.maxDrawdown,
      sharpeRatio: stats.sharpeRatio,
      trades: this.trades,
      equityCurve: stats.equityCurve
    };
  }
}
```

### 5. Real-time Communication

```typescript
// app/api/ws/route.ts
import { WebSocketServer } from 'ws';
import { verifyJWT } from '@/lib/auth';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN
});

export async function SOCKET(request: Request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const user = await verifyJWT(token);
  
  if (!user) {
    return new Response('Invalid token', { status: 401 });
  }
  
  const ws = new WebSocketServer({ noServer: true });
  
  ws.on('connection', (socket) => {
    // Subscribe to user's channels
    const channels = [`user:${user.id}`, 'system'];
    
    socket.on('message', async (data) => {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'subscribe':
          await handleSubscribe(socket, user.id, message.channels);
          break;
          
        case 'heartbeat':
          socket.send(JSON.stringify({ type: 'pong' }));
          break;
          
        default:
          socket.send(JSON.stringify({ 
            type: 'error', 
            message: 'Unknown message type' 
          }));
      }
    });
    
    // Setup Redis pub/sub
    const subscriber = redis.duplicate();
    channels.forEach(channel => {
      subscriber.subscribe(channel, (message) => {
        socket.send(message);
      });
    });
    
    socket.on('close', () => {
      subscriber.disconnect();
    });
  });
  
  return new Response(null, {
    status: 101,
    headers: {
      'Upgrade': 'websocket',
      'Connection': 'Upgrade',
    },
  });
}
```

## Environment Variables

```env
# Database
POSTGRES_URL="postgresql://..."
POSTGRES_PRISMA_URL="postgresql://..."
POSTGRES_URL_NON_POOLING="postgresql://..."

# Redis Cache
UPSTASH_REDIS_URL="https://..."
UPSTASH_REDIS_TOKEN="..."

# Authentication
NEXTAUTH_SECRET="random-32-char-string"
NEXTAUTH_URL="https://app.nexustrade.com"

# OAuth Providers
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# AI Integration
OPENROUTER_API_KEY="..."

# Payment Processing
STRIPE_SECRET_KEY="..."
STRIPE_WEBHOOK_SECRET="..."
MIDTRANS_SERVER_KEY="..."
MIDTRANS_CLIENT_KEY="..."

# External Services
SENTRY_DSN="..."
DATADOG_API_KEY="..."

# Email Service
RESEND_API_KEY="..."
FROM_EMAIL="noreply@nexustrade.com"

# Blob Storage
BLOB_READ_WRITE_TOKEN="..."
```

## Performance Optimization

### 1. Edge Caching

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Cache static API responses
  if (request.nextUrl.pathname.startsWith('/api/public')) {
    response.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate');
  }
  
  // Cache strategy data for authenticated users
  if (request.nextUrl.pathname.startsWith('/api/strategy') && 
      request.method === 'GET') {
    response.headers.set('Cache-Control', 'private, max-age=300');
  }
  
  return response;
}
```

### 2. Database Query Optimization

```typescript
// lib/db/queries/strategy.ts
import { prisma } from '@/lib/prisma';
import { unstable_cache } from 'next/cache';

export const getStrategyWithStats = unstable_cache(
  async (strategyId: string, userId: string) => {
    return await prisma.strategy.findFirst({
      where: {
        id: strategyId,
        userId: userId
      },
      include: {
        _count: {
          select: {
            trades: true
          }
        },
        trades: {
          take: 10,
          orderBy: {
            closeTime: 'desc'
          }
        }
      }
    });
  },
  ['strategy'],
  {
    revalidate: 60, // Cache for 60 seconds
    tags: ['strategy']
  }
);
```

### 3. Image Optimization

```typescript
// next.config.js
module.exports = {
  images: {
    domains: ['avatars.nexustrade.com'],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', 'recharts']
  }
};
```

## Security Implementation

### 1. Input Validation

```typescript
// lib/validation/strategy.ts
import { z } from 'zod';

export const createStrategySchema = z.object({
  name: z.string().min(3).max(100),
  symbol: z.string().regex(/^[A-Z]{6,10}$/),
  timeframe: z.enum(['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN']),
  rules: z.object({
    entry: z.object({
      conditions: z.array(conditionSchema).min(1).max(10),
      logic: z.enum(['AND', 'OR'])
    }),
    exit: exitRulesSchema,
    riskManagement: riskManagementSchema
  })
});

export function validateStrategy(data: unknown) {
  try {
    return createStrategySchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error.errors);
    }
    throw error;
  }
}
```

### 2. Rate Limiting

```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

export const rateLimiter = {
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'),
  }),
  
  aiGeneration: new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(10, '1 h'),
  }),
  
  backtest: new Ratelimit({
    redis,
    limiter: Ratelimit.tokenBucket(50, '1 h', 10),
  })
};

export async function checkRateLimit(
  identifier: string, 
  type: 'api' | 'aiGeneration' | 'backtest'
) {
  const { success, limit, reset, remaining } = await rateLimiter[type].limit(identifier);
  
  if (!success) {
    throw new RateLimitError({
      limit,
      reset,
      remaining
    });
  }
  
  return { limit, reset, remaining };
}
```

### 3. CSRF Protection

```typescript
// lib/csrf.ts
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';

export function generateCSRFToken(): string {
  return randomBytes(32).toString('hex');
}

export async function validateCSRFToken(token: string): Promise<boolean> {
  const cookieStore = cookies();
  const storedToken = cookieStore.get('csrf-token')?.value;
  
  if (!storedToken || !token) {
    return false;
  }
  
  return storedToken === token;
}

// Usage in API route
export async function POST(request: Request) {
  const csrfToken = request.headers.get('X-CSRF-Token');
  
  if (!await validateCSRFToken(csrfToken)) {
    return new Response('Invalid CSRF token', { status: 403 });
  }
  
  // Process request...
}
```

## Deployment & CI/CD

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'
      
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test
      - run: npm run test:e2e

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      - uses: vercel/action@v1
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### Monitoring & Alerting

```typescript
// lib/monitoring.ts
import * as Sentry from '@sentry/nextjs';
import { metrics } from '@datadog/browser-rum';

export function initMonitoring() {
  // Sentry for error tracking
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    beforeSend(event, hint) {
      // Scrub sensitive data
      if (event.request?.cookies) {
        delete event.request.cookies;
      }
      return event;
    }
  });
  
  // Datadog for APM
  metrics.init({
    apiKey: process.env.DATADOG_API_KEY,
    service: 'nexustrade-supervisor',
    env: process.env.NODE_ENV
  });
}

// Custom business metrics
export function trackMetric(name: string, value: number, tags?: Record<string, string>) {
  metrics.gauge(name, value, tags);
  
  // Also send to internal analytics
  fetch('/api/analytics', {
    method: 'POST',
    body: JSON.stringify({ name, value, tags })
  });
}
```

## Testing Strategy

### Unit Tests

```typescript
// __tests__/strategy-generator.test.ts
import { generateStrategy } from '@/lib/ai/strategy-generator';

describe('Strategy Generator', () => {
  it('should generate valid strategy from prompt', async () => {
    const prompt = 'Buy EURUSD when RSI < 30';
    const strategy = await generateStrategy(prompt, {
      symbol: 'EURUSD',
      timeframe: 'H1',
      riskProfile: 'moderate'
    });
    
    expect(strategy).toHaveProperty('entry');
    expect(strategy.entry.conditions).toContainEqual(
      expect.objectContaining({
        indicator: 'RSI',
        condition: 'less_than',
        value: 30
      })
    );
  });
});
```

### Integration Tests

```typescript
// __tests__/api/strategy.test.ts
import { createMocks } from 'node-mocks-http';
import handler from '@/app/api/strategy/create/route';

describe('/api/strategy/create', () => {
  it('should create strategy for authenticated user', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'Authorization': 'Bearer valid-token'
      },
      body: {
        name: 'Test Strategy',
        symbol: 'EURUSD',
        // ... strategy data
      }
    });
    
    await handler(req, res);
    
    expect(res._getStatusCode()).toBe(201);
    expect(JSON.parse(res._getData())).toHaveProperty('strategyId');
  });
});
```
