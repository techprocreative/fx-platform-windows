# 🗄️ FX Trading Platform - Database Documentation

## Overview

The FX Trading Platform uses a multi-database architecture designed for high performance, scalability, and data integrity. This document provides comprehensive information about the database design, schema, relationships, and best practices.

## Database Architecture

### Primary Database: PostgreSQL
- **Version**: PostgreSQL 15+
- **Purpose**: Primary transactional data storage
- **Features**: ACID compliance, full-text search, JSON support, advanced indexing

### Cache Layer: Redis
- **Version**: Redis 7+
- **Purpose**: High-speed caching and session storage
- **Features**: Data persistence, pub/sub, distributed locking

### Time Series Database: InfluxDB
- **Version**: InfluxDB 2.0+
- **Purpose**: Time-series data storage for market data and metrics
- **Features**: High write throughput, compression, retention policies

## Database Schema

### Core Tables

#### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user',
    status VARCHAR(20) DEFAULT 'active',
    email_verified BOOLEAN DEFAULT false,
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(32),
    api_key_hash VARCHAR(255),
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;
```

#### Strategies Table
```sql
CREATE TABLE strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL, -- 'manual', 'ai_generated', 'backtested'
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'active', 'inactive', 'archived'
    config JSONB NOT NULL DEFAULT '{}',
    performance_metrics JSONB DEFAULT '{}',
    tags TEXT[],
    version INTEGER DEFAULT 1,
    parent_strategy_id UUID REFERENCES strategies(id),
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_strategies_user_id ON strategies(user_id);
CREATE INDEX idx_strategies_status ON strategies(status);
CREATE INDEX idx_strategies_type ON strategies(type);
CREATE INDEX idx_strategies_created_at ON strategies(created_at);
CREATE INDEX idx_strategies_deleted_at ON strategies(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_strategies_tags ON strategies USING GIN(tags);
CREATE INDEX idx_strategies_config ON strategies USING GIN(config);
```

#### Backtests Table
```sql
CREATE TABLE backtests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id UUID NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'cancelled'
    progress INTEGER DEFAULT 0,
    config JSONB NOT NULL DEFAULT '{}',
    results JSONB DEFAULT '{}',
    performance_metrics JSONB DEFAULT '{}',
    trades JSONB DEFAULT '[]',
    equity_curve JSONB DEFAULT '[]',
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_backtests_strategy_id ON backtests(strategy_id);
CREATE INDEX idx_backtests_user_id ON backtests(user_id);
CREATE INDEX idx_backtests_status ON backtests(status);
CREATE INDEX idx_backtests_created_at ON backtests(created_at);
CREATE INDEX idx_backtests_completed_at ON backtests(completed_at);
CREATE INDEX idx_backtests_config ON backtests USING GIN(config);
```

#### Trades Table
```sql
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
    backtest_id UUID REFERENCES backtests(id) ON DELETE SET NULL,
    broker_id VARCHAR(50),
    symbol VARCHAR(20) NOT NULL,
    type VARCHAR(10) NOT NULL, -- 'buy', 'sell'
    order_type VARCHAR(20) NOT NULL, -- 'market', 'limit', 'stop', 'stop_limit'
    quantity DECIMAL(18, 8) NOT NULL,
    price DECIMAL(18, 8),
    stop_loss DECIMAL(18, 8),
    take_profit DECIMAL(18, 8),
    commission DECIMAL(18, 8) DEFAULT 0,
    swap DECIMAL(18, 8) DEFAULT 0,
    profit DECIMAL(18, 8) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'executed', 'cancelled', 'rejected'
    executed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    reason_code VARCHAR(50),
    external_id VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_strategy_id ON trades(strategy_id);
CREATE INDEX idx_trades_backtest_id ON trades(backtest_id);
CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trades_type ON trades(type);
CREATE INDEX idx_trades_executed_at ON trades(executed_at);
CREATE INDEX idx_trades_created_at ON trades(created_at);
```

#### Risk Limits Table
```sql
CREATE TABLE risk_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'daily_loss', 'max_position', 'max_leverage', etc.
    limit_type VARCHAR(20) NOT NULL, -- 'absolute', 'percentage'
    limit_value DECIMAL(18, 8) NOT NULL,
    current_value DECIMAL(18, 8) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_risk_limits_user_id ON risk_limits(user_id);
CREATE INDEX idx_risk_limits_type ON risk_limits(type);
CREATE INDEX idx_risk_limits_is_active ON risk_limits(is_active);
```

#### Market Data Table
```sql
CREATE TABLE market_data (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    timeframe VARCHAR(10) NOT NULL, -- '1m', '5m', '15m', '1h', '4h', '1d'
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    open_price DECIMAL(18, 8) NOT NULL,
    high_price DECIMAL(18, 8) NOT NULL,
    low_price DECIMAL(18, 8) NOT NULL,
    close_price DECIMAL(18, 8) NOT NULL,
    volume BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX idx_market_data_unique ON market_data(symbol, timeframe, timestamp);
CREATE INDEX idx_market_data_symbol_timeframe ON market_data(symbol, timeframe);
CREATE INDEX idx_market_data_timestamp ON market_data(timestamp);
CREATE INDEX idx_market_data_symbol_timestamp ON market_data(symbol, timestamp);
```

### Audit Tables

#### Audit Log Table
```sql
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(100),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_resource_type ON audit_log(resource_type);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
```

## Database Relationships

### Entity Relationship Diagram

```
Users (1) ──────── (N) Strategies
   │                      │
   │                      │
   │                      └── (1) ──────── (N) Backtests
   │                                         │
   │                                         └── (1) ──────── (N) Trades
   │
   └── (1) ──────── (N) Risk Limits
   └── (1) ──────── (N) Audit Log

Strategies (1) ──────── (N) Trades
```

## Performance Optimizations

### Indexing Strategy

#### Primary Indexes
- All primary keys use UUID with B-tree indexes
- Foreign keys have dedicated indexes for join performance

#### Composite Indexes
```sql
-- Strategy performance queries
CREATE INDEX idx_strategies_user_status_created ON strategies(user_id, status, created_at DESC);

-- Backtest filtering
CREATE INDEX idx_backtests_user_status_created ON backtests(user_id, status, created_at DESC);

-- Trade analysis
CREATE INDEX idx_trades_user_symbol_executed ON trades(user_id, symbol, executed_at DESC);

-- Market data queries
CREATE INDEX idx_market_data_symbol_timeframe_timestamp ON market_data(symbol, timeframe, timestamp DESC);
```

#### Partial Indexes
```sql
-- Active strategies only
CREATE INDEX idx_strategies_active ON strategies(user_id, created_at DESC) 
WHERE status = 'active' AND deleted_at IS NULL;

-- Completed backtests
CREATE INDEX idx_backtests_completed ON backtests(strategy_id, completed_at DESC) 
WHERE status = 'completed';

-- Executed trades
CREATE INDEX idx_trades_executed ON trades(user_id, executed_at DESC) 
WHERE status = 'executed';
```

### Partitioning

#### Time-based Partitioning for Market Data
```sql
-- Create partitioned table for market data
CREATE TABLE market_data_partitioned (
    LIKE market_data INCLUDING ALL
) PARTITION BY RANGE (timestamp);

-- Create monthly partitions
CREATE TABLE market_data_2024_01 PARTITION OF market_data_partitioned
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE market_data_2024_02 PARTITION OF market_data_partitioned
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
```

### Query Optimization

#### Common Query Patterns
```sql
-- User strategies with performance
SELECT s.*, 
       COUNT(b.id) as backtest_count,
       AVG((b.performance_metrics->>'totalReturn')::DECIMAL) as avg_return
FROM strategies s
LEFT JOIN backtests b ON s.id = b.strategy_id AND b.status = 'completed'
WHERE s.user_id = $1 AND s.deleted_at IS NULL
GROUP BY s.id
ORDER BY s.updated_at DESC;

-- Trade performance analysis
SELECT symbol,
       COUNT(*) as trade_count,
       SUM(profit) as total_profit,
       AVG(profit) as avg_profit,
       SUM(CASE WHEN profit > 0 THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as win_rate
FROM trades
WHERE user_id = $1 AND status = 'executed'
GROUP BY symbol
ORDER BY total_profit DESC;

-- Risk limit utilization
SELECT rl.type, rl.limit_value, rl.current_value,
       (rl.current_value / rl.limit_value * 100) as utilization_percentage
FROM risk_limits rl
WHERE rl.user_id = $1 AND rl.is_active = true
ORDER BY utilization_percentage DESC;
```

## Data Integrity

### Constraints
```sql
-- Check constraints
ALTER TABLE strategies ADD CONSTRAINT chk_strategies_version 
CHECK (version >= 1);

ALTER TABLE trades ADD CONSTRAINT chk_trades_quantity 
CHECK (quantity > 0);

ALTER TABLE trades ADD CONSTRAINT chk_trades_prices 
CHECK (price > 0 AND (stop_loss IS NULL OR stop_loss > 0) AND (take_profit IS NULL OR take_profit > 0));

-- Foreign key constraints with proper actions
ALTER TABLE strategies ADD CONSTRAINT fk_strategies_user 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE backtests ADD CONSTRAINT fk_backtests_strategy 
FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE;
```

### Triggers
```sql
-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_strategies_updated_at BEFORE UPDATE ON strategies
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit trigger
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (user_id, action, resource_type, resource_id, old_values, new_values)
    VALUES (
        COALESCE(current_setting('app.current_user_id', true)::UUID, NULL),
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id)::TEXT,
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply audit trigger to critical tables
CREATE TRIGGER audit_strategies_trigger
AFTER INSERT OR UPDATE OR DELETE ON strategies
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
```

## Backup and Recovery

### Backup Strategy
```bash
# Daily full backup
pg_dump -h localhost -U postgres -d fx_platform -f backup_$(date +%Y%m%d).sql

# Hourly incremental backup (WAL archiving)
archive_command = 'cp %p /backup/wal_archive/%f'
```

### Recovery Procedures
```bash
# Point-in-time recovery
pg_ctl start -D /var/lib/postgresql/data
psql -U postgres -d fx_platform -c "SELECT pg_wal_replay_resume();"
```

## Monitoring and Maintenance

### Performance Monitoring
```sql
-- Slow query monitoring
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Table sizes
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Maintenance Tasks
```sql
-- Update statistics
ANALYZE;

-- Rebuild indexes
REINDEX DATABASE fx_platform;

-- Vacuum and analyze
VACUUM ANALYZE;
```

## Security

### Access Control
```sql
-- Read-only user for reporting
CREATE USER reporting_user WITH PASSWORD 'secure_password';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO reporting_user;

-- Application user with limited permissions
CREATE USER app_user WITH PASSWORD 'app_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;
```

### Data Encryption
```sql
-- Enable transparent data encryption (TDE)
-- Requires PostgreSQL 15+ with appropriate extension

-- Column-level encryption for sensitive data
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt API keys
UPDATE users SET api_key_hash = crypt(api_key, gen_salt('bf')) WHERE api_key IS NOT NULL;
```

## Migration Management

### Version Control
```sql
-- Migration tracking table
CREATE TABLE schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Example migration record
INSERT INTO schema_migrations (version) VALUES ('2024_01_20_initial_schema');
```

### Migration Scripts
```bash
# Up migration
migrations/2024_01_20_initial_schema_up.sql

# Down migration
migrations/2024_01_20_initial_schema_down.sql
```

---

**Last Updated**: 2024-01-20  
**Version**: 1.0.0  
**DBA Contact**: dba@fxplatform.com

---

*This database documentation is maintained by the FX Trading Platform database team. For schema changes or updates, please follow the migration process documented above.*