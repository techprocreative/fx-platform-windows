/**
 * Order Manager - Core order management system
 * 
 * This class implements the complete order lifecycle management, including:
 * - Order creation, submission, cancellation, and modification
 * - Order tracking and status updates
 * - Event handling for order state changes
 * - Reconciliation with broker records
 */

import {
  OrderParams,
  ExtendedOrder,
  SubmissionResult,
  OrderStatus,
  OrderEventType,
  OrderEvent,
  ReconciliationReport,
  OrderDiscrepancy,
  OrderModification,
  OrderManagerConfig
} from './types';
import { OrderStore } from './order-store';
import { getOrderEventManager } from './order-events';
import { IBrokerConnector } from '../brokers/mt5-connector';
import { OrderState, MarketOrder, TradeResult, Order } from '../brokers/types';
import { randomUUID } from 'crypto';

export class OrderManager {
  private orderStore: OrderStore;
  private eventManager: ReturnType<typeof getOrderEventManager>;
  private brokerConnector: IBrokerConnector;
  private config: OrderManagerConfig;
  private reconciliationTimer: NodeJS.Timeout | null = null;

  constructor(
    brokerConnector: IBrokerConnector,
    config: Partial<OrderManagerConfig> = {}
  ) {
    this.brokerConnector = brokerConnector;
    this.orderStore = new OrderStore();
    this.eventManager = getOrderEventManager(this.orderStore);
    
    // Set default configuration
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      enableReconciliation: true,
      reconciliationInterval: 60000, // 1 minute
      enableEventLogging: true,
      enablePersistence: true,
      ...config
    };

    // Start reconciliation if enabled
    if (this.config.enableReconciliation) {
      this.startReconciliation();
    }

    // Register event handlers
    this.registerEventHandlers();
  }

  /**
   * Create a new order
   */
  async createOrder(params: OrderParams): Promise<ExtendedOrder> {
    try {
      // Validate order parameters
      this.validateOrderParams(params);
      
      // Create order object
      const now = new Date();
      const order: Omit<ExtendedOrder, 'id' | 'createdAt' | 'updatedAt'> = {
        // Broker order fields
        ticket: 0, // Will be set when submitted
        symbol: params.symbol,
        type: params.type,
        typeTime: 0, // GTC by default
        state: OrderState.STARTED,
        volume: params.volume,
        priceOpen: params.price || 0,
        priceSL: params.sl,
        priceTP: params.tp,
        priceCurrent: 0,
        volumeCurrent: params.volume,
        comment: params.comment || '',
        openTime: now,
        expiration: params.expiration || new Date(0),
        magic: params.magic || 0,
        commission: 0,
        storage: 0,
        identifier: 0,
        reason: 0,
        
        // Extended fields
        userId: params.userId,
        strategyId: params.strategyId,
        status: OrderStatus.DRAFT,
        filledVolume: 0,
        averageFillPrice: 0
      };

      // Store order in database
      const createdOrder = await this.orderStore.createOrder(order);
      
      // Publish order created event
      await this.eventManager.publishEvent({
        id: randomUUID(),
        orderId: createdOrder.id,
        type: OrderEventType.CREATED,
        timestamp: now,
        data: { order: createdOrder }
      });

      console.log(`Order created: ${createdOrder.id} for user: ${params.userId}`);
      return createdOrder;
    } catch (error) {
      console.error('Failed to create order:', error);
      throw new Error(`Failed to create order: ${(error as Error).message}`);
    }
  }

  /**
   * Submit an order to the broker
   */
  async submitOrder(order: ExtendedOrder): Promise<SubmissionResult> {
    try {
      // Check if order is in a valid state for submission
      if (order.status !== OrderStatus.DRAFT) {
        throw new Error(`Order ${order.id} is not in DRAFT status`);
      }

      // Update order status to PENDING
      await this.updateOrderStatus(order.id, OrderStatus.PENDING);

      // Prepare market order for broker
      const marketOrder: MarketOrder = {
        symbol: order.symbol,
        type: order.type as 0 | 1, // Only market orders for now
        volume: order.volume,
        price: order.priceOpen,
        sl: order.priceSL,
        tp: order.priceTP,
        comment: order.comment,
        magic: order.magic,
        deviation: 10, // Default deviation
        type_filling: 0 // FOK (Fill or Kill)
      };

      // Submit to broker with retry logic
      const result = await this.submitToBroker(marketOrder, this.config.maxRetries);

      // Update order with submission result
      const submissionResult: SubmissionResult = {
        success: result.retcode === 0,
        orderId: order.id,
        brokerTicket: result.order,
        message: result.comment,
        errorCode: result.retcode,
        timestamp: new Date()
      };

      // Update order in database
      await this.orderStore.updateOrder(order.id, {
        ticket: result.order,
        status: submissionResult.success ? OrderStatus.SUBMITTED : OrderStatus.REJECTED,
        submissionResult,
        rejectionReason: submissionResult.success ? undefined : result.comment
      });

      // Publish appropriate event
      const eventType = submissionResult.success 
        ? OrderEventType.SUBMITTED 
        : OrderEventType.REJECTED;

      await this.eventManager.publishEvent({
        id: randomUUID(),
        orderId: order.id,
        type: eventType,
        timestamp: new Date(),
        data: { 
          submissionResult,
          brokerResult: result
        }
      });

      console.log(`Order ${order.id} submitted to broker: ${submissionResult.success ? 'SUCCESS' : 'FAILED'}`);
      return submissionResult;
    } catch (error) {
      // Update order status to ERROR
      await this.updateOrderStatus(order.id, OrderStatus.ERROR);
      
      // Publish error event
      await this.eventManager.publishEvent({
        id: randomUUID(),
        orderId: order.id,
        type: OrderEventType.ERROR,
        timestamp: new Date(),
        message: (error as Error).message
      });

      console.error(`Failed to submit order ${order.id}:`, error);
      throw error;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      const order = await this.orderStore.getOrder(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      // Check if order can be cancelled
      if (![OrderStatus.DRAFT, OrderStatus.PENDING, OrderStatus.SUBMITTED].includes(order.status)) {
        throw new Error(`Order ${orderId} cannot be cancelled in status: ${order.status}`);
      }

      // If order has a broker ticket, try to cancel with broker
      if (order.ticket > 0) {
        try {
          // Note: MT5 doesn't have a direct cancel order API
          // This would need to be implemented based on broker specifics
          // For now, we'll just mark it as cancelled in our system
          console.log(`Cancelling order ${orderId} with broker ticket ${order.ticket}`);
        } catch (error) {
          console.error(`Failed to cancel order with broker: ${error}`);
          // Continue with local cancellation even if broker cancellation fails
        }
      }

      // Update order status
      await this.updateOrderStatus(orderId, OrderStatus.CANCELLED);

      // Publish cancellation event
      await this.eventManager.publishEvent({
        id: randomUUID(),
        orderId,
        type: OrderEventType.CANCELLED,
        timestamp: new Date(),
        data: { reason: 'User requested cancellation' }
      });

      console.log(`Order ${orderId} cancelled successfully`);
      return true;
    } catch (error) {
      console.error(`Failed to cancel order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Modify an existing order
   */
  async modifyOrder(orderId: string, changes: OrderModification): Promise<boolean> {
    try {
      const order = await this.orderStore.getOrder(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      // Check if order can be modified
      if (![OrderStatus.DRAFT, OrderStatus.PENDING, OrderStatus.SUBMITTED].includes(order.status)) {
        throw new Error(`Order ${orderId} cannot be modified in status: ${order.status}`);
      }

      // If order has a broker ticket, try to modify with broker
      if (order.ticket > 0) {
        try {
          // Note: This would need to be implemented based on broker specifics
          // For now, we'll just update it in our system
          console.log(`Modifying order ${orderId} with broker ticket ${order.ticket}`);
        } catch (error) {
          console.error(`Failed to modify order with broker: ${error}`);
          // Continue with local modification even if broker modification fails
        }
      }

      // Update order in database
      const updatedOrder = await this.orderStore.updateOrder(orderId, {
        priceOpen: changes.price,
        priceSL: changes.sl,
        priceTP: changes.tp,
        volume: changes.volume,
        expiration: changes.expiration,
        updatedAt: new Date()
      });

      // Publish modification event
      await this.eventManager.publishEvent({
        id: randomUUID(),
        orderId,
        type: OrderEventType.MODIFIED,
        timestamp: new Date(),
        data: { changes, updatedOrder }
      });

      console.log(`Order ${orderId} modified successfully`);
      return true;
    } catch (error) {
      console.error(`Failed to modify order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Track order status
   */
  async trackOrderStatus(orderId: string): Promise<OrderStatus> {
    try {
      const order = await this.orderStore.getOrder(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      // If order has a broker ticket, check status with broker
      if (order.ticket > 0) {
        try {
          // Get order history from broker
          const now = new Date();
          const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          const brokerOrders = await this.brokerConnector.getOrderHistory(oneDayAgo, now);
          
          // Find our order in the broker history
          const brokerOrder = brokerOrders.find(o => o.ticket === order.ticket);
          
          if (brokerOrder) {
            // Map broker state to our status
            const newStatus = this.mapBrokerStateToOrderStatus(brokerOrder.state);
            
            // Update order if status changed
            if (newStatus !== order.status) {
              await this.updateOrderStatus(orderId, newStatus);
              
              // Check for partial fills
              if (brokerOrder.volumeCurrent < brokerOrder.volume && brokerOrder.volumeCurrent > 0) {
                await this.handlePartialFill(order, brokerOrder.volumeCurrent, brokerOrder.priceOpen);
              }
              
              // Check for complete fills
              if (brokerOrder.state === OrderState.FILLED) {
                await this.handleOrderFilled(order, brokerOrder.volumeCurrent, brokerOrder.priceOpen);
              }
              
              return newStatus;
            }
          }
        } catch (error) {
          console.error(`Failed to check order status with broker: ${error}`);
        }
      }

      return order.status;
    } catch (error) {
      console.error(`Failed to track order status for ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Get active orders for a user
   */
  async getActiveOrders(userId: string): Promise<ExtendedOrder[]> {
    try {
      return await this.orderStore.getActiveOrders(userId);
    } catch (error) {
      console.error(`Failed to get active orders for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Reconcile orders with broker records
   */
  async reconcileOrders(): Promise<ReconciliationReport> {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // Get all orders from our database
      const localOrders = await this.orderStore.getAllOrdersForReconciliation();
      
      // Get all orders from broker
      const brokerOrders = await this.brokerConnector.getOrderHistory(sevenDaysAgo, now);
      
      // Find discrepancies
      const discrepancies: OrderDiscrepancy[] = [];
      let reconciledOrders = 0;
      
      for (const localOrder of localOrders) {
        if (localOrder.ticket === 0) {
          // Order was never submitted to broker
          continue;
        }
        
        const brokerOrder = brokerOrders.find(o => o.ticket === localOrder.ticket);
        
        if (!brokerOrder) {
          // Order exists locally but not in broker
          discrepancies.push({
            orderId: localOrder.id,
            type: 'missing',
            localStatus: localOrder.status,
            description: `Order ${localOrder.id} exists locally but not in broker records`
          });
          continue;
        }
        
        // Check status discrepancy
        const brokerStatus = this.mapBrokerStateToOrderStatus(brokerOrder.state);
        if (brokerStatus !== localOrder.status) {
          discrepancies.push({
            orderId: localOrder.id,
            type: 'status',
            localStatus: localOrder.status,
            brokerStatus: brokerOrder.state,
            description: `Status mismatch: local=${localOrder.status}, broker=${brokerStatus}`
          });
          
          // Update local status to match broker
          await this.updateOrderStatus(localOrder.id, brokerStatus);
        }
        
        // Check volume discrepancy
        if (brokerOrder.volumeCurrent !== localOrder.filledVolume) {
          discrepancies.push({
            orderId: localOrder.id,
            type: 'volume',
            localStatus: localOrder.status,
            localVolume: localOrder.filledVolume,
            brokerVolume: brokerOrder.volumeCurrent,
            description: `Volume mismatch: local=${localOrder.filledVolume}, broker=${brokerOrder.volumeCurrent}`
          });
          
          // Update local volume to match broker
          await this.orderStore.updateOrder(localOrder.id, {
            filledVolume: brokerOrder.volumeCurrent
          });
        }
        
        reconciledOrders++;
      }
      
      const report: ReconciliationReport = {
        generatedAt: now,
        totalOrders: localOrders.length,
        reconciledOrders,
        discrepancyOrders: discrepancies.length,
        discrepancies
      };
      
      console.log(`Order reconciliation completed: ${reconciledOrders}/${localOrders.length} reconciled, ${discrepancies.length} discrepancies`);
      return report;
    } catch (error) {
      console.error('Failed to reconcile orders:', error);
      throw error;
    }
  }

  /**
   * Handle order filled event
   */
  async onOrderFilled(order: ExtendedOrder): Promise<void> {
    try {
      await this.updateOrderStatus(order.id, OrderStatus.FILLED);
      
      await this.eventManager.publishEvent({
        id: randomUUID(),
        orderId: order.id,
        type: OrderEventType.FILLED,
        timestamp: new Date(),
        data: { 
          filledVolume: order.filledVolume,
          averagePrice: order.averageFillPrice
        }
      });
      
      console.log(`Order ${order.id} filled completely`);
    } catch (error) {
      console.error(`Failed to handle order filled for ${order.id}:`, error);
    }
  }

  /**
   * Handle order rejected event
   */
  async onOrderRejected(order: ExtendedOrder, reason: string): Promise<void> {
    try {
      await this.orderStore.updateOrder(order.id, {
        status: OrderStatus.REJECTED,
        rejectionReason: reason
      });
      
      await this.eventManager.publishEvent({
        id: randomUUID(),
        orderId: order.id,
        type: OrderEventType.REJECTED,
        timestamp: new Date(),
        data: { reason }
      });
      
      console.log(`Order ${order.id} rejected: ${reason}`);
    } catch (error) {
      console.error(`Failed to handle order rejected for ${order.id}:`, error);
    }
  }

  /**
   * Handle order partially filled event
   */
  async onOrderPartiallyFilled(order: ExtendedOrder, filledAmount: number): Promise<void> {
    try {
      await this.handlePartialFill(order, filledAmount, order.priceOpen);
      
      console.log(`Order ${order.id} partially filled: ${filledAmount}`);
    } catch (error) {
      console.error(`Failed to handle order partially filled for ${order.id}:`, error);
    }
  }

  /**
   * Shutdown the order manager
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down Order Manager...');
    
    // Stop reconciliation
    if (this.reconciliationTimer) {
      clearInterval(this.reconciliationTimer);
      this.reconciliationTimer = null;
    }
    
    // Shutdown event manager
    await this.eventManager.shutdown();
    
    console.log('Order Manager shutdown complete');
  }

  // Private methods

  private validateOrderParams(params: OrderParams): void {
    if (!params.userId) {
      throw new Error('User ID is required');
    }
    
    if (!params.symbol) {
      throw new Error('Symbol is required');
    }
    
    if (params.volume <= 0) {
      throw new Error('Volume must be greater than 0');
    }
    
    if (![0, 1, 2, 3, 4, 5].includes(params.type)) {
      throw new Error('Invalid order type');
    }
  }

  private async updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    await this.orderStore.updateOrder(orderId, {
      status,
      updatedAt: new Date()
    });
  }

  private async submitToBroker(marketOrder: MarketOrder, maxRetries: number): Promise<TradeResult> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Submitting order to broker (attempt ${attempt}/${maxRetries})`);
        return await this.brokerConnector.openPosition(marketOrder);
      } catch (error) {
        lastError = error as Error;
        console.error(`Broker submission attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        }
      }
    }
    
    throw lastError || new Error('Failed to submit order to broker');
  }

  private mapBrokerStateToOrderStatus(state: OrderState): OrderStatus {
    switch (state) {
      case OrderState.STARTED:
        return OrderStatus.PENDING;
      case OrderState.PLACED:
        return OrderStatus.SUBMITTED;
      case OrderState.CANCELED:
        return OrderStatus.CANCELLED;
      case OrderState.PARTIAL:
        return OrderStatus.PARTIALLY_FILLED;
      case OrderState.FILLED:
        return OrderStatus.FILLED;
      case OrderState.REJECTED:
        return OrderStatus.REJECTED;
      case OrderState.EXPIRED:
        return OrderStatus.EXPIRED;
      default:
        return OrderStatus.ERROR;
    }
  }

  private async handlePartialFill(order: ExtendedOrder, filledAmount: number, price: number): Promise<void> {
    // Calculate new average fill price
    const totalFilled = (order.filledVolume || 0) + filledAmount;
    const totalValue = ((order.filledVolume || 0) * (order.averageFillPrice || 0)) + (filledAmount * price);
    const newAveragePrice = totalFilled > 0 ? totalValue / totalFilled : 0;
    
    await this.orderStore.updateOrder(order.id, {
      status: OrderStatus.PARTIALLY_FILLED,
      filledVolume: totalFilled,
      averageFillPrice: newAveragePrice
    });
    
    await this.eventManager.publishEvent({
      id: randomUUID(),
      orderId: order.id,
      type: OrderEventType.PARTIALLY_FILLED,
      timestamp: new Date(),
      data: { 
        filledAmount,
        totalFilled,
        price,
        averagePrice: newAveragePrice
      }
    });
  }

  private async handleOrderFilled(order: ExtendedOrder, filledAmount: number, price: number): Promise<void> {
    // Calculate final average fill price
    const totalFilled = (order.filledVolume || 0) + filledAmount;
    const totalValue = ((order.filledVolume || 0) * (order.averageFillPrice || 0)) + (filledAmount * price);
    const finalAveragePrice = totalFilled > 0 ? totalValue / totalFilled : 0;
    
    await this.orderStore.updateOrder(order.id, {
      status: OrderStatus.FILLED,
      filledVolume: totalFilled,
      averageFillPrice: finalAveragePrice
    });
    
    await this.eventManager.publishEvent({
      id: randomUUID(),
      orderId: order.id,
      type: OrderEventType.FILLED,
      timestamp: new Date(),
      data: { 
        filledAmount,
        totalFilled,
        price,
        averagePrice: finalAveragePrice
      }
    });
  }

  private startReconciliation(): void {
    this.reconciliationTimer = setInterval(async () => {
      try {
        await this.reconcileOrders();
      } catch (error) {
        console.error('Error during automatic reconciliation:', error);
      }
    }, this.config.reconciliationInterval);
    
    console.log(`Automatic reconciliation started with interval: ${this.config.reconciliationInterval}ms`);
  }

  private registerEventHandlers(): void {
    // Register event handlers for order state changes
    this.eventManager.registerEventHandler(
      OrderEventType.FILLED,
      async (event: OrderEvent) => {
        const order = await this.orderStore.getOrder(event.orderId);
        if (order) {
          await this.onOrderFilled(order);
        }
      }
    );
    
    this.eventManager.registerEventHandler(
      OrderEventType.REJECTED,
      async (event: OrderEvent) => {
        const order = await this.orderStore.getOrder(event.orderId);
        if (order) {
          await this.onOrderRejected(order, event.data?.reason || 'Unknown reason');
        }
      }
    );
    
    this.eventManager.registerEventHandler(
      OrderEventType.PARTIALLY_FILLED,
      async (event: OrderEvent) => {
        const order = await this.orderStore.getOrder(event.orderId);
        if (order) {
          await this.onOrderPartiallyFilled(order, event.data?.filledAmount || 0);
        }
      }
    );
  }
}