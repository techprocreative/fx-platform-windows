// OpenRouter LLM Integration for Adaptive Supervisor
// Quality-First Strategy: Use Grok 4 Fast for critical operations

import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { SYSTEM_PROMPTS } from './prompts';

// Lazy initialize OpenRouter client
let openrouterInstance: OpenAI | null = null;

function getOpenRouterClient(): OpenAI {
  if (!openrouterInstance) {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }
    
    openrouterInstance = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
        "X-Title": "FX Trading Platform - Adaptive Supervisor",
      },
      // Vercel serverless timeout: 60s (Hobby), 300s (Pro)
      timeout: 50000, // 50 seconds to stay within limits
    });
  }
  
  return openrouterInstance;
}

// Model selection: Quality-First Strategy
export const MODELS = {
  // Primary: For CRITICAL operations (optimization, analysis, reasoning)
  CRITICAL: "x-ai/grok-4-fast",                  // $0.20 in/$0.50 out - Excellent quality ⚡
  
  // Reasoning: For COMPLEX LOGIC (deep analysis, parameter decisions)
  REASONING: "z-ai/glm-4.6",                     // $0.50 in/$1.75 out - Best reasoning 🧠
  
  // Budget: For NON-CRITICAL operations (monitoring, quick checks)
  BUDGET: "openai/gpt-oss-120b",                 // $0.04 in/$0.40 out - Cost-effective 💰
  
  // Fallback: Reliable backup for any task
  FALLBACK: "deepseek/deepseek-chat",            // $0.14 in/$0.28 out - Solid backup 🏆
  
  // Premium (only if all fail)
  PREMIUM: "anthropic/claude-3.5-sonnet",        // $3 in/$15 out - Last resort
};

// Model tiers for automatic fallback (QUALITY-FIRST for critical operations)
export const MODEL_TIERS = {
  // CRITICAL: Parameter optimization (affects user profit!)
  optimization: [
    MODELS.CRITICAL,           // Grok 4 Fast - Excellent quality ⚡
    MODELS.REASONING,          // GLM-4.6 - Deep analysis 🧠
    MODELS.FALLBACK            // DeepSeek - Reliable backup
  ],
  
  // CRITICAL: Deep reasoning (complex decisions)
  reasoning: [
    MODELS.REASONING,          // GLM-4.6 - Best for complex logic 🧠
    MODELS.CRITICAL,           // Grok 4 Fast - Fast alternative ⚡
    MODELS.FALLBACK            // DeepSeek - Backup
  ],
  
  // CRITICAL: Performance analysis
  analysis: [
    MODELS.CRITICAL,           // Grok 4 Fast - Fast + quality ⚡
    MODELS.REASONING,          // GLM-4.6 - Deep insights 🧠
    MODELS.FALLBACK            // DeepSeek - Backup
  ],
  
  // NON-CRITICAL: Quick status checks, monitoring
  quick: [
    MODELS.BUDGET,             // GPT-OSS - Cheap for simple tasks 💰
    MODELS.CRITICAL,           // Grok 4 Fast - If GPT-OSS fails
    MODELS.FALLBACK            // DeepSeek - Backup
  ]
};

// Cost tracking per model (average $/M tokens, assuming 50/50 input/output)
export const MODEL_COSTS = {
  [MODELS.CRITICAL]: 0.35,     // Grok 4 Fast: (0.20+0.50)/2 - Worth it! ⚡
  [MODELS.REASONING]: 1.13,    // GLM-4.6: (0.50+1.75)/2 - Best reasoning 🧠
  [MODELS.BUDGET]: 0.22,       // GPT-OSS-120B: (0.04+0.40)/2 - For non-critical 💰
  [MODELS.FALLBACK]: 0.21,     // DeepSeek: (0.14+0.28)/2 - Solid backup 🏆
  [MODELS.PREMIUM]: 9.0,       // Claude: (3+15)/2 - Emergency only
};

// Quality tier (use for critical operations)
export const QUALITY_TIER = [MODELS.CRITICAL, MODELS.REASONING, MODELS.FALLBACK];

// Budget tier (use for non-critical operations)
export const BUDGET_TIER = [MODELS.BUDGET, MODELS.CRITICAL, MODELS.FALLBACK];

/**
 * Call LLM with automatic fallback and retry
 * Optimized for Vercel serverless (60s timeout)
 */
export async function callLLM(
  prompt: string,
  taskType: 'optimization' | 'reasoning' | 'analysis' | 'quick' = 'optimization',
  systemPrompt?: string,
  temperature: number = 0.3
) {
  const models = MODEL_TIERS[taskType];
  let lastError: Error | null = null;
  
  // Try each model in tier order
  for (const model of models) {
    try {
      console.log(`🤖 Calling ${model}...`);
      
      const openrouter = getOpenRouterClient();
      const startTime = Date.now();
      const completion = await openrouter.chat.completions.create({
        model,
        messages: [
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          { role: 'user' as const, content: prompt }
        ],
        temperature,
        response_format: { type: 'json_object' },  // Always return JSON
        max_tokens: 4000, // Limit for cost control
      });
      
      const duration = Date.now() - startTime;
      console.log(`✅ ${model} responded in ${duration}ms`);
      
      // Track usage for cost monitoring
      await trackLLMUsage({
        model,
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        duration,
        success: true
      });
      
      return JSON.parse(completion.choices[0].message.content || '{}');
      
    } catch (error: any) {
      console.error(`❌ ${model} failed:`, error.message);
      lastError = error as Error;
      
      // Track failure
      await trackLLMUsage({
        model,
        promptTokens: 0,
        completionTokens: 0,
        duration: 0,
        success: false,
        error: error.message
      });
      
      // Continue to next model in tier
      continue;
    }
  }
  
  // All models failed
  throw new Error(`All LLM models failed. Last error: ${lastError?.message}`);
}

/**
 * Track LLM usage for cost monitoring
 */
async function trackLLMUsage(data: {
  model: string;
  promptTokens: number;
  completionTokens: number;
  duration: number;
  success: boolean;
  error?: string;
}) {
  try {
    // Store in database for analytics
    await prisma.lLMUsageLog.create({
      data: {
        model: data.model,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        totalTokens: data.promptTokens + data.completionTokens,
        duration: data.duration,
        success: data.success,
        error: data.error,
        timestamp: new Date()
      }
    });
    
    // Also log to console for immediate visibility
    console.log('📊 LLM Usage:', {
      model: data.model,
      tokens: data.promptTokens + data.completionTokens,
      cost: ((data.promptTokens + data.completionTokens) / 1_000_000) * (MODEL_COSTS[data.model] || 0),
      success: data.success
    });
  } catch (error) {
    console.error('Failed to log LLM usage:', error);
  }
}

/**
 * Get estimated cost for a given number of tokens
 */
export function estimateCost(model: string, tokens: number): number {
  const costPerM = MODEL_COSTS[model] || 0.35;
  return (tokens / 1_000_000) * costPerM;
}

/**
 * Enhanced strategy generation with market context
 */
export async function generateEnhancedStrategy(
  prompt: string,
  symbol: string,
  timeframe: string,
  marketContext?: any,
  model?: string
) {
  const selectedModel = model || MODELS.CRITICAL;
  
  try {
    // Build enhanced prompt if market context is available
    let enhancedPrompt = prompt;
    let systemPrompt = SYSTEM_PROMPTS.SUPERVISOR;
    
    if (marketContext) {
      // Use the enhanced strategy generation prompt
      const { buildEnhancedStrategyPrompt } = await import('./prompts');
      
      enhancedPrompt = buildEnhancedStrategyPrompt(
        'automated', // strategy type
        symbol,
        timeframe,
        ['RSI', 'MACD', 'EMA', 'ATR'], // default indicators
        formatMarketContextForPrompt(marketContext),
        marketContext.volatility?.currentATR || 0.002,
        1.5, // 1.5% risk
        marketContext.session?.activeSessions || ['london', 'newYork']
      );
      
      systemPrompt = `You are an expert forex trading strategy developer. Create a comprehensive trading strategy based on the provided requirements and market context. Focus on practical, implementable strategies that account for current market conditions.`;
    }
    
    console.log(`🤖 Generating enhanced strategy for ${symbol} ${timeframe}...`);
    
    const result = await callLLM(
      enhancedPrompt,
      'optimization', // Use optimization tier for strategy generation
      systemPrompt,
      0.4 // Slightly higher creativity for strategy generation
    );
    
    console.log(`✅ Enhanced strategy generated for ${symbol}`);
    return result;
    
  } catch (error) {
    console.error('❌ Enhanced strategy generation failed:', error);
    throw error;
  }
}

/**
 * Market analysis with AI
 */
export async function analyzeMarketConditions(
  marketData: string,
  model?: string
) {
  const selectedModel = model || MODELS.CRITICAL;
  
  try {
    const { buildMarketAnalysisPrompt } = await import('./prompts');
    const prompt = buildMarketAnalysisPrompt(marketData);
    
    console.log('🤖 Analyzing market conditions...');
    
    const result = await callLLM(
      prompt,
      'analysis',
      SYSTEM_PROMPTS.PERFORMANCE_ANALYSIS,
      0.3
    );
    
    console.log('✅ Market analysis completed');
    return result;
    
  } catch (error) {
    console.error('❌ Market analysis failed:', error);
    throw error;
  }
}

/**
 * Format market context for prompt
 */
function formatMarketContextForPrompt(context: any): string {
  if (!context) return '';
  
  return `
Market Context for ${context.symbol} (${context.timeframe}):
- Current Price: ${context.price?.current?.toFixed(5) || 'N/A'} (${context.price?.changePercent >= 0 ? '+' : ''}${context.price?.changePercent?.toFixed(2) || 'N/A'}%)
- Volatility: ${context.volatility?.volatilityLevel || 'unknown'} (ATR: ${context.volatility?.currentATR?.toFixed(5) || 'N/A'})
- Trend: ${context.trend?.direction || 'unknown'} (Strength: ${context.trend?.strength || 'N/A'}/100)
- Key Levels: Support ${context.keyLevels?.nearestSupport?.toFixed(5) || 'N/A'}, Resistance ${context.keyLevels?.nearestResistance?.toFixed(5) || 'N/A'}
- Market Sessions: ${context.session?.activeSessions?.join(', ') || 'none'} (${context.session?.marketCondition || 'unknown'} activity)
- Optimal for ${context.symbol}: ${context.session?.isOptimalForPair ? 'YES' : 'NO'}

Session Recommendations:
- Active Sessions: ${context.session?.activeSessions?.join(', ') || 'none'}
- Optimal Pairs: ${context.session?.recommendedPairs?.join(', ') || 'none'}
- Market Condition: ${context.session?.marketCondition || 'unknown'} volume
`;
}

/**
 * Validate OpenRouter API key is set
 */
export function validateOpenRouterConfig(): boolean {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('❌ OPENROUTER_API_KEY not set in environment variables');
    return false;
  }
  return true;
}
