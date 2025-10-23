import React, { useState, useEffect, useMemo } from 'react';
import {
  CorrelationMatrix,
  CorrelationData,
  CorrelationGroup
} from '@/types';
import { CURRENCY_GROUPS } from '@/lib/market/correlation';
import {
  RefreshCw,
  Download,
  Info,
  Settings,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';

// Import UI components with fallbacks for development
// In production, these would be from your UI library
const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={`border border-neutral-200 rounded-lg bg-white shadow-sm ${className || ''}`}>
    {children}
  </div>
);

const CardHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={`px-6 py-4 border-b border-neutral-200 ${className || ''}`}>
    {children}
  </div>
);

const CardTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <h2 className={`text-lg font-semibold text-neutral-900 ${className || ''}`}>
    {children}
  </h2>
);

const CardContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={`px-6 py-4 ${className || ''}`}>
    {children}
  </div>
);

const Button = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
}) => {
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  
  const variantClasses = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
    secondary: 'bg-secondary-600 text-white hover:bg-secondary-700 focus:ring-secondary-500',
    outline: 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 focus:ring-primary-500'
  };
  
  const sizeClasses = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 py-2 text-sm',
    lg: 'h-12 px-6 text-base'
  };
  
  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className || ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

const Select = ({
  value,
  onValueChange,
  children,
  className
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}) => (
  <select
    value={value}
    onChange={(e) => onValueChange(e.target.value)}
    className={`w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${className || ''}`}
  >
    {children}
  </select>
);

const SelectItem = ({ value, children }: { value: string; children: React.ReactNode }) => (
  <option value={value}>
    {children}
  </option>
);

const SelectTrigger = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={className || ''}>
    {children}
  </div>
);

const SelectContent = ({ children }: { children: React.ReactNode }) => (
  <>
    {children}
  </>
);

const SelectValue = ({ placeholder }: { placeholder?: string }) => (
  <option value="" disabled>
    {placeholder}
  </option>
);

const Badge = ({
  children,
  variant = 'primary',
  className
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  className?: string;
}) => {
  const variantClasses = {
    primary: 'bg-primary-100 text-primary-800',
    secondary: 'bg-secondary-100 text-secondary-800',
    outline: 'border border-neutral-300 text-neutral-700'
  };
  
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${variantClasses[variant]} ${className || ''}`}>
      {children}
    </span>
  );
};

const TooltipProvider = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
);

const Tooltip = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
);

const TooltipTrigger = ({
  children,
  asChild
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) => (
  <>{children}</>
);

const TooltipContent = ({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`z-50 overflow-hidden rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 shadow-md ${className || ''}`}>
    {children}
  </div>
);

interface CorrelationMatrixVisualizerProps {
  symbols: string[];
  timeframe?: string;
  lookbackPeriod?: number;
  minDataPoints?: number;
  onCellClick?: (symbol1: string, symbol2: string, correlation: CorrelationData) => void;
  className?: string;
}

interface CellData {
  symbol1: string;
  symbol2: string;
  correlation: number;
  pValue: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  changeRate: number;
  lastUpdated: Date;
}

export function CorrelationMatrixVisualizer({
  symbols,
  timeframe = 'H1',
  lookbackPeriod = 30,
  minDataPoints = 20,
  onCellClick,
  className
}: CorrelationMatrixVisualizerProps) {
  const [correlationMatrix, setCorrelationMatrix] = useState<CorrelationMatrix | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState(timeframe);
  const [selectedLookback, setSelectedLookback] = useState(lookbackPeriod);
  const [hoveredCell, setHoveredCell] = useState<{symbol1: string; symbol2: string} | null>(null);
  const [showGroups, setShowGroups] = useState(false);
  const [sortBy, setSortBy] = useState<'symbol' | 'correlation' | 'trend'>('symbol');

  // Fetch correlation matrix from API
  const fetchCorrelationMatrix = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        action: 'matrix',
        symbols: symbols.join(','),
        timeframe: selectedTimeframe,
        lookbackPeriod: selectedLookback.toString(),
        minDataPoints: minDataPoints.toString()
      });
      
      const response = await fetch(`/api/market/correlation?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setCorrelationMatrix(data.data);
      } else {
        setError(data.error || 'Failed to fetch correlation matrix');
      }
    } catch (err) {
      setError('Network error while fetching correlation matrix');
      console.error('Error fetching correlation matrix:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch and when parameters change
  useEffect(() => {
    if (symbols.length >= 2) {
      fetchCorrelationMatrix();
    }
  }, [symbols, selectedTimeframe, selectedLookback]);

  // Process correlation data for visualization
  const processedData = useMemo(() => {
    if (!correlationMatrix) return [];
    
    const cells: CellData[] = [];
    
    for (const symbol1 of symbols) {
      for (const symbol2 of symbols) {
        if (symbol1 === symbol2) continue;
        
        const correlationData = correlationMatrix.correlations[symbol1]?.[symbol2];
        if (correlationData) {
          cells.push({
            symbol1,
            symbol2,
            correlation: correlationData.correlation,
            pValue: correlationData.pValue,
            trend: correlationData.trend,
            changeRate: correlationData.changeRate,
            lastUpdated: correlationData.lastUpdated
          });
        }
      }
    }
    
    // Sort cells based on selected criteria
    return cells.sort((a, b) => {
      switch (sortBy) {
        case 'symbol':
          return a.symbol1.localeCompare(b.symbol1) || a.symbol2.localeCompare(b.symbol2);
        case 'correlation':
          return Math.abs(b.correlation) - Math.abs(a.correlation);
        case 'trend':
          return a.trend.localeCompare(b.trend) || b.changeRate - a.changeRate;
        default:
          return 0;
      }
    });
  }, [correlationMatrix, symbols, sortBy]);

  // Group symbols by currency
  const currencyGroups = useMemo(() => {
    const groups: Record<string, string[]> = {};
    
    for (const [currency, currencyPairs] of Object.entries(CURRENCY_GROUPS)) {
      const matchingSymbols = symbols.filter(symbol => (currencyPairs as string[]).includes(symbol));
      if (matchingSymbols.length > 0) {
        groups[currency] = matchingSymbols;
      }
    }
    
    return groups;
  }, [symbols]);

  // Get color based on correlation value
  const getCorrelationColor = (correlation: number): string => {
    const absCorrelation = Math.abs(correlation);
    
    if (absCorrelation >= 0.8) {
      return correlation > 0 ? 'bg-red-600' : 'bg-green-600';
    } else if (absCorrelation >= 0.6) {
      return correlation > 0 ? 'bg-red-500' : 'bg-green-500';
    } else if (absCorrelation >= 0.4) {
      return correlation > 0 ? 'bg-red-400' : 'bg-green-400';
    } else if (absCorrelation >= 0.2) {
      return correlation > 0 ? 'bg-red-300' : 'bg-green-300';
    } else {
      return 'bg-gray-200';
    }
  };

  // Get text color based on background
  const getTextColor = (correlation: number): string => {
    const absCorrelation = Math.abs(correlation);
    return absCorrelation >= 0.4 ? 'text-white' : 'text-gray-800';
  };

  // Get trend icon
  const getTrendIcon = (trend: 'increasing' | 'decreasing' | 'stable') => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="h-3 w-3" />;
      case 'decreasing':
        return <TrendingDown className="h-3 w-3" />;
      default:
        return <Minus className="h-3 w-3" />;
    }
  };

  // Export correlation matrix as CSV
  const exportToCSV = () => {
    if (!correlationMatrix) return;
    
    let csv = 'Symbol1,Symbol2,Correlation,P-Value,Trend,Last Updated\n';
    
    for (const cell of processedData) {
      csv += `${cell.symbol1},${cell.symbol2},${cell.correlation.toFixed(4)},${cell.pValue.toFixed(4)},${cell.trend},${cell.lastUpdated.toISOString()}\n`;
    }
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `correlation_matrix_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (symbols.length < 2) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center p-8">
          <Info className="h-8 w-8 text-blue-500 mb-2" />
          <p className="text-center text-neutral-600">
            Select at least 2 symbols to view correlation matrix
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">Correlation Matrix</CardTitle>
          
          <div className="flex flex-wrap gap-2">
            <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M1">M1</SelectItem>
                <SelectItem value="M5">M5</SelectItem>
                <SelectItem value="M15">M15</SelectItem>
                <SelectItem value="M30">M30</SelectItem>
                <SelectItem value="H1">H1</SelectItem>
                <SelectItem value="H4">H4</SelectItem>
                <SelectItem value="D1">D1</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={selectedLookback.toString()} onValueChange={(value: string) => setSelectedLookback(parseInt(value))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={(value: string) => setSortBy(value as 'symbol' | 'correlation' | 'trend')}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="symbol">Sort by Symbol</SelectItem>
                <SelectItem value="correlation">Sort by Correlation</SelectItem>
                <SelectItem value="trend">Sort by Trend</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGroups(!showGroups)}
            >
              <Settings className="h-4 w-4 mr-1" />
              Groups
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={fetchCorrelationMatrix}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              disabled={!correlationMatrix}
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>
        
        {correlationMatrix && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              Updated: {correlationMatrix.timestamp.toLocaleString()}
            </Badge>
            <Badge variant="secondary">
              Avg Correlation: {correlationMatrix.metadata.averageCorrelation.toFixed(3)}
            </Badge>
            <Badge variant="secondary">
              Highest: {correlationMatrix.metadata.highestCorrelation.toFixed(3)}
            </Badge>
            <Badge variant="secondary">
              Lowest: {correlationMatrix.metadata.lowestCorrelation.toFixed(3)}
            </Badge>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>Loading correlation data...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center p-8 text-red-600">
            <Info className="h-6 w-6 mr-2" />
            <span>{error}</span>
          </div>
        ) : correlationMatrix ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="p-2 text-left text-xs font-medium text-neutral-700 w-24"></th>
                  {symbols.map(symbol => (
                    <th key={symbol} className="p-2 text-center text-xs font-medium text-neutral-700 min-w-20">
                      {showGroups && currencyGroups[symbol] ? (
                        <div>
                          <Badge variant="outline" className="text-xs mb-1">
                            {currencyGroups[symbol][0].slice(0, 3)}
                          </Badge>
                          <div>{symbol}</div>
                        </div>
                      ) : (
                        symbol
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {symbols.map(symbol1 => (
                  <tr key={symbol1}>
                    <td className="p-2 text-xs font-medium text-neutral-700">
                      {showGroups && currencyGroups[symbol1] ? (
                        <div>
                          <Badge variant="outline" className="text-xs mb-1">
                            {currencyGroups[symbol1][0].slice(0, 3)}
                          </Badge>
                          <div>{symbol1}</div>
                        </div>
                      ) : (
                        symbol1
                      )}
                    </td>
                    {symbols.map(symbol2 => {
                      if (symbol1 === symbol2) {
                        return (
                          <td key={symbol2} className="p-2 text-center">
                            <div className="w-full h-8 bg-gray-100 rounded flex items-center justify-center">
                              <span className="text-xs font-medium">1.00</span>
                            </div>
                          </td>
                        );
                      }
                      
                      const correlationData = correlationMatrix.correlations[symbol1]?.[symbol2];
                      if (!correlationData) {
                        return (
                          <td key={symbol2} className="p-2 text-center">
                            <div className="w-full h-8 bg-gray-100 rounded"></div>
                          </td>
                        );
                      }
                      
                      const isHovered = hoveredCell?.symbol1 === symbol1 && hoveredCell?.symbol2 === symbol2;
                      
                      return (
                        <TooltipProvider key={symbol2}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <td
                                className="p-2 text-center cursor-pointer"
                                onClick={() => onCellClick?.(symbol1, symbol2, correlationData)}
                                onMouseEnter={() => setHoveredCell({ symbol1, symbol2 })}
                                onMouseLeave={() => setHoveredCell(null)}
                              >
                                <div
                                  className={`w-full h-8 ${getCorrelationColor(correlationData.correlation)} rounded flex items-center justify-center transition-all ${isHovered ? 'ring-2 ring-blue-500' : ''}`}
                                >
                                  <span className={`text-xs font-medium ${getTextColor(correlationData.correlation)}`}>
                                    {correlationData.correlation.toFixed(2)}
                                  </span>
                                </div>
                              </td>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="space-y-2">
                                <div className="font-medium">
                                  {symbol1} / {symbol2}
                                </div>
                                <div className="text-sm space-y-1">
                                  <div>Correlation: {correlationData.correlation.toFixed(4)}</div>
                                  <div>P-Value: {correlationData.pValue.toFixed(4)}</div>
                                  <div className="flex items-center gap-1">
                                    Trend: {getTrendIcon(correlationData.trend)}
                                    <span>{correlationData.trend}</span>
                                  </div>
                                  <div>Change Rate: {correlationData.changeRate.toFixed(4)}</div>
                                  <div>Updated: {correlationData.lastUpdated.toLocaleString()}</div>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// Legend component for correlation matrix
export function CorrelationMatrixLegend() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Correlation Legend</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-600 rounded"></div>
            <span className="text-xs">Strong Positive (0.8 to 1.0)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span className="text-xs">Moderate Positive (0.6 to 0.8)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-400 rounded"></div>
            <span className="text-xs">Weak Positive (0.4 to 0.6)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-300 rounded"></div>
            <span className="text-xs">Very Weak Positive (0.2 to 0.4)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-200 rounded"></div>
            <span className="text-xs">No Correlation (0.0 to 0.2)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-300 rounded"></div>
            <span className="text-xs">Very Weak Negative (-0.2 to 0.0)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-400 rounded"></div>
            <span className="text-xs">Weak Negative (-0.4 to -0.2)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-xs">Moderate Negative (-0.6 to -0.4)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-600 rounded"></div>
            <span className="text-xs">Strong Negative (-1.0 to -0.6)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}