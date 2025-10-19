/**
 * Unit tests for OrderManager
 */

import { OrderManager } from '../order-manager';
import { OrderStore } from '../order-store';
import { OrderEventManager } from '../order-events';
import { IBrokerConnector } from '../../brokers/mt5-connector';
import { 
  OrderParams, 
  OrderStatus, 
  OrderEventType, 
  ExtendedOrder,
  SubmissionResult,
  ReconciliationReport
} from '../types';
import { OrderState, TradeResult, Order } from '../../brokers/types';

// Mock implementations
const mockBrokerConnector: jest.Mocked<IBrokerConnector> = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  isConnected: jest.fn(),
  getAccountInfo: jest.fn(),
  openPosition: jest.fn(),
  closePosition: jest.fn(),
  modifyPosition: jest.fn(),
  getSymbolInfo: jest.fn(),
  getCurrentPrice: jest.fn(),
  getOpenPositions: jest.fn(),
  getOrderHistory: jest.fn(),
  onConnectionEvent: jest.fn(),
  getLastError: jest.fn()
};

const mockOrderStore = {
  createOrder: jest.fn(),
  getOrder: jest.fn(),
  updateOrder: jest.fn(),
  deleteOrder: jest.fn(),
  getOrders: jest.fn(),
  getActiveOrders: jest.fn(),
  createEvent: jest.fn(),
  getEvents: jest.fn(),
  getAllOrdersForReconciliation: jest.fn(),
  getOrderStatistics: jest.fn(),
  cleanupOldOrders: jest.fn()
};

const mockEventManager = {
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  publishEvent: jest.fn(),
  registerEventHandler: jest.fn(),
  unregisterEventHandler: jest.fn(),
  getActiveSubscriptions: jest.fn(),
  getEventStatistics: jest.fn(),
  clearAllSubscriptions: jest.fn(),
  shutdown: jest.fn()
};

// Mock the getOrderEventManager function
jest.mock('../order-events', () => ({
  getOrderEventManager: jest.fn(() => mockEventManager)
}));

// Mock the OrderStore constructor
jest.mock('../order-store', () => ({
  OrderStore: jest.fn(() => mockOrderStore)
}));

describe('OrderManager', () => {
  let orderManager: OrderManager;
  const userId = 'test-user-id';
  const strategyId = 'test-strategy-id';
  const symbol = 'EURUSD';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock return values
    mockBrokerConnector.isConnected.mockReturnValue(true);
    mockBrokerConnector.openPosition.mockResolvedValue({
      retcode: 0,
      deal: 12346,
      order: 12345,
      volume: 1.0,
      price: 1.1234,
      bid: 1.1233,
      ask: 1.1235,
      comment: 'Order executed',
      request_id: 1,
      retcode_external: 0,
      request: {} as any
    });

    const mockOrder: ExtendedOrder = {
      id: 'test-order-id',
      userId,
      strategyId,
      ticket: 0,
      symbol,
      type: 0, // BUY
      typeTime: 0,
      state: OrderState.STARTED,
      volume: 1.0,
      priceOpen: 1.1234,
      priceSL: 1.1200,
      priceTP: 1.1300,
      priceCurrent: 0,
      volumeCurrent: 1.0,
      comment: 'Test order',
      openTime: new Date(),
      expiration: new Date(0),
      magic: 123,
      commission: 0,
      storage: 0,
      identifier: 0,
      reason: 0,
      status: OrderStatus.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockOrderStore.createOrder.mockResolvedValue(mockOrder);
    mockOrderStore.getOrder.mockResolvedValue(mockOrder);
    mockOrderStore.updateOrder.mockResolvedValue(mockOrder);
    mockOrderStore.getActiveOrders.mockResolvedValue([mockOrder]);
    mockOrderStore.getAllOrdersForReconciliation.mockResolvedValue([mockOrder]);
    mockOrderStore.createEvent.mockResolvedValue({} as any);

    // Create OrderManager instance
    orderManager = new OrderManager(mockBrokerConnector, {
      enableReconciliation: false, // Disable auto-reconciliation for tests
      maxRetries: 2,
      retryDelay: 100
    });
  });

  afterEach(async () => {
    await orderManager.shutdown();
  });

  describe('createOrder', () => {
    it('should create an order with valid parameters', async () => {
      const orderParams: OrderParams = {
        userId,
        strategyId,
        symbol,
        type: 0, // BUY
        volume: 1.0,
        price: 1.1234,
        sl: 1.1200,
        tp: 1.1300,
        comment: 'Test order'
      };

      const order = await orderManager.createOrder(orderParams);

      expect(order).toBeDefined();
      expect(order.userId).toBe(userId);
      expect(order.symbol).toBe(symbol);
      expect(order.status).toBe(OrderStatus.DRAFT);
      expect(mockOrderStore.createOrder).toHaveBeenCalled();
      expect(mockEventManager.publishEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: OrderEventType.CREATED,
          orderId: order.id,
          data: { order }
        })
      );
    });

    it('should throw error for invalid parameters', async () => {
      const invalidParams: OrderParams = {
        userId: '',
        symbol,
        type: 0,
        volume: 1.0
      };

      await expect(orderManager.createOrder(invalidParams)).rejects.toThrow('User ID is required');
      expect(mockOrderStore.createOrder).not.toHaveBeenCalled();
    });

    it('should throw error for invalid volume', async () => {
      const invalidParams: OrderParams = {
        userId,
        symbol,
        type: 0,
        volume: -1.0
      };

      await expect(orderManager.createOrder(invalidParams)).rejects.toThrow('Volume must be greater than 0');
    });

    it('should throw error for invalid order type', async () => {
      const invalidParams: OrderParams = {
        userId,
        symbol,
        type: 99 as any, // Invalid type
        volume: 1.0
      };

      await expect(orderManager.createOrder(invalidParams)).rejects.toThrow('Invalid order type');
    });
  });

  describe('submitOrder', () => {
    let mockOrder: ExtendedOrder;

    beforeEach(() => {
      mockOrder = {
        id: 'test-order-id',
        userId,
        strategyId,
        ticket: 0,
        symbol,
        type: 0, // BUY
        typeTime: 0,
        state: OrderState.STARTED,
        volume: 1.0,
        priceOpen: 1.1234,
        priceSL: 1.1200,
        priceTP: 1.1300,
        priceCurrent: 0,
        volumeCurrent: 1.0,
        comment: 'Test order',
        openTime: new Date(),
        expiration: new Date(0),
        magic: 123,
        commission: 0,
        storage: 0,
        identifier: 0,
        reason: 0,
        status: OrderStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockOrderStore.getOrder.mockResolvedValue(mockOrder);
    });

    it('should submit order to broker successfully', async () => {
      const result = await orderManager.submitOrder(mockOrder);

      expect(result.success).toBe(true);
      expect(result.brokerTicket).toBe(12345);
      expect(mockBrokerConnector.openPosition).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol,
          type: 0,
          volume: 1.0
        })
      );
      expect(mockOrderStore.updateOrder).toHaveBeenCalledWith(
        mockOrder.id,
        expect.objectContaining({
          ticket: 12345,
          status: OrderStatus.SUBMITTED
        })
      );
      expect(mockEventManager.publishEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: OrderEventType.SUBMITTED,
          orderId: mockOrder.id
        })
      );
    });

    it('should handle broker rejection', async () => {
      mockBrokerConnector.openPosition.mockResolvedValue({
        retcode: 1001,
        deal: 0,
        order: 0,
        volume: 0,
        price: 0,
        bid: 0,
        ask: 0,
        comment: 'Insufficient margin',
        request_id: 1,
        retcode_external: 1001,
        request: {} as any
      });

      const result = await orderManager.submitOrder(mockOrder);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(1001);
      expect(result.message).toBe('Insufficient margin');
      expect(mockOrderStore.updateOrder).toHaveBeenCalledWith(
        mockOrder.id,
        expect.objectContaining({
          status: OrderStatus.REJECTED,
          rejectionReason: 'Insufficient margin'
        })
      );
      expect(mockEventManager.publishEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: OrderEventType.REJECTED,
          orderId: mockOrder.id
        })
      );
    });

    it('should throw error if order is not in DRAFT status', async () => {
      mockOrder.status = OrderStatus.SUBMITTED;
      mockOrderStore.getOrder.mockResolvedValue(mockOrder);

      await expect(orderManager.submitOrder(mockOrder)).rejects.toThrow('not in DRAFT status');
    });

    it('should retry on broker failure', async () => {
      // First call fails, second succeeds
      mockBrokerConnector.openPosition
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          retcode: 0,
          deal: 12346,
          order: 12345,
          volume: 1.0,
          price: 1.1234,
          bid: 1.1233,
          ask: 1.1235,
          comment: 'Order executed',
          request_id: 1,
          retcode_external: 0,
          request: {} as any
        });

      const result = await orderManager.submitOrder(mockOrder);

      expect(result.success).toBe(true);
      expect(mockBrokerConnector.openPosition).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      mockBrokerConnector.openPosition.mockRejectedValue(new Error('Persistent error'));

      await expect(orderManager.submitOrder(mockOrder)).rejects.toThrow('Persistent error');
      expect(mockBrokerConnector.openPosition).toHaveBeenCalledTimes(2); // maxRetries = 2
    });
  });

  describe('cancelOrder', () => {
    let mockOrder: ExtendedOrder;

    beforeEach(() => {
      mockOrder = {
        id: 'test-order-id',
        userId,
        strategyId,
        ticket: 12345,
        symbol,
        type: 0,
        typeTime: 0,
        state: OrderState.STARTED,
        volume: 1.0,
        priceOpen: 1.1234,
        priceSL: 1.1200,
        priceTP: 1.1300,
        priceCurrent: 0,
        volumeCurrent: 1.0,
        comment: 'Test order',
        openTime: new Date(),
        expiration: new Date(0),
        magic: 123,
        commission: 0,
        storage: 0,
        identifier: 0,
        reason: 0,
        status: OrderStatus.SUBMITTED,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockOrderStore.getOrder.mockResolvedValue(mockOrder);
    });

    it('should cancel order successfully', async () => {
      const result = await orderManager.cancelOrder(mockOrder.id);

      expect(result).toBe(true);
      expect(mockOrderStore.updateOrder).toHaveBeenCalledWith(
        mockOrder.id,
        expect.objectContaining({
          status: OrderStatus.CANCELLED
        })
      );
      expect(mockEventManager.publishEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: OrderEventType.CANCELLED,
          orderId: mockOrder.id
        })
      );
    });

    it('should throw error if order not found', async () => {
      mockOrderStore.getOrder.mockResolvedValue(null);

      await expect(orderManager.cancelOrder('non-existent-id')).rejects.toThrow('not found');
    });

    it('should throw error if order cannot be cancelled', async () => {
      mockOrder.status = OrderStatus.FILLED;
      mockOrderStore.getOrder.mockResolvedValue(mockOrder);

      await expect(orderManager.cancelOrder(mockOrder.id)).rejects.toThrow('cannot be cancelled');
    });
  });

  describe('modifyOrder', () => {
    let mockOrder: ExtendedOrder;

    beforeEach(() => {
      mockOrder = {
        id: 'test-order-id',
        userId,
        strategyId,
        ticket: 12345,
        symbol,
        type: 0,
        typeTime: 0,
        state: OrderState.STARTED,
        volume: 1.0,
        priceOpen: 1.1234,
        priceSL: 1.1200,
        priceTP: 1.1300,
        priceCurrent: 0,
        volumeCurrent: 1.0,
        comment: 'Test order',
        openTime: new Date(),
        expiration: new Date(0),
        magic: 123,
        commission: 0,
        storage: 0,
        identifier: 0,
        reason: 0,
        status: OrderStatus.SUBMITTED,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockOrderStore.getOrder.mockResolvedValue(mockOrder);
    });

    it('should modify order successfully', async () => {
      const changes = {
        price: 1.1240,
        sl: 1.1210,
        tp: 1.1310
      };

      const result = await orderManager.modifyOrder(mockOrder.id, changes);

      expect(result).toBe(true);
      expect(mockOrderStore.updateOrder).toHaveBeenCalledWith(
        mockOrder.id,
        expect.objectContaining({
          priceOpen: 1.1240,
          priceSL: 1.1210,
          priceTP: 1.1310
        })
      );
      expect(mockEventManager.publishEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: OrderEventType.MODIFIED,
          orderId: mockOrder.id,
          data: { changes }
        })
      );
    });

    it('should throw error if order not found', async () => {
      mockOrderStore.getOrder.mockResolvedValue(null);

      await expect(orderManager.modifyOrder('non-existent-id', {})).rejects.toThrow('not found');
    });
  });

  describe('trackOrderStatus', () => {
    let mockOrder: ExtendedOrder;
    let mockBrokerOrder: Order;

    beforeEach(() => {
      mockOrder = {
        id: 'test-order-id',
        userId,
        strategyId,
        ticket: 12345,
        symbol,
        type: 0,
        typeTime: 0,
        state: OrderState.STARTED,
        volume: 1.0,
        priceOpen: 1.1234,
        priceSL: 1.1200,
        priceTP: 1.1300,
        priceCurrent: 0,
        volumeCurrent: 1.0,
        comment: 'Test order',
        openTime: new Date(),
        expiration: new Date(0),
        magic: 123,
        commission: 0,
        storage: 0,
        identifier: 0,
        reason: 0,
        status: OrderStatus.SUBMITTED,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      mockBrokerOrder = {
        ticket: 12345,
        symbol,
        type: 0,
        typeTime: 0,
        state: OrderState.FILLED,
        volume: 1.0,
        priceOpen: 1.1234,
        priceSL: 1.1200,
        priceTP: 1.1300,
        priceCurrent: 1.1235,
        volumeCurrent: 1.0,
        comment: 'Test order',
        openTime: new Date(),
        expiration: new Date(0),
        magic: 123,
        commission: 0,
        storage: 0,
        identifier: 0,
        reason: 0
      };

      mockOrderStore.getOrder.mockResolvedValue(mockOrder);
      mockBrokerConnector.getOrderHistory.mockResolvedValue([mockBrokerOrder]);
    });

    it('should track order status from broker', async () => {
      const status = await orderManager.trackOrderStatus(mockOrder.id);

      expect(status).toBe(OrderStatus.FILLED);
      expect(mockBrokerConnector.getOrderHistory).toHaveBeenCalled();
      expect(mockOrderStore.updateOrder).toHaveBeenCalledWith(
        mockOrder.id,
        expect.objectContaining({
          status: OrderStatus.FILLED
        })
      );
    });

    it('should handle partial fills', async () => {
      mockBrokerOrder.state = OrderState.PARTIAL;
      mockBrokerOrder.volumeCurrent = 0.5;

      const status = await orderManager.trackOrderStatus(mockOrder.id);

      expect(status).toBe(OrderStatus.PARTIALLY_FILLED);
      expect(mockOrderStore.updateOrder).toHaveBeenCalledWith(
        mockOrder.id,
        expect.objectContaining({
          status: OrderStatus.PARTIALLY_FILLED,
          filledVolume: 0.5
        })
      );
    });

    it('should return local status if broker order not found', async () => {
      mockBrokerConnector.getOrderHistory.mockResolvedValue([]);

      const status = await orderManager.trackOrderStatus(mockOrder.id);

      expect(status).toBe(OrderStatus.SUBMITTED);
    });

    it('should throw error if order not found', async () => {
      mockOrderStore.getOrder.mockResolvedValue(null);

      await expect(orderManager.trackOrderStatus('non-existent-id')).rejects.toThrow('not found');
    });
  });

  describe('getActiveOrders', () => {
    it('should get active orders for user', async () => {
      const orders = await orderManager.getActiveOrders(userId);

      expect(orders).toHaveLength(1);
      expect(orders[0].userId).toBe(userId);
      expect(mockOrderStore.getActiveOrders).toHaveBeenCalledWith(userId);
    });
  });

  describe('reconcileOrders', () => {
    let mockOrder: ExtendedOrder;
    let mockBrokerOrder: Order;

    beforeEach(() => {
      mockOrder = {
        id: 'test-order-id',
        userId,
        strategyId,
        ticket: 12345,
        symbol,
        type: 0,
        typeTime: 0,
        state: OrderState.STARTED,
        volume: 1.0,
        priceOpen: 1.1234,
        priceSL: 1.1200,
        priceTP: 1.1300,
        priceCurrent: 0,
        volumeCurrent: 1.0,
        comment: 'Test order',
        openTime: new Date(),
        expiration: new Date(0),
        magic: 123,
        commission: 0,
        storage: 0,
        identifier: 0,
        reason: 0,
        status: OrderStatus.SUBMITTED,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      mockBrokerOrder = {
        ticket: 12345,
        symbol,
        type: 0,
        typeTime: 0,
        state: OrderState.FILLED,
        volume: 1.0,
        priceOpen: 1.1234,
        priceSL: 1.1200,
        priceTP: 1.1300,
        priceCurrent: 1.1235,
        volumeCurrent: 1.0,
        comment: 'Test order',
        openTime: new Date(),
        expiration: new Date(0),
        magic: 123,
        commission: 0,
        storage: 0,
        identifier: 0,
        reason: 0
      };

      mockOrderStore.getAllOrdersForReconciliation.mockResolvedValue([mockOrder]);
      mockBrokerConnector.getOrderHistory.mockResolvedValue([mockBrokerOrder]);
    });

    it('should reconcile orders successfully', async () => {
      const report = await orderManager.reconcileOrders();

      expect(report.totalOrders).toBe(1);
      expect(report.reconciledOrders).toBe(1);
      expect(report.discrepancyOrders).toBe(0);
      expect(report.discrepancies).toHaveLength(0);
      expect(mockBrokerConnector.getOrderHistory).toHaveBeenCalled();
    });

    it('should detect status discrepancies', async () => {
      mockBrokerOrder.state = OrderState.REJECTED;

      const report = await orderManager.reconcileOrders();

      expect(report.discrepancyOrders).toBe(1);
      expect(report.discrepancies).toHaveLength(1);
      expect(report.discrepancies[0].type).toBe('status');
      expect(report.discrepancies[0].localStatus).toBe(OrderStatus.SUBMITTED);
      expect(report.discrepancies[0].brokerStatus).toBe(OrderState.REJECTED);
    });

    it('should detect missing orders', async () => {
      mockBrokerConnector.getOrderHistory.mockResolvedValue([]);

      const report = await orderManager.reconcileOrders();

      expect(report.discrepancyOrders).toBe(1);
      expect(report.discrepancies).toHaveLength(1);
      expect(report.discrepancies[0].type).toBe('missing');
    });

    it('should detect volume discrepancies', async () => {
      mockBrokerOrder.volumeCurrent = 0.8;

      const report = await orderManager.reconcileOrders();

      expect(report.discrepancyOrders).toBe(1);
      expect(report.discrepancies).toHaveLength(1);
      expect(report.discrepancies[0].type).toBe('volume');
      expect(report.discrepancies[0].localVolume).toBe(0);
      expect(report.discrepancies[0].brokerVolume).toBe(0.8);
    });
  });

  describe('Event Handlers', () => {
    let mockOrder: ExtendedOrder;

    beforeEach(() => {
      mockOrder = {
        id: 'test-order-id',
        userId,
        strategyId,
        ticket: 12345,
        symbol,
        type: 0,
        typeTime: 0,
        state: OrderState.STARTED,
        volume: 1.0,
        priceOpen: 1.1234,
        priceSL: 1.1200,
        priceTP: 1.1300,
        priceCurrent: 0,
        volumeCurrent: 1.0,
        comment: 'Test order',
        openTime: new Date(),
        expiration: new Date(0),
        magic: 123,
        commission: 0,
        storage: 0,
        identifier: 0,
        reason: 0,
        status: OrderStatus.SUBMITTED,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockOrderStore.getOrder.mockResolvedValue(mockOrder);
    });

    it('should handle order filled event', async () => {
      await orderManager.onOrderFilled(mockOrder);

      expect(mockOrderStore.updateOrder).toHaveBeenCalledWith(
        mockOrder.id,
        expect.objectContaining({
          status: OrderStatus.FILLED
        })
      );
      expect(mockEventManager.publishEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: OrderEventType.FILLED,
          orderId: mockOrder.id
        })
      );
    });

    it('should handle order rejected event', async () => {
      await orderManager.onOrderRejected(mockOrder, 'Insufficient margin');

      expect(mockOrderStore.updateOrder).toHaveBeenCalledWith(
        mockOrder.id,
        expect.objectContaining({
          status: OrderStatus.REJECTED,
          rejectionReason: 'Insufficient margin'
        })
      );
      expect(mockEventManager.publishEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: OrderEventType.REJECTED,
          orderId: mockOrder.id,
          data: { reason: 'Insufficient margin' }
        })
      );
    });

    it('should handle order partially filled event', async () => {
      await orderManager.onOrderPartiallyFilled(mockOrder, 0.5);

      expect(mockOrderStore.updateOrder).toHaveBeenCalledWith(
        mockOrder.id,
        expect.objectContaining({
          status: OrderStatus.PARTIALLY_FILLED,
          filledVolume: 0.5
        })
      );
    });
  });

  describe('shutdown', () => {
    it('should shutdown properly', async () => {
      await orderManager.shutdown();

      expect(mockEventManager.shutdown).toHaveBeenCalled();
    });
  });
});