-- CreateTable
CREATE TABLE "RegimeDetectionConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "trendThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.02,
    "volatilityThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.015,
    "rangeThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "lookbackPeriod" INTEGER NOT NULL DEFAULT 20,
    "enableMTF" BOOLEAN NOT NULL DEFAULT false,
    "primaryTimeframe" TEXT NOT NULL DEFAULT 'H1',
    "secondaryTimeframes" TEXT[] DEFAULT ARRAY['M15', 'H4'],
    "enableTrendDetection" BOOLEAN NOT NULL DEFAULT true,
    "enableVolatilityDetection" BOOLEAN NOT NULL DEFAULT true,
    "enableRangeDetection" BOOLEAN NOT NULL DEFAULT true,
    "minConfidence" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "enableNotifications" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnTransition" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegimeDetectionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegimeTransitionHistory" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "fromRegime" TEXT NOT NULL,
    "toRegime" TEXT NOT NULL,
    "transitionTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transitionStrength" DOUBLE PRECISION,
    "volatilityBefore" DOUBLE PRECISION,
    "volatilityAfter" DOUBLE PRECISION,
    "volumeChange" DOUBLE PRECISION,
    "marketEvent" TEXT,
    "newsImpact" TEXT,
    "tradesAffected" INTEGER NOT NULL DEFAULT 0,
    "performanceChange" DOUBLE PRECISION,
    "aiAnalysis" JSONB,
    "confidence" DOUBLE PRECISION,

    CONSTRAINT "RegimeTransitionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegimePrediction" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "currentRegime" TEXT NOT NULL,
    "predictedRegime" TEXT NOT NULL,
    "predictionTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetTime" TIMESTAMP(3) NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "probability" DOUBLE PRECISION NOT NULL,
    "modelType" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "features" JSONB,
    "actualRegime" TEXT,
    "wasCorrect" BOOLEAN,

    CONSTRAINT "RegimePrediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegimeStrategyAdjustment" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "regime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "positionSizeMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "maxPositionSize" DOUBLE PRECISION,
    "stopLossMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "takeProfitMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "trailingStopAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "entryThresholdMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "confirmationRequired" BOOLEAN NOT NULL DEFAULT false,
    "exitThresholdMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "partialExitEnabled" BOOLEAN NOT NULL DEFAULT false,
    "partialExitLevels" JSONB,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profitFactor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sharpeRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegimeStrategyAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegimeDetectionCache" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "regime" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "data" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegimeDetectionCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegimeDetectionConfig_userId_symbol_timeframe_key" ON "RegimeDetectionConfig"("userId", "symbol", "timeframe");

-- CreateIndex
CREATE INDEX "RegimeDetectionConfig_userId_idx" ON "RegimeDetectionConfig"("userId");

-- CreateIndex
CREATE INDEX "RegimeDetectionConfig_symbol_idx" ON "RegimeDetectionConfig"("symbol");

-- CreateIndex
CREATE INDEX "RegimeDetectionConfig_timeframe_idx" ON "RegimeDetectionConfig"("timeframe");

-- CreateIndex
CREATE INDEX "RegimeTransitionHistory_symbol_timeframe_idx" ON "RegimeTransitionHistory"("symbol", "timeframe");

-- CreateIndex
CREATE INDEX "RegimeTransitionHistory_transitionTime_idx" ON "RegimeTransitionHistory"("transitionTime");

-- CreateIndex
CREATE INDEX "RegimeTransitionHistory_fromRegime_toRegime_idx" ON "RegimeTransitionHistory"("fromRegime", "toRegime");

-- CreateIndex
CREATE INDEX "RegimePrediction_symbol_timeframe_idx" ON "RegimePrediction"("symbol", "timeframe");

-- CreateIndex
CREATE INDEX "RegimePrediction_predictionTime_idx" ON "RegimePrediction"("predictionTime");

-- CreateIndex
CREATE INDEX "RegimePrediction_targetTime_idx" ON "RegimePrediction"("targetTime");

-- CreateIndex
CREATE INDEX "RegimePrediction_confidence_idx" ON "RegimePrediction"("confidence");

-- CreateIndex
CREATE INDEX "RegimeStrategyAdjustment_strategyId_idx" ON "RegimeStrategyAdjustment"("strategyId");

-- CreateIndex
CREATE INDEX "RegimeStrategyAdjustment_regime_idx" ON "RegimeStrategyAdjustment"("regime");

-- CreateIndex
CREATE INDEX "RegimeStrategyAdjustment_isActive_idx" ON "RegimeStrategyAdjustment"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RegimeStrategyAdjustment_strategyId_regime_key" ON "RegimeStrategyAdjustment"("strategyId", "regime");

-- CreateIndex
CREATE INDEX "RegimeDetectionCache_symbol_timeframe_idx" ON "RegimeDetectionCache"("symbol", "timeframe");

-- CreateIndex
CREATE INDEX "RegimeDetectionCache_timestamp_idx" ON "RegimeDetectionCache"("timestamp");

-- CreateIndex
CREATE INDEX "RegimeDetectionCache_expiresAt_idx" ON "RegimeDetectionCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RegimeDetectionCache_symbol_timeframe_timestamp_key" ON "RegimeDetectionCache"("symbol", "timeframe", "timestamp");

-- AddForeignKey
ALTER TABLE "RegimeDetectionConfig" ADD CONSTRAINT "RegimeDetectionConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegimeStrategyAdjustment" ADD CONSTRAINT "RegimeStrategyAdjustment_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;