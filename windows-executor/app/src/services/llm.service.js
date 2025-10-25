"use strict";
/**
 * LLM Service
 * Sends LLM consultation requests to web platform
 * Web platform handles OpenRouter with model tiers (Grok 4 Fast, GLM-4.6, etc)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMService = void 0;
const logger_1 = require("../utils/logger");
class LLMService {
    constructor(apiBaseUrl, apiKey, executorId) {
        this.apiBaseUrl = apiBaseUrl;
        this.apiKey = apiKey;
        this.executorId = executorId;
        logger_1.logger.info('[LLMService] Initialized');
        logger_1.logger.info('[LLMService] LLM consultations will be handled by web platform');
    }
    /**
     * Ask LLM for guidance on trading decision
     * Sends request to web platform, which handles OpenRouter with model tiers
     */
    async consult(strategyId, query, context, taskType = 'trading') {
        try {
            logger_1.logger.info(`[LLMService] Consulting LLM for strategy ${strategyId} (${taskType})`);
            logger_1.logger.debug(`[LLMService] Query: ${query}`);
            // Send to web platform - it will use Grok 4 Fast, GLM-4.6, etc
            const response = await fetch(`${this.apiBaseUrl}/api/executor/llm/consult`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.apiKey,
                    'X-Executor-ID': this.executorId
                },
                body: JSON.stringify({
                    strategyId,
                    query,
                    context,
                    taskType,
                    timestamp: new Date().toISOString()
                })
            });
            if (!response.ok) {
                throw new Error(`LLM API returned ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            const consultation = {
                id: data.id || `llm-${Date.now()}`,
                strategyId,
                query,
                context,
                response: data.response,
                decision: data.decision || 'proceed',
                timestamp: new Date()
            };
            logger_1.logger.info(`[LLMService] ✅ LLM responded: ${data.decision}`);
            return consultation;
        }
        catch (error) {
            logger_1.logger.error('[LLMService] Consultation failed:', error);
            // Return conservative decision on error
            return {
                id: `llm-error-${Date.now()}`,
                strategyId,
                query,
                context,
                response: 'LLM consultation failed - defaulting to conservative decision',
                decision: 'skip',
                timestamp: new Date()
            };
        }
    }
    /**
     * Ask LLM if we should enter a trade
     */
    async shouldEnterTrade(strategyId, symbol, type, confidence, reasons, marketConditions) {
        const query = `Should I enter a ${type} trade on ${symbol}? Confidence: ${confidence}%. Reasons: ${reasons.join(', ')}`;
        const consultation = await this.consult(strategyId, query, {
            symbol,
            type,
            confidence,
            reasons,
            ...marketConditions
        });
        // Map decision
        if (consultation.decision === 'proceed')
            return 'yes';
        if (consultation.decision === 'skip')
            return 'no';
        return 'wait';
    }
    /**
     * Ask LLM if we should exit a position
     */
    async shouldExitTrade(strategyId, ticket, symbol, currentProfit, holdingTime, reason) {
        const query = `Should I close position #${ticket} on ${symbol}? Current P/L: ${currentProfit}, Holding: ${holdingTime}s, Reason: ${reason}`;
        const consultation = await this.consult(strategyId, query, {
            ticket,
            symbol,
            currentProfit,
            holdingTime,
            reason
        });
        if (consultation.decision === 'proceed')
            return 'yes';
        if (consultation.decision === 'skip')
            return 'no';
        return 'wait';
    }
    /**
     * Ask LLM about strategy adjustment
     */
    async shouldAdjustStrategy(strategyId, performance, issue) {
        const query = `Strategy performance issue: ${issue}. Should I adjust? Current stats: ${JSON.stringify(performance)}`;
        const consultation = await this.consult(strategyId, query, {
            performance,
            issue
        });
        return {
            adjust: consultation.decision === 'modify',
            recommendations: consultation.response ? [consultation.response] : undefined
        };
    }
}
exports.LLMService = LLMService;
