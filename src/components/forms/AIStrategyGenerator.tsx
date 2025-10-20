'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

interface AIStrategyGeneratorProps {
  onGenerate: (data: {
    name: string;
    description: string;
    rules: any;
    parameters: any;
  }) => void;
}

export function AIStrategyGenerator({ onGenerate }: AIStrategyGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<{ used: number; remaining: number; dailyLimit: number } | null>(null);
  
  // Fixed model - Grok (from OpenRouter)
  const AI_MODEL = 'x-ai/grok-4-fast';

  // Load usage info on mount
  useState(() => {
    fetch('/api/ai/generate-strategy-preview')
      .then(res => res.json())
      .then(data => {
        if (data.usage) setUsage(data.usage);
      })
      .catch(err => console.error('Failed to load usage info:', err));
  });

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please describe what strategy you want to create');
      return;
    }

    if (prompt.length < 10) {
      toast.error('Please provide a more detailed description (at least 10 characters)');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/ai/generate-strategy-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model: AI_MODEL,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === 'LIMIT_REACHED') {
          toast.error(data.error || 'Daily limit reached');
        } else if (data.code === 'SERVICE_UNAVAILABLE' || data.code === 'AUTH_ERROR') {
          toast.error('AI service is temporarily unavailable. Please try again later or contact support.');
        } else {
          toast.error(data.error || 'Failed to generate strategy');
        }
        return;
      }

      if (data.usage) {
        setUsage(data.usage);
      }

      // Convert AI-generated data to form format
      const strategy = data.strategy;
      onGenerate({
        name: strategy.name,
        description: strategy.description,
        symbol: strategy.symbol,
        timeframe: strategy.timeframe,
        rules: strategy.rules,
        parameters: strategy.parameters,
      });

      toast.success('Strategy generated! Review and customize it below.');
      setPrompt(''); // Clear prompt after successful generation
    } catch (error) {
      console.error('AI Generation error:', error);
      toast.error('An error occurred while generating strategy');
    } finally {
      setLoading(false);
    }
  };

  const promptExamples = [
    'Create a scalping strategy using RSI and MACD for EURUSD on 5-minute timeframe',
    'Build a trend-following strategy with EMA crossover and ADX filter for GBPUSD daily chart',
    'Generate a breakout strategy using Bollinger Bands with tight risk management',
    'Create a mean-reversion strategy using RSI oversold/overbought conditions',
  ];

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          <CardTitle>AI Strategy Generator</CardTitle>
        </div>
        <CardDescription>
          Describe your trading strategy idea and let AI create it for you
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Usage Info & AI Model */}
        <div className="rounded-lg bg-white border border-purple-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-neutral-700">Powered by Grok</span>
            </div>
            {usage && (
              <span className="text-sm font-semibold text-purple-600">
                {usage.remaining} / {usage.dailyLimit} remaining
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500">
            Using xAI's Grok 4 Fast model for fast and accurate strategy generation
          </p>
        </div>

        {/* Prompt Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-700">
            Describe Your Strategy <span className="text-red-600">*</span>
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Example: Create a trend-following strategy using 50 and 200 EMA crossover for EURUSD on H1 timeframe..."
            rows={4}
            className="w-full resize-none rounded-lg border border-neutral-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            disabled={loading}
            maxLength={1000}
          />
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>{prompt.length}/1000 characters</span>
            {prompt.length < 10 && prompt.length > 0 && (
              <span className="text-amber-600">Minimum 10 characters required</span>
            )}
          </div>
        </div>

        {/* Example Prompts */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-700">Example Prompts:</p>
          <div className="grid gap-2">
            {promptExamples.map((example, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setPrompt(example)}
                className="text-left rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                disabled={loading}
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={loading || prompt.length < 10 || (usage && usage.remaining === 0)}
          className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating Strategy...
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              Generate Strategy with AI
            </>
          )}
        </Button>

        {usage && usage.remaining === 0 && (
          <p className="text-sm text-center text-red-600">
            Daily AI generation limit reached. Try again tomorrow!
          </p>
        )}

        {/* Info Box */}
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
          <div className="space-y-1 text-sm text-purple-900">
            <p className="font-medium">💡 Tips for better results:</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>Be specific about indicators you want to use</li>
              <li>Mention the symbol and timeframe</li>
              <li>Describe your entry and exit criteria</li>
              <li>Include risk management preferences if you have any</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
