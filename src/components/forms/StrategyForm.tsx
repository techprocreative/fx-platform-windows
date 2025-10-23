"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  AlertCircle,
  ChevronLeft,
  Edit2,
  HelpCircle,
  Info,
  Plus,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Zap, // Still used in template definitions (disabled but present)
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { AIStrategyGenerator } from "@/components/forms/AIStrategyGenerator";
import { AIPreviewCard } from "@/components/forms/AIPreviewCard";
import { DynamicRiskParams, SessionFilter, MTFConfirmation, StrategyCondition as GlobalStrategyCondition, SmartExitRules, PositionSizingConfig, SizingMethod, PositionSizingResult, StrategyScore, CorrelationFilter, MarketRegime, RegimeDetectionConfig, EnhancedPartialExitConfig, PartialExitLevel } from "@/types";
import {
  MARKET_SESSIONS,
  DEFAULT_SESSION_FILTER,
  getCurrentSession,
  isOptimalTimeForPair,
  getSessionInfo
} from "@/lib/market/sessions";
import { TRADING_CONFIG } from "@/lib/config";

type StrategyMode = "ai" | "manual" | "mtf";

type ConditionOperator =
  | "greater_than"
  | "less_than"
  | "equals"
  | "crosses_above"
  | "crosses_below";

export interface StrategyCondition {
  id: string;
  indicator: string;
  condition: ConditionOperator;
  value: number | null;
  period?: number;
}

export interface StrategyRules {
  entry: {
    conditions?: Omit<StrategyCondition, "id">[];
    logic?: "AND" | "OR";
    primary?: Omit<StrategyCondition, "id">[];
    confirmation?: MTFConfirmation[];
  };
  exit: {
    takeProfit: { type: string; value: number };
    stopLoss: { type: string; value: number };
    trailing: { enabled: boolean; distance: number };
    smartExit?: SmartExitRules;
    enhancedPartialExits?: EnhancedPartialExitConfig;
  };
  riskManagement: {
    lotSize: number;
    maxPositions: number;
    maxDailyLoss: number;
  };
  dynamicRisk?: DynamicRiskParams;
  sessionFilter?: SessionFilter;
  correlationFilter?: CorrelationFilter;
  regimeDetection?: RegimeDetectionConfig;
}

export interface StrategyFormData {
  name: string;
  description: string;
  symbol: string;
  timeframe: string;
  type: string;
  primaryTimeframe?: string;
  confirmationTimeframes?: string[];
}

export interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  icon: React.ReactNode;
  config: {
    name: string;
    description: string;
    symbol: string;
    timeframe: string;
    entryConditions: Omit<StrategyCondition, "id">[];
    exitRules: StrategyRules["exit"];
    riskManagement: StrategyRules["riskManagement"];
    entryLogic: "AND" | "OR";
  };
}

interface StrategyFormProps {
  mode?: StrategyMode;
  initialData?: {
    formData?: StrategyFormData;
    rules?: StrategyRules;
    conditions?: StrategyCondition[];
    mode?: StrategyMode;
    selectedTemplateId?: string | null;
  };
  templates?: StrategyTemplate[];
  onSubmit: (payload: {
    formData: StrategyFormData;
    rules: StrategyRules;
  }) => Promise<void>;
  onCancelHref?: string;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  loading?: boolean;
  showModeToggle?: boolean;
}

const DEFAULT_FORM_DATA: StrategyFormData = {
  name: "",
  description: "",
  symbol: "EURUSD",
  timeframe: "H1",
  type: "manual",
};

const DEFAULT_ENTRY_CONDITION: Omit<StrategyCondition, "id"> = {
  indicator: "RSI",
  condition: "greater_than",
  value: null,
  period: 14,
};

const DEFAULT_EXIT_RULES: StrategyRules["exit"] = {
  takeProfit: { type: "pips", value: 50 },
  stopLoss: { type: "pips", value: 25 },
  trailing: { enabled: false, distance: 10 },
  smartExit: {
    stopLoss: {
      type: "fixed",
      atrMultiplier: 2.0,
      useSwingPoints: false,
      swingLookback: 10,
      maxHoldingHours: 24
    },
    takeProfit: {
      type: "fixed",
      rrRatio: 2.0,
      partialExits: [
        { percentage: 50, atRR: 1.0 },
        { percentage: 30, atRR: 2.0 },
        { percentage: 20, atRR: 3.0 }
      ]
    }
  }
};

const DEFAULT_RISK_MANAGEMENT: StrategyRules["riskManagement"] = {
  lotSize: 0.1,
  maxPositions: 5,
  maxDailyLoss: 500,
};

const DEFAULT_DYNAMIC_RISK: DynamicRiskParams = {
  useATRSizing: false,
  atrMultiplier: 2.0,
  riskPercentage: 1.5,
  autoAdjustLotSize: false,
  reduceInHighVolatility: false,
  volatilityThreshold: 0.02,
};

const DEFAULT_CORRELATION_FILTER: CorrelationFilter = {
  enabled: false,
  maxCorrelation: 0.7,
  checkPairs: [],
  skipHighlyCorrelated: true,
  timeframes: ['H1', 'H4', 'D1'],
  lookbackPeriod: 30,
  minDataPoints: 20,
  updateFrequency: 24,
  dynamicThreshold: false,
  groupByCurrency: true,
};

const INDICATORS = [
  "RSI",
  "MACD",
  "EMA",
  "SMA",
  "ADX",
  "Bollinger Bands",
  "Stochastic",
  // New indicators from Phase 1.1
  "ATR",
  "Ichimoku",
  "VWAP",
  "CCI",
  "Williams %R",
  "OBV",
  "Volume MA",
];

// Indicator configurations with descriptions and default periods
export const INDICATOR_CONFIGS = {
  "RSI": { periods: [14, 20], description: "Overbought/oversold momentum" },
  "MACD": { periods: [12, 26, 9], description: "Trend following momentum" },
  "EMA": { periods: [20, 50, 200], description: "Exponential moving average" },
  "SMA": { periods: [20, 50, 200], description: "Simple moving average" },
  "ADX": { periods: [14], description: "Trend strength" },
  "Bollinger Bands": { periods: [20], description: "Volatility bands" },
  "Stochastic": { periods: [14], description: "Momentum oscillator" },
  // New indicators
  "ATR": { periods: [14, 20], description: "Volatility & stop loss" },
  "Ichimoku": { periods: [9, 26, 52], description: "Trend & support/resistance" },
  "VWAP": { periods: [], description: "Institutional levels" },
  "CCI": { periods: [14, 20], description: "Overbought/oversold" },
  "Williams %R": { periods: [14], description: "Momentum reversal" },
  "OBV": { periods: [], description: "Volume confirmation" },
  "Volume MA": { periods: [20], description: "Volume trends" },
};

const CONDITIONS: ConditionOperator[] = [
  "greater_than",
  "less_than",
  "equals",
  "crosses_above",
  "crosses_below",
];

// Use centralized symbol configuration from TRADING_CONFIG
// This ensures consistency across the platform and includes all supported symbols:
// - Major & Minor Forex Pairs
// - Exotic Forex Pairs
// - Commodities (Precious Metals, Energy, Base Metals, Agricultural)
const SYMBOLS = TRADING_CONFIG.SUPPORTED_SYMBOLS;

const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1"];

const DEFAULT_TEMPLATES: StrategyTemplate[] = [
  {
    id: "rsi-oversold",
    name: "RSI Oversold Bounce",
    description:
      "Buy when RSI indicates oversold conditions. Great for beginners!",
    difficulty: "beginner",
    icon: <TrendingUp className="h-5 w-5" />,
    config: {
      name: "RSI Bounce Strategy",
      description:
        "Buys when RSI shows oversold (below 30) and sells at profit target",
      symbol: "EURUSD",
      timeframe: "H1",
      entryConditions: [
        {
          indicator: "RSI",
          condition: "less_than",
          value: 30,
          period: 14,
        },
      ],
      exitRules: {
        takeProfit: { type: "pips", value: 30 },
        stopLoss: { type: "pips", value: 15 },
        trailing: { enabled: false, distance: 10 },
      },
      riskManagement: {
        lotSize: 0.01,
        maxPositions: 2,
        maxDailyLoss: 100,
      },
      entryLogic: "AND",
    },
  },
  {
    id: "ma-crossover",
    name: "Moving Average Crossover",
    description: "Classic trend-following strategy using MA crossovers",
    difficulty: "beginner",
    icon: <Target className="h-5 w-5" />,
    config: {
      name: "MA Crossover Strategy",
      description: "Trades when fast MA crosses slow MA",
      symbol: "EURUSD",
      timeframe: "H4",
      entryConditions: [
        {
          indicator: "EMA",
          condition: "crosses_above",
          value: 50,
          period: 20,
        },
      ],
      exitRules: {
        takeProfit: { type: "pips", value: 50 },
        stopLoss: { type: "pips", value: 25 },
        trailing: { enabled: true, distance: 15 },
      },
      riskManagement: {
        lotSize: 0.01,
        maxPositions: 3,
        maxDailyLoss: 150,
      },
      entryLogic: "AND",
    },
  },
  {
    id: "breakout",
    name: "Support/Resistance Breakout",
    description: "Trade breakouts from key levels with momentum",
    difficulty: "intermediate",
    icon: <Zap className="h-5 w-5" />,
    config: {
      name: "Breakout Strategy",
      description: "Trades breakouts with ADX confirmation",
      symbol: "EURUSD",
      timeframe: "H1",
      entryConditions: [
        {
          indicator: "ADX",
          condition: "greater_than",
          value: 25,
          period: 14,
        },
        {
          indicator: "RSI",
          condition: "greater_than",
          value: 50,
          period: 14,
        },
      ],
      exitRules: {
        takeProfit: { type: "pips", value: 60 },
        stopLoss: { type: "pips", value: 20 },
        trailing: { enabled: true, distance: 20 },
      },
      riskManagement: {
        lotSize: 0.02,
        maxPositions: 3,
        maxDailyLoss: 200,
      },
      entryLogic: "AND",
    },
  },
];

export function StrategyForm({
  mode: initialMode = "manual",
  initialData,
  templates,
  onSubmit,
  onCancelHref,
  title = "Create Strategy",
  subtitle,
  submitLabel = "Create Strategy",
  loading,
  showModeToggle = true,
}: StrategyFormProps) {
  // Note: onSubmit is intentionally not serialized as it's a client-side callback function
  const router = useRouter();
  const [mode, setMode] = useState<StrategyMode>(
    initialData?.mode ?? initialMode,
  );
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null); // Templates removed
  const [showTemplates, setShowTemplates] = useState(false); // Templates removed
  const [formData, setFormData] = useState<StrategyFormData>(
    initialData?.formData ?? DEFAULT_FORM_DATA,
  );
  const [entryConditions, setEntryConditions] = useState<StrategyCondition[]>(
    initialData?.conditions ?? [],
  );
  const [exitRules, setExitRules] = useState(DEFAULT_EXIT_RULES);
  const [riskManagement, setRiskManagement] = useState(DEFAULT_RISK_MANAGEMENT);
  const [dynamicRisk, setDynamicRisk] = useState<DynamicRiskParams>(DEFAULT_DYNAMIC_RISK);
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>(DEFAULT_SESSION_FILTER);
  const [correlationFilter, setCorrelationFilter] = useState<CorrelationFilter>(DEFAULT_CORRELATION_FILTER);
  const [smartExitEnabled, setSmartExitEnabled] = useState(false);
  
  // Enhanced Partial Exit States
  const [enhancedPartialExitsEnabled, setEnhancedPartialExitsEnabled] = useState(false);
  const [enhancedPartialExitsConfig, setEnhancedPartialExitsConfig] = useState<EnhancedPartialExitConfig>({
    enabled: false,
    strategy: 'sequential',
    levels: [],
    globalSettings: {
      allowReentry: false,
      minRemainingPosition: 10,
      maxDailyPartialExits: 10,
      cooldownPeriod: 5,
      reduceInHighVolatility: true,
      volatilityThreshold: 0.02,
      adjustForSpread: true,
      maxSpreadPercentage: 0.001,
      respectMarketSessions: true,
      avoidNewsEvents: true,
      newsBufferMinutes: 30
    },
    performanceTracking: {
      enabled: true,
      trackEffectiveness: true,
      optimizeLevels: false,
      lookbackPeriod: 30
    },
    integration: {
      withSmartExits: true,
      withTrailingStops: true,
      withRiskManagement: true,
      withRegimeDetection: false
    }
  });
  
  // Regime Detection States
  const [regimeDetectionEnabled, setRegimeDetectionEnabled] = useState(false);
  const [regimeDetectionConfig, setRegimeDetectionConfig] = useState<RegimeDetectionConfig>({
    trendPeriod: 20,
    trendThreshold: 0.02,
    volatilityPeriod: 14,
    volatilityThreshold: 0.015,
    rangePeriod: 20,
    rangeThreshold: 0.01,
    enableMTFAnalysis: false,
    primaryTimeframe: "H1",
    confirmationTimeframes: ["H4", "D1"],
    minConfidence: 70,
    weightTrend: 0.4,
    weightVolatility: 0.3,
    weightRange: 0.3,
    lookbackPeriod: 30,
    minDataPoints: 50,
    updateFrequency: 15,
    enableTransitionDetection: true
  });
  const [currentRegime, setCurrentRegime] = useState<MarketRegime>(MarketRegime.RANGING);
  const [regimeConfidence, setRegimeConfidence] = useState(0);
  const [showRegimePreview, setShowRegimePreview] = useState(false);
  
  // Position Sizing States
  const [positionSizingEnabled, setPositionSizingEnabled] = useState(false);
  const [positionSizingMethod, setPositionSizingMethod] = useState<SizingMethod>('percentage_risk');
  const [positionSizingConfig, setPositionSizingConfig] = useState<PositionSizingConfig | null>(null);
  const [positionSizingResult, setPositionSizingResult] = useState<PositionSizingResult | null>(null);
  const [showPositionSizingPreview, setShowPositionSizingPreview] = useState(false);
  
  // Strategy Score States
  const [strategyScore, setStrategyScore] = useState<StrategyScore | null>(null);
  const [showStrategyScore, setShowStrategyScore] = useState(false);
  const [scoreLoading, setScoreLoading] = useState(false);
  
  // MTF States
  const [primaryTimeframe, setPrimaryTimeframe] = useState<string>(initialData?.formData?.primaryTimeframe || "H1");
  const [confirmationTimeframes, setConfirmationTimeframes] = useState<string[]>(initialData?.formData?.confirmationTimeframes || []);
  const [mtfConfirmations, setMtfConfirmations] = useState<MTFConfirmation[]>([]);
  const [showMTFSection, setShowMTFSection] = useState(false);

  // MTF Helper Functions
  const addMTFConfirmation = (timeframe: string) => {
    const newConfirmation: MTFConfirmation = {
      timeframe,
      condition: {
        indicator: "RSI",
        condition: "greater_than",
        value: 50
      },
      required: true
    };
    setMtfConfirmations(prev => [...prev, newConfirmation]);
  };

  const removeMTFConfirmation = (index: number) => {
    setMtfConfirmations(prev => prev.filter((_, i) => i !== index));
  };

  const updateMTFConfirmation = (index: number, field: keyof MTFConfirmation, value: any) => {
    setMtfConfirmations(prev =>
      prev.map((confirmation, i) =>
        i === index ? { ...confirmation, [field]: value } : confirmation
      )
    );
  };

  // Enhanced Partial Exit Helper Functions
  const addPartialExitLevel = () => {
    const newLevel: PartialExitLevel = {
      id: `level-${Date.now()}`,
      name: `Level ${enhancedPartialExitsConfig.levels.length + 1}`,
      percentage: 25,
      triggerType: 'profit',
      profitTarget: {
        type: 'rr_ratio',
        value: 1.5
      },
      isActive: true,
      priority: enhancedPartialExitsConfig.levels.length + 1
    };

    setEnhancedPartialExitsConfig(prev => ({
      ...prev,
      levels: [...prev.levels, newLevel]
    }));
  };

  const removePartialExitLevel = (levelId: string) => {
    setEnhancedPartialExitsConfig(prev => ({
      ...prev,
      levels: prev.levels.filter(level => level.id !== levelId)
    }));
  };

  const updatePartialExitLevel = (levelId: string, field: keyof PartialExitLevel, value: any) => {
    setEnhancedPartialExitsConfig(prev => ({
      ...prev,
      levels: prev.levels.map(level =>
        level.id === levelId ? { ...level, [field]: value } : level
      )
    }));
  };

  const updateEnhancedPartialExitsConfig = (section: keyof EnhancedPartialExitConfig, updates: any) => {
    setEnhancedPartialExitsConfig(prev => {
      const currentSection = prev[section];
      if (typeof currentSection === 'object' && currentSection !== null) {
        return {
          ...prev,
          [section]: {
            ...currentSection,
            ...updates
          }
        };
      }
      
      return {
        ...prev,
        [section]: updates
      };
    });
  };

  const [entryLogic, setEntryLogic] = useState<"AND" | "OR">(
    initialData?.rules?.entry.logic ?? "AND",
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [aiGeneratedData, setAIGeneratedData] = useState<any>(null);
  const [showAIPreview, setShowAIPreview] = useState(false);
  const [highlightFields, setHighlightFields] = useState(false);

  useEffect(() => {
    if (initialData?.rules) {
      setExitRules(initialData.rules.exit);
      setRiskManagement(initialData.rules.riskManagement);
      if (initialData.rules.dynamicRisk) {
        setDynamicRisk(initialData.rules.dynamicRisk);
      }
      if (initialData.rules.sessionFilter) {
        setSessionFilter(initialData.rules.sessionFilter);
      }
      if (initialData.rules.correlationFilter) {
        setCorrelationFilter(initialData.rules.correlationFilter);
      }
      if (initialData.rules.regimeDetection) {
        setRegimeDetectionConfig(initialData.rules.regimeDetection);
        setRegimeDetectionEnabled(true);
      }
    }
  }, [initialData?.rules]);

  const availableTemplates = templates ?? DEFAULT_TEMPLATES;

  const templatesMap = useMemo(() => {
    return availableTemplates.reduce<Record<string, StrategyTemplate>>(
      (acc, template) => {
        acc[template.id] = template;
        return acc;
      },
      {},
    );
  }, [availableTemplates]);

  const handleSelectTemplate = (templateId: string) => {
    const template = templatesMap[templateId];
    if (!template) return;

    setSelectedTemplate(template.id);
    setFormData({
      name: template.config.name,
      description: template.config.description,
      symbol: template.config.symbol,
      timeframe: template.config.timeframe,
      type: "manual",
    });

    setEntryConditions(
      template.config.entryConditions.map((condition, index) => ({
        id: `${template.id}-${index}`,
        ...condition,
      })),
    );

    setExitRules(template.config.exitRules);
    setRiskManagement(template.config.riskManagement);
    setEntryLogic(template.config.entryLogic);
    setShowTemplates(false);
  };

  const handleFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const addCondition = () => {
    setEntryConditions((prev) => [
      ...prev,
      {
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
        ...DEFAULT_ENTRY_CONDITION,
      },
    ]);
  };

  const removeCondition = (id: string) => {
    setEntryConditions((prev) =>
      prev.filter((condition) => condition.id !== id),
    );
  };

  const updateCondition = (
    id: string,
    field: keyof StrategyCondition,
    value: any,
  ) => {
    setEntryConditions((prev) =>
      prev.map((condition) =>
        condition.id === id
          ? {
              ...condition,
              [field]: value,
            }
          : condition,
      ),
    );
  };

  const validate = () => {
    const validationErrors: string[] = [];

    if (!formData.name.trim()) {
      validationErrors.push("Strategy name is required");
    }

    if (!formData.symbol) {
      validationErrors.push("Symbol is required");
    }

    if (!formData.timeframe) {
      validationErrors.push("Timeframe is required");
    }

    if (entryConditions.length === 0) {
      validationErrors.push("At least one entry condition is required");
    }

    // MTF-specific validation
    if (formData.type === "mtf") {
      if (!primaryTimeframe) {
        validationErrors.push("Primary timeframe is required for MTF strategies");
      }
      
      if (confirmationTimeframes.length === 0) {
        validationErrors.push("At least one confirmation timeframe is required for MTF strategies");
      }
      
      const requiredConfirmations = mtfConfirmations.filter(c => c.required);
      if (requiredConfirmations.length === 0 && mtfConfirmations.length > 0) {
        validationErrors.push("At least one confirmation must be marked as required");
      }
      
      // Check if all selected timeframes have confirmation rules
      const timeframesWithoutRules = confirmationTimeframes.filter(tf =>
        !mtfConfirmations.some(c => c.timeframe === tf)
      );
      if (timeframesWithoutRules.length > 0) {
        validationErrors.push(`Confirmation rules required for: ${timeframesWithoutRules.join(", ")}`);
      }
    }

    if (!exitRules.takeProfit.value) {
      validationErrors.push("Take profit value is required");
    }

    if (!exitRules.stopLoss.value) {
      validationErrors.push("Stop loss value is required");
    }

    if (riskManagement.lotSize <= 0) {
      validationErrors.push("Lot size must be greater than 0");
    }

    setErrors(validationErrors);
    return validationErrors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validate()) {
      toast.error("Please fix the highlighted issues");
      return;
    }

    const payload: Parameters<typeof onSubmit>[0] = formData.type === "mtf" ? {
      formData: {
        ...formData,
        primaryTimeframe,
        confirmationTimeframes
      },
      rules: {
        entry: {
          primary: entryConditions.map(({ id, ...condition }) => condition),
          confirmation: mtfConfirmations
        },
        exit: {
          ...exitRules,
          smartExit: smartExitEnabled ? exitRules.smartExit : undefined,
          enhancedPartialExits: enhancedPartialExitsEnabled ? enhancedPartialExitsConfig : undefined
        },
        riskManagement,
        dynamicRisk,
        sessionFilter,
        correlationFilter,
      }
    } : {
      formData,
      rules: {
        entry: {
          conditions: entryConditions.map(({ id, ...condition }) => condition),
          logic: entryLogic,
        },
        exit: {
          ...exitRules,
          smartExit: smartExitEnabled ? exitRules.smartExit : undefined,
          enhancedPartialExits: enhancedPartialExitsEnabled ? enhancedPartialExitsConfig : undefined
        },
        riskManagement,
        dynamicRisk,
        sessionFilter,
        correlationFilter,
        regimeDetection: regimeDetectionEnabled ? regimeDetectionConfig : undefined,
      }
    };

    try {
      await onSubmit(payload);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to submit strategy");
      }
    }
  };

  const handleCancel = () => {
    if (onCancelHref) {
      router.push(onCancelHref);
    }
  };

  const populateFieldsFromAI = (data: any) => {
    // Set form data from AI generation
    setFormData((prev) => ({
      ...prev,
      name: data.name,
      description: data.description,
      symbol: data.symbol || formData.symbol,
      timeframe: data.timeframe || formData.timeframe,
      type: "ai_generated",
    }));

    // Convert AI rules to form format
    if (data.rules && Array.isArray(data.rules) && data.rules.length > 0) {
      const rule = data.rules[0];
      if (rule.conditions && Array.isArray(rule.conditions)) {
        const conditions = rule.conditions.map((cond: any, index: number) => ({
          id: `ai-${Date.now()}-${index}`,
          indicator: cond.indicator || "RSI",
          condition: cond.operator || "greater_than",
          value: cond.value || null,
          period: 14,
        }));
        setEntryConditions(conditions);
      }
    }

    // Set risk management from AI parameters (with optional chaining for safety)
    if (data.parameters) {
      setRiskManagement({
        lotSize: data.parameters?.riskPerTrade || 0.01,
        maxPositions: data.parameters?.maxPositions || 1,
        maxDailyLoss: data.parameters?.maxDailyLoss || 100,
      });

      setExitRules({
        takeProfit: {
          type: "pips",
          value: (data.parameters?.takeProfit || 0.004) * 10000,
        },
        stopLoss: {
          type: "pips",
          value: (data.parameters?.stopLoss || 0.002) * 10000,
        },
        trailing: { enabled: false, distance: 10 },
      });
    }
  };

  const handleAIGenerate = (data: {
    name: string;
    description: string;
    symbol?: string;
    timeframe?: string;
    rules: any;
    parameters?: any;
  }) => {
    // Debug log to verify received data
    console.log('📝 StrategyForm received AI data:', {
      name: data.name,
      symbol: data.symbol,
      timeframe: data.timeframe,
      hasRules: !!data.rules,
      hasParameters: !!data.parameters
    });
    
    // Store generated data and show preview
    setAIGeneratedData(data);
    setShowAIPreview(true);
    toast.success("Strategy generated! Review the preview below.");
  };

  const handleReviewStrategy = () => {
    if (!aiGeneratedData) return;

    // Debug log
    console.log('🔍 Review Strategy - Data:', {
      symbol: aiGeneratedData.symbol,
      timeframe: aiGeneratedData.timeframe,
      name: aiGeneratedData.name
    });

    // Populate fields with AI data
    populateFieldsFromAI(aiGeneratedData);

    // Switch to manual mode (not advanced - we removed that)
    setMode("manual");

    // Hide preview
    setShowAIPreview(false);

    // Enable field highlighting
    setHighlightFields(true);
    setTimeout(() => setHighlightFields(false), 3000);

    // Smooth scroll to basic information section
    setTimeout(() => {
      const basicInfoSection = document.getElementById(
        "basic-information-section",
      );
      if (basicInfoSection) {
        basicInfoSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);

    toast.success("Review and customize your strategy below!");
  };

  const handleUseAsIs = async () => {
    if (!aiGeneratedData) return;

    try {
      // Debug log
      console.log('✨ Use As-Is - Creating strategy with data:', {
        name: aiGeneratedData.name,
        symbol: aiGeneratedData.symbol || formData.symbol,
        timeframe: aiGeneratedData.timeframe || formData.timeframe,
        hasRules: !!aiGeneratedData.rules,
        hasParameters: !!aiGeneratedData.parameters
      });

      // Show loading toast
      toast.loading("Creating strategy...");

      // Prepare conditions from AI data
      const conditions =
        aiGeneratedData.rules?.[0]?.conditions?.map(
          (cond: any, index: number) => ({
            indicator: cond.indicator || "RSI",
            condition: cond.operator || "greater_than",
            value: cond.value || null,
            period: 14,
          }),
        ) || [];

      // Extract parameters - check both aiGeneratedData.parameters and nested rules.parameters
      const params = aiGeneratedData.parameters || (aiGeneratedData.rules as any)?.parameters || {};

      // Prepare exit rules
      const exitRulesFromAI = {
        takeProfit: {
          type: "pips" as const,
          value: Math.round((params?.takeProfit || 0.004) * 10000),
        },
        stopLoss: {
          type: "pips" as const,
          value: Math.round((params?.stopLoss || 0.002) * 10000),
        },
        trailing: { enabled: false, distance: 10 },
      };

      // Prepare risk management
      const riskMgmt = {
        lotSize: params?.riskPerTrade || 0.01,
        maxPositions: params?.maxPositions || 1,
        maxDailyLoss: params?.maxDailyLoss || 100,
      };

      // Submit directly without switching mode
      const payload = {
        formData: {
          name: aiGeneratedData.name,
          description: aiGeneratedData.description,
          symbol: aiGeneratedData.symbol || formData.symbol,
          timeframe: aiGeneratedData.timeframe || formData.timeframe,
          type: "ai_generated" as const,
        },
        rules: {
          entry: {
            conditions,
            logic: entryLogic,
          },
          exit: exitRulesFromAI,
          riskManagement: riskMgmt,
          dynamicRisk,
          sessionFilter,
          correlationFilter,
        },
      };

      await onSubmit(payload);

      // Hide preview on success
      setShowAIPreview(false);
      toast.dismiss();
      toast.success("Strategy created successfully! Ready for backtest.");
    } catch (error) {
      toast.dismiss();
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to create strategy");
      }
    }
  };

  // Position Sizing Helper Functions
  const loadDefaultPositionSizingConfig = async (method: SizingMethod) => {
    try {
      const response = await fetch(`/api/trading/position-sizing?method=${method}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setPositionSizingConfig(data.data.config);
      }
    } catch (error) {
      console.error('Error loading position sizing config:', error);
      // Set a basic default config
      setPositionSizingConfig({
        method,
        maxPositionSize: 10.0,
        minPositionSize: 0.01,
        positionSizeStep: 0.01,
        maxDailyLoss: 6.0,
        maxDrawdown: 20.0,
        maxTotalExposure: 50.0
      });
    }
  };

  const updatePositionSizingConfig = (section: keyof PositionSizingConfig, updates: any) => {
    setPositionSizingConfig(prev => {
      if (!prev) return prev;
      
      const currentSection = prev[section];
      if (typeof currentSection === 'object' && currentSection !== null) {
        return {
          ...prev,
          [section]: {
            ...currentSection,
            ...updates
          }
        };
      }
      
      return {
        ...prev,
        [section]: updates
      };
    });
  };

  const calculatePositionSizingPreview = async () => {
    if (!positionSizingConfig) return;

    try {
      const response = await fetch('/api/trading/position-sizing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountBalance: 10000, // Default balance for preview
          symbol: formData.symbol,
          entryPrice: 1.1000, // Default entry price for preview
          tradeType: 'BUY',
          currentATR: 0.0020, // Default ATR for preview
          volatility: 0.015, // Default volatility for preview
          config: positionSizingConfig
        })
      });

      const data = await response.json();
      
      if (data.success && data.data) {
        setPositionSizingResult(data.data);
        setShowPositionSizingPreview(true);
        toast.success('Position sizing preview calculated successfully!');
      } else {
        toast.error(data.error?.message || 'Failed to calculate position sizing');
      }
    } catch (error) {
      console.error('Error calculating position sizing preview:', error);
      toast.error('Failed to calculate position sizing preview');
    }
  };

  // Calculate Strategy Score
  const calculateStrategyScore = async () => {
    if (!formData.name || entryConditions.length === 0) {
      toast.error('Please fill in basic strategy information first');
      return;
    }

    setScoreLoading(true);
    try {
      // Create a mock backtest result for scoring
      const mockBacktest = {
        returnPercentage: 0,
        winRate: 0,
        trades: 0,
        profitFactor: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        sortinoRatio: 0,
        calmarRatio: 0,
        expectancy: 0,
        recoveryFactor: 0,
        avgTrade: 0,
        totalReturn: 0,
        annualizedReturn: 0,
        volatility: 0,
        variance: 0,
        skewness: 0,
        kurtosis: 0,
        var95: 0,
        maxConsecutiveWins: 0,
        maxConsecutiveLosses: 0,
        winRateStability: 0,
        drawdownDuration: 0,
        metadata: {
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          averageWin: 0,
          averageLoss: 0,
          largestWin: 0,
          largestLoss: 0,
          profitFactor: 0,
          sharpeRatio: 0,
          sortinoRatio: 0,
          calmarRatio: 0,
          expectancy: 0,
          recoveryFactor: 0,
          winRateStability: 0,
          drawdownDuration: 0,
          var95: 0,
          skewness: 0,
          kurtosis: 0
        }
      };

      // Call the strategy scoring API
      const response = await fetch('/api/strategy/score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          backtest: mockBacktest,
          strategy: {
            name: formData.name,
            description: formData.description,
            symbol: formData.symbol,
            timeframe: formData.timeframe,
            type: formData.type,
            rules: {
              entry: {
                conditions: entryConditions.map(({ id, ...condition }) => condition),
                logic: entryLogic,
              },
              exit: exitRules,
              riskManagement,
              dynamicRisk,
              sessionFilter,
              correlationFilter,
            }
          }
        })
      });

      const data = await response.json();
      
      if (data.success && data.data) {
        setStrategyScore(data.data);
        setShowStrategyScore(true);
        toast.success('Strategy score calculated successfully!');
      } else {
        toast.error(data.error?.message || 'Failed to calculate strategy score');
      }
    } catch (error) {
      console.error('Error calculating strategy score:', error);
      toast.error('Failed to calculate strategy score');
    } finally {
      setScoreLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            {onCancelHref && (
              <Link
                href={onCancelHref}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-50"
                aria-label="Back"
              >
                <ChevronLeft className="h-5 w-5" />
              </Link>
            )}
            <h1 className="text-3xl font-bold text-neutral-900">{title}</h1>
          </div>
          {subtitle && <p className="text-neutral-600">{subtitle}</p>}
        </div>

        {showModeToggle && (
          <div className="rounded-lg border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-white p-1">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant={mode === "ai" ? "primary" : "secondary"}
                size="sm"
                className={cn(
                  "flex-1 shadow-none",
                  mode === "ai" && "bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                )}
                onClick={() => setMode("ai")}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  <span className="font-semibold">AI Generate</span>
                  <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs">Recommended</span>
                </div>
              </Button>
              <Button
                type="button"
                variant={mode === "manual" ? "primary" : "secondary"}
                size="sm"
                className="flex-1 shadow-none"
                onClick={() => setMode("manual")}
              >
                <div className="flex items-center gap-2">
                  <Edit2 className="h-4 w-4" />
                  <span>Manual</span>
                </div>
              </Button>
            </div>
          </div>
        )}
      </div>

      {errors.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="flex flex-row items-start gap-3 border-none pb-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <CardTitle className="text-red-700">
                Please review the following
              </CardTitle>
              <CardDescription className="text-red-600">
                These issues must be resolved before continuing
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="list-disc space-y-1 pl-6 text-sm text-red-700">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Templates section removed - simplified to AI/Manual only */}
      {false && (
        <Card>
          <CardHeader>
            <CardTitle>Choose a Template</CardTitle>
            <CardDescription>
              Start with a proven template to accelerate your strategy creation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {availableTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleSelectTemplate(template.id)}
                  className={cn(
                    "text-left",
                    "rounded-lg border-2 p-4 transition-all",
                    selectedTemplate === template.id
                      ? "border-primary-500 shadow-md"
                      : "border-neutral-200 hover:border-primary-200 hover:shadow",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "rounded-lg p-2",
                        template.difficulty === "beginner"
                          ? "bg-green-100 text-green-600"
                          : template.difficulty === "intermediate"
                            ? "bg-yellow-100 text-yellow-600"
                            : "bg-red-100 text-red-600",
                      )}
                    >
                      {template.icon}
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-neutral-900">
                        {template.name}
                      </h3>
                      <p className="text-sm text-neutral-600">
                        {template.description}
                      </p>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          template.difficulty === "beginner"
                            ? "bg-green-100 text-green-700"
                            : template.difficulty === "intermediate"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700",
                        )}
                      >
                        {template.difficulty}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 text-blue-600" />
                <div className="space-y-1 text-sm text-blue-900">
                  <p className="font-medium">Need inspiration?</p>
                  <p>
                    Each template comes with preconfigured risk management and
                    exit rules. Customize them after selecting a template.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {mode === "ai" && !showAIPreview && (
        <AIStrategyGenerator onGenerate={handleAIGenerate} />
      )}

      {mode === "ai" && showAIPreview && aiGeneratedData && (
        <AIPreviewCard
          strategy={aiGeneratedData}
          onReview={handleReviewStrategy}
          onUseAsIs={handleUseAsIs}
        />
      )}

      {/* Manual form sections - only show in manual mode */}
      {mode === "manual" && (
        <>
      <Card
        id="basic-information-section"
        className={highlightFields ? "ai-highlighted-section" : ""}
      >
        <CardHeader className="border-none pb-0">
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            Describe your strategy and select the market conditions where it
            operates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">
                Strategy Name<span className="text-red-600"> *</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter strategy name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">
                Symbol<span className="text-red-600"> *</span>
              </label>
              <select
                name="symbol"
                value={formData.symbol}
                onChange={handleFormChange}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {SYMBOLS.map((symbol) => (
                  <option key={symbol} value={symbol}>
                    {symbol}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleFormChange}
              rows={3}
              className="w-full resize-none rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Describe your strategy"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">
                Timeframe<span className="text-red-600"> *</span>
              </label>
              <select
                name="timeframe"
                value={formData.timeframe}
                onChange={handleFormChange}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {TIMEFRAMES.map((timeframe) => (
                  <option key={timeframe} value={timeframe}>
                    {timeframe}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">
                Type
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleFormChange}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="manual">Manual</option>
                <option value="mtf">Multi-Timeframe</option>
                <option value="automated">Automated</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Multi-Timeframe Configuration */}
      {formData.type === "mtf" && (
        <Card>
          <CardHeader className="border-none pb-0">
            <CardTitle>Multi-Timeframe Configuration</CardTitle>
            <CardDescription>
              Configure higher timeframe confirmations for more robust signals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Primary Timeframe Selection */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700">
                  Primary Timeframe<span className="text-red-600"> *</span>
                </label>
                <select
                  value={primaryTimeframe}
                  onChange={(e) => setPrimaryTimeframe(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {TIMEFRAMES.map((tf) => (
                    <option key={tf} value={tf}>
                      {tf}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-neutral-500">
                  This is your main trading timeframe where entries are executed
                </p>
              </div>

              {/* Confirmation Timeframes Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700">
                  Confirmation Timeframes
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TIMEFRAMES.filter(tf => tf !== primaryTimeframe).map((tf) => (
                    <label key={tf} className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={confirmationTimeframes.includes(tf)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setConfirmationTimeframes(prev => [...prev, tf]);
                          } else {
                            setConfirmationTimeframes(prev => prev.filter(t => t !== tf));
                            // Remove confirmations for this timeframe
                            setMtfConfirmations(prev => prev.filter(c => c.timeframe !== tf));
                          }
                        }}
                      />
                      {tf}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-neutral-500">
                  Select higher timeframes for trend confirmation (e.g., H1 primary with D1 confirmation)
                </p>
              </div>
            </div>

            {/* Confirmation Rules */}
            {confirmationTimeframes.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-neutral-700">
                    Confirmation Rules
                  </label>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const firstUnconfigured = confirmationTimeframes.find(tf =>
                        !mtfConfirmations.some(c => c.timeframe === tf)
                      );
                      if (firstUnconfigured) {
                        addMTFConfirmation(firstUnconfigured);
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" /> Add Rule
                  </Button>
                </div>

                {mtfConfirmations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-neutral-300 p-8 text-center text-neutral-600">
                    <HelpCircle className="h-6 w-6" />
                    <p className="text-sm">
                      No confirmation rules yet. Add rules for your selected timeframes.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        const firstUnconfigured = confirmationTimeframes.find(tf =>
                          !mtfConfirmations.some(c => c.timeframe === tf)
                        );
                        if (firstUnconfigured) {
                          addMTFConfirmation(firstUnconfigured);
                        }
                      }}
                    >
                      <Plus className="h-4 w-4" /> Add First Rule
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mtfConfirmations.map((confirmation, index) => (
                      <div
                        key={index}
                        className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 sm:flex-row sm:items-center"
                      >
                        <div className="w-full sm:w-32">
                          <span className="text-sm font-medium text-neutral-700">
                            {confirmation.timeframe}
                          </span>
                        </div>

                        <select
                          value={confirmation.condition.indicator}
                          onChange={(e) => updateMTFConfirmation(index, 'condition', {
                            ...confirmation.condition,
                            indicator: e.target.value
                          })}
                          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 sm:w-40"
                        >
                          {INDICATORS.map((indicator) => (
                            <option key={indicator} value={indicator}>
                              {indicator}
                            </option>
                          ))}
                        </select>

                        <select
                          value={confirmation.condition.condition}
                          onChange={(e) => updateMTFConfirmation(index, 'condition', {
                            ...confirmation.condition,
                            condition: e.target.value
                          })}
                          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 sm:w-32"
                        >
                          {CONDITIONS.map((operator) => (
                            <option key={operator} value={operator}>
                              {operator.replace("_", " ")}
                            </option>
                          ))}
                        </select>

                        <input
                          type="number"
                          value={confirmation.condition.value ?? ""}
                          onChange={(e) => updateMTFConfirmation(index, 'condition', {
                            ...confirmation.condition,
                            value: e.target.value ? Number(e.target.value) : undefined
                          })}
                          placeholder="Value"
                          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 sm:w-24"
                        />

                        <div className="flex items-center gap-2">
                          <label className="inline-flex items-center gap-1 text-sm">
                            <input
                              type="checkbox"
                              checked={confirmation.required}
                              onChange={(e) => updateMTFConfirmation(index, 'required', e.target.checked)}
                            />
                            Required
                          </label>
                        </div>

                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          onClick={() => removeMTFConfirmation(index)}
                          aria-label="Remove confirmation"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 h-4 w-4" />
                    <div className="space-y-1">
                      <p className="font-medium">Multi-Timeframe Logic</p>
                      <ul className="text-xs space-y-1">
                        <li>• Primary timeframe conditions must be met first</li>
                        <li>• Required confirmations must all be satisfied</li>
                        <li>• Optional confirmations can improve signal strength</li>
                        <li>• Higher timeframes provide trend context</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-2 border-none pb-0 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Entry Conditions</CardTitle>
            <CardDescription>
              Define the indicators and thresholds that trigger your entries
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addCondition}
          >
            <Plus className="h-4 w-4" /> Add Condition
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="entryLogic"
                value="AND"
                checked={entryLogic === "AND"}
                onChange={() => setEntryLogic("AND")}
                className="h-4 w-4"
              />
              Require all conditions (AND)
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="entryLogic"
                value="OR"
                checked={entryLogic === "OR"}
                onChange={() => setEntryLogic("OR")}
                className="h-4 w-4"
              />
              Require any condition (OR)
            </label>
          </div>

          {entryConditions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-neutral-300 p-8 text-center text-neutral-600">
              <HelpCircle className="h-6 w-6" />
              <p className="text-sm">
                No conditions yet. Add your first condition to begin.
              </p>
              <Button type="button" size="sm" onClick={addCondition}>
                <Plus className="h-4 w-4" /> Add Condition
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {entryConditions.map((condition) => (
                <div
                  key={condition.id}
                  className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 sm:flex-row sm:items-center"
                >
                  <select
                    value={condition.indicator}
                    onChange={(event) =>
                      updateCondition(
                        condition.id,
                        "indicator",
                        event.target.value,
                      )
                    }
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 sm:w-48"
                  >
                    {INDICATORS.map((indicator) => (
                      <option key={indicator} value={indicator}>
                        {indicator} - {INDICATOR_CONFIGS[indicator as keyof typeof INDICATOR_CONFIGS]?.description || ''}
                      </option>
                    ))}
                  </select>

                  <select
                    value={condition.condition}
                    onChange={(event) =>
                      updateCondition(
                        condition.id,
                        "condition",
                        event.target.value,
                      )
                    }
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 sm:w-48"
                  >
                    {CONDITIONS.map((operator) => (
                      <option key={operator} value={operator}>
                        {operator.replace("_", " ")}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    value={condition.value ?? ""}
                    onChange={(event) =>
                      updateCondition(
                        condition.id,
                        "value",
                        event.target.value ? Number(event.target.value) : null,
                      )
                    }
                    placeholder="Value"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 sm:w-40"
                  />

                  <input
                    type="number"
                    value={condition.period ?? ""}
                    onChange={(event) =>
                      updateCondition(
                        condition.id,
                        "period",
                        event.target.value
                          ? Number(event.target.value)
                          : undefined,
                      )
                    }
                    placeholder={
                      INDICATOR_CONFIGS[condition.indicator as keyof typeof INDICATOR_CONFIGS]?.periods.length > 0
                        ? `Period: ${INDICATOR_CONFIGS[condition.indicator as keyof typeof INDICATOR_CONFIGS]?.periods.join(', ')}`
                        : "Period"
                    }
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 sm:w-28"
                    disabled={
                      INDICATOR_CONFIGS[condition.indicator as keyof typeof INDICATOR_CONFIGS]?.periods.length === 0
                    }
                  />

                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={() => removeCondition(condition.id)}
                    aria-label="Remove condition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-none pb-0">
            <CardTitle>Exit Rules</CardTitle>
            <CardDescription>
              Set profit targets and protection for your positions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700">
                  Take Profit (pips)<span className="text-red-600"> *</span>
                </label>
                <input
                  type="number"
                  value={exitRules.takeProfit.value}
                  onChange={(event) =>
                    setExitRules((prev) => ({
                      ...prev,
                      takeProfit: {
                        ...prev.takeProfit,
                        value: Number(event.target.value) || 0,
                      },
                    }))
                  }
                  className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700">
                  Stop Loss (pips)<span className="text-red-600"> *</span>
                </label>
                <input
                  type="number"
                  value={exitRules.stopLoss.value}
                  onChange={(event) =>
                    setExitRules((prev) => ({
                      ...prev,
                      stopLoss: {
                        ...prev.stopLoss,
                        value: Number(event.target.value) || 0,
                      },
                    }))
                  }
                  className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">
                Trailing Stop Distance (pips)
              </label>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={exitRules.trailing.enabled}
                    onChange={(event) =>
                      setExitRules((prev) => ({
                        ...prev,
                        trailing: {
                          ...prev.trailing,
                          enabled: event.target.checked,
                        },
                      }))
                    }
                  />
                  Enable trailing stop
                </label>
                <input
                  type="number"
                  value={exitRules.trailing.distance}
                  onChange={(event) =>
                    setExitRules((prev) => ({
                      ...prev,
                      trailing: {
                        ...prev.trailing,
                        distance: Number(event.target.value) || 0,
                      },
                    }))
                  }
                  className="w-32 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={!exitRules.trailing.enabled}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Smart Exit Rules Section */}
        <Card>
          <CardHeader className="border-none pb-0">
            <CardTitle>Smart Exit Rules</CardTitle>
            <CardDescription>
              Advanced exit management with ATR, swing points, and partial exits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={smartExitEnabled}
                  onChange={(event) => setSmartExitEnabled(event.target.checked)}
                />
                Enable Smart Exit Rules
              </label>
              <p className="text-xs text-neutral-500 ml-6">
                Use intelligent exit strategies based on market structure and volatility
              </p>
            </div>

            {smartExitEnabled && (
              <>
                {/* Stop Loss Configuration */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-neutral-700">Smart Stop Loss</h4>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">Stop Loss Type</label>
                    <select
                      value={exitRules.smartExit?.stopLoss.type || 'fixed'}
                      onChange={(event) =>
                        setExitRules((prev) => ({
                          ...prev,
                          smartExit: {
                            ...prev.smartExit!,
                            stopLoss: {
                              ...prev.smartExit!.stopLoss,
                              type: event.target.value as SmartExitRules['stopLoss']['type']
                            }
                          }
                        }))
                      }
                      className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="fixed">Fixed Distance</option>
                      <option value="atr">ATR-based</option>
                      <option value="support">Support/Resistance</option>
                      <option value="trailing">Trailing Stop</option>
                    </select>
                  </div>

                  {exitRules.smartExit?.stopLoss.type === 'atr' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-700">ATR Multiplier</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        max="5"
                        value={exitRules.smartExit?.stopLoss.atrMultiplier || 2.0}
                        onChange={(event) =>
                          setExitRules((prev) => ({
                            ...prev,
                            smartExit: {
                              ...prev.smartExit!,
                              stopLoss: {
                                ...prev.smartExit!.stopLoss,
                                atrMultiplier: Number(event.target.value) || 2.0
                              }
                            }
                          }))
                        }
                        className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <p className="text-xs text-neutral-500">
                        Stop loss distance = ATR × multiplier (recommended: 1.5-3.0)
                      </p>
                    </div>
                  )}

                  {exitRules.smartExit?.stopLoss.type === 'support' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                          <input
                            type="checkbox"
                            checked={exitRules.smartExit?.stopLoss.useSwingPoints || false}
                            onChange={(event) =>
                              setExitRules((prev) => ({
                                ...prev,
                                smartExit: {
                                  ...prev.smartExit!,
                                  stopLoss: {
                                    ...prev.smartExit!.stopLoss,
                                    useSwingPoints: event.target.checked
                                  }
                                }
                              }))
                            }
                          />
                          Use Swing Points
                        </label>
                        <p className="text-xs text-neutral-500 ml-6">
                          Place stop loss at recent swing highs/lows
                        </p>
                      </div>

                      {exitRules.smartExit?.stopLoss.useSwingPoints && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-neutral-700">Swing Lookback</label>
                          <input
                            type="number"
                            min="5"
                            max="50"
                            value={exitRules.smartExit?.stopLoss.swingLookback || 10}
                            onChange={(event) =>
                              setExitRules((prev) => ({
                                ...prev,
                                smartExit: {
                                  ...prev.smartExit!,
                                  stopLoss: {
                                    ...prev.smartExit!.stopLoss,
                                    swingLookback: Number(event.target.value) || 10
                                  }
                                }
                              }))
                            }
                            className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <p className="text-xs text-neutral-500">
                            Number of swing points to analyze (recommended: 10-20)
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">Max Holding Time (hours)</label>
                    <input
                      type="number"
                      min="1"
                      max="168"
                      value={exitRules.smartExit?.stopLoss.maxHoldingHours || 24}
                      onChange={(event) =>
                        setExitRules((prev) => ({
                          ...prev,
                          smartExit: {
                            ...prev.smartExit!,
                            stopLoss: {
                              ...prev.smartExit!.stopLoss,
                              maxHoldingHours: Number(event.target.value) || 24
                            }
                          }
                        }))
                      }
                      className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <p className="text-xs text-neutral-500">
                      Automatically close position after this time (0 = disabled)
                    </p>
                  </div>
                </div>

                {/* Take Profit Configuration */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-neutral-700">Smart Take Profit</h4>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">Take Profit Type</label>
                    <select
                      value={exitRules.smartExit?.takeProfit.type || 'fixed'}
                      onChange={(event) =>
                        setExitRules((prev) => ({
                          ...prev,
                          smartExit: {
                            ...prev.smartExit!,
                            takeProfit: {
                              ...prev.smartExit!.takeProfit,
                              type: event.target.value as SmartExitRules['takeProfit']['type']
                            }
                          }
                        }))
                      }
                      className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="fixed">Fixed Distance</option>
                      <option value="rr_ratio">Risk-Reward Ratio</option>
                      <option value="resistance">Support/Resistance</option>
                      <option value="partial">Partial Exits</option>
                    </select>
                  </div>

                  {exitRules.smartExit?.takeProfit.type === 'rr_ratio' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-700">Risk-Reward Ratio</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="5"
                        value={exitRules.smartExit?.takeProfit.rrRatio || 2.0}
                        onChange={(event) =>
                          setExitRules((prev) => ({
                            ...prev,
                            smartExit: {
                              ...prev.smartExit!,
                              takeProfit: {
                                ...prev.smartExit!.takeProfit,
                                rrRatio: Number(event.target.value) || 2.0
                              }
                            }
                          }))
                        }
                        className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <p className="text-xs text-neutral-500">
                        Take profit distance = Stop loss distance × ratio (recommended: 1.5-3.0)
                      </p>
                    </div>
                  )}

                  {exitRules.smartExit?.takeProfit.type === 'partial' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-700">Partial Exit Levels</label>
                        <div className="space-y-2">
                          {exitRules.smartExit?.takeProfit.partialExits?.map((partial, index) => (
                            <div key={index} className="flex gap-2 items-center">
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={partial.percentage}
                                onChange={(event) =>
                                  setExitRules((prev) => ({
                                    ...prev,
                                    smartExit: {
                                      ...prev.smartExit!,
                                      takeProfit: {
                                        ...prev.smartExit!.takeProfit,
                                        partialExits: prev.smartExit!.takeProfit.partialExits?.map((p, i) =>
                                          i === index ? { ...p, percentage: Number(event.target.value) || 0 } : p
                                        )
                                      }
                                    }
                                  }))
                                }
                                className="w-20 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder="%"
                              />
                              <span className="text-sm text-neutral-600">at</span>
                              <input
                                type="number"
                                step="0.1"
                                min="0.5"
                                max="5"
                                value={partial.atRR}
                                onChange={(event) =>
                                  setExitRules((prev) => ({
                                    ...prev,
                                    smartExit: {
                                      ...prev.smartExit!,
                                      takeProfit: {
                                        ...prev.smartExit!.takeProfit,
                                        partialExits: prev.smartExit!.takeProfit.partialExits?.map((p, i) =>
                                          i === index ? { ...p, atRR: Number(event.target.value) || 1.0 } : p
                                        )
                                      }
                                    }
                                  }))
                                }
                                className="w-20 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder="RR"
                              />
                              <span className="text-sm text-neutral-600">:1</span>
                              <Button
                                type="button"
                                variant="secondary"
                                size="icon"
                                onClick={() =>
                                  setExitRules((prev) => ({
                                    ...prev,
                                    smartExit: {
                                      ...prev.smartExit!,
                                      takeProfit: {
                                        ...prev.smartExit!.takeProfit,
                                        partialExits: prev.smartExit!.takeProfit.partialExits?.filter((_, i) => i !== index)
                                      }
                                    }
                                  }))
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setExitRules((prev) => ({
                              ...prev,
                              smartExit: {
                                ...prev.smartExit!,
                                takeProfit: {
                                  ...prev.smartExit!.takeProfit,
                                  partialExits: [
                                    ...(prev.smartExit!.takeProfit.partialExits || []),
                                    { percentage: 25, atRR: 1.5 }
                                  ]
                                }
                              }
                            }))
                          }
                        >
                          <Plus className="h-4 w-4" /> Add Partial Exit
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900">
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 h-4 w-4" />
                    <div className="space-y-1">
                      <p className="font-medium">Smart Exit Benefits</p>
                      <ul className="text-xs space-y-1">
                        <li>• ATR-based stops adapt to market volatility</li>
                        <li>• Support/resistance levels use market structure</li>
                        <li>• Partial exits lock in profits progressively</li>
                        <li>• Risk-reward ratios ensure profitable trades</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Enhanced Partial Exit System */}
        <Card>
          <CardHeader className="border-none pb-0">
            <CardTitle>Enhanced Partial Exit System</CardTitle>
            <CardDescription>
              Advanced partial exit management with multiple triggers, dynamic adjustments, and performance tracking
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={enhancedPartialExitsEnabled}
                  onChange={(event) => setEnhancedPartialExitsEnabled(event.target.checked)}
                />
                Enable Enhanced Partial Exit System
              </label>
              <p className="text-xs text-neutral-500 ml-6">
                Use sophisticated partial exit strategies with multiple trigger types and dynamic adjustments
              </p>
            </div>

            {enhancedPartialExitsEnabled && (
              <>
                {/* Strategy Configuration */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-neutral-700">Exit Strategy</h4>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">Strategy Type</label>
                    <select
                      value={enhancedPartialExitsConfig.strategy}
                      onChange={(event) => updateEnhancedPartialExitsConfig('strategy', event.target.value)}
                      className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="sequential">Sequential (execute in order)</option>
                      <option value="parallel">Parallel (all conditions independent)</option>
                      <option value="conditional">Conditional (based on market conditions)</option>
                    </select>
                  </div>
                </div>

                {/* Partial Exit Levels */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-neutral-700">Partial Exit Levels</h4>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={addPartialExitLevel}
                    >
                      <Plus className="h-4 w-4" /> Add Level
                    </Button>
                  </div>

                  {enhancedPartialExitsConfig.levels.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-neutral-300 p-8 text-center text-neutral-600">
                      <Target className="h-6 w-6" />
                      <p className="text-sm">
                        No partial exit levels yet. Add your first level to begin.
                      </p>
                      <Button type="button" size="sm" onClick={addPartialExitLevel}>
                        <Plus className="h-4 w-4" /> Add Level
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {enhancedPartialExitsConfig.levels.map((level, index) => (
                        <div key={level.id} className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <input
                                type="text"
                                value={level.name}
                                onChange={(e) => updatePartialExitLevel(level.id, 'name', e.target.value)}
                                className="rounded-lg border border-neutral-300 px-3 py-1 text-sm font-medium focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder="Level name"
                              />
                              <span className="text-xs text-neutral-500">Priority: {level.priority}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="inline-flex items-center gap-1 text-xs">
                                <input
                                  type="checkbox"
                                  checked={level.isActive}
                                  onChange={(e) => updatePartialExitLevel(level.id, 'isActive', e.target.checked)}
                                />
                                Active
                              </label>
                              <Button
                                type="button"
                                variant="secondary"
                                size="icon"
                                onClick={() => removePartialExitLevel(level.id)}
                                aria-label="Remove level"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {/* Percentage */}
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-neutral-700">Exit Percentage (%)</label>
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={level.percentage}
                                onChange={(e) => updatePartialExitLevel(level.id, 'percentage', Number(e.target.value))}
                                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            </div>

                            {/* Trigger Type */}
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-neutral-700">Trigger Type</label>
                              <select
                                value={level.triggerType}
                                onChange={(e) => updatePartialExitLevel(level.id, 'triggerType', e.target.value)}
                                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                              >
                                <option value="profit">Profit Target</option>
                                <option value="time">Time-based</option>
                                <option value="price">Price Level</option>
                                <option value="atr">ATR-based</option>
                                <option value="trailing">Trailing</option>
                                <option value="regime">Market Regime</option>
                              </select>
                            </div>

                            {/* Priority */}
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-neutral-700">Priority</label>
                              <input
                                type="number"
                                min="1"
                                max="10"
                                value={level.priority}
                                onChange={(e) => updatePartialExitLevel(level.id, 'priority', Number(e.target.value))}
                                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            </div>
                          </div>

                          {/* Trigger-specific configuration */}
                          <div className="mt-4 space-y-3">
                            {level.triggerType === 'profit' && (
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                  <label className="text-sm font-medium text-neutral-700">Profit Type</label>
                                  <select
                                    value={level.profitTarget?.type || 'rr_ratio'}
                                    onChange={(e) => updatePartialExitLevel(level.id, 'profitTarget', {
                                      ...level.profitTarget,
                                      type: e.target.value
                                    })}
                                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                                  >
                                    <option value="pips">Pips</option>
                                    <option value="percentage">Percentage</option>
                                    <option value="rr_ratio">Risk-Reward Ratio</option>
                                    <option value="amount">Amount ($)</option>
                                  </select>
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-medium text-neutral-700">Value</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={level.profitTarget?.value || 1.5}
                                    onChange={(e) => updatePartialExitLevel(level.id, 'profitTarget', {
                                      ...level.profitTarget,
                                      value: Number(e.target.value)
                                    })}
                                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                                  />
                                </div>
                              </div>
                            )}

                            {level.triggerType === 'time' && (
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                  <label className="text-sm font-medium text-neutral-700">Time Type</label>
                                  <select
                                    value={level.timeTarget?.type || 'duration'}
                                    onChange={(e) => updatePartialExitLevel(level.id, 'timeTarget', {
                                      ...level.timeTarget,
                                      type: e.target.value
                                    })}
                                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                                  >
                                    <option value="duration">Duration (minutes)</option>
                                    <option value="specific_time">Specific Time</option>
                                    <option value="session_end">Session End</option>
                                  </select>
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-medium text-neutral-700">Value</label>
                                  <input
                                    type="text"
                                    value={level.timeTarget?.value || 60}
                                    onChange={(e) => updatePartialExitLevel(level.id, 'timeTarget', {
                                      ...level.timeTarget,
                                      value: e.target.value
                                    })}
                                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    placeholder={level.timeTarget?.type === 'specific_time' ? 'HH:mm' : 'minutes'}
                                  />
                                </div>
                              </div>
                            )}

                            {level.triggerType === 'atr' && (
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                  <label className="text-sm font-medium text-neutral-700">ATR Multiplier</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0.5"
                                    max="5"
                                    value={level.atrTarget?.multiplier || 2.0}
                                    onChange={(e) => updatePartialExitLevel(level.id, 'atrTarget', {
                                      ...level.atrTarget,
                                      multiplier: Number(e.target.value)
                                    })}
                                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-medium text-neutral-700">Direction</label>
                                  <select
                                    value={level.atrTarget?.direction || 'profit'}
                                    onChange={(e) => updatePartialExitLevel(level.id, 'atrTarget', {
                                      ...level.atrTarget,
                                      direction: e.target.value
                                    })}
                                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                                  >
                                    <option value="profit">Profit Direction</option>
                                    <option value="loss">Loss Direction</option>
                                  </select>
                                </div>
                              </div>
                            )}

                            {level.triggerType === 'trailing' && (
                              <div className="grid gap-3 sm:grid-cols-3">
                                <div className="space-y-2">
                                  <label className="text-sm font-medium text-neutral-700">Distance</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="1"
                                    value={level.trailingTarget?.distance || 20}
                                    onChange={(e) => updatePartialExitLevel(level.id, 'trailingTarget', {
                                      ...level.trailingTarget,
                                      distance: Number(e.target.value)
                                    })}
                                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-medium text-neutral-700">Distance Type</label>
                                  <select
                                    value={level.trailingTarget?.distanceType || 'pips'}
                                    onChange={(e) => updatePartialExitLevel(level.id, 'trailingTarget', {
                                      ...level.trailingTarget,
                                      distanceType: e.target.value
                                    })}
                                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                                  >
                                    <option value="pips">Pips</option>
                                    <option value="percentage">Percentage</option>
                                    <option value="atr">ATR</option>
                                  </select>
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-medium text-neutral-700">Activation Point</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0.5"
                                    value={level.trailingTarget?.activationPoint || 1.0}
                                    onChange={(e) => updatePartialExitLevel(level.id, 'trailingTarget', {
                                      ...level.trailingTarget,
                                      activationPoint: Number(e.target.value)
                                    })}
                                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                                  />
                                </div>
                              </div>
                            )}

                            {level.triggerType === 'regime' && (
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                  <label className="text-sm font-medium text-neutral-700">Target Regime</label>
                                  <select
                                    value={level.regimeTarget?.regime || 'ranging'}
                                    onChange={(e) => updatePartialExitLevel(level.id, 'regimeTarget', {
                                      ...level.regimeTarget,
                                      regime: e.target.value
                                    })}
                                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                                  >
                                    <option value="trending_up">Trending Up</option>
                                    <option value="trending_down">Trending Down</option>
                                    <option value="ranging">Ranging</option>
                                    <option value="volatile">Volatile</option>
                                  </select>
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-medium text-neutral-700">Min Confidence (%)</label>
                                  <input
                                    type="number"
                                    min="50"
                                    max="95"
                                    value={level.regimeTarget?.confidence || 70}
                                    onChange={(e) => updatePartialExitLevel(level.id, 'regimeTarget', {
                                      ...level.regimeTarget,
                                      confidence: Number(e.target.value)
                                    })}
                                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Description */}
                          <div className="mt-3">
                            <input
                              type="text"
                              value={level.description || ''}
                              onChange={(e) => updatePartialExitLevel(level.id, 'description', e.target.value)}
                              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                              placeholder="Optional description for this level"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Global Settings */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-neutral-700">Global Settings</h4>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-700">Min Remaining Position (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={enhancedPartialExitsConfig.globalSettings.minRemainingPosition}
                        onChange={(e) => updateEnhancedPartialExitsConfig('globalSettings', {
                          minRemainingPosition: Number(e.target.value)
                        })}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-700">Max Daily Partial Exits</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={enhancedPartialExitsConfig.globalSettings.maxDailyPartialExits}
                        onChange={(e) => updateEnhancedPartialExitsConfig('globalSettings', {
                          maxDailyPartialExits: Number(e.target.value)
                        })}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-700">Cooldown Period (minutes)</label>
                      <input
                        type="number"
                        min="0"
                        max="60"
                        value={enhancedPartialExitsConfig.globalSettings.cooldownPeriod}
                        onChange={(e) => updateEnhancedPartialExitsConfig('globalSettings', {
                          cooldownPeriod: Number(e.target.value)
                        })}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-700">Max Spread (%)</label>
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        max="0.01"
                        value={enhancedPartialExitsConfig.globalSettings.maxSpreadPercentage}
                        onChange={(e) => updateEnhancedPartialExitsConfig('globalSettings', {
                          maxSpreadPercentage: Number(e.target.value)
                        })}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          checked={enhancedPartialExitsConfig.globalSettings.allowReentry}
                          onChange={(e) => updateEnhancedPartialExitsConfig('globalSettings', {
                            allowReentry: e.target.checked
                          })}
                        />
                        Allow Re-entry
                      </label>

                      <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          checked={enhancedPartialExitsConfig.globalSettings.reduceInHighVolatility}
                          onChange={(e) => updateEnhancedPartialExitsConfig('globalSettings', {
                            reduceInHighVolatility: e.target.checked
                          })}
                        />
                        Reduce in High Volatility
                      </label>

                      <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          checked={enhancedPartialExitsConfig.globalSettings.adjustForSpread}
                          onChange={(e) => updateEnhancedPartialExitsConfig('globalSettings', {
                            adjustForSpread: e.target.checked
                          })}
                        />
                        Adjust for Spread
                      </label>

                      <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          checked={enhancedPartialExitsConfig.globalSettings.respectMarketSessions}
                          onChange={(e) => updateEnhancedPartialExitsConfig('globalSettings', {
                            respectMarketSessions: e.target.checked
                          })}
                        />
                        Respect Market Sessions
                      </label>

                      <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          checked={enhancedPartialExitsConfig.globalSettings.avoidNewsEvents}
                          onChange={(e) => updateEnhancedPartialExitsConfig('globalSettings', {
                            avoidNewsEvents: e.target.checked
                          })}
                        />
                        Avoid News Events
                      </label>
                    </div>
                  </div>
                </div>

                {/* Integration Settings */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-neutral-700">Integration Settings</h4>
                  
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={enhancedPartialExitsConfig.integration.withSmartExits}
                        onChange={(e) => updateEnhancedPartialExitsConfig('integration', {
                          withSmartExits: e.target.checked
                        })}
                      />
                      Integrate with Smart Exits
                    </label>

                    <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={enhancedPartialExitsConfig.integration.withTrailingStops}
                        onChange={(e) => updateEnhancedPartialExitsConfig('integration', {
                          withTrailingStops: e.target.checked
                        })}
                      />
                      Integrate with Trailing Stops
                    </label>

                    <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={enhancedPartialExitsConfig.integration.withRiskManagement}
                        onChange={(e) => updateEnhancedPartialExitsConfig('integration', {
                          withRiskManagement: e.target.checked
                        })}
                      />
                      Integrate with Risk Management
                    </label>

                    <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={enhancedPartialExitsConfig.integration.withRegimeDetection}
                        onChange={(e) => updateEnhancedPartialExitsConfig('integration', {
                          withRegimeDetection: e.target.checked
                        })}
                      />
                      Integrate with Regime Detection
                    </label>
                  </div>
                </div>

                <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900">
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 h-4 w-4" />
                    <div className="space-y-1">
                      <p className="font-medium">Enhanced Partial Exit Benefits</p>
                      <ul className="text-xs space-y-1">
                        <li>• Multiple trigger types for flexible exit strategies</li>
                        <li>• Dynamic adjustments based on market conditions</li>
                        <li>• Performance tracking and optimization</li>
                        <li>• Integration with existing trading systems</li>
                        <li>• Risk management through position sizing control</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-none pb-0">
            <CardTitle>Risk Management</CardTitle>
            <CardDescription>
              Control exposure and losses for better capital protection
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700">
                  Lot Size<span className="text-red-600"> *</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={riskManagement.lotSize}
                  onChange={(event) =>
                    setRiskManagement((prev) => ({
                      ...prev,
                      lotSize: Number(event.target.value) || 0,
                    }))
                  }
                  className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700">
                  Max Positions
                </label>
                <input
                  type="number"
                  value={riskManagement.maxPositions}
                  onChange={(event) =>
                    setRiskManagement((prev) => ({
                      ...prev,
                      maxPositions: Number(event.target.value) || 0,
                    }))
                  }
                  className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700">
                  Max Daily Loss ($)
                </label>
                <input
                  type="number"
                  value={riskManagement.maxDailyLoss}
                  onChange={(event) =>
                    setRiskManagement((prev) => ({
                      ...prev,
                      maxDailyLoss: Number(event.target.value) || 0,
                    }))
                  }
                  className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4" />
                <div className="space-y-1">
                  <p className="font-medium">Smart tip</p>
                  <p>
                    Keep your max daily loss under 2% of your account balance to
                    follow professional risk management rules.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-none pb-0">
            <CardTitle>Dynamic Risk Management (ATR-based)</CardTitle>
            <CardDescription>
              Advanced risk management using Average True Range for adaptive stop losses
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={dynamicRisk.useATRSizing}
                  onChange={(event) =>
                    setDynamicRisk((prev) => ({
                      ...prev,
                      useATRSizing: event.target.checked,
                    }))
                  }
                />
                Enable ATR-based position sizing
              </label>
              <p className="text-xs text-neutral-500 ml-6">
                Automatically adjust position size and stop loss based on market volatility
              </p>
            </div>

            {dynamicRisk.useATRSizing && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">
                      ATR Multiplier
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="3"
                      value={dynamicRisk.atrMultiplier}
                      onChange={(event) =>
                        setDynamicRisk((prev) => ({
                          ...prev,
                          atrMultiplier: Number(event.target.value) || 2.0,
                        }))
                      }
                      className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <p className="text-xs text-neutral-500">
                      Stop loss distance = ATR × multiplier (1-3x)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">
                      Risk Percentage (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="2"
                      value={dynamicRisk.riskPercentage}
                      onChange={(event) =>
                        setDynamicRisk((prev) => ({
                          ...prev,
                          riskPercentage: Number(event.target.value) || 1.5,
                        }))
                      }
                      className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <p className="text-xs text-neutral-500">
                      Risk per trade (0.5-2% of balance)
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={dynamicRisk.autoAdjustLotSize}
                      onChange={(event) =>
                        setDynamicRisk((prev) => ({
                          ...prev,
                          autoAdjustLotSize: event.target.checked,
                        }))
                      }
                    />
                    Auto-adjust lot size based on ATR
                  </label>
                  <p className="text-xs text-neutral-500 ml-6">
                    Reduce position size in high volatility conditions
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={dynamicRisk.reduceInHighVolatility}
                      onChange={(event) =>
                        setDynamicRisk((prev) => ({
                          ...prev,
                          reduceInHighVolatility: event.target.checked,
                        }))
                      }
                    />
                    Reduce risk in high volatility
                  </label>
                  <p className="text-xs text-neutral-500 ml-6">
                    Automatically reduce exposure when volatility exceeds threshold
                  </p>
                </div>

                {dynamicRisk.reduceInHighVolatility && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">
                      Volatility Threshold
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0.01"
                      max="0.05"
                      value={dynamicRisk.volatilityThreshold}
                      onChange={(event) =>
                        setDynamicRisk((prev) => ({
                          ...prev,
                          volatilityThreshold: Number(event.target.value) || 0.02,
                        }))
                      }
                      className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <p className="text-xs text-neutral-500">
                      ATR threshold for high volatility detection (0.01-0.05)
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4" />
                <div className="space-y-1">
                  <p className="font-medium">ATR-based Risk Management</p>
                  <p>
                    Uses Average True Range to dynamically adjust stop losses based on market volatility.
                    Higher volatility = wider stops, lower volatility = tighter stops.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-none pb-0">
            <CardTitle>Market Session Filter</CardTitle>
            <CardDescription>
              Optimize strategy performance by trading during specific market sessions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={sessionFilter.enabled}
                  onChange={(event) =>
                    setSessionFilter((prev) => ({
                      ...prev,
                      enabled: event.target.checked,
                    }))
                  }
                />
                Enable market session filtering
              </label>
              <p className="text-xs text-neutral-500 ml-6">
                Only generate signals during selected market sessions
              </p>
            </div>

            {sessionFilter.enabled && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-700">
                    Allowed Trading Sessions
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {Object.entries(MARKET_SESSIONS).map(([sessionName, sessionInfo]) => (
                      <label key={sessionName} className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={sessionFilter.allowedSessions.includes(sessionName as keyof typeof MARKET_SESSIONS)}
                          onChange={(event) => {
                            const session = sessionName as keyof typeof MARKET_SESSIONS;
                            if (event.target.checked) {
                              setSessionFilter((prev) => ({
                                ...prev,
                                allowedSessions: [...prev.allowedSessions, session],
                              }));
                            } else {
                              setSessionFilter((prev) => ({
                                ...prev,
                                allowedSessions: prev.allowedSessions.filter(s => s !== session),
                              }));
                            }
                          }}
                        />
                        <div>
                          <span className="font-medium capitalize">{sessionName}</span>
                          <span className="text-neutral-500 ml-1">
                            ({sessionInfo.start}-{sessionInfo.end} UTC)
                          </span>
                          <div className="text-xs text-neutral-500">
                            {sessionInfo.pairs.join(", ")}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={sessionFilter.useOptimalPairs}
                      onChange={(event) =>
                        setSessionFilter((prev) => ({
                          ...prev,
                          useOptimalPairs: event.target.checked,
                        }))
                      }
                    />
                    Only trade optimal pairs for each session
                  </label>
                  <p className="text-xs text-neutral-500 ml-6">
                    Restrict trading to pairs that perform best in each session
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-neutral-700">
                    Session Aggressiveness Multipliers
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm text-neutral-600">
                        Optimal Session/Pair
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="2.0"
                        value={sessionFilter.aggressivenessMultiplier.optimal}
                        onChange={(event) =>
                          setSessionFilter((prev) => ({
                            ...prev,
                            aggressivenessMultiplier: {
                              ...prev.aggressivenessMultiplier,
                              optimal: Number(event.target.value) || 1.2,
                            },
                          }))
                        }
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <p className="text-xs text-neutral-500">
                        Position size multiplier (0.5-2.0x)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm text-neutral-600">
                        Suboptimal Session/Pair
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="2.0"
                        value={sessionFilter.aggressivenessMultiplier.suboptimal}
                        onChange={(event) =>
                          setSessionFilter((prev) => ({
                            ...prev,
                            aggressivenessMultiplier: {
                              ...prev.aggressivenessMultiplier,
                              suboptimal: Number(event.target.value) || 0.8,
                            },
                          }))
                        }
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <p className="text-xs text-neutral-500">
                        Position size multiplier (0.5-2.0x)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 h-4 w-4" />
                    <div className="space-y-1">
                      <p className="font-medium">Current Market Status</p>
                      <div className="text-xs space-y-1">
                        <div>
                          Active Sessions: {getCurrentSession().join(", ") || "None"}
                        </div>
                        <div>
                          {formData.symbol} is {isOptimalTimeForPair(formData.symbol) ? "optimal" : "not optimal"} for current sessions
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4" />
                <div className="space-y-1">
                  <p className="font-medium">Market Session Benefits</p>
                  <p>
                    Trading during optimal sessions can improve win rates by 20-30%
                    due to higher liquidity and better price action.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Correlation Filter */}
        <Card>
          <CardHeader className="border-none pb-0">
            <CardTitle>Correlation-Based Filtering</CardTitle>
            <CardDescription>
              Avoid overexposure by filtering highly correlated currency pairs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={correlationFilter.enabled}
                  onChange={(event) =>
                    setCorrelationFilter((prev) => ({
                      ...prev,
                      enabled: event.target.checked,
                    }))
                  }
                />
                Enable correlation filtering
              </label>
              <p className="text-xs text-neutral-500 ml-6">
                Skip trading opportunities when pairs are highly correlated with existing positions
              </p>
            </div>

            {correlationFilter.enabled && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">
                      Maximum Correlation Threshold
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="1.0"
                      value={correlationFilter.maxCorrelation}
                      onChange={(event) =>
                        setCorrelationFilter((prev) => ({
                          ...prev,
                          maxCorrelation: Number(event.target.value) || 0.7,
                        }))
                      }
                      className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <p className="text-xs text-neutral-500">
                      Skip pairs with correlation above this threshold (0.1-1.0)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">
                      Lookback Period (days)
                    </label>
                    <input
                      type="number"
                      min="7"
                      max="365"
                      value={correlationFilter.lookbackPeriod}
                      onChange={(event) =>
                        setCorrelationFilter((prev) => ({
                          ...prev,
                          lookbackPeriod: Number(event.target.value) || 30,
                        }))
                      }
                      className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <p className="text-xs text-neutral-500">
                      Days of historical data for correlation calculation
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-700">
                    Analysis Timeframes
                  </label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {TIMEFRAMES.map((timeframe) => (
                      <label key={timeframe} className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={correlationFilter.timeframes.includes(timeframe)}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setCorrelationFilter((prev) => ({
                                ...prev,
                                timeframes: [...prev.timeframes, timeframe],
                              }));
                            } else {
                              setCorrelationFilter((prev) => ({
                                ...prev,
                                timeframes: prev.timeframes.filter(tf => tf !== timeframe),
                              }));
                            }
                          }}
                        />
                        {timeframe}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-neutral-500">
                    Select timeframes for correlation analysis
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-700">
                    Pairs to Monitor
                  </label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {SYMBOLS.filter(symbol => symbol !== formData.symbol).map((symbol) => (
                      <label key={symbol} className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={correlationFilter.checkPairs.includes(symbol)}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setCorrelationFilter((prev) => ({
                                ...prev,
                                checkPairs: [...prev.checkPairs, symbol],
                              }));
                            } else {
                              setCorrelationFilter((prev) => ({
                                ...prev,
                                checkPairs: prev.checkPairs.filter(pair => pair !== symbol),
                              }));
                            }
                          }}
                        />
                        {symbol}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-neutral-500">
                    Select pairs to check for correlation with {formData.symbol}
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-neutral-700">
                    Advanced Settings
                  </label>
                  
                  <div className="space-y-2">
                    <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={correlationFilter.skipHighlyCorrelated}
                        onChange={(event) =>
                          setCorrelationFilter((prev) => ({
                            ...prev,
                            skipHighlyCorrelated: event.target.checked,
                          }))
                        }
                      />
                      Skip highly correlated positions
                    </label>
                    <p className="text-xs text-neutral-500 ml-6">
                      Don't open new positions when highly correlated pairs already exist
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={correlationFilter.dynamicThreshold}
                        onChange={(event) =>
                          setCorrelationFilter((prev) => ({
                            ...prev,
                            dynamicThreshold: event.target.checked,
                          }))
                        }
                      />
                      Dynamic threshold adjustment
                    </label>
                    <p className="text-xs text-neutral-500 ml-6">
                      Adjust correlation threshold based on market volatility
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={correlationFilter.groupByCurrency}
                        onChange={(event) =>
                          setCorrelationFilter((prev) => ({
                            ...prev,
                            groupByCurrency: event.target.checked,
                          }))
                        }
                      />
                      Group by base currency
                    </label>
                    <p className="text-xs text-neutral-500 ml-6">
                      Group pairs by base currency (USD, EUR, GBP, etc.) for analysis
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">
                      Minimum Data Points
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="1000"
                      value={correlationFilter.minDataPoints}
                      onChange={(event) =>
                        setCorrelationFilter((prev) => ({
                          ...prev,
                          minDataPoints: Number(event.target.value) || 20,
                        }))
                      }
                      className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <p className="text-xs text-neutral-500">
                      Minimum data points required for valid correlation
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700">
                      Update Frequency (hours)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="168"
                      value={correlationFilter.updateFrequency}
                      onChange={(event) =>
                        setCorrelationFilter((prev) => ({
                          ...prev,
                          updateFrequency: Number(event.target.value) || 24,
                        }))
                      }
                      className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <p className="text-xs text-neutral-500">
                      Hours between correlation data updates
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900">
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 h-4 w-4" />
                    <div className="space-y-1">
                      <p className="font-medium">Correlation Filtering Benefits</p>
                      <ul className="text-xs space-y-1">
                        <li>• Reduces overexposure to correlated currency movements</li>
                        <li>• Improves portfolio diversification</li>
                        <li>• Helps manage risk during market stress</li>
                        <li>• Prevents multiple losses from correlated pairs</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Market Regime Detection */}
        <Card>
          <CardHeader className="border-none pb-0">
            <CardTitle>Market Regime Detection</CardTitle>
            <CardDescription>
              Automatically detect market conditions and adapt strategy parameters accordingly
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={regimeDetectionEnabled}
                  onChange={(event) => setRegimeDetectionEnabled(event.target.checked)}
                />
                Enable Market Regime Detection
              </label>
              <p className="text-xs text-neutral-500 ml-6">
                Automatically detect trending, ranging, and volatile market conditions
              </p>
            </div>

            {regimeDetectionEnabled && (
              <>
                {/* Current Regime Display */}
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-blue-900">Current Market Regime</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-lg font-semibold text-blue-700">
                          {currentRegime.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className="text-xs text-blue-600">
                          ({regimeConfidence}% confidence)
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowRegimePreview(!showRegimePreview)}
                    >
                      {showRegimePreview ? 'Hide' : 'Show'} Analysis
                    </Button>
                  </div>
                </div>

                {/* Detection Parameters */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-neutral-700">Detection Parameters</h4>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-700">Trend Period</label>
                      <input
                        type="number"
                        min="5"
                        max="100"
                        value={regimeDetectionConfig.trendPeriod}
                        onChange={(event) => setRegimeDetectionConfig(prev => ({
                          ...prev,
                          trendPeriod: Number(event.target.value) || 20
                        }))}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <p className="text-xs text-neutral-500">
                        Period for trend analysis (5-100)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-700">Trend Threshold</label>
                      <input
                        type="number"
                        step="0.001"
                        min="0.005"
                        max="0.1"
                        value={regimeDetectionConfig.trendThreshold}
                        onChange={(event) => setRegimeDetectionConfig(prev => ({
                          ...prev,
                          trendThreshold: Number(event.target.value) || 0.02
                        }))}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <p className="text-xs text-neutral-500">
                        Minimum price change for trend (0.005-0.1)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-700">Volatility Period</label>
                      <input
                        type="number"
                        min="5"
                        max="50"
                        value={regimeDetectionConfig.volatilityPeriod}
                        onChange={(event) => setRegimeDetectionConfig(prev => ({
                          ...prev,
                          volatilityPeriod: Number(event.target.value) || 14
                        }))}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <p className="text-xs text-neutral-500">
                        Period for volatility calculation (5-50)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-700">Volatility Threshold</label>
                      <input
                        type="number"
                        step="0.001"
                        min="0.005"
                        max="0.05"
                        value={regimeDetectionConfig.volatilityThreshold}
                        onChange={(event) => setRegimeDetectionConfig(prev => ({
                          ...prev,
                          volatilityThreshold: Number(event.target.value) || 0.015
                        }))}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <p className="text-xs text-neutral-500">
                        Volatility threshold for volatile regime (0.005-0.05)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-700">Range Period</label>
                      <input
                        type="number"
                        min="5"
                        max="100"
                        value={regimeDetectionConfig.rangePeriod}
                        onChange={(event) => setRegimeDetectionConfig(prev => ({
                          ...prev,
                          rangePeriod: Number(event.target.value) || 20
                        }))}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <p className="text-xs text-neutral-500">
                        Period for range detection (5-100)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-700">Range Threshold</label>
                      <input
                        type="number"
                        step="0.001"
                        min="0.005"
                        max="0.03"
                        value={regimeDetectionConfig.rangeThreshold}
                        onChange={(event) => setRegimeDetectionConfig(prev => ({
                          ...prev,
                          rangeThreshold: Number(event.target.value) || 0.01
                        }))}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <p className="text-xs text-neutral-500">
                        Price range threshold for ranging regime (0.005-0.03)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Multi-Timeframe Analysis */}
                <div className="space-y-3">
                  <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={regimeDetectionConfig.enableMTFAnalysis}
                      onChange={(event) => setRegimeDetectionConfig(prev => ({
                        ...prev,
                        enableMTFAnalysis: event.target.checked
                      }))}
                    />
                    Enable Multi-Timeframe Analysis
                  </label>
                  <p className="text-xs text-neutral-500 ml-6">
                    Analyze regime across multiple timeframes for better accuracy
                  </p>

                  {regimeDetectionConfig.enableMTFAnalysis && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-700">Primary Timeframe</label>
                        <select
                          value={regimeDetectionConfig.primaryTimeframe}
                          onChange={(event) => setRegimeDetectionConfig(prev => ({
                            ...prev,
                            primaryTimeframe: event.target.value
                          }))}
                          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          {TIMEFRAMES.map((tf) => (
                            <option key={tf} value={tf}>{tf}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-700">Confirmation Timeframes</label>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {TIMEFRAMES.filter(tf => tf !== regimeDetectionConfig.primaryTimeframe).map((tf) => (
                            <label key={tf} className="inline-flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={regimeDetectionConfig.confirmationTimeframes.includes(tf)}
                                onChange={(event) => {
                                  if (event.target.checked) {
                                    setRegimeDetectionConfig(prev => ({
                                      ...prev,
                                      confirmationTimeframes: [...prev.confirmationTimeframes, tf]
                                    }));
                                  } else {
                                    setRegimeDetectionConfig(prev => ({
                                      ...prev,
                                      confirmationTimeframes: prev.confirmationTimeframes.filter(t => t !== tf)
                                    }));
                                  }
                                }}
                              />
                              {tf}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Confidence Weights */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-neutral-700">Confidence Weights</h4>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-700">Trend Weight</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        value={regimeDetectionConfig.weightTrend}
                        onChange={(event) => setRegimeDetectionConfig(prev => ({
                          ...prev,
                          weightTrend: Number(event.target.value) || 0.4
                        }))}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-700">Volatility Weight</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        value={regimeDetectionConfig.weightVolatility}
                        onChange={(event) => setRegimeDetectionConfig(prev => ({
                          ...prev,
                          weightVolatility: Number(event.target.value) || 0.3
                        }))}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-700">Range Weight</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        value={regimeDetectionConfig.weightRange}
                        onChange={(event) => setRegimeDetectionConfig(prev => ({
                          ...prev,
                          weightRange: Number(event.target.value) || 0.3
                        }))}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-neutral-500">
                    Weights should sum to 1.0 for balanced detection
                  </p>
                </div>

                {/* Advanced Settings */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-neutral-700">Advanced Settings</h4>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-700">Minimum Confidence (%)</label>
                      <input
                        type="number"
                        min="50"
                        max="95"
                        value={regimeDetectionConfig.minConfidence}
                        onChange={(event) => setRegimeDetectionConfig(prev => ({
                          ...prev,
                          minConfidence: Number(event.target.value) || 70
                        }))}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-700">Lookback Period (days)</label>
                      <input
                        type="number"
                        min="7"
                        max="365"
                        value={regimeDetectionConfig.lookbackPeriod}
                        onChange={(event) => setRegimeDetectionConfig(prev => ({
                          ...prev,
                          lookbackPeriod: Number(event.target.value) || 30
                        }))}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-700">Update Frequency (minutes)</label>
                      <input
                        type="number"
                        min="5"
                        max="60"
                        value={regimeDetectionConfig.updateFrequency}
                        onChange={(event) => setRegimeDetectionConfig(prev => ({
                          ...prev,
                          updateFrequency: Number(event.target.value) || 15
                        }))}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-700">Minimum Data Points</label>
                      <input
                        type="number"
                        min="20"
                        max="500"
                        value={regimeDetectionConfig.minDataPoints}
                        onChange={(event) => setRegimeDetectionConfig(prev => ({
                          ...prev,
                          minDataPoints: Number(event.target.value) || 50
                        }))}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={regimeDetectionConfig.enableTransitionDetection}
                        onChange={(event) => setRegimeDetectionConfig(prev => ({
                          ...prev,
                          enableTransitionDetection: event.target.checked
                        }))}
                      />
                      Enable Regime Transition Detection
                    </label>
                    <p className="text-xs text-neutral-500 ml-6">
                      Detect and alert when market regime changes
                    </p>
                  </div>
                </div>

                {/* Regime Preview */}
                {showRegimePreview && (
                  <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                    <h4 className="text-sm font-medium text-purple-900 mb-3">Regime Analysis Preview</h4>
                    <div className="grid gap-3 text-xs">
                      <div className="flex justify-between">
                        <span className="text-purple-700">Trend Strength:</span>
                        <span className="font-medium">0.65</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-purple-700">Volatility Index:</span>
                        <span className="font-medium">0.42</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-purple-700">Range Bound:</span>
                        <span className="font-medium">0.28</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-purple-700">ADX:</span>
                        <span className="font-medium">23.5</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-purple-700">ATR:</span>
                        <span className="font-medium">0.0018</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 h-4 w-4" />
                    <div className="space-y-1">
                      <p className="font-medium">Market Regime Benefits</p>
                      <ul className="text-xs space-y-1">
                        <li>• Automatically adapts strategy to market conditions</li>
                        <li>• Reduces false signals in inappropriate markets</li>
                        <li>• Improves risk management per regime type</li>
                        <li>• Enhances overall strategy performance</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Advanced Position Sizing Calculator */}
        <Card>
          <CardHeader className="border-none pb-0">
            <CardTitle>Advanced Position Sizing Calculator</CardTitle>
            <CardDescription>
              Calculate optimal position sizes using multiple methods including ATR-based, volatility-based, and Kelly criterion
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={positionSizingEnabled}
                  onChange={(event) => setPositionSizingEnabled(event.target.checked)}
                />
                Enable Advanced Position Sizing
              </label>
              <p className="text-xs text-neutral-500 ml-6">
                Replace basic risk management with sophisticated position sizing algorithms
              </p>
            </div>

            {positionSizingEnabled && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-700">Position Sizing Method</label>
                  <select
                    value={positionSizingMethod}
                    onChange={(event) => {
                      const method = event.target.value as SizingMethod;
                      setPositionSizingMethod(method);
                      loadDefaultPositionSizingConfig(method);
                    }}
                    className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="fixed_lot">Fixed Lot Size</option>
                    <option value="percentage_risk">Percentage Risk</option>
                    <option value="atr_based">ATR-Based</option>
                    <option value="volatility_based">Volatility-Based</option>
                    <option value="kelly_criterion">Kelly Criterion</option>
                    <option value="account_equity">Account Equity</option>
                  </select>
                </div>

                {/* Method-specific configuration */}
                {positionSizingMethod === 'fixed_lot' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-neutral-700">Fixed Lot Configuration</h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-700">Lot Size</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={positionSizingConfig?.fixedLot?.lotSize || 0.1}
                          onChange={(event) => updatePositionSizingConfig('fixedLot', {
                            ...positionSizingConfig?.fixedLot,
                            lotSize: Number(event.target.value)
                          })}
                          className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-700">Max Positions</label>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={positionSizingConfig?.fixedLot?.maxPositions || 5}
                          onChange={(event) => updatePositionSizingConfig('fixedLot', {
                            ...positionSizingConfig?.fixedLot,
                            maxPositions: Number(event.target.value)
                          })}
                          className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {positionSizingMethod === 'percentage_risk' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-neutral-700">Percentage Risk Configuration</h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-700">Risk per Trade (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="5"
                          value={positionSizingConfig?.percentageRisk?.riskPercentage || 1.5}
                          onChange={(event) => updatePositionSizingConfig('percentageRisk', {
                            ...positionSizingConfig?.percentageRisk,
                            riskPercentage: Number(event.target.value)
                          })}
                          className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-700">Max Risk per Trade (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="10"
                          value={positionSizingConfig?.percentageRisk?.maxRiskPerTrade || 2.0}
                          onChange={(event) => updatePositionSizingConfig('percentageRisk', {
                            ...positionSizingConfig?.percentageRisk,
                            maxRiskPerTrade: Number(event.target.value)
                          })}
                          className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {positionSizingMethod === 'atr_based' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-neutral-700">ATR-Based Configuration</h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-700">ATR Multiplier</label>
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          max="5"
                          value={positionSizingConfig?.atrBased?.atrMultiplier || 2.0}
                          onChange={(event) => updatePositionSizingConfig('atrBased', {
                            ...positionSizingConfig?.atrBased,
                            atrMultiplier: Number(event.target.value)
                          })}
                          className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-700">Risk Percentage (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="5"
                          value={positionSizingConfig?.atrBased?.riskPercentage || 1.5}
                          onChange={(event) => updatePositionSizingConfig('atrBased', {
                            ...positionSizingConfig?.atrBased,
                            riskPercentage: Number(event.target.value)
                          })}
                          className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          checked={positionSizingConfig?.atrBased?.volatilityAdjustment || false}
                          onChange={(event) => updatePositionSizingConfig('atrBased', {
                            ...positionSizingConfig?.atrBased,
                            volatilityAdjustment: event.target.checked
                          })}
                        />
                        Enable Volatility Adjustment
                      </label>
                      <p className="text-xs text-neutral-500 ml-6">
                        Automatically reduce position size in high volatility conditions
                      </p>
                    </div>
                  </div>
                )}

                {positionSizingMethod === 'volatility_based' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-neutral-700">Volatility-Based Configuration</h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-700">Volatility Period</label>
                        <input
                          type="number"
                          min="5"
                          max="50"
                          value={positionSizingConfig?.volatilityBased?.volatilityPeriod || 14}
                          onChange={(event) => updatePositionSizingConfig('volatilityBased', {
                            ...positionSizingConfig?.volatilityBased,
                            volatilityPeriod: Number(event.target.value)
                          })}
                          className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-700">Volatility Multiplier</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.5"
                          max="5"
                          value={positionSizingConfig?.volatilityBased?.volatilityMultiplier || 2.0}
                          onChange={(event) => updatePositionSizingConfig('volatilityBased', {
                            ...positionSizingConfig?.volatilityBased,
                            volatilityMultiplier: Number(event.target.value)
                          })}
                          className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {positionSizingMethod === 'kelly_criterion' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-neutral-700">Kelly Criterion Configuration</h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-700">Win Rate (0-1)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={positionSizingConfig?.kellyCriterion?.winRate || 0.55}
                          onChange={(event) => updatePositionSizingConfig('kellyCriterion', {
                            ...positionSizingConfig?.kellyCriterion,
                            winRate: Number(event.target.value)
                          })}
                          className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-700">Kelly Fraction</label>
                        <input
                          type="number"
                          step="0.05"
                          min="0.1"
                          max="1"
                          value={positionSizingConfig?.kellyCriterion?.kellyFraction || 0.25}
                          onChange={(event) => updatePositionSizingConfig('kellyCriterion', {
                            ...positionSizingConfig?.kellyCriterion,
                            kellyFraction: Number(event.target.value)
                          })}
                          className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 h-4 w-4" />
                        <div className="space-y-1">
                          <p className="font-medium">Kelly Criterion Warning</p>
                          <p>
                            Kelly criterion requires accurate historical data. Use conservative fraction (0.25) to reduce risk.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {positionSizingMethod === 'account_equity' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-neutral-700">Account Equity Configuration</h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-700">Equity Percentage (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="5"
                          value={positionSizingConfig?.accountEquity?.equityPercentage || 1.5}
                          onChange={(event) => updatePositionSizingConfig('accountEquity', {
                            ...positionSizingConfig?.accountEquity,
                            equityPercentage: Number(event.target.value)
                          })}
                          className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-700">Max Drawdown (%)</label>
                        <input
                          type="number"
                          step="1"
                          min="5"
                          max="50"
                          value={positionSizingConfig?.accountEquity?.maxDrawdown || 20}
                          onChange={(event) => updatePositionSizingConfig('accountEquity', {
                            ...positionSizingConfig?.accountEquity,
                            maxDrawdown: Number(event.target.value)
                          })}
                          className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          checked={positionSizingConfig?.accountEquity?.drawdownAdjustment || false}
                          onChange={(event) => updatePositionSizingConfig('accountEquity', {
                            ...positionSizingConfig?.accountEquity,
                            drawdownAdjustment: event.target.checked
                          })}
                        />
                        Enable Drawdown Adjustment
                      </label>
                      <p className="text-xs text-neutral-500 ml-6">
                        Automatically reduce position size during drawdown periods
                      </p>
                    </div>
                  </div>
                )}

                {/* Preview Button */}
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => calculatePositionSizingPreview()}
                  >
                    <Target className="h-4 w-4" /> Calculate Preview
                  </Button>
                  {showPositionSizingPreview && positionSizingResult && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowPositionSizingPreview(false)}
                    >
                      Hide Preview
                    </Button>
                  )}
                </div>

                {/* Position Sizing Preview */}
                {showPositionSizingPreview && positionSizingResult && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
                    <div className="flex items-start gap-2">
                      <Target className="mt-0.5 h-4 w-4" />
                      <div className="space-y-2">
                        <p className="font-medium">Position Sizing Preview</p>
                        <div className="grid gap-2 text-xs">
                          <div className="flex justify-between">
                            <span>Position Size:</span>
                            <span className="font-medium">{positionSizingResult.positionSize.toFixed(2)} lots</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Risk Amount:</span>
                            <span className="font-medium">${positionSizingResult.riskAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Risk Percentage:</span>
                            <span className="font-medium">{positionSizingResult.riskPercentage.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Stop Loss:</span>
                            <span className="font-medium">{positionSizingResult.stopLossPrice.toFixed(5)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Confidence:</span>
                            <span className="font-medium">{positionSizingResult.confidence.toFixed(0)}%</span>
                          </div>
                        </div>
                        {positionSizingResult.warnings.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="font-medium text-yellow-800">Warnings:</p>
                            {positionSizingResult.warnings.map((warning, index) => (
                              <p key={index} className="text-yellow-700">• {warning}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 h-4 w-4" />
                    <div className="space-y-1">
                      <p className="font-medium">Advanced Position Sizing Benefits</p>
                      <ul className="text-xs space-y-1">
                        <li>• ATR-based sizing adapts to market volatility</li>
                        <li>• Kelly criterion optimizes for long-term growth</li>
                        <li>• Account equity sizing protects capital during drawdowns</li>
                        <li>• Volatility-based sizing reduces risk in turbulent markets</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Strategy Score Preview */}
      <Card>
        <CardHeader className="flex flex-col gap-2 border-none pb-0 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Strategy Performance Score</CardTitle>
            <CardDescription>
              Get an instant assessment of your strategy's potential performance
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => calculateStrategyScore()}
              disabled={scoreLoading || !formData.name || entryConditions.length === 0}
            >
              {scoreLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Target className="h-4 w-4" />
              )}
              {scoreLoading ? 'Calculating...' : 'Calculate Score'}
            </Button>
            {showStrategyScore && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowStrategyScore(false)}
              >
                Hide Score
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {!showStrategyScore ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-neutral-300 p-8 text-center text-neutral-600">
              <Target className="h-8 w-8" />
              <div>
                <p className="text-sm font-medium">Calculate Your Strategy Score</p>
                <p className="text-xs text-neutral-500 mt-1">
                  Get instant feedback on profitability, consistency, risk-adjusted returns, and drawdown control
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => calculateStrategyScore()}
                disabled={scoreLoading || !formData.name || entryConditions.length === 0}
              >
                {scoreLoading ? <LoadingSpinner size="sm" /> : <Target className="h-4 w-4 mr-2" />}
                Calculate Score
              </Button>
            </div>
          ) : strategyScore ? (
            <div className="space-y-4">
              {/* Simplified Score Preview */}
              <div className="rounded-lg border border-neutral-200 bg-white p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-neutral-900">Performance Score</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold text-blue-600">{strategyScore.overall}</span>
                    <span className="text-sm text-neutral-500">/100</span>
                  </div>
                </div>

                {/* Score Dimensions */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600">Profitability</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-neutral-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${strategyScore.profitability}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8">{strategyScore.profitability}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600">Consistency</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-neutral-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${strategyScore.consistency}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8">{strategyScore.consistency}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600">Risk-Adjusted</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-neutral-200 rounded-full h-2">
                        <div
                          className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${strategyScore.riskAdjusted}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8">{strategyScore.riskAdjusted}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600">Drawdown Control</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-neutral-200 rounded-full h-2">
                        <div
                          className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${strategyScore.drawdown}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8">{strategyScore.drawdown}</span>
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                {strategyScore.recommendations.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-neutral-700 mb-2">Recommendations</h4>
                    <div className="space-y-1">
                      {strategyScore.recommendations.slice(0, 3).map((recommendation, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                          <p className="text-xs text-neutral-600">{recommendation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {strategyScore.warnings.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-red-700 mb-2">Warnings</h4>
                    <div className="space-y-1">
                      {strategyScore.warnings.slice(0, 2).map((warning, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 flex-shrink-0" />
                          <p className="text-xs text-neutral-600">{warning}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4" />
                  <div className="space-y-1">
                    <p className="font-medium">Strategy Score Analysis</p>
                    <p className="text-xs">
                      This score is based on your strategy configuration and provides an estimate of potential performance.
                      Actual performance may vary based on market conditions and execution quality.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center p-8">
              <LoadingSpinner size="lg" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 border-t border-neutral-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <HelpCircle className="h-4 w-4" />
            Need help? Explore our strategy guide for proven setups.
          </div>
          <div className="flex items-center gap-3">
            {onCancelHref && (
              <Button type="button" variant="secondary" onClick={handleCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" loading={loading}>
              {submitLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
        </>
      )}
    </form>
  );
}

export function StrategyFormSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-56" />
      </div>

      <Card>
        <CardContent className="space-y-4">
          <Skeleton className="h-6 w-64" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="grid gap-3 sm:grid-cols-5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-10" />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex justify-end">
          <Button disabled>
            <LoadingSpinner size="sm" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
