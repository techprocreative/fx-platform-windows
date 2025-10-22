// LLM Supervisor Service - Core optimization logic
// Orchestrates parameter optimization with LLM analysis

import { prisma } from '@/lib/prisma';
import { callLLM } from '@/lib/llm/openrouter';
import { SYSTEM_PROMPTS, buildOptimizationPrompt } from '@/lib/llm/prompts';
import { ParameterValidator } from './parameter-validator';
import { RollbackManager } from './rollback-manager';
import { CircuitBreaker } from './circuit-breaker';
import { triggerExecutorCommand } from '@/lib/pusher/server';

interface OptimizationRequest {
  strategyId: string;
  executorIds: string[];
  userId: string;
  forceOptimize?: boolean;  // Skip min trades check
}

interface OptimizationResult {
  success: boolean;
  optimizationId?: string;
  status: 'APPROVED' | 'REQUIRES_APPROVAL' | 'REJECTED' | 'ERROR';
  suggestions?: any[];
  confidence?: number;
  error?: string;
  requiresUserApproval?: boolean;
}

export class LLMSupervisor {
  /**
   * Main optimization workflow
   * Analyze → LLM Suggest → Validate → Apply (or request approval)
   */
  static async optimizeStrategy(
    request: OptimizationRequest
  ): Promise<OptimizationResult> {
    try {
      console.log(`🧠 Starting LLM optimization for strategy ${request.strategyId}`);
      
      // Phase 1: Get strategy and validate
      const strategy = await prisma.strategy.findUnique({
        where: { id: request.strategyId },
        include: { user: true }
      });
      
      if (!strategy) {
        return {
          success: false,
          status: 'ERROR',
          error: 'Strategy not found'
        };
      }
      
      // Phase 2: Collect trading data
      const trades = await prisma.trade.findMany({
        where: {
          strategyId: request.strategyId,
          executorId: { in: request.executorIds }
        },
        orderBy: { openTime: 'desc' },
        take: 100  // Last 100 trades
      });
      
      // Minimum trades requirement
      if (trades.length < 20 && !request.forceOptimize) {
        return {
          success: false,
          status: 'REJECTED',
          error: `Insufficient data: ${trades.length} trades (minimum 20 required)`
        };
      }
      
      // Phase 3: Calculate performance metrics
      const performance = this.calculatePerformance(trades);
      
      console.log('📊 Current performance:', performance);
      
      // Phase 4: Check circuit breaker
      for (const executorId of request.executorIds) {
        const cbCheck = await CircuitBreaker.checkAndTrigger(
          executorId,
          request.strategyId
        );
        
        if (cbCheck.triggered) {
          return {
            success: false,
            status: 'ERROR',
            error: `Circuit breaker triggered: ${cbCheck.reason}`
          };
        }
      }
      
      // Phase 5: Call LLM for optimization suggestions
      const prompt = buildOptimizationPrompt(strategy, trades, performance);
      
      const llmResponse = await callLLM(
        prompt,
        'optimization',  // Use quality tier (Grok 4 Fast)
        SYSTEM_PROMPTS.OPTIMIZATION,
        0.3  // Low temperature for consistent analysis
      );
      
      console.log('🤖 LLM suggestions received:', llmResponse);
      
      // Phase 6: Parse and validate suggestions
      const suggestions = llmResponse.suggestions || [];
      const overallConfidence = llmResponse.overallConfidence || 0;
      
      if (suggestions.length === 0) {
        return {
          success: true,
          status: 'REJECTED',
          error: 'LLM found no optimization opportunities',
          confidence: overallConfidence
        };
      }
      
      // Phase 7: Validate each suggestion
      const currentParams = strategy.rules as Record<string, any>;
      const proposedParams = { ...currentParams };
      
      for (const suggestion of suggestions) {
        proposedParams[suggestion.parameter] = suggestion.proposed;
      }
      
      const validation = ParameterValidator.validateParameterSet(
        currentParams,
        proposedParams
      );
      
      if (!validation.valid) {
        return {
          success: false,
          status: 'REJECTED',
          error: `Validation failed: ${validation.errors.join(', ')}`,
          suggestions
        };
      }
      
      // Phase 8: Risk simulation
      const riskSimulation = await ParameterValidator.simulateRiskImpact(
        request.strategyId,
        currentParams,
        proposedParams,
        trades
      );
      
      if (!riskSimulation.acceptable) {
        return {
          success: false,
          status: 'REJECTED',
          error: `Risk simulation failed: ${riskSimulation.details}`,
          suggestions
        };
      }
      
      console.log('✅ Risk simulation passed:', riskSimulation);
      
      // Phase 9: Create optimization record
      const optimization = await prisma.parameterOptimization.create({
        data: {
          strategyId: request.strategyId,
          userId: request.userId,
          currentParameters: currentParams,
          proposedParameters: proposedParams,
          llmReasoning: llmResponse.reasoning || llmResponse.analysis,
          confidenceScore: overallConfidence,
          status: overallConfidence >= 0.95 ? 'APPROVED' : 'PENDING_APPROVAL',
          affectedExecutors: request.executorIds,
          baselineMetrics: performance,
          riskSimulation: riskSimulation as any,
          createdAt: new Date()
        }
      });
      
      // Phase 10: Decision based on confidence
      if (overallConfidence >= 0.95) {
        // Auto-apply: Very high confidence
        console.log('✅ Auto-applying optimization (confidence ≥ 0.95)');
        
        await this.applyOptimization(optimization.id);
        
        return {
          success: true,
          optimizationId: optimization.id,
          status: 'APPROVED',
          suggestions,
          confidence: overallConfidence,
          requiresUserApproval: false
        };
        
      } else if (overallConfidence >= 0.85) {
        // Request approval: Good confidence
        console.log('📋 Requesting user approval (confidence 0.85-0.94)');
        
        // TODO: Send notification to user for approval
        
        return {
          success: true,
          optimizationId: optimization.id,
          status: 'REQUIRES_APPROVAL',
          suggestions,
          confidence: overallConfidence,
          requiresUserApproval: true
        };
        
      } else {
        // Reject: Low confidence
        console.log('❌ Optimization rejected (confidence < 0.85)');
        
        await prisma.parameterOptimization.update({
          where: { id: optimization.id },
          data: { status: 'REJECTED' }
        });
        
        return {
          success: false,
          status: 'REJECTED',
          error: `Confidence too low: ${(overallConfidence * 100).toFixed(1)}% (minimum 85%)`,
          suggestions,
          confidence: overallConfidence
        };
      }
      
    } catch (error: any) {
      console.error('❌ Optimization failed:', error);
      
      return {
        success: false,
        status: 'ERROR',
        error: error.message
      };
    }
  }
  
  /**
   * Apply approved optimization
   */
  static async applyOptimization(optimizationId: string) {
    try {
      const optimization = await prisma.parameterOptimization.findUnique({
        where: { id: optimizationId }
      });
      
      if (!optimization) {
        throw new Error(`Optimization ${optimizationId} not found`);
      }
      
      console.log(`🚀 Applying optimization ${optimizationId}`);
      
      // Create snapshots for rollback
      for (const executorId of optimization.affectedExecutors) {
        await RollbackManager.createSnapshot(
          optimization.strategyId,
          executorId,
          optimization.currentParameters as Record<string, any>,
          `pre_optimization_${optimizationId}`
        );
      }
      
      // Send parameter update commands to all affected executors
      for (const executorId of optimization.affectedExecutors) {
        await triggerExecutorCommand(executorId, {
          command: 'UPDATE_PARAMETERS',
          parameters: {
            strategyId: optimization.strategyId,
            newParameters: optimization.proposedParameters
          },
          priority: 'HIGH'
        });
      }
      
      // Update optimization status
      await prisma.parameterOptimization.update({
        where: { id: optimizationId },
        data: {
          status: 'TESTING',
          appliedAt: new Date()
        }
      });
      
      // Log supervisor decision
      await prisma.supervisorDecision.create({
        data: {
          userId: optimization.userId,
          strategyId: optimization.strategyId,
          executorId: optimization.affectedExecutors[0],
          decision: 'OPTIMIZE',
          reasoning: optimization.llmReasoning as string,
          confidenceScore: optimization.confidenceScore,
          outcome: 'PENDING'
        }
      });
      
      console.log(`✅ Optimization applied to ${optimization.affectedExecutors.length} executors`);
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ Failed to apply optimization:', error);
      throw error;
    }
  }
  
  /**
   * Reject optimization (user decision)
   */
  static async rejectOptimization(
    optimizationId: string,
    reason: string = 'User rejected'
  ) {
    try {
      await prisma.parameterOptimization.update({
        where: { id: optimizationId },
        data: {
          status: 'REJECTED',
          evaluatedAt: new Date()
        }
      });
      
      console.log(`❌ Optimization ${optimizationId} rejected: ${reason}`);
      
      return { success: true };
    } catch (error) {
      console.error('Failed to reject optimization:', error);
      throw error;
    }
  }
  
  /**
   * Calculate performance metrics
   */
  private static calculatePerformance(trades: any[]) {
    const wins = trades.filter(t => (t.profit || 0) > 0).length;
    const losses = trades.filter(t => (t.profit || 0) < 0).length;
    const breakeven = trades.filter(t => (t.profit || 0) === 0).length;
    
    const winRate = trades.length > 0 ? wins / trades.length : 0;
    
    const totalWins = trades
      .filter(t => (t.profit || 0) > 0)
      .reduce((sum, t) => sum + (t.profit || 0), 0);
    
    const totalLosses = Math.abs(
      trades
        .filter(t => (t.profit || 0) < 0)
        .reduce((sum, t) => sum + (t.profit || 0), 0)
    );
    
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins;
    
    const avgWin = wins > 0 ? totalWins / wins : 0;
    const avgLoss = losses > 0 ? totalLosses / losses : 0;
    
    const totalProfit = trades.reduce((sum, t) => sum + (t.profit || 0), 0);
    
    // Calculate max drawdown
    let balance = 0;
    let peak = 0;
    let maxDrawdown = 0;
    
    for (const trade of [...trades].reverse()) {
      balance += trade.profit || 0;
      if (balance > peak) peak = balance;
      const drawdown = peak - balance;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    
    return {
      wins,
      losses,
      breakeven,
      winRate,
      profitFactor,
      avgWin,
      avgLoss,
      totalProfit,
      maxDrawdown
    };
  }
  
  /**
   * Monitor optimization performance (called periodically)
   */
  static async monitorOptimization(optimizationId: string) {
    try {
      const optimization = await prisma.parameterOptimization.findUnique({
        where: { id: optimizationId }
      });
      
      if (!optimization || optimization.status !== 'TESTING') {
        return;
      }
      
      // Get trades since optimization was applied
      const tradesSince = await prisma.trade.findMany({
        where: {
          strategyId: optimization.strategyId,
          executorId: { in: optimization.affectedExecutors },
          openTime: { gte: optimization.appliedAt! }
        }
      });
      
      // Need at least 10 trades to evaluate
      if (tradesSince.length < 10) {
        console.log(`⏳ Waiting for more trades (${tradesSince.length}/10)`);
        return;
      }
      
      const currentMetrics = this.calculatePerformance(tradesSince);
      
      // Check for auto-rollback conditions
      const rollbackCheck = await RollbackManager.checkAndRollback(
        optimizationId,
        {
          winRate: currentMetrics.winRate,
          profitFactor: currentMetrics.profitFactor,
          maxDrawdown: currentMetrics.maxDrawdown
        }
      );
      
      if (rollbackCheck?.rolledBack) {
        console.log(`🔄 Auto-rollback triggered: ${rollbackCheck.reason}`);
        return;
      }
      
      // If performance is good, mark as successful
      const baseline = optimization.baselineMetrics as any;
      if (
        currentMetrics.winRate >= baseline.winRate &&
        currentMetrics.profitFactor >= baseline.profitFactor
      ) {
        await prisma.parameterOptimization.update({
          where: { id: optimizationId },
          data: {
            status: 'ACTIVE',
            wasSuccessful: true,
            testMetrics: currentMetrics,
            evaluatedAt: new Date()
          }
        });
        
        console.log(`✅ Optimization ${optimizationId} marked as successful`);
      }
      
    } catch (error) {
      console.error('❌ Failed to monitor optimization:', error);
    }
  }
}
