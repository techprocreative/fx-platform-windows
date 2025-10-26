export class PriorityQueue {
    constructor(maxItems = 10000) {
        Object.defineProperty(this, "items", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "maxItems", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.maxItems = maxItems;
    }
    /**
     * Add an item to the queue with priority
     * Higher priority number = higher priority
     */
    enqueue(item, priority, maxAttempts = 3) {
        const id = this.generateId();
        const queueItem = {
            id,
            priority,
            data: item,
            createdAt: new Date(),
            attempts: 0,
            maxAttempts,
        };
        // Insert item in correct position based on priority
        let inserted = false;
        for (let i = 0; i < this.items.length; i++) {
            if (this.items[i].priority < priority) {
                this.items.splice(i, 0, queueItem);
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            this.items.push(queueItem);
        }
        // Remove oldest items if queue is full
        if (this.items.length > this.maxItems) {
            this.items = this.items.slice(-this.maxItems);
        }
        return id;
    }
    /**
     * Remove and return the highest priority item
     */
    dequeue() {
        if (this.isEmpty()) {
            return null;
        }
        return this.items.shift() || null;
    }
    /**
     * Get the highest priority item without removing it
     */
    peek() {
        if (this.isEmpty()) {
            return null;
        }
        return this.items[0];
    }
    /**
     * Remove item by ID
     */
    removeById(id) {
        const index = this.items.findIndex(item => item.id === id);
        if (index !== -1) {
            this.items.splice(index, 1);
            return true;
        }
        return false;
    }
    /**
     * Get item by ID without removing it
     */
    getById(id) {
        return this.items.find(item => item.id === id) || null;
    }
    /**
     * Requeue an item for retry (update attempts and next retry time)
     */
    requeue(id, retryDelay = 1000) {
        const item = this.getById(id);
        if (!item) {
            return false;
        }
        // Remove from current position
        this.removeById(id);
        // Update retry info
        item.attempts += 1;
        item.nextRetryAt = new Date(Date.now() + retryDelay);
        // Only requeue if max attempts not reached
        if (item.attempts < item.maxAttempts) {
            // Insert back in correct position
            let inserted = false;
            for (let i = 0; i < this.items.length; i++) {
                if (this.items[i].priority < item.priority) {
                    this.items.splice(i, 0, item);
                    inserted = true;
                    break;
                }
            }
            if (!inserted) {
                this.items.push(item);
            }
            return true;
        }
        return false;
    }
    /**
     * Get items that are ready for retry
     */
    getReadyForRetry() {
        const now = new Date();
        return this.items.filter(item => item.nextRetryAt && item.nextRetryAt <= now);
    }
    /**
     * Get items that are pending retry (not ready yet)
     */
    getPendingRetry() {
        const now = new Date();
        return this.items.filter(item => item.nextRetryAt && item.nextRetryAt > now);
    }
    /**
     * Get items that can be processed (not pending retry)
     */
    getProcessableItems() {
        const now = new Date();
        return this.items.filter(item => !item.nextRetryAt || item.nextRetryAt <= now);
    }
    /**
     * Update priority of an item
     */
    updatePriority(id, newPriority) {
        const item = this.getById(id);
        if (!item) {
            return false;
        }
        // Remove from current position
        this.removeById(id);
        // Update priority
        item.priority = newPriority;
        // Insert back in correct position
        let inserted = false;
        for (let i = 0; i < this.items.length; i++) {
            if (this.items[i].priority < newPriority) {
                this.items.splice(i, 0, item);
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            this.items.push(item);
        }
        return true;
    }
    /**
     * Check if queue is empty
     */
    isEmpty() {
        return this.items.length === 0;
    }
    /**
     * Get queue size
     */
    size() {
        return this.items.length;
    }
    /**
     * Clear all items
     */
    clear() {
        this.items = [];
    }
    /**
     * Get all items (for debugging/monitoring)
     */
    getAll() {
        return [...this.items];
    }
    /**
     * Get items by priority range
     */
    getByPriorityRange(minPriority, maxPriority) {
        return this.items.filter(item => item.priority >= minPriority && item.priority <= maxPriority);
    }
    /**
     * Get statistics about the queue
     */
    getStats() {
        const now = new Date();
        const processable = this.getProcessableItems();
        const pendingRetry = this.getPendingRetry();
        const priorityCounts = this.items.reduce((acc, item) => {
            const priority = item.priority;
            acc[priority] = (acc[priority] || 0) + 1;
            return acc;
        }, {});
        const attemptCounts = this.items.reduce((acc, item) => {
            const attempts = item.attempts;
            acc[attempts] = (acc[attempts] || 0) + 1;
            return acc;
        }, {});
        return {
            total: this.items.length,
            processable: processable.length,
            pendingRetry: pendingRetry.length,
            priorityCounts,
            attemptCounts,
            oldestItem: this.items.length > 0 ? this.items[0].createdAt : null,
            newestItem: this.items.length > 0 ? this.items[this.items.length - 1].createdAt : null,
        };
    }
    /**
     * Generate unique ID for queue items
     */
    generateId() {
        return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Get estimated wait time for items at different priority levels
     */
    getEstimatedWaitTime() {
        const avgProcessingTime = 1000; // 1 second average processing time
        const waitTimes = {};
        // Calculate wait time for each priority level
        const priorityGroups = this.items.reduce((acc, item) => {
            const priority = item.priority;
            if (!acc[priority]) {
                acc[priority] = [];
            }
            acc[priority].push(item);
            return acc;
        }, {});
        let itemsBefore = 0;
        const priorities = Object.keys(priorityGroups)
            .map(Number)
            .sort((a, b) => b - a); // Sort by priority descending
        for (const priority of priorities) {
            waitTimes[priority] = itemsBefore * avgProcessingTime;
            itemsBefore += priorityGroups[priority].length;
        }
        return waitTimes;
    }
    /**
     * Export queue state for persistence
     */
    export() {
        return JSON.stringify({
            items: this.items,
            maxItems: this.maxItems,
            exportedAt: new Date().toISOString(),
        });
    }
    /**
     * Import queue state from persistence
     */
    import(data) {
        try {
            const parsed = JSON.parse(data);
            if (parsed.items && Array.isArray(parsed.items)) {
                this.items = parsed.items.map((item) => ({
                    ...item,
                    createdAt: new Date(item.createdAt),
                    nextRetryAt: item.nextRetryAt ? new Date(item.nextRetryAt) : undefined,
                }));
                this.maxItems = parsed.maxItems || 10000;
                return true;
            }
            return false;
        }
        catch (error) {
            console.error('Failed to import queue state:', error);
            return false;
        }
    }
}
// Priority constants for easier use
export const PRIORITIES = {
    URGENT: 100,
    HIGH: 75,
    NORMAL: 50,
    LOW: 25,
};
// Type guard for queue items
export function isQueueItem(obj) {
    return obj &&
        typeof obj.id === 'string' &&
        typeof obj.priority === 'number' &&
        obj.data !== undefined &&
        obj.createdAt instanceof Date &&
        typeof obj.attempts === 'number' &&
        typeof obj.maxAttempts === 'number';
}
