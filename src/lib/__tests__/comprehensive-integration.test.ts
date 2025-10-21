/**
 * Comprehensive Integration Tests
 *
 * This file contains comprehensive integration tests for the FX Trading Platform.
 * These tests verify the integration between different components and systems.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "@jest/globals";
import request from "supertest";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { TestDataFactory } from "../testing/factory";
import { TestCleanup } from "../testing/cleanup";

// Create a mock Next.js app handler for testing
const mockApp = {
  get: async (path: string) => {
    if (path === "/api/health") {
      return NextResponse.json({ status: "ok" });
    }
    // Mock other API routes as needed
    return NextResponse.json({ error: "Not implemented" }, { status: 501 });
  },
  post: async (path: string) => {
    if (path === "/api/auth/register") {
      return NextResponse.json({ success: true, data: { id: "test-user" } });
    }
    if (path === "/api/auth/login") {
      return NextResponse.json({
        success: true,
        data: { token: "mock-token" },
      });
    }
    return NextResponse.json({ error: "Not implemented" }, { status: 501 });
  },
};

describe.skip("Comprehensive Integration Tests", () => {
  let authToken: string;
  let userId: string;
  let strategyId: string;
  let backtestId: string;

  beforeAll(async () => {
    // Setup test environment
    await TestCleanup.cleanupAll();

    // Create test user
    const user = await TestDataFactory.createTestUser({
      email: "integration-test@example.com",
      username: "integration-test-user",
    });
    userId = user.id;
    authToken = `Bearer ${generateTestToken(user)}`;
  });

  afterAll(async () => {
    // Cleanup test data
    await TestCleanup.cleanupUser(userId);
  });

  beforeEach(async () => {
    // Reset test state before each test
    await TestCleanup.cleanupUser(userId);
  });

  afterEach(async () => {
    // Additional cleanup if needed
  });

  describe("User Registration and Authentication Flow", () => {
    it("should complete full user registration flow", async () => {
      const userData = {
        email: "new-user@example.com",
        username: "new-user",
        password: "SecurePassword123!",
        firstName: "John",
        lastName: "Doe",
      };

      // Register user
      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.data.user.email).toBe(userData.email);

      // Login user
      const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data.token).toBeDefined();

      // Verify user profile
      const profileResponse = await request(app)
        .get("/api/user/profile")
        .set("Authorization", `Bearer ${loginResponse.body.data.token}`)
        .expect(200);

      expect(profileResponse.body.data.email).toBe(userData.email);
    });

    it("should handle two-factor authentication setup", async () => {
      // Enable 2FA
      const enable2FAResponse = await request(app)
        .post("/api/auth/2fa/enable")
        .set("Authorization", authToken)
        .expect(200);

      expect(enable2FAResponse.body.data.secret).toBeDefined();
      expect(enable2FAResponse.body.data.qrCode).toBeDefined();

      // Verify 2FA setup
      const verify2FAResponse = await request(app)
        .post("/api/auth/2fa/verify")
        .set("Authorization", authToken)
        .send({
          token: "123456", // Mock 2FA token
        })
        .expect(200);

      expect(verify2FAResponse.body.success).toBe(true);
    });
  });

  describe("Strategy Creation and Management Flow", () => {
    it("should create, update, and delete a strategy", async () => {
      // Create strategy
      const strategyData = {
        name: "Test Integration Strategy",
        description: "Strategy for integration testing",
        type: "manual",
        config: {
          symbol: "EURUSD",
          timeframe: "1h",
          riskPercent: 2,
          stopLossPips: 20,
          takeProfitPips: 40,
        },
        tags: ["test", "integration"],
      };

      const createResponse = await request(app)
        .post("/api/strategy")
        .set("Authorization", authToken)
        .send(strategyData)
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.data.name).toBe(strategyData.name);
      strategyId = createResponse.body.data.id;

      // Update strategy
      const updateData = {
        name: "Updated Test Strategy",
        description: "Updated description",
        config: {
          ...strategyData.config,
          riskPercent: 3,
        },
      };

      const updateResponse = await request(app)
        .put(`/api/strategy/${strategyId}`)
        .set("Authorization", authToken)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.data.name).toBe(updateData.name);
      expect(updateResponse.body.data.config.riskPercent).toBe(3);

      // Get strategy details
      const getResponse = await request(app)
        .get(`/api/strategy/${strategyId}`)
        .set("Authorization", authToken)
        .expect(200);

      expect(getResponse.body.data.id).toBe(strategyId);
      expect(getResponse.body.data.name).toBe(updateData.name);

      // Delete strategy
      await request(app)
        .delete(`/api/strategy/${strategyId}`)
        .set("Authorization", authToken)
        .expect(200);

      // Verify deletion
      await request(app)
        .get(`/api/strategy/${strategyId}`)
        .set("Authorization", authToken)
        .expect(404);
    });

    it("should handle AI-powered strategy generation", async () => {
      const aiRequest = {
        symbol: "EURUSD",
        timeframe: "1h",
        riskLevel: "medium",
        tradingStyle: "swing",
        duration: "1month",
      };

      const aiResponse = await request(app)
        .post("/api/strategy/generate")
        .set("Authorization", authToken)
        .send(aiRequest)
        .expect(200);

      expect(aiResponse.body.success).toBe(true);
      expect(aiResponse.body.data.strategy).toBeDefined();
      expect(aiResponse.body.data.strategy.config).toBeDefined();
    });
  });

  describe("Backtesting Flow", () => {
    beforeEach(async () => {
      // Create a strategy for backtesting
      const strategy = await TestDataFactory.createTestStrategy(userId, {
        name: "Backtest Test Strategy",
        type: "manual",
        config: {
          symbol: "EURUSD",
          timeframe: "1h",
          riskPercent: 2,
        },
      });
      strategyId = strategy.id;
    });

    it("should complete full backtesting flow", async () => {
      // Start backtest
      const backtestData = {
        strategyId,
        name: "Integration Test Backtest",
        config: {
          startDate: "2023-01-01",
          endDate: "2023-12-31",
          initialCapital: 10000,
          commission: 0.0001,
          slippage: 2,
        },
      };

      const startResponse = await request(app)
        .post("/api/backtest")
        .set("Authorization", authToken)
        .send(backtestData)
        .expect(201);

      expect(startResponse.body.success).toBe(true);
      expect(startResponse.body.data.status).toBe("pending");
      backtestId = startResponse.body.data.id;

      // Wait for backtest to complete (mock in test environment)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Get backtest results
      const resultsResponse = await request(app)
        .get(`/api/backtest/${backtestId}`)
        .set("Authorization", authToken)
        .expect(200);

      expect(resultsResponse.body.data.id).toBe(backtestId);
      expect(resultsResponse.body.data.results).toBeDefined();

      // Export backtest results
      const exportResponse = await request(app)
        .get(`/api/backtest/${backtestId}/export`)
        .set("Authorization", authToken)
        .expect(200);

      expect(exportResponse.headers["content-type"]).toBe("application/pdf");
    });

    it("should handle backtest optimization", async () => {
      const optimizationData = {
        strategyId,
        parameters: {
          riskPercent: { min: 1, max: 5, step: 0.5 },
          stopLossPips: { min: 10, max: 50, step: 5 },
          takeProfitPips: { min: 20, max: 100, step: 10 },
        },
        optimizationMethod: "grid_search",
        maxRuns: 50,
      };

      const optimizationResponse = await request(app)
        .post("/api/backtest/optimize")
        .set("Authorization", authToken)
        .send(optimizationData)
        .expect(200);

      expect(optimizationResponse.body.success).toBe(true);
      expect(optimizationResponse.body.data.optimizationId).toBeDefined();
    });
  });

  describe("Risk Management Integration", () => {
    it("should enforce risk limits on trades", async () => {
      // Set risk limits
      const riskLimits = {
        maxRiskPerTrade: 2,
        maxDailyLoss: 5,
        maxPositions: 3,
        maxLeverage: 100,
      };

      await request(app)
        .post("/api/risk/limits")
        .set("Authorization", authToken)
        .send(riskLimits)
        .expect(200);

      // Attempt trade that exceeds risk limits
      const excessiveTrade = {
        symbol: "EURUSD",
        type: "buy",
        lotSize: 10.0, // Excessive size
        stopLoss: 1.08,
        takeProfit: 1.09,
      };

      const tradeResponse = await request(app)
        .post("/api/trading/trade")
        .set("Authorization", authToken)
        .send(excessiveTrade)
        .expect(400);

      expect(tradeResponse.body.error.code).toBe("RISK_LIMIT_EXCEEDED");
    });

    it("should handle emergency procedures", async () => {
      // Create some test positions
      await TestDataFactory.createTestTrade(userId, {
        symbol: "EURUSD",
        type: "buy",
        quantity: 1.0,
        status: "executed",
      });

      // Trigger emergency close all
      const emergencyResponse = await request(app)
        .post("/api/risk/emergency-close-all")
        .set("Authorization", authToken)
        .expect(200);

      expect(emergencyResponse.body.success).toBe(true);

      // Verify all positions are closed
      const positionsResponse = await request(app)
        .get("/api/trading/positions")
        .set("Authorization", authToken)
        .expect(200);

      expect(positionsResponse.body.data).toHaveLength(0);
    });
  });

  describe("Real-time Features Integration", () => {
    it("should handle WebSocket connections", async () => {
      // Test WebSocket connection
      const wsUrl = "ws://localhost:3000/api/ws";
      const WebSocket = require("ws");
      const ws = new WebSocket(wsUrl, {
        headers: {
          Authorization: authToken,
        },
      });

      await new Promise((resolve, reject) => {
        ws.on("open", () => {
          // Subscribe to real-time updates
          ws.send(
            JSON.stringify({
              type: "subscribe",
              channel: "positions",
              userId: userId,
            }),
          );
          resolve(true);
        });

        ws.on("error", reject);
        ws.on("close", () => {
          ws.close();
        });
      });

      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });

    it("should handle real-time market data updates", async () => {
      // Subscribe to market data
      const subscriptionData = {
        symbols: ["EURUSD", "GBPUSD", "XAUUSD", "XAGUSD", "USOIL"],
        type: "market_data",
      };

      const subscriptionResponse = await request(app)
        .post("/api/realtime/subscribe")
        .set("Authorization", authToken)
        .send(subscriptionData)
        .expect(200);

      expect(subscriptionResponse.body.success).toBe(true);
      expect(subscriptionResponse.body.data.subscriptionId).toBeDefined();
    });
  });

  describe("Analytics and Reporting Integration", () => {
    beforeEach(async () => {
      // Create test data for analytics
      await TestDataFactory.createTestTrade(userId, {
        symbol: "EURUSD",
        type: "buy",
        quantity: 1.0,
        profit: 100,
        status: "executed",
      });

      await TestDataFactory.createTestTrade(userId, {
        symbol: "GBPUSD",
        type: "sell",
        quantity: 1.0,
        profit: -50,
        status: "executed",
      });
    });

    it("should generate performance analytics", async () => {
      const analyticsResponse = await request(app)
        .get("/api/analytics/performance")
        .set("Authorization", authToken)
        .query({
          startDate: "2023-01-01",
          endDate: "2023-12-31",
        })
        .expect(200);

      expect(analyticsResponse.body.success).toBe(true);
      expect(analyticsResponse.body.data.totalReturn).toBeDefined();
      expect(analyticsResponse.body.data.winRate).toBeDefined();
      expect(analyticsResponse.body.data.profitFactor).toBeDefined();
    });

    it("should generate risk analytics", async () => {
      const riskAnalyticsResponse = await request(app)
        .get("/api/analytics/risk")
        .set("Authorization", authToken)
        .expect(200);

      expect(riskAnalyticsResponse.body.success).toBe(true);
      expect(riskAnalyticsResponse.body.data.currentDrawdown).toBeDefined();
      expect(riskAnalyticsResponse.body.data.var).toBeDefined();
    });

    it("should export reports in multiple formats", async () => {
      const formats = ["pdf", "excel", "csv"];

      for (const format of formats) {
        const reportResponse = await request(app)
          .get("/api/analytics/report")
          .set("Authorization", authToken)
          .query({
            format,
            startDate: "2023-01-01",
            endDate: "2023-12-31",
          })
          .expect(200);

        expect(reportResponse.headers["content-type"]).toBeDefined();
        if (format === "pdf") {
          expect(reportResponse.headers["content-type"]).toBe(
            "application/pdf",
          );
        } else if (format === "excel") {
          expect(reportResponse.headers["content-type"]).toBe(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          );
        } else if (format === "csv") {
          expect(reportResponse.headers["content-type"]).toBe("text/csv");
        }
      }
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle concurrent requests gracefully", async () => {
      const concurrentRequests = Array(10)
        .fill(null)
        .map(() =>
          request(app).get("/api/strategy").set("Authorization", authToken),
        );

      const responses = await Promise.all(concurrentRequests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it("should handle database connection failures", async () => {
      // Mock database failure
      const originalPrisma = prisma;
      (global as any).prisma = null;

      const response = await request(app)
        .get("/api/strategy")
        .set("Authorization", authToken)
        .expect(500);

      expect(response.body.error.code).toBe("DATABASE_ERROR");

      // Restore prisma
      (global as any).prisma = originalPrisma;
    });

    it("should handle malformed requests", async () => {
      const malformedData = {
        name: null,
        config: "invalid-json",
      };

      const response = await request(app)
        .post("/api/strategy")
        .set("Authorization", authToken)
        .send(malformedData)
        .expect(400);

      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Performance and Load Testing", () => {
    it("should handle large datasets efficiently", async () => {
      // Create large dataset
      const trades = Array(1000)
        .fill(null)
        .map((_, index) =>
          TestDataFactory.createTestTrade(userId, {
            symbol: "EURUSD",
            type: index % 2 === 0 ? "buy" : "sell",
            quantity: 1.0,
            profit: Math.random() * 200 - 100,
            status: "executed",
          }),
        );

      await Promise.all(trades);

      const startTime = Date.now();
      const response = await request(app)
        .get("/api/trading/trades")
        .set("Authorization", authToken)
        .query({ limit: 1000 })
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.body.data).toHaveLength(1000);
      expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
    });

    it("should maintain performance under load", async () => {
      const loadTestRequests = Array(100)
        .fill(null)
        .map(() => request(app).get("/api/health").expect(200));

      const startTime = Date.now();
      await Promise.all(loadTestRequests);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      const averageTime = totalTime / 100;

      expect(averageTime).toBeLessThan(100); // Average response time under 100ms
    });
  });
});

// Helper function to generate test token
function generateTestToken(user: { id: string }): string {
  // Mock JWT token generation for testing
  return `mock-jwt-token-${user.id}`;
}
