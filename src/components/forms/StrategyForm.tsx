"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  AlertCircle,
  BookOpen,
  ChevronLeft,
  HelpCircle,
  Info,
  Plus,
  Shield,
  Target,
  Trash2,
  TrendingUp,
  Zap,
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

type StrategyMode = "simple" | "advanced" | "ai";

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
    conditions: Omit<StrategyCondition, "id">[];
    logic: "AND" | "OR";
  };
  exit: {
    takeProfit: { type: string; value: number };
    stopLoss: { type: string; value: number };
    trailing: { enabled: boolean; distance: number };
  };
  riskManagement: {
    lotSize: number;
    maxPositions: number;
    maxDailyLoss: number;
  };
}

export interface StrategyFormData {
  name: string;
  description: string;
  symbol: string;
  timeframe: string;
  type: string;
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
};

const DEFAULT_RISK_MANAGEMENT: StrategyRules["riskManagement"] = {
  lotSize: 0.1,
  maxPositions: 5,
  maxDailyLoss: 500,
};

const INDICATORS = [
  "RSI",
  "MACD",
  "EMA",
  "SMA",
  "ADX",
  "Bollinger Bands",
  "Stochastic",
];

const CONDITIONS: ConditionOperator[] = [
  "greater_than",
  "less_than",
  "equals",
  "crosses_above",
  "crosses_below",
];

const SYMBOLS = [
  // Major Forex Pairs
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "USDCHF",
  "AUDUSD",
  "USDCAD",
  "NZDUSD",

  // Cross Currency Pairs
  "EURJPY",
  "GBPJPY",
  "EURGBP",
  "AUDJPY",
  "EURAUD",
  "EURCHF",
  "AUDNZD",
  "NZDJPY",
  "GBPAUD",
  "GBPCAD",
  "GBPNZD",
  "AUDCAD",

  // Commodities
  "XAUUSD", // Gold
  "XAGUSD", // Silver
  "USOIL", // WTI Crude Oil
  "UKOIL", // Brent Crude Oil

  // Indices
  "US30", // Dow Jones
  "NAS100", // NASDAQ
  "SPX500", // S&P 500
  "UK100", // FTSE 100
  "GER40", // DAX
  "JPN225", // Nikkei

  // Crypto (if supported)
  "BTCUSD",
  "ETHUSD",
];

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
  mode: initialMode = "simple",
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
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(
    initialData?.selectedTemplateId ?? null,
  );
  const [showTemplates, setShowTemplates] = useState(mode === "simple");
  const [formData, setFormData] = useState<StrategyFormData>(
    initialData?.formData ?? DEFAULT_FORM_DATA,
  );
  const [entryConditions, setEntryConditions] = useState<StrategyCondition[]>(
    initialData?.conditions ?? [],
  );
  const [exitRules, setExitRules] = useState(DEFAULT_EXIT_RULES);
  const [riskManagement, setRiskManagement] = useState(DEFAULT_RISK_MANAGEMENT);
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

    const payload = {
      formData,
      rules: {
        entry: {
          conditions: entryConditions.map(({ id, ...condition }) => condition),
          logic: entryLogic,
        },
        exit: exitRules,
        riskManagement,
      },
    } satisfies Parameters<typeof onSubmit>[0];

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
    rules: any;
  }) => {
    // Store generated data and show preview
    setAIGeneratedData(data);
    setShowAIPreview(true);
    toast.success("Strategy generated! Review the preview below.");
  };

  const handleReviewStrategy = () => {
    if (!aiGeneratedData) return;

    // Populate fields with AI data
    populateFieldsFromAI(aiGeneratedData);

    // Switch to advanced mode
    setMode("advanced");

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

      // Extract parameters from rules structure if available
      const rulesData = aiGeneratedData.rules as any;
      const params = rulesData?.parameters || {};

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
          <div className="rounded-lg border border-neutral-200 bg-white p-1">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant={mode === "simple" ? "primary" : "secondary"}
                size="sm"
                className="shadow-none"
                onClick={() => {
                  setMode("simple");
                  setShowTemplates(true);
                  if (!selectedTemplate) {
                    setEntryConditions([]);
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Simple
                </div>
              </Button>
              <Button
                type="button"
                variant={mode === "advanced" ? "primary" : "secondary"}
                size="sm"
                className="shadow-none"
                onClick={() => setMode("advanced")}
              >
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Advanced
                </div>
              </Button>
              <Button
                type="button"
                variant={mode === "ai" ? "primary" : "secondary"}
                size="sm"
                className="shadow-none"
                onClick={() => setMode("ai")}
              >
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  AI
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

      {mode === "simple" && showTemplates && (
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
                <option value="automated">Automated</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

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
                        {indicator}
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
                    placeholder="Period"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 sm:w-28"
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
      </div>

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
