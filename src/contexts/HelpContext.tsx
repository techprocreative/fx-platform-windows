'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface HelpTopic {
  id: string;
  title: string;
  content: string;
  category: string;
  tags?: string[];
  videoUrl?: string;
  relatedTopics?: string[];
}

interface HelpTutorial {
  id: string;
  title: string;
  description: string;
  steps: TutorialStep[];
  estimatedTime: number; // in minutes
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

interface TutorialStep {
  id: string;
  title: string;
  content: string;
  action?: {
    type: 'click' | 'navigate' | 'input' | 'wait';
    selector?: string;
    value?: string;
    url?: string;
    delay?: number;
  };
  imageUrl?: string;
  videoUrl?: string;
}

interface HelpContextType {
  // Help content
  helpTopics: HelpTopic[];
  tutorials: HelpTutorial[];
  
  // Current state
  isHelpOpen: boolean;
  currentTopic: HelpTopic | null;
  currentTutorial: HelpTutorial | null;
  currentStepIndex: number;
  searchQuery: string;
  
  // Actions
  openHelp: () => void;
  closeHelp: () => void;
  showTopic: (topicId: string) => void;
  showTutorial: (tutorialId: string) => void;
  nextStep: () => void;
  previousStep: () => void;
  searchHelp: (query: string) => void;
  getContextualHelp: (context: string) => HelpTopic[];
  
  // Interactive help
  startInteractiveTutorial: (tutorialId: string) => void;
  stopInteractiveTutorial: () => void;
  executeTutorialStep: (step: TutorialStep) => Promise<void>;
}

const HelpContext = createContext<HelpContextType | undefined>(undefined);

// Sample help data
const sampleHelpTopics: HelpTopic[] = [
  {
    id: 'getting-started',
    title: 'Getting Started with NexusTrade',
    content: 'Learn the basics of NexusTrade platform and how to navigate through the interface.',
    category: 'Getting Started',
    tags: ['beginner', 'navigation', 'interface'],
    relatedTopics: ['dashboard-overview', 'first-strategy'],
  },
  {
    id: 'dashboard-overview',
    title: 'Dashboard Overview',
    content: 'Understand the main dashboard components and how to interpret the data displayed.',
    category: 'Dashboard',
    tags: ['dashboard', 'metrics', 'overview'],
    relatedTopics: ['getting-started', 'performance-metrics'],
  },
  {
    id: 'creating-strategies',
    title: 'Creating Trading Strategies',
    content: 'Step-by-step guide on how to create your first trading strategy using our AI-powered generator.',
    category: 'Strategies',
    tags: ['strategies', 'AI', 'creation'],
    videoUrl: 'https://example.com/strategy-creation-video',
    relatedTopics: ['backtesting', 'strategy-optimization'],
  },
  {
    id: 'backtesting',
    title: 'Backtesting Your Strategies',
    content: 'Learn how to test your strategies against historical data to evaluate their performance.',
    category: 'Backtesting',
    tags: ['backtesting', 'testing', 'performance'],
    relatedTopics: ['creating-strategies', 'analyzing-results'],
  },
  {
    id: 'risk-management',
    title: 'Risk Management Best Practices',
    content: 'Essential risk management techniques to protect your capital while trading.',
    category: 'Risk Management',
    tags: ['risk', 'management', 'safety'],
    relatedTopics: ['position-sizing', 'stop-loss'],
  },
];

const sampleTutorials: HelpTutorial[] = [
  {
    id: 'first-strategy-tutorial',
    title: 'Create Your First Strategy',
    description: 'A step-by-step tutorial to create and test your first trading strategy.',
    estimatedTime: 10,
    category: 'Getting Started',
    difficulty: 'beginner',
    steps: [
      {
        id: 'step-1',
        title: 'Navigate to Strategies',
        content: 'Click on the "Strategies" menu item in the sidebar to access the strategies page.',
        action: {
          type: 'navigate',
          url: '/dashboard/strategies',
        },
      },
      {
        id: 'step-2',
        title: 'Create New Strategy',
        content: 'Click the "Create Strategy" button to start building your new trading strategy.',
        action: {
          type: 'click',
          selector: '[data-testid="create-strategy-button"]',
        },
      },
      {
        id: 'step-3',
        title: 'Configure Strategy Parameters',
        content: 'Fill in the strategy details including name, description, and trading parameters.',
        action: {
          type: 'input',
          selector: '[data-testid="strategy-name"]',
          value: 'My First Strategy',
        },
      },
      {
        id: 'step-4',
        title: 'Generate with AI',
        content: 'Use our AI-powered generator to create strategy logic based on your preferences.',
        action: {
          type: 'click',
          selector: '[data-testid="ai-generate-button"]',
        },
      },
    ],
  },
  {
    id: 'backtesting-tutorial',
    title: 'Run Your First Backtest',
    description: 'Learn how to run a backtest to evaluate your strategy performance.',
    estimatedTime: 8,
    category: 'Backtesting',
    difficulty: 'beginner',
    steps: [
      {
        id: 'step-1',
        title: 'Select Strategy',
        content: 'Choose the strategy you want to test from your strategies list.',
        action: {
          type: 'navigate',
          url: '/dashboard/strategies',
        },
      },
      {
        id: 'step-2',
        title: 'Start Backtest',
        content: 'Click the "Backtest" button to begin testing your strategy.',
        action: {
          type: 'click',
          selector: '[data-testid="backtest-button"]',
        },
      },
      {
        id: 'step-3',
        title: 'Configure Parameters',
        content: 'Set your backtest parameters including date range and initial capital.',
        action: {
          type: 'input',
          selector: '[data-testid="backtest-capital"]',
          value: '10000',
        },
      },
      {
        id: 'step-4',
        title: 'Run Test',
        content: 'Start the backtest and wait for the results to be generated.',
        action: {
          type: 'click',
          selector: '[data-testid="run-backtest-button"]',
        },
      },
    ],
  },
];

export function HelpProvider({ children }: { children: ReactNode }) {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [currentTopic, setCurrentTopic] = useState<HelpTopic | null>(null);
  const [currentTutorial, setCurrentTutorial] = useState<HelpTutorial | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [helpTopics] = useState<HelpTopic[]>(sampleHelpTopics);
  const [tutorials] = useState<HelpTutorial[]>(sampleTutorials);

  const openHelp = useCallback(() => {
    setIsHelpOpen(true);
  }, []);

  const closeHelp = useCallback(() => {
    setIsHelpOpen(false);
    setCurrentTopic(null);
    setCurrentTutorial(null);
    setCurrentStepIndex(0);
  }, []);

  const showTopic = useCallback((topicId: string) => {
    const topic = helpTopics.find(t => t.id === topicId);
    if (topic) {
      setCurrentTopic(topic);
      setCurrentTutorial(null);
      setIsHelpOpen(true);
    }
  }, [helpTopics]);

  const showTutorial = useCallback((tutorialId: string) => {
    const tutorial = tutorials.find(t => t.id === tutorialId);
    if (tutorial) {
      setCurrentTutorial(tutorial);
      setCurrentTopic(null);
      setCurrentStepIndex(0);
      setIsHelpOpen(true);
    }
  }, [tutorials]);

  const nextStep = useCallback(() => {
    if (currentTutorial && currentStepIndex < currentTutorial.steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  }, [currentTutorial, currentStepIndex]);

  const previousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  const searchHelp = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const getContextualHelp = useCallback((context: string): HelpTopic[] => {
    return helpTopics.filter(topic => 
      topic.tags?.some(tag => 
        context.toLowerCase().includes(tag.toLowerCase()) ||
        tag.toLowerCase().includes(context.toLowerCase())
      ) ||
      topic.category.toLowerCase().includes(context.toLowerCase()) ||
      topic.title.toLowerCase().includes(context.toLowerCase())
    );
  }, [helpTopics]);

  const startInteractiveTutorial = useCallback((tutorialId: string) => {
    showTutorial(tutorialId);
  }, [showTutorial]);

  const stopInteractiveTutorial = useCallback(() => {
    setCurrentTutorial(null);
    setCurrentStepIndex(0);
  }, []);

  const executeTutorialStep = useCallback(async (step: TutorialStep) => {
    const action = step.action;
    if (!action) return;

    switch (action.type) {
      case 'navigate':
        if (action.url) {
          window.location.href = action.url;
        }
        break;
      
      case 'click':
        if (action.selector) {
          const element = document.querySelector(action.selector);
          if (element instanceof HTMLElement) {
            element.click();
          }
        }
        break;
      
      case 'input':
        if (action.selector && action.value) {
          const element = document.querySelector(action.selector) as HTMLInputElement;
          if (element) {
            element.value = action.value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
        break;
      
      case 'wait':
        if (action.delay) {
          await new Promise(resolve => setTimeout(resolve, action.delay));
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        break;
    }
  }, []);

  const value: HelpContextType = {
    helpTopics,
    tutorials,
    isHelpOpen,
    currentTopic,
    currentTutorial,
    currentStepIndex,
    searchQuery,
    openHelp,
    closeHelp,
    showTopic,
    showTutorial,
    nextStep,
    previousStep,
    searchHelp,
    getContextualHelp,
    startInteractiveTutorial,
    stopInteractiveTutorial,
    executeTutorialStep,
  };

  return (
    <HelpContext.Provider value={value}>
      {children}
    </HelpContext.Provider>
  );
}

export function useHelp() {
  const context = useContext(HelpContext);
  if (context === undefined) {
    throw new Error('useHelp must be used within a HelpProvider');
  }
  return context;
}