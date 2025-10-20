# 🔧 CRITICAL BUG FIXES - IMMEDIATE IMPLEMENTATION

## FIX #1: Pip Conversion Logic

### File: `/src/app/api/backtest/route.ts`
**Replace lines 88-91 with:**

```typescript
// Helper function to get correct pip multiplier based on symbol
const getPipMultiplier = (symbol: string): number => {
  // JPY pairs use 0.01
  if (symbol.includes('JPY')) {
    return 0.01;
  }
  
  // Gold uses different multiplier
  if (symbol === 'XAUUSD') {
    return 0.1;
  }
  
  // Crypto pairs don't use pips (use actual price)
  if (symbol.startsWith('BTC') || symbol.startsWith('ETH') || 
      symbol.includes('CRYPTO')) {
    return 1;
  }
  
  // Indices
  if (['US30', 'NAS100', 'SPX500', 'UK100', 'GER40', 'JPN225'].includes(symbol)) {
    return 1;
  }
  
  // Default for major forex pairs
  return 0.0001;
};

// Update the conversion logic
const pipMultiplier = getPipMultiplier(validatedData.symbol);
const stopLossDecimal = stopLossPips * pipMultiplier;
const takeProfitDecimal = takeProfitPips * pipMultiplier;
```

---

## FIX #2: Prevent Race Condition on Backtest Submit

### File: `/src/app/(dashboard)/dashboard/backtest/page.tsx`
**Add debounce and submission tracking:**

```typescript
// Add at component level
const [isSubmitting, setIsSubmitting] = useState(false);
const submitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

// Replace handleRunBacktest function
const handleRunBacktest = async () => {
  // Prevent double submission
  if (isSubmitting) {
    toast.warning('Please wait, backtest is being submitted...');
    return;
  }
  
  if (!formData.strategyId) {
    toast.error('Please select a strategy');
    return;
  }

  if (!formData.symbol) {
    toast.error('Strategy symbol is not set');
    return;
  }
  
  // Validate date range
  const startDate = new Date(formData.startDate);
  const endDate = new Date(formData.endDate);
  
  if (startDate >= endDate) {
    toast.error('End date must be after start date');
    return;
  }
  
  const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff > 365) {
    toast.error('Backtest period cannot exceed 365 days');
    return;
  }

  try {
    setIsSubmitting(true);
    setLoading(true);
    
    // Clear any pending timeout
    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current);
    }
    
    const requestData = {
      ...formData,
      startDate: `${formData.startDate}T00:00:00Z`,
      endDate: `${formData.endDate}T23:59:59Z`,
    };
    
    const response = await fetch('/api/backtest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to start backtest');
    }

    toast.success('Backtest started successfully!');
    setRunningBacktests(prev => new Set(prev).add(data.backtest.id));
    setShowNewBacktest(false);
    await fetchData();
    
  } catch (error: any) {
    toast.error(error.message || 'An error occurred');
  } finally {
    // Reset after delay to prevent rapid re-submission
    submitTimeoutRef.current = setTimeout(() => {
      setIsSubmitting(false);
      setLoading(false);
    }, 2000);
  }
};

// Clean up on unmount
useEffect(() => {
  return () => {
    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current);
    }
  };
}, []);

// Update button to show submission state
<button
  onClick={handleRunBacktest}
  disabled={!formData.strategyId || loading || isSubmitting}
  className={`px-6 py-2 bg-primary-600 text-white rounded-lg 
    ${(!formData.strategyId || loading || isSubmitting) 
      ? 'opacity-50 cursor-not-allowed' 
      : 'hover:bg-primary-700'} 
    transition-colors font-medium`}
>
  {isSubmitting ? 'Submitting...' : loading ? 'Starting...' : 'Run Backtest'}
</button>
```

---

## FIX #3: Add Ownership Check for Strategy Access

### File: `/src/app/api/strategy/[id]/route.ts`
**Add ownership validation:**

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      throw new AppError(401, 'Unauthorized');
    }

    const strategy = await prisma.strategy.findFirst({
      where: {
        id: params.id,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            trades: true,
            backtests: true,
          },
        },
      },
    });

    if (!strategy) {
      throw new AppError(404, 'Strategy not found');
    }

    // CRITICAL: Check ownership
    if (strategy.userId !== session.user.id) {
      // Check if strategy is public
      if (!strategy.isPublic) {
        throw new AppError(403, 'Access denied. You do not own this strategy.');
      }
      // If public, return limited data
      const { rules, ...publicData } = strategy;
      return NextResponse.json(publicData);
    }

    return NextResponse.json(strategy);
  } catch (error) {
    return handleApiError(error);
  }
}
```

---

## FIX #4: Fix Memory Leak in Backtest Polling

### File: `/src/app/(dashboard)/dashboard/backtest/page.tsx`
**Proper cleanup for intervals:**

```typescript
useEffect(() => {
  if (status === 'unauthenticated') {
    redirect('/login');
  }
  
  if (status === 'authenticated') {
    fetchData();
    
    // Set up interval for updating running backtests
    let intervalId: NodeJS.Timeout | null = null;
    
    if (runningBacktests.size > 0) {
      intervalId = setInterval(() => {
        // Only fetch if component is still mounted
        fetchData().catch(console.error);
      }, 5000);
    }

    // Cleanup function
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }
}, [status, runningBacktests.size]); // Fixed dependencies
```

---

## FIX #5: Add Input Validation and Sanitization

### File: `/src/app/api/strategy/route.ts`
**Replace rules validation:**

```typescript
import DOMPurify from 'isomorphic-dompurify';

// Enhanced validation schema
const strategyCreateSchema = z.object({
  name: z.string()
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .refine(val => !/<[^>]*>/g.test(val), 'HTML tags are not allowed'),
  
  description: z.string()
    .max(500, 'Description cannot exceed 500 characters')
    .optional()
    .transform(val => val ? DOMPurify.sanitize(val) : val),
  
  symbol: z.string()
    .min(3)
    .max(20)
    .regex(/^[A-Z0-9]+$/, 'Symbol must contain only uppercase letters and numbers'),
  
  timeframe: z.enum(['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1']),
  
  type: z.enum(['manual', 'automated', 'ai_generated', 'imported']).default('manual'),
  
  rules: z.object({
    entry: z.object({
      conditions: z.array(z.object({
        indicator: z.string(),
        condition: z.enum(['greater_than', 'less_than', 'equals', 'crosses_above', 'crosses_below']),
        value: z.number().nullable(),
        period: z.number().optional(),
      })),
      logic: z.enum(['AND', 'OR']),
    }),
    exit: z.object({
      takeProfit: z.object({
        type: z.enum(['pips', 'percentage', 'amount']),
        value: z.number().positive(),
      }),
      stopLoss: z.object({
        type: z.enum(['pips', 'percentage', 'amount']),
        value: z.number().positive(),
      }),
      trailing: z.object({
        enabled: z.boolean(),
        distance: z.number().nonnegative(),
      }),
    }),
    riskManagement: z.object({
      lotSize: z.number().positive().max(100),
      maxPositions: z.number().int().positive().max(100),
      maxDailyLoss: z.number().positive().max(1000000),
    }),
  }),
  
  isPublic: z.boolean().default(false),
});
```

---

## FIX #6: Implement Rate Limiting

### Create new file: `/src/lib/rate-limit.ts`

```typescript
import { LRUCache } from 'lru-cache';
import { NextRequest } from 'next/server';

type Options = {
  uniqueTokenPerInterval?: number;
  interval?: number;
};

export default function rateLimit(options?: Options) {
  const tokenCache = new LRUCache({
    max: options?.uniqueTokenPerInterval || 500,
    ttl: options?.interval || 60000,
  });

  return {
    check: (req: NextRequest, limit: number, token: string) =>
      new Promise<void>((resolve, reject) => {
        const tokenCount = (tokenCache.get(token) as number[]) || [0];
        if (tokenCount[0] === 0) {
          tokenCache.set(token, [1]);
        }
        tokenCount[0] += 1;

        const currentUsage = tokenCount[0];
        const isRateLimited = currentUsage > limit;
        
        if (isRateLimited) {
          reject(new Error('Rate limit exceeded'));
        } else {
          tokenCache.set(token, tokenCount);
          resolve();
        }
      }),
  };
}

// Usage in API routes
const limiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  uniqueTokenPerInterval: 500,
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(401, 'Unauthorized');
    }

    // Apply rate limiting
    try {
      await limiter.check(request, 10, session.user.id); // 10 requests per minute
    } catch {
      throw new AppError(429, 'Too many requests. Please try again later.');
    }

    // ... rest of the handler
  } catch (error) {
    return handleApiError(error);
  }
}
```

---

## FIX #7: Add Error Boundary

### Create file: `/src/components/ErrorBoundary.tsx`

```tsx
'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to error reporting service
    console.error('Uncaught error:', error, errorInfo);
    
    // Send to monitoring service (e.g., Sentry)
    if (typeof window !== 'undefined' && window.Sentry) {
      window.Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      });
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50">
          <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <h1 className="text-2xl font-bold text-neutral-900">
                Something went wrong
              </h1>
            </div>
            
            <p className="text-neutral-600 mb-4">
              We encountered an unexpected error. The error has been logged and our team will investigate.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-4">
                <summary className="cursor-pointer text-sm text-neutral-500 hover:text-neutral-700">
                  Error details (development only)
                </summary>
                <pre className="mt-2 p-3 bg-neutral-100 rounded text-xs overflow-auto">
                  {this.state.error.toString()}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Try again
              </button>
              
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrap your app in layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
```

---

## FIX #8: Add Loading States

### Create reusable loading component: `/src/components/ui/TableSkeleton.tsx`

```tsx
export function TableSkeleton({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
      <table className="w-full">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-6 py-3">
                <div className="h-4 bg-neutral-200 rounded animate-pulse" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="px-6 py-4">
                  <div className="h-4 bg-neutral-100 rounded animate-pulse" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## IMMEDIATE DEPLOYMENT CHECKLIST

Before deploying any fixes:

1. **Test in Development:**
   ```bash
   npm run dev
   # Run all test scenarios
   npm run test
   ```

2. **Check for TypeScript Errors:**
   ```bash
   npm run type-check
   ```

3. **Run Linter:**
   ```bash
   npm run lint
   ```

4. **Test Build:**
   ```bash
   npm run build
   ```

5. **Security Scan:**
   ```bash
   npm audit
   ```

6. **Database Migration:**
   ```bash
   npx prisma migrate dev
   ```

7. **Environment Variables:**
   - Ensure all required env vars are set
   - Never commit .env files
   - Use secrets management in production

8. **Monitoring Setup:**
   - Configure Sentry or similar
   - Set up alerts for errors
   - Monitor API performance

---

**IMPORTANT:** Deploy these fixes in the order presented. Each fix may depend on the previous one.

**Estimated Time:** 2-3 days for all critical fixes with proper testing

**Risk Level:** LOW if properly tested, HIGH if rushed to production
