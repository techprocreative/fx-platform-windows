/**
 * Order Store - Database operations for order persistence
 */

import { PrismaClient } from '@prisma/client';
import {
  IOrderStore,
  ExtendedOrder,
  OrderEvent,
  OrderFilter,
  OrderQueryResult,
  OrderStatus,
  OrderEventType
} from './types';
import { OrderState } from '../brokers/types';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

export class OrderStore implements IOrderStore {
  /**
   * Create a new order in the database
   */
  async createOrder(order: Omit<ExtendedOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExtendedOrder> {
    const now = new Date();
    const id = randomUUID();
    
    try {
      // Store order in a JSON field in the ActivityLog table as a temporary solution
      // In a production environment, you would create a dedicated Order table
      const activityLog = await prisma.activityLog.create({
        data: {
          userId: order.userId,
          eventType: 'ORDER_CREATED',
          metadata: {
            orderId: id,
            orderData: JSON.parse(JSON.stringify(order)),
            createdAt: now.toISOString(),
            updatedAt: now.toISOString()
          }
        }
      });
      
      // Create the initial order event
      await this.createEvent({
        orderId: id,
        type: OrderEventType.CREATED,
        timestamp: now,
        data: order
      });
      
      return {
        ...order,
        id,
        createdAt: now,
        updatedAt: now
      };
    } catch (error) {
      console.error('Failed to create order:', error);
      throw new Error(`Failed to create order: ${(error as Error).message}`);
    }
  }
  
  /**
   * Get an order by ID
   */
  async getOrder(orderId: string): Promise<ExtendedOrder | null> {
    try {
      // Find the most recent activity log for this order
      const activityLog = await prisma.activityLog.findFirst({
        where: {
          eventType: 'ORDER_UPDATED',
          metadata: {
            path: ['orderId'],
            equals: orderId
          }
        },
        orderBy: {
          timestamp: 'desc'
        }
      });
      
      if (!activityLog) {
        // Try to find the creation log if no update log exists
        const creationLog = await prisma.activityLog.findFirst({
          where: {
            eventType: 'ORDER_CREATED',
            metadata: {
              path: ['orderId'],
              equals: orderId
            }
          }
        });
        
        if (!creationLog || !creationLog.metadata) {
          return null;
        }
        
        return (creationLog.metadata as any).orderData as ExtendedOrder;
      }
      
      if (!activityLog.metadata) {
        return null;
      }
      
      return (activityLog.metadata as any).orderData as ExtendedOrder;
    } catch (error) {
      console.error('Failed to get order:', error);
      throw new Error(`Failed to get order: ${(error as Error).message}`);
    }
  }
  
  /**
   * Update an order
   */
  async updateOrder(orderId: string, updates: Partial<ExtendedOrder>): Promise<ExtendedOrder> {
    try {
      const existingOrder = await this.getOrder(orderId);
      if (!existingOrder) {
        throw new Error(`Order with ID ${orderId} not found`);
      }
      
      const updatedOrder = {
        ...existingOrder,
        ...updates,
        updatedAt: new Date()
      };
      
      // Store updated order in activity log
      await prisma.activityLog.create({
        data: {
          userId: existingOrder.userId,
          eventType: 'ORDER_UPDATED',
          metadata: {
            orderId,
            orderData: JSON.parse(JSON.stringify(updatedOrder)),
            updatedAt: new Date().toISOString()
          }
        }
      });
      
      return updatedOrder;
    } catch (error) {
      console.error('Failed to update order:', error);
      throw new Error(`Failed to update order: ${(error as Error).message}`);
    }
  }
  
  /**
   * Delete an order
   */
  async deleteOrder(orderId: string): Promise<boolean> {
    try {
      const existingOrder = await this.getOrder(orderId);
      if (!existingOrder) {
        return false;
      }
      
      // Create a deletion log
      await prisma.activityLog.create({
        data: {
          userId: existingOrder.userId,
          eventType: 'ORDER_DELETED',
          metadata: {
            orderId,
            deletedAt: new Date().toISOString()
          }
        }
      });
      
      // Create order deletion event
      await this.createEvent({
        orderId,
        type: OrderEventType.CANCELLED,
        timestamp: new Date(),
        data: { reason: 'Deleted by user' }
      });
      
      return true;
    } catch (error) {
      console.error('Failed to delete order:', error);
      throw new Error(`Failed to delete order: ${(error as Error).message}`);
    }
  }
  
  /**
   * Get orders with filtering
   */
  async getOrders(filter: OrderFilter): Promise<OrderQueryResult> {
    try {
      // Build the where clause for the query
      const whereClause: any = {
        eventType: {
          in: ['ORDER_CREATED', 'ORDER_UPDATED']
        }
      };
      
      if (filter.userId) {
        whereClause.userId = filter.userId;
      }
      
      // Get all order activity logs
      const activityLogs = await prisma.activityLog.findMany({
        where: whereClause,
        orderBy: {
          timestamp: 'desc'
        },
        take: filter.limit || 100,
        skip: filter.offset || 0
      });
      
      // Extract unique orders and get their latest state
      const orderMap = new Map<string, ExtendedOrder>();
      
      for (const log of activityLogs) {
        if (log.metadata && (log.metadata as any).orderData) {
          const order = (log.metadata as any).orderData as ExtendedOrder;
          
          // Skip if we already have a newer version of this order
          if (orderMap.has(order.id)) {
            const existingOrder = orderMap.get(order.id);
            if (existingOrder && existingOrder.updatedAt > order.updatedAt) {
              continue;
            }
          }
          
          // Apply additional filters
          let includeOrder = true;
          
          if (filter.strategyId && order.strategyId !== filter.strategyId) {
            includeOrder = false;
          }
          
          if (filter.symbol && order.symbol !== filter.symbol) {
            includeOrder = false;
          }
          
          if (filter.status && filter.status.length > 0 && !filter.status.includes(order.status)) {
            includeOrder = false;
          }
          
          if (filter.from && order.createdAt < filter.from) {
            includeOrder = false;
          }
          
          if (filter.to && order.createdAt > filter.to) {
            includeOrder = false;
          }
          
          if (includeOrder) {
            orderMap.set(order.id, order);
          }
        }
      }
      
      const orders = Array.from(orderMap.values());
      
      // Sort by creation date (newest first)
      orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      return {
        orders,
        totalCount: orders.length,
        hasMore: orders.length === (filter.limit || 100)
      };
    } catch (error) {
      console.error('Failed to get orders:', error);
      throw new Error(`Failed to get orders: ${(error as Error).message}`);
    }
  }
  
  /**
   * Get active orders for a user
   */
  async getActiveOrders(userId: string): Promise<ExtendedOrder[]> {
    try {
      const activeStatuses = [
        OrderStatus.DRAFT,
        OrderStatus.PENDING,
        OrderStatus.SUBMITTED,
        OrderStatus.PARTIALLY_FILLED
      ];
      
      const result = await this.getOrders({
        userId,
        status: activeStatuses
      });
      
      return result.orders;
    } catch (error) {
      console.error('Failed to get active orders:', error);
      throw new Error(`Failed to get active orders: ${(error as Error).message}`);
    }
  }
  
  /**
   * Create an order event
   */
  async createEvent(event: Omit<OrderEvent, 'id'>): Promise<OrderEvent> {
    try {
      const id = randomUUID();
      const newEvent = { ...event, id };
      
      // Store event in activity log
      await prisma.activityLog.create({
        data: {
          userId: 'SYSTEM', // We'll need to update this when we have the order
          eventType: 'ORDER_EVENT',
          metadata: {
            orderId: event.orderId,
            eventData: JSON.parse(JSON.stringify(newEvent))
          }
        }
      });
      
      return newEvent;
    } catch (error) {
      console.error('Failed to create order event:', error);
      throw new Error(`Failed to create order event: ${(error as Error).message}`);
    }
  }
  
  /**
   * Get events for an order
   */
  async getEvents(orderId: string): Promise<OrderEvent[]> {
    try {
      const activityLogs = await prisma.activityLog.findMany({
        where: {
          eventType: 'ORDER_EVENT',
          metadata: {
            path: ['orderId'],
            equals: orderId
          }
        },
        orderBy: {
          timestamp: 'asc'
        }
      });
      
      return activityLogs.map(log => (log.metadata as any).eventData as OrderEvent);
    } catch (error) {
      console.error('Failed to get order events:', error);
      throw new Error(`Failed to get order events: ${(error as Error).message}`);
    }
  }
  
  /**
   * Get all orders for reconciliation
   */
  async getAllOrdersForReconciliation(): Promise<ExtendedOrder[]> {
    try {
      // Get all orders in the last 7 days for reconciliation
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const result = await this.getOrders({
        from: sevenDaysAgo,
        limit: 1000 // Limit to prevent performance issues
      });
      
      return result.orders;
    } catch (error) {
      console.error('Failed to get orders for reconciliation:', error);
      throw new Error(`Failed to get orders for reconciliation: ${(error as Error).message}`);
    }
  }
  
  /**
   * Get order statistics for a user
   */
  async getOrderStatistics(userId: string): Promise<any> {
    try {
      const result = await this.getOrders({ userId });
      const orders = result.orders;
      
      const stats = {
        totalOrders: orders.length,
        filledOrders: orders.filter(o => o.status === OrderStatus.FILLED).length,
        cancelledOrders: orders.filter(o => o.status === OrderStatus.CANCELLED).length,
        rejectedOrders: orders.filter(o => o.status === OrderStatus.REJECTED).length,
        pendingOrders: orders.filter(o => 
          [OrderStatus.DRAFT, OrderStatus.PENDING, OrderStatus.SUBMITTED].includes(o.status)
        ).length,
        partiallyFilledOrders: orders.filter(o => o.status === OrderStatus.PARTIALLY_FILLED).length,
        totalVolume: orders.reduce((sum, o) => sum + (o.volume || 0), 0),
        filledVolume: orders.reduce((sum, o) => sum + (o.filledVolume || 0), 0)
      };
      
      // Calculate average fill price for filled orders
      const filledOrders = orders.filter(o => o.status === OrderStatus.FILLED && o.averageFillPrice);
      if (filledOrders.length > 0) {
        (stats as any).averageFillPrice = filledOrders.reduce((sum, o) => sum + (o.averageFillPrice || 0), 0) / filledOrders.length;
      }
      
      return stats;
    } catch (error) {
      console.error('Failed to get order statistics:', error);
      throw new Error(`Failed to get order statistics: ${(error as Error).message}`);
    }
  }
  
  /**
   * Clean up old order data
   */
  async cleanupOldOrders(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      // Delete old order activity logs
      const result = await prisma.activityLog.deleteMany({
        where: {
          eventType: {
            in: ['ORDER_CREATED', 'ORDER_UPDATED', 'ORDER_DELETED', 'ORDER_EVENT']
          },
          timestamp: {
            lt: cutoffDate
          }
        }
      });
      
      return result.count;
    } catch (error) {
      console.error('Failed to cleanup old orders:', error);
      throw new Error(`Failed to cleanup old orders: ${(error as Error).message}`);
    }
  }
}