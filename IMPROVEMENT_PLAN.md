# 🚀 Practical Improvement Plan - NexusTrade Platform

## Week 1: Component Library & Code Organization

### Day 1-2: Extract Reusable Components

**Task 1: Create Base UI Components**
```bash
mkdir -p src/components/ui
```

```typescript
// src/components/ui/Button.tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  loading,
  children,
  ...props 
}: ButtonProps) {
  const variants = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700',
    secondary: 'border border-neutral-300 text-neutral-700 hover:bg-neutral-50',
    danger: 'bg-red-600 text-white hover:bg-red-700'
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3'
  };
  
  return (
    <button
      className={cn(
        'rounded-lg font-semibold transition-colors',
        variants[variant],
        sizes[size],
        loading && 'opacity-50 cursor-not-allowed',
        props.className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}
```

```typescript
// src/components/ui/Card.tsx
export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-neutral-200 bg-white p-6', className)}>
      {children}
    </div>
  );
}

// src/components/ui/LoadingSpinner.tsx
export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };
  
  return (
    <div className="flex items-center justify-center">
      <div className={cn('animate-spin rounded-full border-4 border-primary-600 border-t-transparent', sizes[size])} />
    </div>
  );
}

// src/components/ui/Skeleton.tsx
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse bg-gray-200 rounded', className)} />
  );
}
```

**Task 2: Extract Form Components**
```typescript
// src/components/forms/StrategyForm.tsx
// Extract the 820-line form into a reusable component
export function StrategyForm({ 
  mode = 'create',
  initialData,
  onSubmit 
}: StrategyFormProps) {
  // Consolidate form logic from new/edit pages
}
```

### Day 3: Create Custom Hooks

```typescript
// src/hooks/useApi.ts
export function useApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setData(data);
      } catch (err) {
        setError(err as Error);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [url]);

  return { data, loading, error, refetch: fetchData };
}

// src/hooks/useWebSocket.ts
export function useWebSocket(channel: string) {
  // Consolidate WebSocket/Pusher logic
}
```

### Day 4-5: Implement Error Boundary & Global Error Handler

```typescript
// src/lib/errors.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function handleApiError(error: unknown): NextResponse {
  // Centralized error handling
  logger.error('API Error:', error);
  
  if (error instanceof z.ZodError) {
    return NextResponse.json({
      error: 'Validation error',
      details: error.errors
    }, { status: 400 });
  }
  
  if (error instanceof AppError) {
    return NextResponse.json({
      error: error.message,
      code: error.code
    }, { status: error.statusCode });
  }
  
  return NextResponse.json({
    error: 'Internal server error'
  }, { status: 500 });
}

// src/components/ErrorBoundary.tsx
export class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error caught by boundary:', error, info);
    // Send to monitoring service
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Card className="max-w-md">
            <h2 className="text-xl font-bold text-red-600 mb-4">
              Something went wrong
            </h2>
            <p className="text-neutral-600 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <Button onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </Card>
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

---

## Week 2: Performance Optimization

### Day 6-7: Database Optimization

```sql
-- migrations/add_performance_indexes.sql
CREATE INDEX CONCURRENTLY idx_trade_strategy_user ON "Trade"("strategyId", "userId");
CREATE INDEX CONCURRENTLY idx_trade_created ON "Trade"("createdAt" DESC);
CREATE INDEX CONCURRENTLY idx_trade_status ON "Trade"("status") WHERE status != 'closed';
CREATE INDEX CONCURRENTLY idx_strategy_user_status ON "Strategy"("userId", "status");
CREATE INDEX CONCURRENTLY idx_backtest_strategy ON "Backtest"("strategyId");
CREATE INDEX CONCURRENTLY idx_backtest_status ON "Backtest"("status") WHERE status = 'running';
```

**Optimize Queries:**
```typescript
// Before: N+1 problem
const strategies = await prisma.strategy.findMany({ where: { userId } });
for (const strategy of strategies) {
  const trades = await prisma.trade.findMany({ where: { strategyId: strategy.id } });
}

// After: Single query with relations
const strategies = await prisma.strategy.findMany({
  where: { userId },
  include: {
    trades: {
      select: {
        id: true,
        profit: true,
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
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

### Day 8: Implement Code Splitting

```typescript
// src/app/(dashboard)/dashboard/strategies/new/page.tsx
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const StrategyForm = dynamic(
  () => import('@/components/forms/StrategyForm'),
  { 
    loading: () => <StrategyFormSkeleton />,
    ssr: false  // Heavy form doesn't need SSR
  }
);

const TemplateSelector = dynamic(
  () => import('@/components/strategy/TemplateSelector')
);

export default function NewStrategyPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StrategyForm />
    </Suspense>
  );
}
```

### Day 9-10: Add Caching Layer

```typescript
// src/lib/cache/query-cache.ts
import { unstable_cache } from 'next/cache';

export const getCachedStrategies = unstable_cache(
  async (userId: string) => {
    return prisma.strategy.findMany({
      where: { userId, deletedAt: null }
    });
  },
  ['strategies'],
  {
    revalidate: 60,  // 1 minute
    tags: ['strategies']
  }
);

// Invalidate cache on mutation
export async function createStrategy(data: any) {
  const strategy = await prisma.strategy.create({ data });
  revalidateTag('strategies');
  return strategy;
}
```

---

## Week 3: Testing Implementation

### Day 11-12: Unit Tests for Critical Functions

```typescript
// src/lib/backtest/__tests__/engine.test.ts
import { transformStrategyRules, convertTimeframe } from '../engine';

describe('Backtest Engine', () => {
  describe('transformStrategyRules', () => {
    it('should transform valid strategy rules', () => {
      const input = mockStrategyRules();
      const result = transformStrategyRules(input);
      
      expect(result).toHaveLength(2);
      expect(result[0].conditions[0].operator).toBe('LT');
    });
    
    it('should handle invalid input gracefully', () => {
      const result = transformStrategyRules(null);
      expect(result).toEqual(getDefaultStrategyRules());
    });
  });
  
  describe('convertTimeframe', () => {
    it.each([
      ['M1', '1min'],
      ['H1', '1h'],
      ['D1', '1d']
    ])('should convert %s to %s', (input, expected) => {
      expect(convertTimeframe(input)).toBe(expected);
    });
  });
});
```

### Day 13: Component Tests

```typescript
// src/components/ui/__tests__/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
  
  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    
    fireEvent.click(screen.getByText('Click'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
  
  it('shows loading state', () => {
    render(<Button loading>Submit</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

### Day 14-15: API Integration Tests

```typescript
// src/app/api/strategy/__tests__/route.test.ts
import { POST } from '../route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';

jest.mock('@/lib/prisma');
jest.mock('next-auth');

describe('POST /api/strategy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('creates strategy with valid data', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user123' }
    });
    
    (prisma.strategy.create as jest.Mock).mockResolvedValue({
      id: 'strategy123',
      name: 'Test Strategy'
    });
    
    const request = createMockRequest({
      method: 'POST',
      body: {
        name: 'Test Strategy',
        symbol: 'EURUSD',
        timeframe: 'H1',
        rules: mockRules
      }
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(201);
    expect(data.id).toBe('strategy123');
  });
  
  it('returns 401 for unauthenticated requests', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    
    const request = createMockRequest({ method: 'POST' });
    const response = await POST(request);
    
    expect(response.status).toBe(401);
  });
});
```

---

## Week 4: Production Readiness

### Day 16-17: Monitoring & Logging

```typescript
// src/lib/monitoring.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event, hint) {
    // Filter sensitive data
    if (event.request?.cookies) {
      delete event.request.cookies;
    }
    return event;
  }
});

// src/lib/logger.ts
export const logger = {
  info: (message: string, meta?: any) => {
    console.log(JSON.stringify({ 
      level: 'info', 
      message, 
      ...meta,
      timestamp: new Date().toISOString()
    }));
  },
  
  error: (message: string, error?: Error, meta?: any) => {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: error?.message,
      stack: error?.stack,
      ...meta,
      timestamp: new Date().toISOString()
    }));
    
    // Send to Sentry in production
    if (process.env.NODE_ENV === 'production') {
      Sentry.captureException(error);
    }
  }
};
```

### Day 18: Add Health Checks

```typescript
// src/app/api/health/route.ts
export async function GET() {
  const checks = {
    database: 'unknown',
    redis: 'unknown',
    pusher: 'unknown',
    timestamp: new Date().toISOString()
  };
  
  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'healthy';
  } catch {
    checks.database = 'unhealthy';
  }
  
  // Check Redis
  try {
    await redis.ping();
    checks.redis = 'healthy';
  } catch {
    checks.redis = 'unhealthy';
  }
  
  // Check Pusher
  checks.pusher = isRealtimeConfigured() ? 'healthy' : 'not configured';
  
  const isHealthy = Object.values(checks).every(
    status => status === 'healthy' || status === 'not configured'
  );
  
  return NextResponse.json(checks, {
    status: isHealthy ? 200 : 503
  });
}
```

### Day 19-20: Documentation

```typescript
/**
 * @openapi
 * /api/strategy:
 *   post:
 *     summary: Create a new trading strategy
 *     tags: [Strategies]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateStrategyInput'
 *     responses:
 *       201:
 *         description: Strategy created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
```

---

## Continuous Improvements

### Monthly Tasks

1. **Performance Review**
   - Analyze bundle sizes
   - Review slow queries
   - Check error rates

2. **Security Audit**
   - Rotate API keys
   - Review dependencies
   - Check for vulnerabilities

3. **User Experience**
   - A/B testing
   - User feedback analysis
   - Feature usage analytics

---

## Success Metrics

- [ ] Component library with 20+ reusable components
- [ ] Test coverage > 60%
- [ ] Bundle size < 200KB per route
- [ ] API response time < 200ms (p95)
- [ ] Error rate < 1%
- [ ] Lighthouse score > 90

---

*This plan focuses on practical, incremental improvements that can be implemented alongside feature development.*
