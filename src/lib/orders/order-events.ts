/**
 * Order Event Management System
 * Handles order events, subscriptions, and notifications
 */

import { 
  IOrderEventManager, 
  OrderEvent, 
  OrderEventType, 
  OrderEventSubscription,
  OrderEventHandler
} from './types';
import { OrderStore } from './order-store';
import { randomUUID } from 'crypto';

export class OrderEventManager implements IOrderEventManager {
  private subscriptions: Map<string, OrderEventSubscription> = new Map();
  private eventHandlers: Map<OrderEventType, OrderEventHandler[]> = new Map();
  private orderStore: OrderStore;
  private isProcessing: boolean = false;
  private eventQueue: OrderEvent[] = [];

  constructor(orderStore: OrderStore) {
    this.orderStore = orderStore;
    this.initializeDefaultHandlers();
  }

  /**
   * Initialize default event handlers
   */
  private initializeDefaultHandlers(): void {
    // Register default handlers for each event type
    Object.values(OrderEventType).forEach(eventType => {
      this.eventHandlers.set(eventType, []);
    });
  }

  /**
   * Subscribe to order events
   */
  async subscribe(subscription: Omit<OrderEventSubscription, 'id'>): Promise<string> {
    const id = randomUUID();
    const fullSubscription: OrderEventSubscription = {
      ...subscription,
      id
    };

    this.subscriptions.set(id, fullSubscription);
    
    console.log(`Order event subscription created: ${id} for events: ${subscription.eventTypes.join(', ')}`);
    
    return id;
  }

  /**
   * Unsubscribe from order events
   */
  async unsubscribe(subscriptionId: string): Promise<boolean> {
    const existed = this.subscriptions.has(subscriptionId);
    
    if (existed) {
      this.subscriptions.delete(subscriptionId);
      console.log(`Order event subscription removed: ${subscriptionId}`);
    }
    
    return existed;
  }

  /**
   * Publish an order event
   */
  async publishEvent(event: OrderEvent): Promise<void> {
    try {
      // Store the event in the database
      await this.orderStore.createEvent(event);
      
      // Add to processing queue
      this.eventQueue.push(event);
      
      // Process events if not already processing
      if (!this.isProcessing) {
        this.processEventQueue();
      }
    } catch (error) {
      console.error('Failed to publish order event:', error);
      throw new Error(`Failed to publish order event: ${(error as Error).message}`);
    }
  }

  /**
   * Process the event queue
   */
  private async processEventQueue(): Promise<void> {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift();
        if (event) {
          await this.processEvent(event);
        }
      }
    } catch (error) {
      console.error('Error processing event queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(event: OrderEvent): Promise<void> {
    try {
      // Get all relevant subscriptions
      const relevantSubscriptions = Array.from(this.subscriptions.values()).filter(sub =>
        sub.eventTypes.includes(event.type) &&
        (!sub.orderId || event.orderId === sub.orderId)
      );

      // Notify all relevant subscriptions
      const notificationPromises = relevantSubscriptions.map(async (subscription) => {
        try {
          // Check if subscription is for a specific user and if the event is for that user
          if (subscription.userId) {
            const isForUser = await this.isEventForUser(event, subscription.userId);
            if (!isForUser) {
              return; // Skip this subscription if the event is not for the user
            }
          }
          
          await subscription.handler(event);
        } catch (error) {
          console.error(`Error in event handler for subscription ${subscription.id}:`, error);
        }
      });

      await Promise.allSettled(notificationPromises);

      // Call registered event handlers
      const handlers = this.eventHandlers.get(event.type) || [];
      const handlerPromises = handlers.map(async (handler) => {
        try {
          await handler(event);
        } catch (error) {
          console.error(`Error in event handler for event type ${event.type}:`, error);
        }
      });

      await Promise.allSettled(handlerPromises);

      console.log(`Processed order event: ${event.type} for order: ${event.orderId}`);
    } catch (error) {
      console.error('Failed to process event:', error);
    }
  }

  /**
   * Check if an event is relevant for a user
   */
  private async isEventForUser(event: OrderEvent, userId: string): Promise<boolean> {
    try {
      const order = await this.orderStore.getOrder(event.orderId);
      return order ? order.userId === userId : false;
    } catch (error) {
      console.error('Error checking if event is for user:', error);
      return false;
    }
  }

  /**
   * Register an event handler for a specific event type
   */
  registerEventHandler(eventType: OrderEventType, handler: OrderEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    
    const handlers = this.eventHandlers.get(eventType)!;
    handlers.push(handler);
    
    console.log(`Event handler registered for type: ${eventType}`);
  }

  /**
   * Unregister an event handler for a specific event type
   */
  unregisterEventHandler(eventType: OrderEventType, handler: OrderEventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
        console.log(`Event handler unregistered for type: ${eventType}`);
      }
    }
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): OrderEventSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get event statistics
   */
  getEventStatistics(): {
    totalSubscriptions: number;
    subscriptionsByEventType: Record<string, number>;
    registeredHandlers: Record<string, number>;
    queuedEvents: number;
  } {
    const subscriptionsByEventType: Record<string, number> = {};
    const registeredHandlers: Record<string, number> = {};

    // Count subscriptions by event type
    this.subscriptions.forEach(sub => {
      sub.eventTypes.forEach(eventType => {
        subscriptionsByEventType[eventType] = (subscriptionsByEventType[eventType] || 0) + 1;
      });
    });

    // Count registered handlers
    this.eventHandlers.forEach((handlers, eventType) => {
      registeredHandlers[eventType] = handlers.length;
    });

    return {
      totalSubscriptions: this.subscriptions.size,
      subscriptionsByEventType,
      registeredHandlers,
      queuedEvents: this.eventQueue.length
    };
  }

  /**
   * Clear all subscriptions (for testing or cleanup)
   */
  clearAllSubscriptions(): void {
    this.subscriptions.clear();
    console.log('All order event subscriptions cleared');
  }

  /**
   * Shutdown the event manager
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down order event manager...');
    
    // Wait for current processing to complete
    while (this.isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Clear all subscriptions
    this.clearAllSubscriptions();
    
    // Clear event handlers
    this.eventHandlers.clear();
    
    // Clear event queue
    this.eventQueue = [];
    
    console.log('Order event manager shutdown complete');
  }
}

// Default notification handlers
export class OrderNotificationHandlers {
  /**
   * Handle order filled notification
   */
  static async onOrderFilled(event: OrderEvent): Promise<void> {
    console.log(`NOTIFICATION: Order ${event.orderId} has been filled`, event.data);
    
    // Here you would integrate with your notification system
    // e.g., send email, push notification, etc.
    
    // Example integration with Pusher (if available)
    try {
      // This would be replaced with actual notification service
      // await notificationService.send({
      //   type: 'ORDER_FILLED',
      //   userId: event.userId,
      //   data: event.data
      // });
    } catch (error) {
      console.error('Failed to send order filled notification:', error);
    }
  }

  /**
   * Handle order rejected notification
   */
  static async onOrderRejected(event: OrderEvent): Promise<void> {
    console.log(`NOTIFICATION: Order ${event.orderId} has been rejected`, event.data);
    
    // Here you would integrate with your notification system
    // e.g., send email, push notification, etc.
  }

  /**
   * Handle order partially filled notification
   */
  static async onOrderPartiallyFilled(event: OrderEvent): Promise<void> {
    console.log(`NOTIFICATION: Order ${event.orderId} has been partially filled`, event.data);
    
    // Here you would integrate with your notification system
    // e.g., send email, push notification, etc.
  }

  /**
   * Handle order cancelled notification
   */
  static async onOrderCancelled(event: OrderEvent): Promise<void> {
    console.log(`NOTIFICATION: Order ${event.orderId} has been cancelled`, event.data);
    
    // Here you would integrate with your notification system
    // e.g., send email, push notification, etc.
  }

  /**
   * Handle order error notification
   */
  static async onOrderError(event: OrderEvent): Promise<void> {
    console.error(`NOTIFICATION: Error occurred for order ${event.orderId}`, event.data);
    
    // Here you would integrate with your notification system
    // e.g., send email, push notification, etc.
  }
}

// Create a singleton instance
let orderEventManagerInstance: OrderEventManager | null = null;

export function getOrderEventManager(orderStore?: OrderStore): OrderEventManager {
  if (!orderEventManagerInstance) {
    if (!orderStore) {
      throw new Error('OrderStore instance required for first-time initialization');
    }
    orderEventManagerInstance = new OrderEventManager(orderStore);
    
    // Register default notification handlers
    orderEventManagerInstance.registerEventHandler(
      OrderEventType.FILLED, 
      OrderNotificationHandlers.onOrderFilled
    );
    
    orderEventManagerInstance.registerEventHandler(
      OrderEventType.REJECTED, 
      OrderNotificationHandlers.onOrderRejected
    );
    
    orderEventManagerInstance.registerEventHandler(
      OrderEventType.PARTIALLY_FILLED, 
      OrderNotificationHandlers.onOrderPartiallyFilled
    );
    
    orderEventManagerInstance.registerEventHandler(
      OrderEventType.CANCELLED, 
      OrderNotificationHandlers.onOrderCancelled
    );
    
    orderEventManagerInstance.registerEventHandler(
      OrderEventType.ERROR, 
      OrderNotificationHandlers.onOrderError
    );
  }
  
  return orderEventManagerInstance;
}