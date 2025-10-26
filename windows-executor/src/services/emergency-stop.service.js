/**
 * Emergency Stop Service (Kill Switch)
 * CRITICAL SAFETY FEATURE: Immediately stop all trading and close positions
 */
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
export class EmergencyStopService extends EventEmitter {
    constructor() {
        super();
        Object.defineProperty(this, "killSwitchActive", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "activationDetails", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "lockDuration", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 60 * 60 * 1000
        }); // 1 hour default
        Object.defineProperty(this, "lockedUntil", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "autoStopReasons", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        logger.info('[EmergencyStop] Service initialized');
    }
    /**
     * Activate kill switch - STOPS EVERYTHING
     */
    async activate(reason, triggeredBy = 'manual', severity = 'critical') {
        if (this.killSwitchActive) {
            logger.warn('[EmergencyStop] Kill switch already active');
            return;
        }
        this.killSwitchActive = true;
        this.activationDetails = {
            reason,
            timestamp: new Date(),
            triggeredBy,
            severity,
        };
        logger.critical(`🔴 KILL SWITCH ACTIVATED: ${reason}`, {
            triggeredBy,
            severity,
        });
        // Emit alert immediately
        this.emit('killswitch:activated', this.activationDetails);
        try {
            // STEP 1: Stop all strategy monitors
            logger.info('[EmergencyStop] Step 1: Stopping all strategy monitors...');
            await this.stopAllStrategyMonitors();
            this.emit('killswitch:monitors_stopped');
            // STEP 2: Close all open positions
            logger.info('[EmergencyStop] Step 2: Closing all open positions...');
            const closedPositions = await this.closeAllPositions();
            this.emit('killswitch:positions_closed', { count: closedPositions });
            // STEP 3: Cancel all pending orders
            logger.info('[EmergencyStop] Step 3: Canceling all pending orders...');
            const canceledOrders = await this.cancelAllOrders();
            this.emit('killswitch:orders_canceled', { count: canceledOrders });
            // STEP 4: Lock trading
            const lockUntil = severity === 'critical' ? 60 * 60 * 1000 : 30 * 60 * 1000;
            await this.lockTrading(lockUntil);
            logger.info(`[EmergencyStop] Step 4: Trading locked for ${lockUntil / 1000 / 60} minutes`);
            // STEP 5: Notify platform
            logger.info('[EmergencyStop] Step 5: Notifying platform...');
            await this.notifyPlatform({
                event: 'KILL_SWITCH_ACTIVATED',
                reason,
                timestamp: new Date(),
                severity,
            });
            // STEP 6: Save emergency backup
            logger.info('[EmergencyStop] Step 6: Creating emergency backup...');
            await this.createEmergencyBackup();
            logger.critical('[EmergencyStop] ✅ Kill switch activation completed successfully');
            this.emit('killswitch:completed', {
                closedPositions,
                canceledOrders,
                lockedUntil: this.lockedUntil,
            });
        }
        catch (error) {
            logger.critical('[EmergencyStop] ❌ Error during kill switch activation:', error);
            this.emit('killswitch:error', error);
            // Still try to lock trading even if other steps failed
            await this.lockTrading(this.lockDuration);
        }
    }
    /**
     * Deactivate kill switch (with safety checks)
     */
    async deactivate(adminConfirmation = false) {
        if (!this.killSwitchActive) {
            logger.warn('[EmergencyStop] Kill switch is not active');
            return;
        }
        // Check if still locked
        if (this.lockedUntil && new Date() < this.lockedUntil) {
            const remainingTime = Math.ceil((this.lockedUntil.getTime() - Date.now()) / 1000 / 60);
            if (!adminConfirmation) {
                throw new Error(`Trading still locked for ${remainingTime} minutes. Admin confirmation required.`);
            }
            logger.warn(`[EmergencyStop] Admin override: unlocking ${remainingTime} minutes early`);
        }
        logger.info('[EmergencyStop] Deactivating kill switch...');
        this.killSwitchActive = false;
        this.lockedUntil = null;
        const deactivationInfo = {
            previousActivation: this.activationDetails,
            deactivatedAt: new Date(),
        };
        this.activationDetails = null;
        this.emit('killswitch:deactivated', deactivationInfo);
        logger.info('[EmergencyStop] Kill switch deactivated - trading can resume');
    }
    /**
     * Check if trading is allowed
     */
    canTrade() {
        if (this.killSwitchActive) {
            return false;
        }
        if (this.lockedUntil && new Date() < this.lockedUntil) {
            return false;
        }
        return true;
    }
    /**
     * Get current status
     */
    getStatus() {
        return {
            isActive: this.killSwitchActive,
            activatedAt: this.activationDetails?.timestamp || null,
            reason: this.activationDetails?.reason || null,
            canResume: this.lockedUntil ? new Date() >= this.lockedUntil : !this.killSwitchActive,
            lockDuration: this.lockDuration,
            lockedUntil: this.lockedUntil,
        };
    }
    /**
     * Add automatic stop reason (for auto-triggering)
     */
    addAutoStopReason(reason) {
        this.autoStopReasons.add(reason);
        logger.info(`[EmergencyStop] Auto-stop reason added: ${reason}`);
    }
    /**
     * Check if should auto-trigger
     */
    async checkAutoTrigger(metrics) {
        // Auto-trigger conditions
        if (metrics.dailyLoss && metrics.dailyLoss < -500) {
            await this.activate(`Auto-stop: Daily loss exceeded ${metrics.dailyLoss}`, 'automatic', 'critical');
        }
        if (metrics.drawdown && metrics.drawdown > 10) {
            await this.activate(`Auto-stop: Drawdown exceeded ${metrics.drawdown}%`, 'automatic', 'critical');
        }
        if (metrics.consecutiveLosses && metrics.consecutiveLosses >= 5) {
            await this.activate(`Auto-stop: ${metrics.consecutiveLosses} consecutive losses`, 'automatic', 'high');
        }
        if (metrics.errorRate && metrics.errorRate > 0.5) {
            await this.activate(`Auto-stop: High error rate ${(metrics.errorRate * 100).toFixed(1)}%`, 'automatic', 'high');
        }
    }
    // ============ PRIVATE METHODS ============
    /**
     * Stop all strategy monitors
     */
    async stopAllStrategyMonitors() {
        this.emit('emergency:stop_monitors');
        // The strategy monitor service will listen to this event
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for monitors to stop
    }
    /**
     * Close all open positions
     */
    async closeAllPositions() {
        // TODO: Integrate with MT5 service
        this.emit('emergency:close_all_positions');
        // Simulate closing positions
        await new Promise(resolve => setTimeout(resolve, 2000));
        return 0; // Return count of closed positions
    }
    /**
     * Cancel all pending orders
     */
    async cancelAllOrders() {
        // TODO: Integrate with MT5 service
        this.emit('emergency:cancel_all_orders');
        // Simulate canceling orders
        await new Promise(resolve => setTimeout(resolve, 1000));
        return 0; // Return count of canceled orders
    }
    /**
     * Lock trading for specified duration
     */
    async lockTrading(duration) {
        this.lockDuration = duration;
        this.lockedUntil = new Date(Date.now() + duration);
        logger.warn(`[EmergencyStop] Trading locked until ${this.lockedUntil.toISOString()}`);
        this.emit('emergency:trading_locked', {
            lockedUntil: this.lockedUntil,
            durationMinutes: duration / 1000 / 60,
        });
    }
    /**
     * Notify platform about emergency stop
     */
    async notifyPlatform(data) {
        // TODO: Send notification to web platform via API/Pusher
        this.emit('emergency:notify_platform', data);
    }
    /**
     * Create emergency backup
     */
    async createEmergencyBackup() {
        // TODO: Implement backup creation
        this.emit('emergency:backup_created', {
            timestamp: new Date(),
        });
    }
}
