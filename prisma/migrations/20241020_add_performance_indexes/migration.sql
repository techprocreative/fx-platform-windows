-- Add indexes for frequently queried fields to improve performance
-- These indexes are based on the optimization plan in IMPROVEMENT_PLAN.md

-- Strategy table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_strategies_user_deleted" ON "strategies"("userId", "deletedAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_strategies_user_status" ON "strategies"("userId", "status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_strategies_symbol_status" ON "strategies"("symbol", "status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_strategies_created_desc" ON "strategies"("createdAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_strategies_name_search" ON "strategies" USING gin(to_tsvector('english', "name"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_strategies_description_search" ON "strategies" USING gin(to_tsvector('english', "description"));

-- Backtest table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_backtests_strategy_status" ON "backtests"("strategyId", "status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_backtests_user_status" ON "backtests"("userId", "status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_backtests_created_desc" ON "backtests"("createdAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_backtests_date_range" ON "backtests"("dateFrom", "dateTo");

-- Trade table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_trades_strategy_user" ON "trades"("strategyId", "userId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_trades_symbol_open_time" ON "trades"("symbol", "openTime" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_trades_executor_status" ON "trades"("executorId", "closeTime") WHERE "closeTime" IS NULL;

-- Command table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_commands_executor_status" ON "commands"("executorId", "status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_commands_priority_created" ON "commands"("priority", "createdAt");

-- Audit log indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_audit_logs_user_timestamp" ON "auditLogs"("userId", "timestamp" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_audit_logs_event_timestamp" ON "auditLogs"("eventType", "timestamp" DESC);

-- Activity log indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_activity_logs_user_timestamp" ON "activityLogs"("userId", "timestamp" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_activity_logs_event_timestamp" ON "activityLogs"("eventType", "timestamp" DESC);

-- Market data indexes for backtesting performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_market_data_symbol_timeframe_timestamp" ON "marketData"("symbol", "timeframe", "timestamp" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_market_data_timestamp_desc" ON "marketData"("timestamp" DESC);

-- Composite index for strategy list with pagination
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_strategies_list_pagination" ON "strategies"("userId", "deletedAt", "createdAt" DESC);

-- Composite index for backtest list with filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_backtests_list_filter" ON "backtests"("userId", "status", "createdAt" DESC);

-- Partial index for active strategies (most commonly queried)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_strategies_active" ON "strategies"("userId", "updatedAt" DESC) WHERE "status" = 'active' AND "deletedAt" IS NULL;

-- Partial index for running backtests
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_backtests_running" ON "backtests"("strategyId", "createdAt" DESC) WHERE "status" = 'running';

-- Partial index for open trades
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_trades_open" ON "trades"("strategyId", "openTime" DESC) WHERE "closeTime" IS NULL;
