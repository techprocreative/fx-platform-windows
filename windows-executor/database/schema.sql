-- FX Platform Executor Database Schema
-- SQLite with encryption support

-- Configuration table
CREATE TABLE config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key VARCHAR(255) UNIQUE NOT NULL,
  value TEXT,
  encrypted BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- MT5 installations table
CREATE TABLE mt5_installations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path VARCHAR(500) NOT NULL,
  data_path VARCHAR(500) NOT NULL,
  version VARCHAR(50),
  build INTEGER,
  library_path VARCHAR(500),
  experts_path VARCHAR(500),
  is_running BOOLEAN DEFAULT FALSE,
  broker VARCHAR(100),
  account_number VARCHAR(50),
  is_active BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Command queue table
CREATE TABLE command_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command_id VARCHAR(255) UNIQUE NOT NULL,
  command_type VARCHAR(50) NOT NULL,
  priority VARCHAR(20) DEFAULT 'NORMAL',
  status VARCHAR(20) DEFAULT 'PENDING',
  parameters TEXT,
  received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  executed_at DATETIME,
  result TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  INDEX idx_command_id (command_id),
  INDEX idx_status (status),
  INDEX idx_priority (priority),
  INDEX idx_received_at (received_at)
);

-- Safety limits table
CREATE TABLE safety_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) NOT NULL,
  value REAL NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Trade history table
CREATE TABLE trade_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket INTEGER NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  type VARCHAR(10) NOT NULL,
  volume REAL NOT NULL,
  open_price REAL NOT NULL,
  close_price REAL,
  open_time DATETIME NOT NULL,
  close_time DATETIME,
  profit REAL,
  commission REAL,
  swap REAL,
  comment TEXT,
  magic_number INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Performance metrics table
CREATE TABLE performance_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  profit REAL DEFAULT 0,
  loss REAL DEFAULT 0,
  max_drawdown REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(date)
);

-- Logs table
CREATE TABLE logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME NOT NULL,
  level VARCHAR(10) NOT NULL,
  category VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_timestamp (timestamp),
  INDEX idx_level (level),
  INDEX idx_category (category)
);

-- Insert default safety limits
INSERT INTO safety_limits (name, value, description) VALUES
('max_daily_loss', 500, 'Maximum daily loss limit in USD'),
('max_positions', 10, 'Maximum number of open positions'),
('max_lot_size', 1.0, 'Maximum lot size per trade'),
('max_drawdown_percent', 20, 'Maximum drawdown percentage');

-- Insert default configuration
INSERT INTO config (key, value, encrypted) VALUES
('executor_id', '', FALSE),
('api_key', '', TRUE),
('api_secret', '', TRUE),
('platform_url', 'https://platform.com', FALSE),
('pusher_key', '', FALSE),
('pusher_cluster', 'mt1', FALSE),
('zmq_port', 5555, FALSE),
('zmq_host', 'tcp://localhost', FALSE),
('heartbeat_interval', 60, FALSE),
('auto_reconnect', 'true', FALSE);

-- Create triggers for updated_at timestamps
CREATE TRIGGER config_updated_at AFTER UPDATE ON config
BEGIN
  UPDATE config SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER mt5_installations_updated_at AFTER UPDATE ON mt5_installations
BEGIN
  UPDATE mt5_installations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER safety_limits_updated_at AFTER UPDATE ON safety_limits
BEGIN
  UPDATE safety_limits SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER performance_metrics_updated_at AFTER UPDATE ON performance_metrics
BEGIN
  UPDATE performance_metrics SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;