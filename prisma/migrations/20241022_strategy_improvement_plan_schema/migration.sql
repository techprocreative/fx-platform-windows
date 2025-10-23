-- CreateIndex
DROP INDEX IF EXISTS "LatestScore";

-- AlterTable
ALTER TABLE "Strategy" ADD COLUMN     "correlationFilter" JSONB,
ADD COLUMN     "regimeSettings" JSONB,
ADD COLUMN     "score" JSONB,
ADD COLUMN     "latestScoreId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Strategy_latestScoreId_key" ON "Strategy"("latestScoreId");

-- CreateTable
CREATE TABLE "StrategyPerformance" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trades" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION,
    "profitFactor" DOUBLE PRECISION,
    "regime" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "totalReturn" DOUBLE PRECISION,
    "maxDrawdown" DOUBLE PRECISION,
    "sharpeRatio" DOUBLE PRECISION,
    "avgWin" DOUBLE PRECISION,
    "avgLoss" DOUBLE PRECISION,
    "expectancy" DOUBLE PRECISION,
    "volatilityLevel" TEXT,
    "marketCondition" TEXT,

    CONSTRAINT "StrategyPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketRegimeHistory" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "regime" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trendStrength" DOUBLE PRECISION,
    "volatility" DOUBLE PRECISION,
    "volume" DOUBLE PRECISION,
    "indicators" JSONB,
    "previousRegime" TEXT,
    "transitionReason" TEXT,

    CONSTRAINT "MarketRegimeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegimePerformanceStats" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "regime" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "winningTrades" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgLoss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profitFactor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxDrawdown" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sharpeRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgPositionSize" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxPositionSize" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "riskRewardRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegimePerformanceStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionSizingHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "strategyId" TEXT,
    "tradeId" TEXT,
    "executorId" TEXT,
    "method" TEXT NOT NULL,
    "baseLotSize" DOUBLE PRECISION NOT NULL,
    "adjustedLotSize" DOUBLE PRECISION NOT NULL,
    "riskPercentage" DOUBLE PRECISION,
    "accountBalance" DOUBLE PRECISION,
    "riskAmount" DOUBLE PRECISION,
    "atrValue" DOUBLE PRECISION,
    "volatility" DOUBLE PRECISION,
    "stopLossPips" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION,
    "sessionMultiplier" DOUBLE PRECISION,
    "regimeMultiplier" DOUBLE PRECISION,
    "correlationMultiplier" DOUBLE PRECISION,
    "finalLotSize" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PositionSizingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionSizingConfigHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "strategyId" TEXT,
    "method" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "changedBy" TEXT,
    "changeReason" TEXT,
    "previousConfigId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PositionSizingConfigHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correlation_matrices" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timeframe" TEXT NOT NULL,
    "lookbackPeriod" INTEGER NOT NULL,
    "totalPairs" INTEGER NOT NULL,
    "averageCorrelation" DOUBLE PRECISION NOT NULL,
    "highestCorrelation" DOUBLE PRECISION NOT NULL,
    "lowestCorrelation" DOUBLE PRECISION NOT NULL,
    "volatilityAdjusted" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "correlation_matrices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correlation_entries" (
    "id" TEXT NOT NULL,
    "matrixId" TEXT NOT NULL,
    "symbol1" TEXT NOT NULL,
    "symbol2" TEXT NOT NULL,
    "correlation" DOUBLE PRECISION NOT NULL,
    "pValue" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "standardError" DOUBLE PRECISION NOT NULL,
    "confidenceLow" DOUBLE PRECISION NOT NULL,
    "confidenceHigh" DOUBLE PRECISION NOT NULL,
    "trend" TEXT NOT NULL,
    "changeRate" DOUBLE PRECISION NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "correlation_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historical_correlations" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "correlation" DOUBLE PRECISION NOT NULL,
    "volatility" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "historical_correlations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correlation_groups" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "averageInternalCorrelation" DOUBLE PRECISION NOT NULL,
    "riskFactor" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "correlation_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correlation_group_members" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correlation_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correlation_thresholds" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "adjustedForVolatility" BOOLEAN NOT NULL DEFAULT false,
    "volatilityMultiplier" DOUBLE PRECISION NOT NULL,
    "timeframe" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "correlation_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correlation_analysis_results" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "shouldSkip" BOOLEAN NOT NULL,
    "reason" TEXT,
    "recommendedAction" TEXT NOT NULL,
    "adjustedPositionSize" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION NOT NULL,
    "userId" TEXT NOT NULL,
    "strategyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correlation_analysis_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correlation_conflicts" (
    "id" TEXT NOT NULL,
    "analysisResultId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "correlation" DOUBLE PRECISION NOT NULL,
    "positionSize" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correlation_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correlation_cache" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correlation_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsData" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "strategyId" TEXT,
    "timeframe" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalReturn" DOUBLE PRECISION,
    "returnPercentage" DOUBLE PRECISION,
    "winRate" DOUBLE PRECISION,
    "profitFactor" DOUBLE PRECISION,
    "sharpeRatio" DOUBLE PRECISION,
    "maxDrawdown" DOUBLE PRECISION,
    "maxDrawdownPercent" DOUBLE PRECISION,
    "totalTrades" INTEGER,
    "winningTrades" INTEGER,
    "losingTrades" INTEGER,
    "avgWin" DOUBLE PRECISION,
    "avgLoss" DOUBLE PRECISION,
    "expectancy" DOUBLE PRECISION,
    "var95" DOUBLE PRECISION,
    "sortinoRatio" DOUBLE PRECISION,
    "calmarRatio" DOUBLE PRECISION,
    "skewness" DOUBLE PRECISION,
    "kurtosis" DOUBLE PRECISION,
    "marketRegime" TEXT,
    "volatilityLevel" TEXT,
    "dataSource" TEXT NOT NULL DEFAULT 'trades',
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MultiTimeframeAnalysis" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "primaryTimeframe" TEXT NOT NULL,
    "analysisDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overallSignal" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "timeframeData" JSONB NOT NULL,
    "marketRegime" TEXT,
    "volatility" DOUBLE PRECISION,
    "recommendations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MultiTimeframeAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartExitHistory" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exitType" TEXT NOT NULL,
    "exitConfig" JSONB NOT NULL,
    "marketData" JSONB,
    "exitReason" TEXT,
    "exitPrice" DOUBLE PRECISION,
    "exitTime" TIMESTAMP(3),
    "actualProfit" DOUBLE PRECISION,
    "projectedProfit" DOUBLE PRECISION,
    "improvement" DOUBLE PRECISION,
    "aiAnalysis" JSONB,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmartExitHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartialExitHistory" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "exitSequence" INTEGER NOT NULL,
    "exitPercentage" DOUBLE PRECISION NOT NULL,
    "exitPrice" DOUBLE PRECISION NOT NULL,
    "exitTime" TIMESTAMP(3) NOT NULL,
    "exitConfig" JSONB NOT NULL,
    "exitReason" TEXT,
    "profitAtExit" DOUBLE PRECISION,
    "remainingProfit" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartialExitHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StrategyPerformance_strategyId_date_key" ON "StrategyPerformance"("strategyId", "date");

-- CreateIndex
CREATE INDEX "StrategyPerformance_strategyId_idx" ON "StrategyPerformance"("strategyId");

-- CreateIndex
CREATE INDEX "StrategyPerformance_date_idx" ON "StrategyPerformance"("date");

-- CreateIndex
CREATE INDEX "StrategyPerformance_regime_idx" ON "StrategyPerformance"("regime");

-- CreateIndex
CREATE UNIQUE INDEX "MarketRegimeHistory_symbol_timeframe_timestamp_key" ON "MarketRegimeHistory"("symbol", "timeframe", "timestamp");

-- CreateIndex
CREATE INDEX "MarketRegimeHistory_symbol_timeframe_timestamp_idx" ON "MarketRegimeHistory"("symbol", "timeframe", "timestamp");

-- CreateIndex
CREATE INDEX "MarketRegimeHistory_regime_idx" ON "MarketRegimeHistory"("regime");

-- CreateIndex
CREATE INDEX "MarketRegimeHistory_timestamp_idx" ON "MarketRegimeHistory"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "RegimePerformanceStats_strategyId_regime_timeframe_key" ON "RegimePerformanceStats"("strategyId", "regime", "timeframe");

-- CreateIndex
CREATE INDEX "RegimePerformanceStats_strategyId_regime_idx" ON "RegimePerformanceStats"("strategyId", "regime");

-- CreateIndex
CREATE INDEX "RegimePerformanceStats_timeframe_idx" ON "RegimePerformanceStats"("timeframe");

-- CreateIndex
CREATE INDEX "PositionSizingHistory_userId_idx" ON "PositionSizingHistory"("userId");

-- CreateIndex
CREATE INDEX "PositionSizingHistory_strategyId_idx" ON "PositionSizingHistory"("strategyId");

-- CreateIndex
CREATE INDEX "PositionSizingHistory_tradeId_idx" ON "PositionSizingHistory"("tradeId");

-- CreateIndex
CREATE INDEX "PositionSizingHistory_timestamp_idx" ON "PositionSizingHistory"("timestamp");

-- CreateIndex
CREATE INDEX "PositionSizingHistory_method_idx" ON "PositionSizingHistory"("method");

-- CreateIndex
CREATE INDEX "PositionSizingConfigHistory_userId_idx" ON "PositionSizingConfigHistory"("userId");

-- CreateIndex
CREATE INDEX "PositionSizingConfigHistory_strategyId_idx" ON "PositionSizingConfigHistory"("strategyId");

-- CreateIndex
CREATE INDEX "PositionSizingConfigHistory_method_idx" ON "PositionSizingConfigHistory"("method");

-- CreateIndex
CREATE INDEX "PositionSizingConfigHistory_isActive_idx" ON "PositionSizingConfigHistory"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "correlation_entries_matrixId_symbol1_symbol2_key" ON "correlation_entries"("matrixId", "symbol1", "symbol2");

-- CreateIndex
CREATE UNIQUE INDEX "correlation_group_members_groupId_symbol_key" ON "correlation_group_members"("groupId", "symbol");

-- CreateIndex
CREATE UNIQUE INDEX "correlation_thresholds_symbol_timeframe_key" ON "correlation_thresholds"("symbol", "timeframe");

-- CreateIndex
CREATE UNIQUE INDEX "correlation_cache_key_key" ON "correlation_cache"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsData_userId_strategyId_startDate_endDate_dataSource_key" ON "AnalyticsData"("userId", "strategyId", "startDate", "endDate", "dataSource");

-- CreateIndex
CREATE INDEX "AnalyticsData_userId_idx" ON "AnalyticsData"("userId");

-- CreateIndex
CREATE INDEX "AnalyticsData_strategyId_idx" ON "AnalyticsData"("strategyId");

-- CreateIndex
CREATE INDEX "AnalyticsData_startDate_endDate_idx" ON "AnalyticsData"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "AnalyticsData_dataSource_idx" ON "AnalyticsData"("dataSource");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsCache_userId_cacheKey_key" ON "AnalyticsCache"("userId", "cacheKey");

-- CreateIndex
CREATE INDEX "AnalyticsCache_expiresAt_idx" ON "AnalyticsCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MultiTimeframeAnalysis_strategyId_symbol_analysisDate_key" ON "MultiTimeframeAnalysis"("strategyId", "symbol", "analysisDate");

-- CreateIndex
CREATE INDEX "MultiTimeframeAnalysis_strategyId_idx" ON "MultiTimeframeAnalysis"("strategyId");

-- CreateIndex
CREATE INDEX "MultiTimeframeAnalysis_symbol_idx" ON "MultiTimeframeAnalysis"("symbol");

-- CreateIndex
CREATE INDEX "MultiTimeframeAnalysis_analysisDate_idx" ON "MultiTimeframeAnalysis"("analysisDate");

-- CreateIndex
CREATE INDEX "SmartExitHistory_tradeId_idx" ON "SmartExitHistory"("tradeId");

-- CreateIndex
CREATE INDEX "SmartExitHistory_userId_idx" ON "SmartExitHistory"("userId");

-- CreateIndex
CREATE INDEX "SmartExitHistory_exitType_idx" ON "SmartExitHistory"("exitType");

-- CreateIndex
CREATE INDEX "SmartExitHistory_exitTime_idx" ON "SmartExitHistory"("exitTime");

-- CreateIndex
CREATE INDEX "PartialExitHistory_tradeId_idx" ON "PartialExitHistory"("tradeId");

-- CreateIndex
CREATE INDEX "PartialExitHistory_exitTime_idx" ON "PartialExitHistory"("exitTime");

-- CreateIndex
CREATE UNIQUE INDEX "PartialExitHistory_tradeId_exitSequence_key" ON "PartialExitHistory"("tradeId", "exitSequence");

-- AddForeignKey
ALTER TABLE "StrategyPerformance" ADD CONSTRAINT "StrategyPerformance_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy" ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correlation_entries" ADD CONSTRAINT "correlation_entries_matrixId_fkey" FOREIGN KEY ("matrixId") REFERENCES "correlation_matrices" ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_correlations" ADD CONSTRAINT "historical_correlations_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "correlation_entries" ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correlation_group_members" ADD CONSTRAINT "correlation_group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "correlation_groups" ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correlation_conflicts" ADD CONSTRAINT "correlation_conflicts_analysisResultId_fkey" FOREIGN KEY ("analysisResultId") REFERENCES "correlation_analysis_results" ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex for Strategy latestScoreId
CREATE INDEX "Strategy_latestScoreId_idx" ON "Strategy"("latestScoreId");