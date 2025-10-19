CREATE INDEX IF NOT EXISTS "Trade_strategy_user_idx" ON "Trade"("strategyId", "userId");
CREATE INDEX IF NOT EXISTS "Strategy_user_status_idx" ON "Strategy"("userId", "status");
