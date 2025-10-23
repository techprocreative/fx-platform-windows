import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { 
  StrategyScore, 
  ScoringMetrics,
  StrategyScoreHistory 
} from '@/types';

interface StrategyScoreCardProps {
  strategyId: string;
  strategyName: string;
  initialScore?: StrategyScore;
  initialMetrics?: ScoringMetrics;
  showDetails?: boolean;
  className?: string;
  onScoreUpdate?: (score: StrategyScore, metrics: ScoringMetrics) => void;
}

interface ScoreDimensionProps {
  label: string;
  value: number;
  color: string;
  description: string;
}

/**
 * Individual score dimension component
 */
const ScoreDimension: React.FC<ScoreDimensionProps> = ({ 
  label, 
  value, 
  color, 
  description 
}) => {
  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 65) return 'text-blue-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressColor = (score: number): string => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 65) return 'bg-blue-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Tooltip content={description}>
      <div className="flex flex-col space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className={`text-sm font-bold ${getScoreColor(value)}`}>
            {value}/100
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`${getProgressColor(value)} h-2 rounded-full transition-all duration-300`}
            style={{ width: `${value}%` }}
          />
        </div>
      </div>
    </Tooltip>
  );
};

/**
 * Strategy Score Card Component
 * 
 * Displays comprehensive strategy performance scores with visual indicators,
 * recommendations, and detailed metrics breakdown.
 */
export const StrategyScoreCard: React.FC<StrategyScoreCardProps> = ({
  strategyId,
  strategyName,
  initialScore,
  initialMetrics,
  showDetails = false,
  className = '',
  onScoreUpdate
}) => {
  const [score, setScore] = useState<StrategyScore | null>(initialScore || null);
  const [metrics, setMetrics] = useState<ScoringMetrics | null>(initialMetrics || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullDetails, setShowFullDetails] = useState(showDetails);
  const [historicalScores, setHistoricalScores] = useState<StrategyScoreHistory[]>([]);

  /**
   * Fetch latest strategy score from API
   */
  const fetchStrategyScore = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/strategy/score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          strategyId,
          // In a real implementation, you would fetch the latest backtest results
          // For now, we'll use the initial score if available
        }),
      });

      const result = await response.json();

      if (result.success) {
        setScore(result.data.score);
        setMetrics(result.data.metrics);
        onScoreUpdate?.(result.data.score, result.data.metrics);
      } else {
        setError(result.error?.message || 'Failed to fetch strategy score');
      }
    } catch (err) {
      setError('Network error while fetching strategy score');
      console.error('Strategy score fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get overall score grade and color
   */
  const getScoreGrade = (overallScore: number): { grade: string; color: string; description: string } => {
    if (overallScore >= 80) {
      return {
        grade: 'A+',
        color: 'text-green-600',
        description: 'Excellent strategy performance'
      };
    } else if (overallScore >= 70) {
      return {
        grade: 'A',
        color: 'text-green-500',
        description: 'Very good strategy performance'
      };
    } else if (overallScore >= 65) {
      return {
        grade: 'B+',
        color: 'text-blue-600',
        description: 'Good strategy performance'
      };
    } else if (overallScore >= 60) {
      return {
        grade: 'B',
        color: 'text-blue-500',
        description: 'Above average strategy performance'
      };
    } else if (overallScore >= 50) {
      return {
        grade: 'C',
        color: 'text-yellow-600',
        description: 'Average strategy performance'
      };
    } else if (overallScore >= 40) {
      return {
        grade: 'D',
        color: 'text-orange-600',
        description: 'Below average strategy performance'
      };
    } else {
      return {
        grade: 'F',
        color: 'text-red-600',
        description: 'Poor strategy performance'
      };
    }
  };

  /**
   * Render score visualization
   */
  const renderScoreVisualization = () => {
    if (!score) return null;

    const { grade, color, description } = getScoreGrade(score.overall);

    return (
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <div className={`text-6xl font-bold ${color}`}>
            {score.overall}
          </div>
          <div className={`absolute -top-2 -right-8 text-2xl font-bold ${color}`}>
            {grade}
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600">{description}</p>
          <p className="text-xs text-gray-500 mt-1">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    );
  };

  /**
   * Render score dimensions
   */
  const renderScoreDimensions = () => {
    if (!score) return null;

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Performance Dimensions</h3>
        
        <ScoreDimension
          label="Profitability"
          value={score.profitability}
          color="green"
          description="Returns, profit factor, and expectancy"
        />
        
        <ScoreDimension
          label="Consistency"
          value={score.consistency}
          color="blue"
          description="Win rate stability and consecutive runs"
        />
        
        <ScoreDimension
          label="Risk-Adjusted"
          value={score.riskAdjusted}
          color="purple"
          description="Sharpe ratio and risk-adjusted returns"
        />
        
        <ScoreDimension
          label="Drawdown Control"
          value={score.drawdown}
          color="orange"
          description="Maximum drawdown and recovery factor"
        />
      </div>
    );
  };

  /**
   * Render recommendations
   */
  const renderRecommendations = () => {
    if (!score || score.recommendations.length === 0) return null;

    return (
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-800">Recommendations</h3>
        <div className="space-y-2">
          {score.recommendations.map((recommendation, index) => (
            <div key={index} className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
              <p className="text-sm text-gray-700">{recommendation}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /**
   * Render warnings
   */
  const renderWarnings = () => {
    if (!score || score.warnings.length === 0) return null;

    return (
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-red-800">Warnings</h3>
        <div className="space-y-2">
          {score.warnings.map((warning, index) => (
            <div key={index} className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 flex-shrink-0" />
              <p className="text-sm text-gray-700">{warning}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /**
   * Render detailed metrics
   */
  const renderDetailedMetrics = () => {
    if (!metrics || !showFullDetails) return null;

    const metricGroups = [
      {
        title: 'Performance Metrics',
        metrics: [
          { label: 'Return %', value: `${metrics.returnPercentage.toFixed(2)}%` },
          { label: 'Profit Factor', value: metrics.profitFactor.toFixed(2) },
          { label: 'Win Rate', value: `${metrics.winRate.toFixed(1)}%` },
          { label: 'Expectancy', value: `$${metrics.expectancy.toFixed(2)}` },
        ]
      },
      {
        title: 'Risk Metrics',
        metrics: [
          { label: 'Sharpe Ratio', value: metrics.sharpeRatio.toFixed(2) },
          { label: 'Sortino Ratio', value: metrics.sortinoRatio.toFixed(2) },
          { label: 'Max Drawdown', value: `${metrics.maxDrawdownPercent.toFixed(1)}%` },
          { label: 'Recovery Factor', value: metrics.recoveryFactor.toFixed(2) },
        ]
      },
      {
        title: 'Trading Metrics',
        metrics: [
          { label: 'Total Trades', value: metrics.totalTrades.toString() },
          { label: 'Avg Win', value: `$${metrics.averageWin.toFixed(2)}` },
          { label: 'Avg Loss', value: `$${metrics.averageLoss.toFixed(2)}` },
          { label: 'Win Rate Stability', value: `${(metrics.winRateStability * 100).toFixed(1)}%` },
        ]
      }
    ];

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Detailed Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {metricGroups.map((group, groupIndex) => (
            <Card key={groupIndex} className="p-4">
              <h4 className="font-medium text-gray-700 mb-3">{group.title}</h4>
              <div className="space-y-2">
                {group.metrics.map((metric, metricIndex) => (
                  <div key={metricIndex} className="flex justify-between">
                    <span className="text-sm text-gray-600">{metric.label}:</span>
                    <span className="text-sm font-medium text-gray-900">{metric.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (!initialScore) {
      fetchStrategyScore();
    }
  }, [strategyId]);

  if (loading && !score) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </Card>
    );
  }

  if (error && !score) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center">
          <div className="text-red-500 mb-2">Error loading strategy score</div>
          <div className="text-sm text-gray-600 mb-4">{error}</div>
          <Button onClick={fetchStrategyScore} variant="secondary" size="sm">
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">{strategyName}</h2>
          <p className="text-sm text-gray-600">Strategy Performance Score</p>
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={fetchStrategyScore}
            variant="secondary"
            size="sm"
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Refresh'}
          </Button>
          <Button
            onClick={() => setShowFullDetails(!showFullDetails)}
            variant="secondary"
            size="sm"
          >
            {showFullDetails ? 'Hide Details' : 'Show Details'}
          </Button>
        </div>
      </div>

      {/* Score Visualization */}
      {renderScoreVisualization()}

      {/* Score Dimensions */}
      <div className="mt-8">
        {renderScoreDimensions()}
      </div>

      {/* Detailed Metrics */}
      {showFullDetails && (
        <div className="mt-8">
          {renderDetailedMetrics()}
        </div>
      )}

      {/* Recommendations */}
      {score?.recommendations && score.recommendations.length > 0 && (
        <div className="mt-8">
          {renderRecommendations()}
        </div>
      )}

      {/* Warnings */}
      {score?.warnings && score.warnings.length > 0 && (
        <div className="mt-8">
          {renderWarnings()}
        </div>
      )}
    </Card>
  );
};

export default StrategyScoreCard;