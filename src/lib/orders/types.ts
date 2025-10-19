/**
 * Types and interfaces for the Order Management System
 */

import { Order, OrderState, TradeResult } from '../brokers/types';

// Order parameters for creating a new order
export interface OrderParams {
  userId: string;
  strategyId?: string;
  symbol: string;
  type: 0 | 1 | 2 | 3 | 4 | 5; // 0-buy, 1-sell, 2-buylimit, 3-selllimit, 4-buystop, 5-sellstop
  volume: number;
  price?: number; // For limit orders
  sl?: number; // Stop loss price
  tp?: number; // Take profit price
  comment?: string;
  magic?: number;
  deviation?: number; // Max price deviation
  type_filling?: number; // Order filling type
  expiration?: Date; // Order expiration time
}

// Extended Order interface with additional properties
export interface ExtendedOrder extends Order {
  id: string; // Internal unique identifier
  userId: string;
  strategyId?: string;
  createdAt: Date;
  updatedAt: Date;
  status: OrderStatus;
  submissionResult?: SubmissionResult;
  filledVolume?: number; // Track partially filled orders
  averageFillPrice?: number; // Average price for partially filled orders
  rejectionReason?: string; // Reason for rejection if applicable
}

// Order status enum
export enum OrderStatus {
  DRAFT = 'draft',           // Order created but not submitted
  PENDING = 'pending',       // Order submitted to broker
  SUBMITTED = 'submitted',   // Order accepted by broker
  PARTIALLY_FILLED = 'partially_filled', // Order partially filled
  FILLED = 'filled',         // Order completely filled
  CANCELLED = 'cancelled',   // Order cancelled
  REJECTED = 'rejected',     // Order rejected by broker
  EXPIRED = 'expired',       // Order expired
  ERROR = 'error'            // Error occurred during processing
}

// Result of order submission
export interface SubmissionResult {
  success: boolean;
  orderId?: string;
  brokerTicket?: number;
  message?: string;
  errorCode?: number;
  timestamp: Date;
}

// Order event types
export enum OrderEventType {
  CREATED = 'created',
  SUBMITTED = 'submitted',
  FILLED = 'filled',
  PARTIALLY_FILLED = 'partially_filled',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  MODIFIED = 'modified',
  ERROR = 'error'
}

// Order event
export interface OrderEvent {
  id: string;
  orderId: string;
  type: OrderEventType;
  timestamp: Date;
  data?: any;
  message?: string;
}

// Reconciliation report
export interface ReconciliationReport {
  generatedAt: Date;
  totalOrders: number;
  reconciledOrders: number;
  discrepancyOrders: number;
  discrepancies: OrderDiscrepancy[];
}

// Order discrepancy
export interface OrderDiscrepancy {
  orderId: string;
  type: 'status' | 'volume' | 'price' | 'missing';
  localStatus: OrderStatus;
  brokerStatus?: OrderState;
  localVolume?: number;
  brokerVolume?: number;
  localPrice?: number;
  brokerPrice?: number;
  description: string;
}

// Order filter options
export interface OrderFilter {
  userId?: string;
  strategyId?: string;
  symbol?: string;
  status?: OrderStatus[];
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

// Order statistics
export interface OrderStatistics {
  totalOrders: number;
  filledOrders: number;
  cancelledOrders: number;
  rejectedOrders: number;
  pendingOrders: number;
  partiallyFilledOrders: number;
  totalVolume: number;
  filledVolume: number;
  averageFillPrice?: number;
  winRate?: number;
  totalProfit?: number;
}

// Order modification parameters
export interface OrderModification {
  price?: number;
  sl?: number;
  tp?: number;
  volume?: number;
  expiration?: Date;
}

// Order query result
export interface OrderQueryResult {
  orders: ExtendedOrder[];
  totalCount: number;
  hasMore: boolean;
}

// Order event handler
export type OrderEventHandler = (event: OrderEvent) => void;

// Order event subscription
export interface OrderEventSubscription {
  id: string;
  userId?: string;
  orderId?: string;
  eventTypes: OrderEventType[];
  handler: OrderEventHandler;
}

// Order store interface
export interface IOrderStore {
  // CRUD operations
  createOrder(order: Omit<ExtendedOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExtendedOrder>;
  getOrder(orderId: string): Promise<ExtendedOrder | null>;
  updateOrder(orderId: string, updates: Partial<ExtendedOrder>): Promise<ExtendedOrder>;
  deleteOrder(orderId: string): Promise<boolean>;
  
  // Query operations
  getOrders(filter: OrderFilter): Promise<OrderQueryResult>;
  getActiveOrders(userId: string): Promise<ExtendedOrder[]>;
  
  // Event operations
  createEvent(event: Omit<OrderEvent, 'id'>): Promise<OrderEvent>;
  getEvents(orderId: string): Promise<OrderEvent[]>;
  
  // Reconciliation
  getAllOrdersForReconciliation(): Promise<ExtendedOrder[]>;
}

// Order event manager interface
export interface IOrderEventManager {
  // Event subscription
  subscribe(subscription: Omit<OrderEventSubscription, 'id'>): Promise<string>;
  unsubscribe(subscriptionId: string): Promise<boolean>;
  
  // Event publishing
  publishEvent(event: OrderEvent): Promise<void>;
  
  // Event handling
  registerEventHandler(eventType: OrderEventType, handler: OrderEventHandler): void;
  unregisterEventHandler(eventType: OrderEventType, handler: OrderEventHandler): void;
}

// Order manager configuration
export interface OrderManagerConfig {
  maxRetries: number;
  retryDelay: number; // in milliseconds
  enableReconciliation: boolean;
  reconciliationInterval: number; // in milliseconds
  enableEventLogging: boolean;
  enablePersistence: boolean;
}