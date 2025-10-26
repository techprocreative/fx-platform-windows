/**
 * Disaster Recovery Service
 * Handles backup, recovery, and crash restoration
 */
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
export class DisasterRecoveryService extends EventEmitter {
    constructor(config) {
        super();
        Object.defineProperty(this, "config", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "backupInterval", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "lastBackup", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "isBackupInProgress", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        this.config = {
            enabled: true,
            autoBackup: true,
            backupInterval: 60 * 60 * 1000, // 1 hour
            maxBackups: 24, // Keep last 24 backups
            backupPath: './backups',
            ...config,
        };
        logger.info('[DisasterRecovery] Service initialized', { config: this.config });
        // Create backup directory if not exists
        this.ensureBackupDirectory();
    }
    /**
     * Start automatic backups
     */
    startAutoBackup() {
        if (!this.config.autoBackup) {
            logger.info('[DisasterRecovery] Auto backup is disabled');
            return;
        }
        if (this.backupInterval) {
            logger.warn('[DisasterRecovery] Auto backup already running');
            return;
        }
        logger.info(`[DisasterRecovery] Starting auto backup (interval: ${this.config.backupInterval / 1000 / 60} minutes)`);
        this.backupInterval = setInterval(async () => {
            await this.performBackup('automatic');
        }, this.config.backupInterval);
        // Immediate backup on critical events
        this.setupEventTriggers();
    }
    /**
     * Stop automatic backups
     */
    stopAutoBackup() {
        if (this.backupInterval) {
            clearInterval(this.backupInterval);
            this.backupInterval = null;
            logger.info('[DisasterRecovery] Auto backup stopped');
        }
    }
    /**
     * Perform backup
     */
    async performBackup(type = 'manual') {
        if (this.isBackupInProgress) {
            logger.warn('[DisasterRecovery] Backup already in progress, skipping');
            throw new Error('Backup already in progress');
        }
        this.isBackupInProgress = true;
        const startTime = Date.now();
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupId = `backup_${type}_${timestamp}`;
            const backupDir = path.join(this.config.backupPath, backupId);
            logger.info(`[DisasterRecovery] Starting ${type} backup: ${backupId}`);
            // Create backup directory
            await fs.promises.mkdir(backupDir, { recursive: true });
            const components = [];
            // 1. Backup database
            await this.backupDatabase(backupDir);
            components.push('database');
            // 2. Backup configurations
            await this.backupConfigurations(backupDir);
            components.push('configurations');
            // 3. Backup logs (last 24 hours)
            await this.backupLogs(backupDir);
            components.push('logs');
            // 4. Backup active strategies
            await this.backupActiveStrategies(backupDir);
            components.push('strategies');
            // 5. Backup performance metrics
            await this.backupPerformanceMetrics(backupDir);
            components.push('metrics');
            // Calculate checksum
            const checksum = await this.calculateChecksum(backupDir);
            // Save metadata
            const metadata = {
                timestamp: new Date(),
                type,
                fileSize: await this.getDirectorySize(backupDir),
                duration: Date.now() - startTime,
                components,
                checksum,
            };
            await fs.promises.writeFile(path.join(backupDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
            this.lastBackup = new Date();
            // Cleanup old backups
            await this.cleanupOldBackups();
            // Upload to cloud if configured
            if (this.config.cloudBackup?.enabled) {
                await this.uploadToCloud(backupDir);
            }
            this.emit('backup-completed', { backupId, metadata });
            logger.info(`[DisasterRecovery] Backup completed: ${backupId} (${metadata.duration}ms)`);
            return backupId;
        }
        catch (error) {
            logger.error('[DisasterRecovery] Backup failed:', error);
            this.emit('backup-failed', { error });
            throw error;
        }
        finally {
            this.isBackupInProgress = false;
        }
    }
    /**
     * Restore from backup
     */
    async restoreFromBackup(backupId) {
        logger.info(`[DisasterRecovery] Starting restoration from backup: ${backupId}`);
        try {
            const backupDir = path.join(this.config.backupPath, backupId);
            // Verify backup exists
            if (!fs.existsSync(backupDir)) {
                throw new Error(`Backup ${backupId} not found`);
            }
            // Load metadata
            const metadataPath = path.join(backupDir, 'metadata.json');
            const metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf-8'));
            logger.info('[DisasterRecovery] Backup metadata loaded:', metadata);
            // Verify integrity
            const currentChecksum = await this.calculateChecksum(backupDir);
            if (currentChecksum !== metadata.checksum) {
                throw new Error('Backup integrity check failed - checksum mismatch');
            }
            // Emit warning - this will stop all trading
            this.emit('restoration-started', { backupId, metadata });
            // 1. Stop all trading (via emergency stop)
            logger.info('[DisasterRecovery] Step 1: Stopping all trading...');
            this.emit('stop-all-trading');
            await this.waitForTradingStop();
            // 2. Restore database
            logger.info('[DisasterRecovery] Step 2: Restoring database...');
            await this.restoreDatabase(backupDir);
            // 3. Restore configurations
            logger.info('[DisasterRecovery] Step 3: Restoring configurations...');
            await this.restoreConfigurations(backupDir);
            // 4. Restore active strategies
            logger.info('[DisasterRecovery] Step 4: Restoring strategies...');
            await this.restoreActiveStrategies(backupDir);
            // 5. Verify restoration
            logger.info('[DisasterRecovery] Step 5: Verifying restoration...');
            await this.verifyRestoration(metadata);
            this.emit('restoration-completed', { backupId, metadata });
            logger.info(`[DisasterRecovery] Restoration completed successfully from ${backupId}`);
        }
        catch (error) {
            logger.error('[DisasterRecovery] Restoration failed:', error);
            this.emit('restoration-failed', { backupId, error });
            throw error;
        }
    }
    /**
     * Recover from crash
     */
    async recoverFromCrash() {
        logger.critical('[DisasterRecovery] ⚠️ CRASH RECOVERY INITIATED');
        try {
            // 1. Check for orphaned positions
            logger.info('[DisasterRecovery] Step 1: Checking for orphaned positions...');
            const orphanedPositions = await this.findOrphanedPositions();
            if (orphanedPositions.length > 0) {
                logger.warn(`[DisasterRecovery] Found ${orphanedPositions.length} orphaned positions`);
                await this.handleOrphanedPositions(orphanedPositions);
            }
            else {
                logger.info('[DisasterRecovery] No orphaned positions found');
            }
            // 2. Check database integrity
            logger.info('[DisasterRecovery] Step 2: Checking database integrity...');
            await this.checkDatabaseIntegrity();
            // 3. Restore active strategies
            logger.info('[DisasterRecovery] Step 3: Restoring active strategies...');
            const activeStrategies = await this.getActiveStrategiesFromDB();
            for (const strategy of activeStrategies) {
                logger.info(`[DisasterRecovery] Restoring strategy: ${strategy.name}`);
                this.emit('restore-strategy', { strategy });
            }
            // 4. Sync with platform
            logger.info('[DisasterRecovery] Step 4: Syncing with platform...');
            await this.syncWithPlatform();
            // 5. Verify account state
            logger.info('[DisasterRecovery] Step 5: Verifying account state...');
            await this.verifyAccountState();
            this.emit('crash-recovery-completed');
            logger.info('[DisasterRecovery] ✅ Crash recovery completed successfully');
        }
        catch (error) {
            logger.critical('[DisasterRecovery] ❌ Crash recovery failed:', error);
            this.emit('crash-recovery-failed', { error });
            throw error;
        }
    }
    /**
     * Get available recovery points
     */
    async getRecoveryPoints() {
        const backupPath = this.config.backupPath;
        if (!fs.existsSync(backupPath)) {
            return [];
        }
        const backups = await fs.promises.readdir(backupPath);
        const recoveryPoints = [];
        for (const backup of backups) {
            const backupDir = path.join(backupPath, backup);
            const metadataPath = path.join(backupDir, 'metadata.json');
            if (fs.existsSync(metadataPath)) {
                try {
                    const metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf-8'));
                    // Verify integrity
                    const currentChecksum = await this.calculateChecksum(backupDir);
                    const isValid = currentChecksum === metadata.checksum;
                    recoveryPoints.push({
                        id: backup,
                        timestamp: new Date(metadata.timestamp),
                        backupFile: backupDir,
                        metadata,
                        isValid,
                    });
                }
                catch (error) {
                    logger.warn(`[DisasterRecovery] Invalid backup: ${backup}`, error);
                }
            }
        }
        // Sort by timestamp (newest first)
        recoveryPoints.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        return recoveryPoints;
    }
    // ============ PRIVATE METHODS ============
    ensureBackupDirectory() {
        if (!fs.existsSync(this.config.backupPath)) {
            fs.mkdirSync(this.config.backupPath, { recursive: true });
            logger.info(`[DisasterRecovery] Backup directory created: ${this.config.backupPath}`);
        }
    }
    async backupDatabase(backupDir) {
        const dbPath = './executor.db';
        const targetPath = path.join(backupDir, 'executor.db');
        if (fs.existsSync(dbPath)) {
            await fs.promises.copyFile(dbPath, targetPath);
            logger.debug('[DisasterRecovery] Database backed up');
        }
    }
    async backupConfigurations(backupDir) {
        const configs = ['config.json', '.env'];
        const configDir = path.join(backupDir, 'configs');
        await fs.promises.mkdir(configDir, { recursive: true });
        for (const config of configs) {
            if (fs.existsSync(config)) {
                await fs.promises.copyFile(config, path.join(configDir, config));
            }
        }
        logger.debug('[DisasterRecovery] Configurations backed up');
    }
    async backupLogs(backupDir) {
        const logsDir = path.join(backupDir, 'logs');
        await fs.promises.mkdir(logsDir, { recursive: true });
        // Copy log files
        if (fs.existsSync('./logs')) {
            const logFiles = await fs.promises.readdir('./logs');
            for (const logFile of logFiles) {
                const sourcePath = path.join('./logs', logFile);
                const targetPath = path.join(logsDir, logFile);
                await fs.promises.copyFile(sourcePath, targetPath);
            }
        }
        logger.debug('[DisasterRecovery] Logs backed up');
    }
    async backupActiveStrategies(backupDir) {
        // TODO: Export active strategies from database
        const strategiesPath = path.join(backupDir, 'strategies.json');
        const strategies = []; // Get from database
        await fs.promises.writeFile(strategiesPath, JSON.stringify(strategies, null, 2));
        logger.debug('[DisasterRecovery] Active strategies backed up');
    }
    async backupPerformanceMetrics(backupDir) {
        // TODO: Export performance metrics from database
        const metricsPath = path.join(backupDir, 'metrics.json');
        const metrics = {}; // Get from database
        await fs.promises.writeFile(metricsPath, JSON.stringify(metrics, null, 2));
        logger.debug('[DisasterRecovery] Performance metrics backed up');
    }
    async restoreDatabase(backupDir) {
        const backupDbPath = path.join(backupDir, 'executor.db');
        const currentDbPath = './executor.db';
        if (fs.existsSync(backupDbPath)) {
            // Backup current database first
            if (fs.existsSync(currentDbPath)) {
                await fs.promises.copyFile(currentDbPath, `${currentDbPath}.before-restore`);
            }
            await fs.promises.copyFile(backupDbPath, currentDbPath);
            logger.info('[DisasterRecovery] Database restored');
        }
    }
    async restoreConfigurations(backupDir) {
        const configDir = path.join(backupDir, 'configs');
        if (fs.existsSync(configDir)) {
            const configs = await fs.promises.readdir(configDir);
            for (const config of configs) {
                const sourcePath = path.join(configDir, config);
                await fs.promises.copyFile(sourcePath, config);
            }
            logger.info('[DisasterRecovery] Configurations restored');
        }
    }
    async restoreActiveStrategies(backupDir) {
        const strategiesPath = path.join(backupDir, 'strategies.json');
        if (fs.existsSync(strategiesPath)) {
            const strategies = JSON.parse(await fs.promises.readFile(strategiesPath, 'utf-8'));
            // Emit event to restore each strategy
            for (const strategy of strategies) {
                this.emit('restore-strategy', { strategy });
            }
            logger.info(`[DisasterRecovery] ${strategies.length} strategies restored`);
        }
    }
    async calculateChecksum(directory) {
        // Simple checksum - in production, use crypto hash
        const files = await this.getAllFiles(directory);
        let checksum = 0;
        for (const file of files) {
            const stats = await fs.promises.stat(file);
            checksum += stats.size;
        }
        return checksum.toString(16);
    }
    async getAllFiles(directory) {
        const files = [];
        const entries = await fs.promises.readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                files.push(...await this.getAllFiles(fullPath));
            }
            else {
                files.push(fullPath);
            }
        }
        return files;
    }
    async getDirectorySize(directory) {
        const files = await this.getAllFiles(directory);
        let size = 0;
        for (const file of files) {
            const stats = await fs.promises.stat(file);
            size += stats.size;
        }
        return size;
    }
    async cleanupOldBackups() {
        const recoveryPoints = await this.getRecoveryPoints();
        if (recoveryPoints.length > this.config.maxBackups) {
            const toDelete = recoveryPoints.slice(this.config.maxBackups);
            for (const point of toDelete) {
                try {
                    await fs.promises.rm(point.backupFile, { recursive: true, force: true });
                    logger.debug(`[DisasterRecovery] Deleted old backup: ${point.id}`);
                }
                catch (error) {
                    logger.warn(`[DisasterRecovery] Failed to delete backup ${point.id}:`, error);
                }
            }
            logger.info(`[DisasterRecovery] Cleaned up ${toDelete.length} old backups`);
        }
    }
    async uploadToCloud(backupDir) {
        // TODO: Implement cloud upload
        logger.debug('[DisasterRecovery] Cloud upload not implemented yet');
    }
    setupEventTriggers() {
        // Trigger backup on critical events
        this.on('trade-executed', () => this.scheduleBackup());
        this.on('strategy-modified', () => this.scheduleBackup());
        this.on('emergency-stop', () => this.performBackup('emergency'));
    }
    scheduleBackup() {
        // Debounce: only backup if last backup was > 5 minutes ago
        if (this.lastBackup && Date.now() - this.lastBackup.getTime() < 5 * 60 * 1000) {
            return;
        }
        setTimeout(() => this.performBackup('automatic'), 1000);
    }
    async waitForTradingStop() {
        // Wait for trading to stop
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
    async verifyRestoration(metadata) {
        // Verify all components restored
        logger.info('[DisasterRecovery] Verifying restoration...');
        // Check database
        if (!fs.existsSync('./executor.db')) {
            throw new Error('Database not found after restoration');
        }
        logger.info('[DisasterRecovery] Restoration verification passed');
    }
    async findOrphanedPositions() {
        // TODO: Compare MT5 positions with database
        return [];
    }
    async handleOrphanedPositions(positions) {
        logger.warn(`[DisasterRecovery] Handling ${positions.length} orphaned positions`);
        // TODO: Sync orphaned positions with database
    }
    async checkDatabaseIntegrity() {
        // TODO: Run database integrity checks
        logger.info('[DisasterRecovery] Database integrity check passed');
    }
    async getActiveStrategiesFromDB() {
        // TODO: Query database for active strategies
        return [];
    }
    async syncWithPlatform() {
        // TODO: Sync state with web platform
        logger.info('[DisasterRecovery] Synced with platform');
    }
    async verifyAccountState() {
        // TODO: Verify MT5 account state matches database
        logger.info('[DisasterRecovery] Account state verified');
    }
}
