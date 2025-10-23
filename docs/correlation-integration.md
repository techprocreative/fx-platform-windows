# Correlation-Based Trading System Integration Guide

This document explains how to integrate the correlation-based trading system into your existing forex trading platform.

## Overview

The correlation-based trading system consists of the following components:

1. **Type Definitions** (`src/types/index.ts`)
2. **Correlation Analyzer** (`src/lib/market/correlation.ts`)
3. **Signal Generator Integration** (`src/lib/signals/generator.ts`)
4. **Risk Manager Integration** (`src/lib/risk/risk-manager.ts`)
5. **API Endpoint** (`src/app/api/market/correlation/route.ts`)
6. **Visualizer Component** (`src/components/correlation/CorrelationMatrix.tsx`)
7. **Database Schema** (`prisma/correlation-schema.prisma`)
8. **Database Service** (`src/lib/db/correlation-service.ts`)

## Integration Steps

### 1. Database Schema Integration

Add the correlation tables to your main Prisma schema:

```prisma
// Add these models to your prisma/schema.prisma file

model CorrelationMatrix {
  id          String   @id @default(cuid())
  timestamp   DateTime @default(now())
  timeframe   String
  lookbackPeriod Int
  totalPairs  Int
  averageCorrelation Float
  highestCorrelation Float
  lowestCorrelation Float
  volatilityAdjusted Boolean @default(false)
  metadata    Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  correlationEntries CorrelationEntry[]
  
  @@map("correlation_matrices")
}

model CorrelationEntry {
  id                String @id @default(cuid())
  matrixId          String
  symbol1           String
  symbol2           String
  correlation       Float
  pValue            Float
  sampleSize        Int
  standardError     Float
  confidenceLow     Float
  confidenceHigh    Float
  trend             String
  changeRate        Float
  lastUpdated       DateTime @default(now())
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  matrix            CorrelationMatrix @relation(fields: [matrixId], references: [id], onDelete: Cascade)
  historicalData    HistoricalCorrelation[]
  
  @@unique([matrixId, symbol1, symbol2])
  @@map("correlation_entries")
}

model HistoricalCorrelation {
  id                String @id @default(cuid())
  entryId           String
  date              DateTime
  correlation       Float
  volatility        Float
  
  entry             CorrelationEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  
  @@map("historical_correlations")
}

model CorrelationAnalysisResult {
  id                    String @id @default(cuid())
  symbol                String
  shouldSkip            Boolean
  reason                String?
  recommendedAction      String
  adjustedPositionSize  Float?
  confidence            Float
  userId                String
  strategyId            String?
  createdAt             DateTime @default(now())
  
  conflictingPositions   CorrelationConflict[]
  
  @@map("correlation_analysis_results")
}

model CorrelationConflict {
  id                String @id @default(cuid())
  analysisResultId  String
  symbol            String
  correlation       Float
  positionSize      Float
  createdAt         DateTime @default(now())
  
  analysisResult    CorrelationAnalysisResult @relation(fields: [analysisResultId], references: [id], onDelete: Cascade)
  
  @@map("correlation_conflicts")
}

model CorrelationThreshold {
  id                    String @id @default(cuid())
  symbol                String
  threshold             Float
  adjustedForVolatility Boolean @default(false)
  volatilityMultiplier  Float
  timeframe             String
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt)
  
  @@unique([symbol, timeframe])
  @@map("correlation_thresholds")
}

model CorrelationGroup {
  id                        String @id @default(cuid())
  currency                  String
  averageInternalCorrelation Float
  riskFactor                Float
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt
  
  groupMembers              CorrelationGroupMember[]
  
  @@map("correlation_groups")
}

model CorrelationGroupMember {
  id       String @id @default(cuid())
  groupId  String
  symbol   String
  createdAt DateTime @default(now())
  
  group    CorrelationGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  
  @@unique([groupId, symbol])
  @@map("correlation_group_members")
}

model CorrelationCache {
  id         String @id @default(cuid())
  key        String @unique
  data       Json
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  
  @@map("correlation_cache")
}
```

After adding these models, run:

```bash
npx prisma migrate dev --name "add-correlation-tables"
npx prisma generate
```

### 2. Strategy Form Integration

The correlation filter UI is already integrated into the StrategyForm component. To enable it:

1. Ensure the CorrelationFilter type is imported in your StrategyForm
2. The correlation filter state is already handled in the form
3. The filter data is automatically included in the strategy rules when saved

### 3. Signal Generator Integration

The signal generator has been updated to include correlation filtering:

1. When generating signals, it checks the correlation filter
2. If highly correlated positions exist, it may skip or adjust the signal
3. The correlation analysis result is included in the signal metadata

### 4. Risk Manager Integration

The risk manager has been updated to include correlation-based position limits:

1. Trade validation now includes correlation checks
2. Position limits are adjusted based on currency group correlations
3. Position sizes may be reduced for highly correlated pairs

### 5. API Integration

The correlation API endpoint provides:

- Correlation matrix calculation
- Correlation analysis for trading signals
- Historical correlation data
- Currency group information
- Dynamic threshold calculation

### 6. Frontend Integration

The CorrelationMatrix component provides:

- Interactive heatmap visualization
- Real-time correlation data updates
- Export functionality
- Currency group highlighting
- Trend indicators

## Usage Examples

### 1. Enabling Correlation Filter in a Strategy

```typescript
const strategyRules = {
  // ... other strategy rules
  correlationFilter: {
    enabled: true,
    maxCorrelation: 0.7,
    checkPairs: ['EURUSD', 'GBPUSD', 'USDJPY'],
    skipHighlyCorrelated: true,
    timeframes: ['H1', 'H4', 'D1'],
    lookbackPeriod: 30,
    minDataPoints: 20,
    updateFrequency: 24,
    dynamicThreshold: false,
    groupByCurrency: true
  }
};
```

### 2. Using the Correlation API

```typescript
// Get correlation matrix
const response = await fetch('/api/market/correlation?action=matrix&symbols=EURUSD,GBPUSD,USDJPY&timeframe=H1&lookbackPeriod=30');
const data = await response.json();

// Analyze correlation for a signal
const analysisResponse = await fetch('/api/market/correlation?action=analyze&symbol=EURUSD&filter=' + encodeURIComponent(JSON.stringify(correlationFilter)));
const analysisData = await analysisResponse.json();
```

### 3. Using the Visualizer Component

```typescript
import { CorrelationMatrixVisualizer } from '@/components/correlation/CorrelationMatrix';

function MyComponent() {
  return (
    <CorrelationMatrixVisualizer
      symbols={['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD']}
      timeframe="H1"
      lookbackPeriod={30}
      onCellClick={(symbol1, symbol2, correlation) => {
        console.log(`Correlation between ${symbol1} and ${symbol2}: ${correlation.correlation}`);
      }}
    />
  );
}
```

## Performance Considerations

1. **Caching**: Correlation matrices are cached to avoid recalculating them frequently
2. **Batch Processing**: Correlation calculations are done in batches for efficiency
3. **Data Cleanup**: Old correlation data is automatically cleaned up (default: 30 days)
4. **Async Processing**: Correlation calculations are performed asynchronously to avoid blocking

## Monitoring and Maintenance

1. **Database Monitoring**: Monitor the size of correlation tables and implement appropriate retention policies
2. **Performance Metrics**: Track correlation calculation times and API response times
3. **Error Handling**: Implement proper error handling for correlation calculation failures
4. **Data Quality**: Regularly validate correlation data for accuracy and consistency

## Security Considerations

1. **Access Control**: Ensure proper access controls for correlation data
2. **Data Privacy**: Correlation data doesn't contain sensitive user information
3. **Rate Limiting**: Implement rate limiting for correlation API endpoints
4. **Input Validation**: Validate all input parameters for correlation calculations

## Testing

Run the correlation tests to verify functionality:

```bash
npm test -- --testPathPattern=correlation
```

## Troubleshooting

### Common Issues

1. **Missing Correlation Data**: Ensure the correlation calculation job is running
2. **High Memory Usage**: Limit the number of symbols in correlation calculations
3. **Slow API Response**: Check database indexes and query optimization
4. **Inaccurate Correlations**: Verify price data quality and lookback periods

### Debug Mode

Enable debug logging for correlation calculations:

```typescript
// In your environment variables
DEBUG=correlation:*
```

## Future Enhancements

1. **Real-time Correlation Updates**: Implement WebSocket-based real-time updates
2. **Machine Learning Integration**: Use ML models to predict correlation changes
3. **Multi-asset Correlation**: Extend to include commodities, indices, and cryptocurrencies
4. **Advanced Visualization**: Implement 3D correlation visualization and network graphs