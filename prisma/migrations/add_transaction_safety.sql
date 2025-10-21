-- Migration: Add Transaction Safety System
-- Description: Adds stored procedures for safe trade execution with proper transaction handling

-- Create function to execute trade safely within a transaction
CREATE OR REPLACE FUNCTION execute_trade_safely(
  p_user_id VARCHAR,
  p_strategy_id VARCHAR,
  p_executor_id VARCHAR,
  p_symbol VARCHAR,
  p_type VARCHAR,
  p_lots FLOAT,
  p_open_price FLOAT,
  p_stop_loss FLOAT DEFAULT NULL,
  p_take_profit FLOAT DEFAULT NULL,
  p_magic_number INT DEFAULT NULL,
  p_comment VARCHAR DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_trade_id VARCHAR;
  v_user_balance FLOAT;
  v_user_risk_exposure FLOAT;
  v_strategy_active BOOLEAN;
  v_executor_online BOOLEAN;
  v_error_message VARCHAR;
  v_audit_id VARCHAR;
BEGIN
  -- Start transaction
  BEGIN
    -- Check if user exists and is not locked
    IF NOT EXISTS (SELECT 1 FROM "User" WHERE id = p_user_id AND locked = false AND deletedAt IS NULL) THEN
      v_error_message := 'User not found or locked';
      RAISE EXCEPTION '%', v_error_message;
    END IF;
    
    -- Check if strategy exists and is active
    SELECT status INTO v_strategy_active FROM "Strategy" WHERE id = p_strategy_id AND userId = p_user_id AND deletedAt IS NULL;
    IF v_strategy_active IS NULL OR v_strategy_active != 'active' THEN
      v_error_message := 'Strategy not found or not active';
      RAISE EXCEPTION '%', v_error_message;
    END IF;
    
    -- Check if executor exists and is online
    SELECT status INTO v_executor_online FROM "Executor" WHERE id = p_executor_id AND userId = p_user_id AND deletedAt IS NULL;
    IF v_executor_online IS NULL OR v_executor_online != 'online' THEN
      v_error_message := 'Executor not found or not online';
      RAISE EXCEPTION '%', v_error_message;
    END IF;
    
    -- Get user's current balance and risk exposure
    SELECT 
      COALESCE(SUM(t.profit), 0) as risk_exposure
    INTO v_user_risk_exposure
    FROM "Trade" t
    WHERE t.userId = p_user_id AND t.closeTime IS NULL;
    
    -- Validate trade parameters
    IF p_lots <= 0 OR p_lots > 100 THEN
      v_error_message := 'Invalid lot size';
      RAISE EXCEPTION '%', v_error_message;
    END IF;
    
    IF p_open_price <= 0 THEN
      v_error_message := 'Invalid open price';
      RAISE EXCEPTION '%', v_error_message;
    END IF;
    
    -- Create trade record
    INSERT INTO "Trade" (
      userId,
      strategyId,
      executorId,
      ticket,
      symbol,
      type,
      lots,
      openTime,
      openPrice,
      stopLoss,
      takeProfit,
      magicNumber,
      comment
    ) VALUES (
      p_user_id,
      p_strategy_id,
      p_executor_id,
      -- Generate a unique ticket number
      'TXN_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_' || substr(md5(random()::text), 1, 8),
      p_symbol,
      p_type,
      p_lots,
      NOW(),
      p_open_price,
      p_stop_loss,
      p_take_profit,
      p_magic_number,
      p_comment
    ) RETURNING id INTO v_trade_id;
    
    -- Log audit trail
    INSERT INTO "AuditLog" (
      userId,
      eventType,
      resource,
      action,
      result,
      metadata
    ) VALUES (
      p_user_id,
      'TRADE_EXECUTION',
      'Trade',
      'CREATE',
      'SUCCESS',
      jsonb_build_object(
        'tradeId', v_trade_id,
        'strategyId', p_strategy_id,
        'executorId', p_executor_id,
        'symbol', p_symbol,
        'type', p_type,
        'lots', p_lots,
        'openPrice', p_open_price,
        'stopLoss', p_stop_loss,
        'takeProfit', p_take_profit
      )
    ) RETURNING id INTO v_audit_id;
    
    -- Update strategy last used timestamp
    UPDATE "Strategy" SET updatedAt = NOW() WHERE id = p_strategy_id;
    
    -- Update executor last heartbeat
    UPDATE "Executor" SET lastHeartbeat = NOW() WHERE id = p_executor_id;
    
    -- Create activity log
    INSERT INTO "ActivityLog" (
      userId,
      eventType,
      metadata
    ) VALUES (
      p_user_id,
      'TRADE_OPENED',
      jsonb_build_object(
        'tradeId', v_trade_id,
        'symbol', p_symbol,
        'type', p_type,
        'lots', p_lots
      )
    );
    
    -- Build success result
    v_result := jsonb_build_object(
      'success', true,
      'tradeId', v_trade_id,
      'auditId', v_audit_id,
      'message', 'Trade executed successfully'
    );
    
    -- Commit transaction
    COMMIT;
    
    RETURN v_result;
    
  EXCEPTION WHEN OTHERS THEN
    -- Rollback transaction
    ROLLBACK;
    
    -- Log error to audit trail
    INSERT INTO "AuditLog" (
      userId,
      eventType,
      resource,
      action,
      result,
      metadata
    ) VALUES (
      p_user_id,
      'TRADE_EXECUTION',
      'Trade',
      'CREATE',
      'FAILED',
      jsonb_build_object(
        'error', SQLERRM,
        'strategyId', p_strategy_id,
        'executorId', p_executor_id,
        'symbol', p_symbol,
        'type', p_type,
        'lots', p_lots,
        'openPrice', p_open_price
      )
    );
    
    -- Return error result
    v_result := jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Trade execution failed'
    );
    
    RETURN v_result;
  END;
END;
$$ LANGUAGE plpgsql;

-- Function to close trade safely within a transaction
CREATE OR REPLACE FUNCTION close_trade_safely(
  p_trade_id VARCHAR,
  p_close_price FLOAT,
  p_close_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  p_user_id VARCHAR
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_trade_exists BOOLEAN;
  v_trade_already_closed BOOLEAN;
  v_audit_id VARCHAR;
  v_error_message VARCHAR;
BEGIN
  -- Start transaction
  BEGIN
    -- Check if trade exists and belongs to user
    SELECT EXISTS(
      SELECT 1 FROM "Trade" 
      WHERE id = p_trade_id AND userId = p_user_id
    ) INTO v_trade_exists;
    
    IF NOT v_trade_exists THEN
      v_error_message := 'Trade not found or does not belong to user';
      RAISE EXCEPTION '%', v_error_message;
    END IF;
    
    -- Check if trade is already closed
    SELECT closeTime IS NOT NULL INTO v_trade_already_closed 
    FROM "Trade" 
    WHERE id = p_trade_id;
    
    IF v_trade_already_closed THEN
      v_error_message := 'Trade is already closed';
      RAISE EXCEPTION '%', v_error_message;
    END IF;
    
    -- Validate close price
    IF p_close_price <= 0 THEN
      v_error_message := 'Invalid close price';
      RAISE EXCEPTION '%', v_error_message;
    END IF;
    
    -- Update trade with close information
    UPDATE "Trade" SET
      closeTime = p_close_time,
      closePrice = p_close_price,
      updatedAt = NOW()
    WHERE id = p_trade_id;
    
    -- Calculate profit/loss (simplified calculation)
    UPDATE "Trade" SET
      profit = CASE 
        WHEN type = 'BUY' THEN (p_close_price - openPrice) * lots * 100000
        WHEN type = 'SELL' THEN (openPrice - p_close_price) * lots * 100000
        ELSE 0
      END,
      pips = CASE 
        WHEN type = 'BUY' THEN (p_close_price - openPrice) * 10000
        WHEN type = 'SELL' THEN (openPrice - p_close_price) * 10000
        ELSE 0
      END,
      netProfit = CASE 
        WHEN type = 'BUY' THEN (p_close_price - openPrice) * lots * 100000 - COALESCE(commission, 0) - COALESCE(swap, 0)
        WHEN type = 'SELL' THEN (openPrice - p_close_price) * lots * 100000 - COALESCE(commission, 0) - COALESCE(swap, 0)
        ELSE 0
      END
    WHERE id = p_trade_id;
    
    -- Log audit trail
    INSERT INTO "AuditLog" (
      userId,
      eventType,
      resource,
      action,
      result,
      metadata
    ) VALUES (
      p_user_id,
      'TRADE_CLOSE',
      'Trade',
      'UPDATE',
      'SUCCESS',
      jsonb_build_object(
        'tradeId', p_trade_id,
        'closePrice', p_close_price,
        'closeTime', p_close_time
      )
    ) RETURNING id INTO v_audit_id;
    
    -- Create activity log
    INSERT INTO "ActivityLog" (
      userId,
      eventType,
      metadata
    ) VALUES (
      p_user_id,
      'TRADE_CLOSED',
      jsonb_build_object(
        'tradeId', p_trade_id,
        'closePrice', p_close_price
      )
    );
    
    -- Build success result
    v_result := jsonb_build_object(
      'success', true,
      'tradeId', p_trade_id,
      'auditId', v_audit_id,
      'message', 'Trade closed successfully'
    );
    
    -- Commit transaction
    COMMIT;
    
    RETURN v_result;
    
  EXCEPTION WHEN OTHERS THEN
    -- Rollback transaction
    ROLLBACK;
    
    -- Log error to audit trail
    INSERT INTO "AuditLog" (
      userId,
      eventType,
      resource,
      action,
      result,
      metadata
    ) VALUES (
      p_user_id,
      'TRADE_CLOSE',
      'Trade',
      'UPDATE',
      'FAILED',
      jsonb_build_object(
        'error', SQLERRM,
        'tradeId', p_trade_id,
        'closePrice', p_close_price
      )
    );
    
    -- Return error result
    v_result := jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Trade close failed'
    );
    
    RETURN v_result;
  END;
END;
$$ LANGUAGE plpgsql;

-- Function to update account metrics safely
CREATE OR REPLACE FUNCTION update_account_metrics(
  p_user_id VARCHAR,
  p_balance_change FLOAT DEFAULT 0,
  p_equity_change FLOAT DEFAULT 0,
  p_margin_change FLOAT DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_user_exists BOOLEAN;
  v_audit_id VARCHAR;
  v_error_message VARCHAR;
BEGIN
  -- Start transaction
  BEGIN
    -- Check if user exists
    SELECT EXISTS(SELECT 1 FROM "User" WHERE id = p_user_id AND deletedAt IS NULL) INTO v_user_exists;
    
    IF NOT v_user_exists THEN
      v_error_message := 'User not found';
      RAISE EXCEPTION '%', v_error_message;
    END IF;
    
    -- Log audit trail
    INSERT INTO "AuditLog" (
      userId,
      eventType,
      resource,
      action,
      result,
      metadata
    ) VALUES (
      p_user_id,
      'ACCOUNT_METRICS_UPDATE',
      'User',
      'UPDATE',
      'SUCCESS',
      jsonb_build_object(
        'balanceChange', p_balance_change,
        'equityChange', p_equity_change,
        'marginChange', p_margin_change
      )
    ) RETURNING id INTO v_audit_id;
    
    -- Create activity log
    INSERT INTO "ActivityLog" (
      userId,
      eventType,
      metadata
    ) VALUES (
      p_user_id,
      'ACCOUNT_UPDATED',
      jsonb_build_object(
        'balanceChange', p_balance_change,
        'equityChange', p_equity_change,
        'marginChange', p_margin_change
      )
    );
    
    -- Build success result
    v_result := jsonb_build_object(
      'success', true,
      'auditId', v_audit_id,
      'message', 'Account metrics updated successfully'
    );
    
    -- Commit transaction
    COMMIT;
    
    RETURN v_result;
    
  EXCEPTION WHEN OTHERS THEN
    -- Rollback transaction
    ROLLBACK;
    
    -- Log error to audit trail
    INSERT INTO "AuditLog" (
      userId,
      eventType,
      resource,
      action,
      result,
      metadata
    ) VALUES (
      p_user_id,
      'ACCOUNT_METRICS_UPDATE',
      'User',
      'UPDATE',
      'FAILED',
      jsonb_build_object(
        'error', SQLERRM,
        'balanceChange', p_balance_change,
        'equityChange', p_equity_change,
        'marginChange', p_margin_change
      )
    );
    
    -- Return error result
    v_result := jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Account metrics update failed'
    );
    
    RETURN v_result;
  END;
END;
$$ LANGUAGE plpgsql;

-- Function to log audit trail with tamper protection
CREATE OR REPLACE FUNCTION log_audit_trail(
  p_user_id VARCHAR,
  p_event_type VARCHAR,
  p_resource VARCHAR DEFAULT NULL,
  p_action VARCHAR DEFAULT NULL,
  p_result VARCHAR DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_ip_address VARCHAR DEFAULT NULL,
  p_user_agent VARCHAR DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_audit_id VARCHAR;
  v_user_exists BOOLEAN;
  v_error_message VARCHAR;
  v_hash VARCHAR;
BEGIN
  -- Start transaction
  BEGIN
    -- Check if user exists
    SELECT EXISTS(SELECT 1 FROM "User" WHERE id = p_user_id AND deletedAt IS NULL) INTO v_user_exists;
    
    IF NOT v_user_exists THEN
      v_error_message := 'User not found';
      RAISE EXCEPTION '%', v_error_message;
    END IF;
    
    -- Generate tamper-proof hash
    v_hash := encode(
      digest(
        p_user_id || p_event_type || COALESCE(p_resource, '') || 
        COALESCE(p_action, '') || COALESCE(p_result, '') || 
        COALESCE(p_metadata::text, '{}') || EXTRACT(EPOCH FROM NOW())::TEXT,
        'sha256'
      ),
      'hex'
    );
    
    -- Insert audit log
    INSERT INTO "AuditLog" (
      userId,
      eventType,
      resource,
      action,
      result,
      metadata,
      ipAddress,
      userAgent,
      hash
    ) VALUES (
      p_user_id,
      p_event_type,
      p_resource,
      p_action,
      p_result,
      p_metadata,
      p_ip_address,
      p_user_agent,
      v_hash
    ) RETURNING id INTO v_audit_id;
    
    -- Build success result
    v_result := jsonb_build_object(
      'success', true,
      'auditId', v_audit_id,
      'hash', v_hash,
      'message', 'Audit trail logged successfully'
    );
    
    -- Commit transaction
    COMMIT;
    
    RETURN v_result;
    
  EXCEPTION WHEN OTHERS THEN
    -- Rollback transaction
    ROLLBACK;
    
    -- Return error result
    v_result := jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Audit trail logging failed'
    );
    
    RETURN v_result;
  END;
END;
$$ LANGUAGE plpgsql;

-- Function to validate trade parameters before execution
CREATE OR REPLACE FUNCTION validate_trade_parameters(
  p_user_id VARCHAR,
  p_strategy_id VARCHAR,
  p_executor_id VARCHAR,
  p_symbol VARCHAR,
  p_lots FLOAT,
  p_type VARCHAR
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_user_exists BOOLEAN;
  v_strategy_exists BOOLEAN;
  v_strategy_active BOOLEAN;
  v_executor_exists BOOLEAN;
  v_executor_online BOOLEAN;
  v_open_trades_count INT;
  v_max_open_trades INT DEFAULT 10;
  v_error_message VARCHAR;
BEGIN
  -- Check if user exists and is not locked
  SELECT EXISTS(
    SELECT 1 FROM "User" 
    WHERE id = p_user_id AND locked = false AND deletedAt IS NULL
  ) INTO v_user_exists;
  
  IF NOT v_user_exists THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'User not found or locked'
    );
  END IF;
  
  -- Check if strategy exists and is active
  SELECT EXISTS(
    SELECT 1 FROM "Strategy" 
    WHERE id = p_strategy_id AND userId = p_user_id AND status = 'active' AND deletedAt IS NULL
  ) INTO v_strategy_exists;
  
  IF NOT v_strategy_exists THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Strategy not found or not active'
    );
  END IF;
  
  -- Check if executor exists and is online
  SELECT EXISTS(
    SELECT 1 FROM "Executor" 
    WHERE id = p_executor_id AND userId = p_user_id AND status = 'online' AND deletedAt IS NULL
  ) INTO v_executor_exists;
  
  IF NOT v_executor_exists THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Executor not found or not online'
    );
  END IF;
  
  -- Check if user has too many open trades
  SELECT COUNT(*) INTO v_open_trades_count
  FROM "Trade"
  WHERE userId = p_user_id AND closeTime IS NULL;
  
  IF v_open_trades_count >= v_max_open_trades THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Maximum open trades limit reached'
    );
  END IF;
  
  -- Validate trade parameters
  IF p_lots <= 0 OR p_lots > 100 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Invalid lot size'
    );
  END IF;
  
  IF p_type NOT IN ('BUY', 'SELL') THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Invalid trade type'
    );
  END IF;
  
  IF p_symbol IS NULL OR LENGTH(p_symbol) < 1 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Invalid symbol'
    );
  END IF;
  
  -- All validations passed
  v_result := jsonb_build_object(
    'valid', true,
    'openTradesCount', v_open_trades_count,
    'maxOpenTrades', v_max_open_trades,
    'message', 'Trade parameters validated successfully'
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;