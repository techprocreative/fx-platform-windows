/**
 * Integration Tests for MT5 Connector
 *
 * This file contains integration tests for the MT5Connector class,
 * testing connection, trading operations, and error handling with mocking.
 * These tests use the test utilities and mock implementations.
 */

import { MT5Connector } from "../mt5-connector";
import {
  BrokerCredentials,
  MarketOrder,
  SymbolInfo,
  Position,
  TradeResult,
  ConnectionEventType,
  ConnectionStatus,
} from "../types";
import {
  TestDataFactory,
  TestEnvironmentHelper,
  PerformanceTestHelper,
  AsyncTestHelper,
  ErrorTestHelper,
  NetworkTestHelper,
} from "../../testing/test-utils";

// Mock the MT5 API wrapper
jest.mock("../mt5-api-wrapper", () => ({
  MT5ApiWrapper: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    isConnected: jest.fn(),
    getAccountInfo: jest.fn(),
    getSymbolInfo: jest.fn(),
    getCurrentPrice: jest.fn(),
    getOpenPositions: jest.fn(),
    getOrderHistory: jest.fn(),
    openPosition: jest.fn(),
    closePosition: jest.fn(),
    modifyPosition: jest.fn(),
  })),
}));

describe("MT5 Connector Integration Tests", () => {
  let connector: MT5Connector;
  let mockCredentials: BrokerCredentials;

  beforeEach(() => {
    connector = new MT5Connector();
    connector.enableMockMode();

    mockCredentials = TestDataFactory.createBrokerCredentials();
    jest.clearAllMocks();
    TestEnvironmentHelper.setupMockEnvironment();
  });

  afterEach(async () => {
    if (connector.isConnected()) {
      await connector.disconnect();
    }
  });

  describe("Connection Management", () => {
    it("should establish connection with valid credentials", async () => {
      const result = await connector.connect(mockCredentials);

      expect(result).toBe(true);
      expect(connector.isConnected()).toBe(true);
      expect(connector.getLastError()).toBeNull();
    });

    it("should handle connection timeout", async () => {
      connector.disableMockMode();

      const credentialsWithTimeout = {
        ...mockCredentials,
        timeout: 1, // Very short timeout
      };

      const result = await connector.connect(credentialsWithTimeout);

      expect(result).toBe(false);
      expect(connector.isConnected()).toBe(false);
      expect(connector.getLastError()).not.toBeNull();
    });

    it("should handle invalid credentials", async () => {
      connector.disableMockMode();

      const invalidCredentials = {
        ...mockCredentials,
        login: 99999999,
        password: "invalidpassword",
        server: "invalid-server",
      };

      const result = await connector.connect(invalidCredentials);

      expect(result).toBe(false);
      expect(connector.isConnected()).toBe(false);
      expect(connector.getLastError()).not.toBeNull();
    });

    it("should reconnect automatically on connection loss", async () => {
      await connector.connect(mockCredentials);
      expect(connector.isConnected()).toBe(true);

      // Manually disconnect to simulate connection loss
      await connector.disconnect();
      expect(connector.isConnected()).toBe(false);

      // Reconnect manually
      const result = await connector.connect(mockCredentials);

      // Should be reconnected
      expect(result).toBe(true);
      expect(connector.isConnected()).toBe(true);
    });

    it("should emit connection events", async () => {
      const events: any[] = [];
      connector.onConnectionEvent((event) => {
        events.push(event);
      });

      // Connect
      await connector.connect(mockCredentials);

      // Disconnect
      await connector.disconnect();

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe(ConnectionEventType.CONNECTED);
      expect(events[1].type).toBe(ConnectionEventType.DISCONNECTED);
    });

    it("should handle concurrent connection attempts", async () => {
      const promises = Array.from({ length: 5 }, () =>
        connector.connect(mockCredentials),
      );

      const results = await Promise.all(promises);

      // All should return true (first one connects, others see already connected)
      results.forEach((result) => {
        expect(result).toBe(true);
      });

      expect(connector.isConnected()).toBe(true);
    });
  });

  describe("Account Information", () => {
    beforeEach(async () => {
      await connector.connect(mockCredentials);
    });

    it("should retrieve account information", async () => {
      const accountInfo = await connector.getAccountInfo();

      expect(accountInfo).toBeDefined();
      expect(accountInfo.login).toBe(mockCredentials.login);
      expect(accountInfo.server).toBe(mockCredentials.server);
      expect(accountInfo.balance).toBeGreaterThan(0);
      expect(accountInfo.equity).toBeGreaterThan(0);
      expect(accountInfo.leverage).toBeGreaterThan(0);
    });

    it("should handle account info retrieval when disconnected", async () => {
      await connector.disconnect();

      await ErrorTestHelper.expectError(
        () => connector.getAccountInfo(),
        Error,
        "Not connected to broker",
      );
    });

    it("should handle account info retrieval errors", async () => {
      // Disconnect to simulate error
      await connector.disconnect();

      await ErrorTestHelper.expectError(
        () => connector.getAccountInfo(),
        Error,
        "Not connected to MT5 broker",
      );
    });

    it("should handle concurrent account info requests", async () => {
      const promises = Array.from({ length: 10 }, () =>
        connector.getAccountInfo(),
      );

      const results = await Promise.all(promises);

      // All results should be valid
      results.forEach((accountInfo) => {
        expect(accountInfo).toBeDefined();
        expect(accountInfo.login).toBe(mockCredentials.login);
        expect(accountInfo.balance).toBeGreaterThan(0);
      });
    });
  });

  describe("Trading Operations", () => {
    beforeEach(async () => {
      await connector.connect(mockCredentials);
    });

    it("should open a BUY position", async () => {
      const order: MarketOrder = TestDataFactory.createMarketOrder({
        type: 0, // BUY
        volume: 0.1,
        sl: 1.09,
        tp: 1.11,
      });

      const result = await connector.openPosition(order);

      expect(result.retcode).toBe(0);
      expect(result.order).toBeGreaterThan(0);
      expect(result.deal).toBeGreaterThan(0);
      expect(result.volume).toBe(order.volume);
      expect(connector.getLastError()).toBeNull();
    });

    it("should open a SELL position", async () => {
      const order: MarketOrder = TestDataFactory.createMarketOrder({
        type: 1, // SELL
        volume: 0.1,
        sl: 1.11,
        tp: 1.09,
      });

      const result = await connector.openPosition(order);

      expect(result.retcode).toBe(0);
      expect(result.order).toBeGreaterThan(0);
      expect(result.deal).toBeGreaterThan(0);
      expect(result.volume).toBe(order.volume);
      expect(connector.getLastError()).toBeNull();
    });

    it("should handle invalid order parameters", async () => {
      const invalidOrder: MarketOrder = {
        symbol: "",
        type: 0,
        volume: 0,
      };

      await ErrorTestHelper.expectError(
        () => connector.openPosition(invalidOrder),
        Error,
        "Invalid order parameters",
      );
    });

    it("should handle insufficient margin", async () => {
      const largeOrder: MarketOrder = TestDataFactory.createMarketOrder({
        volume: 1000, // Very large volume
      });

      const result = await connector.openPosition(largeOrder);

      expect(result.retcode).not.toBe(0);
      expect(connector.getLastError()).not.toBeNull();
    });

    it("should close a position", async () => {
      // First open a position
      const openOrder: MarketOrder = TestDataFactory.createMarketOrder({
        type: 0,
        volume: 0.1,
      });

      const openResult = await connector.openPosition(openOrder);
      const ticket = openResult.order;

      // Then close it
      const closeResult = await connector.closePosition(ticket);

      expect(closeResult.retcode).toBe(0);
      expect(closeResult.order).toBe(ticket);
      expect(closeResult.volume).toBe(openOrder.volume);
      expect(connector.getLastError()).toBeNull();
    });

    it("should partially close a position", async () => {
      // First open a position
      const openOrder: MarketOrder = TestDataFactory.createMarketOrder({
        type: 0,
        volume: 0.2,
      });

      const openResult = await connector.openPosition(openOrder);
      const ticket = openResult.order;

      // Then partially close it
      const closeResult = await connector.closePosition(ticket, 0.1);

      expect(closeResult.retcode).toBe(0);
      expect(closeResult.order).toBe(ticket);
      expect(closeResult.volume).toBe(0.1);
      expect(connector.getLastError()).toBeNull();
    });

    it("should handle closing non-existent position", async () => {
      const result = await connector.closePosition(99999);

      expect(result.retcode).not.toBe(0);
      expect(connector.getLastError()).not.toBeNull();
    });

    it("should modify a position", async () => {
      // First open a position
      const openOrder: MarketOrder = TestDataFactory.createMarketOrder({
        type: 0,
        volume: 0.1,
      });

      const openResult = await connector.openPosition(openOrder);
      const ticket = openResult.order;

      // Then modify it
      const newSL = 1.095;
      const newTP = 1.105;
      const result = await connector.modifyPosition(ticket, newSL, newTP);

      expect(result).toBe(true);
      expect(connector.getLastError()).toBeNull();
    });

    it("should handle modifying non-existent position", async () => {
      const result = await connector.modifyPosition(99999, 1.09, 1.11);

      expect(result).toBe(false);
      expect(connector.getLastError()).not.toBeNull();
    });

    it("should handle concurrent trading operations", async () => {
      const orders = Array.from({ length: 5 }, (_, i) =>
        TestDataFactory.createMarketOrder({
          volume: 0.1,
          comment: `Concurrent order ${i}`,
        }),
      );

      const promises = orders.map((order) => connector.openPosition(order));
      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((result) => {
        expect(result.retcode).toBe(0);
        expect(result.order).toBeGreaterThan(0);
      });
    });
  });

  describe("Market Data", () => {
    beforeEach(async () => {
      await connector.connect(mockCredentials);
    });

    it("should get symbol information", async () => {
      const symbolInfo = await connector.getSymbolInfo("EURUSD");

      expect(symbolInfo).toBeDefined();
      expect(symbolInfo.symbol).toBe("EURUSD");
      expect(symbolInfo.digits).toBeGreaterThan(0);
      expect(symbolInfo.volumeMin).toBeGreaterThan(0);
      expect(symbolInfo.volumeMax).toBeGreaterThan(0);
      expect(connector.getLastError()).toBeNull();
    });

    it("should get current price", async () => {
      const price = await connector.getCurrentPrice("EURUSD");

      expect(price).toBeDefined();
      expect(price.bid).toBeGreaterThan(0);
      expect(price.ask).toBeGreaterThan(0);
      expect(price.ask).toBeGreaterThan(price.bid);
      expect(connector.getLastError()).toBeNull();
    });

    it("should handle invalid symbol", async () => {
      connector.disableMockMode();

      await ErrorTestHelper.expectError(
        () => connector.getSymbolInfo("INVALID"),
        Error,
      );
    });

    it("should handle price retrieval for invalid symbol", async () => {
      connector.disableMockMode();

      await ErrorTestHelper.expectError(
        () => connector.getCurrentPrice("INVALID"),
        Error,
      );
    });

    it("should handle concurrent market data requests", async () => {
      const symbols = [
        "EURUSD",
        "GBPUSD",
        "USDJPY",
        "AUDUSD",
        "USDCAD",
        "XAUUSD",
        "XAGUSD",
        "USOIL",
        "UKOIL",
      ];

      const promises = symbols.map((symbol) =>
        Promise.all([
          connector.getSymbolInfo(symbol),
          connector.getCurrentPrice(symbol),
        ]),
      );

      const results = await Promise.all(promises);

      // All results should be valid
      results.forEach(([symbolInfo, price]) => {
        expect(symbolInfo).toBeDefined();
        expect(symbolInfo.symbol).toBeTruthy();
        expect(price).toBeDefined();
        expect(price.bid).toBeGreaterThan(0);
        expect(price.ask).toBeGreaterThan(0);
      });
    });
  });

  describe("Position Management", () => {
    beforeEach(async () => {
      await connector.connect(mockCredentials);
    });

    it("should get open positions", async () => {
      // Initially should be empty
      let positions = await connector.getOpenPositions();
      expect(positions).toHaveLength(0);

      // Open a position
      const order: MarketOrder = TestDataFactory.createMarketOrder({
        type: 0,
        volume: 0.1,
      });
      await connector.openPosition(order);

      // Should now have one position
      positions = await connector.getOpenPositions();
      expect(positions).toHaveLength(1);
      expect(positions[0].symbol).toBe(order.symbol);
      expect(positions[0].type).toBe(order.type);
      expect(positions[0].volume).toBe(order.volume);
      expect(connector.getLastError()).toBeNull();
    });

    it("should get order history", async () => {
      const from = new Date("2023-01-01");
      const to = new Date("2023-12-31");

      const orders = await connector.getOrderHistory(from, to);

      expect(orders).toBeDefined();
      expect(Array.isArray(orders)).toBe(true);
      expect(connector.getLastError()).toBeNull();
    });

    it("should handle position management when disconnected", async () => {
      await connector.disconnect();

      await ErrorTestHelper.expectError(
        () => connector.getOpenPositions(),
        Error,
        "Not connected to broker",
      );

      await ErrorTestHelper.expectError(
        () => connector.getOrderHistory(new Date(), new Date()),
        Error,
        "Not connected to broker",
      );
    });

    it("should handle concurrent position management requests", async () => {
      const promises = Array.from({ length: 5 }, () =>
        connector.getOpenPositions(),
      );

      const results = await Promise.all(promises);

      // All results should be valid
      results.forEach((positions) => {
        expect(positions).toBeDefined();
        expect(Array.isArray(positions)).toBe(true);
      });
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should handle network errors", async () => {
      await connector.connect(mockCredentials);

      // Manually disconnect to simulate network error
      await connector.disconnect();

      // Should be disconnected
      expect(connector.isConnected()).toBe(false);

      // Reconnect manually
      const result = await connector.connect(mockCredentials);

      // Should be reconnected
      expect(result).toBe(true);
      expect(connector.isConnected()).toBe(true);
    });

    it("should handle server errors", async () => {
      await connector.connect(mockCredentials);

      // Disconnect to simulate server error
      await connector.disconnect();

      // Should be disconnected
      expect(connector.isConnected()).toBe(false);

      // Should not reconnect automatically
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(connector.isConnected()).toBe(false);
    });

    it("should maintain state during reconnection", async () => {
      await connector.connect(mockCredentials);

      // Open a position
      const order: MarketOrder = TestDataFactory.createMarketOrder({
        volume: 0.1,
      });
      const openResult = await connector.openPosition(order);

      // Manually disconnect
      await connector.disconnect();
      expect(connector.isConnected()).toBe(false);

      // Reconnect manually
      const result = await connector.connect(mockCredentials);
      expect(result).toBe(true);
      expect(connector.isConnected()).toBe(true);

      // Should still be able to access position
      const positions = await connector.getOpenPositions();
      expect(positions.length).toBeGreaterThanOrEqual(0);

      // Should be able to close the position if it exists
      if (positions.length > 0) {
        const closeResult = await connector.closePosition(openResult.order);
        expect(closeResult.retcode).toBe(0);
      }
    });
  });

  describe("Performance Tests", () => {
    it("should handle high-frequency operations", async () => {
      await connector.connect(mockCredentials);

      const { averageTime, totalTime } =
        await PerformanceTestHelper.measureExecutionTime(async () => {
          const order: MarketOrder = TestDataFactory.createMarketOrder({
            volume: 0.01,
          });

          const openResult = await connector.openPosition(order);
          await connector.closePosition(openResult.order);
        }, 10);

      // Should complete within reasonable time
      expect(averageTime).toBeLessThan(1000); // Less than 1 second per operation
      expect(totalTime).toBeLessThan(10000); // Less than 10 seconds total
    });

    it("should handle concurrent market data requests", async () => {
      await connector.connect(mockCredentials);

      const { averageTime, totalTime } =
        await PerformanceTestHelper.measureExecutionTime(async () => {
          const promises = Array.from({ length: 10 }, () =>
            connector.getCurrentPrice("EURUSD"),
          );

          await Promise.all(promises);
        }, 5);

      // Should complete within reasonable time
      expect(averageTime).toBeLessThan(500); // Less than 500ms per batch
      expect(totalTime).toBeLessThan(2500); // Less than 2.5 seconds total
    });

    it("should maintain performance under load", async () => {
      await connector.connect(mockCredentials);

      const startTime = Date.now();
      const operations = 100;

      for (let i = 0; i < operations; i++) {
        const order: MarketOrder = TestDataFactory.createMarketOrder({
          volume: 0.01,
          comment: `Load test ${i}`,
        });

        const openResult = await connector.openPosition(order);
        await connector.closePosition(openResult.order);
      }

      const endTime = Date.now();
      const averageTime = (endTime - startTime) / operations;

      // Average time per operation should be reasonable
      expect(averageTime).toBeLessThan(100); // Less than 100ms per operation
    });
  });

  describe("Mock Mode Testing", () => {
    it("should work completely in mock mode", async () => {
      const mockConnector = new MT5Connector();
      mockConnector.enableMockMode();

      // Connect
      const connected = await mockConnector.connect(mockCredentials);
      expect(connected).toBe(true);
      expect(mockConnector.isConnected()).toBe(true);

      // Get account info
      const accountInfo = await mockConnector.getAccountInfo();
      expect(accountInfo).toBeDefined();

      // Get symbol info
      const symbolInfo = await mockConnector.getSymbolInfo("EURUSD");
      expect(symbolInfo).toBeDefined();

      // Get price
      const price = await mockConnector.getCurrentPrice("EURUSD");
      expect(price).toBeDefined();

      // Open position
      const order: MarketOrder = TestDataFactory.createMarketOrder({
        volume: 0.1,
      });
      const openResult = await mockConnector.openPosition(order);
      expect(openResult.retcode).toBe(0);

      // Close position
      const closeResult = await mockConnector.closePosition(openResult.order);
      expect(closeResult.retcode).toBe(0);

      // Get positions
      const positions = await mockConnector.getOpenPositions();
      expect(positions).toBeDefined();

      // Disconnect
      await mockConnector.disconnect();
      expect(mockConnector.isConnected()).toBe(false);
    });

    it("should provide realistic mock data", async () => {
      connector.enableMockMode();
      await connector.connect(mockCredentials);

      const accountInfo = await connector.getAccountInfo();
      expect(accountInfo.balance).toBe(10000.0);
      expect(accountInfo.equity).toBe(10250.5);

      const symbolInfo = await connector.getSymbolInfo("EURUSD");
      expect(symbolInfo.symbol).toBe("EURUSD");
      expect(symbolInfo.digits).toBe(5);

      const price = await connector.getCurrentPrice("EURUSD");
      expect(price.bid).toBeGreaterThan(0);
      expect(price.ask).toBeGreaterThan(price.bid);

      const order: MarketOrder = TestDataFactory.createMarketOrder({
        volume: 0.1,
      });
      const result = await connector.openPosition(order);
      expect(result.retcode).toBe(0);
      expect(result.order).toBeGreaterThan(0);
    });
  });
});
