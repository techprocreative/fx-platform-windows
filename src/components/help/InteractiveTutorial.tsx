'use client';

import { useHelp } from '@/contexts/HelpContext';
import { useState, useEffect } from 'react';
import { X, ArrowLeft, ArrowRight, Play, Pause, CheckCircle, Circle } from 'lucide-react';

export function InteractiveTutorial() {
  const { 
    currentTutorial, 
    currentStepIndex, 
    nextStep, 
    previousStep, 
    stopInteractiveTutorial,
    executeTutorialStep 
  } = useHelp();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [highlightedElement, setHighlightedElement] = useState<Element | null>(null);

  const currentStep = currentTutorial?.steps[currentStepIndex];
  const progress = currentTutorial ? ((currentStepIndex + 1) / currentTutorial.steps.length) * 100 : 0;

  useEffect(() => {
    if (currentStep?.action?.selector) {
      const element = document.querySelector(currentStep.action.selector);
      setHighlightedElement(element);
      
      // Add highlight styles
      if (element) {
        element.classList.add('tutorial-highlight');
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      setHighlightedElement(null);
    }

    return () => {
      // Clean up highlight styles
      if (highlightedElement) {
        highlightedElement.classList.remove('tutorial-highlight');
      }
    };
  }, [currentStep, highlightedElement]);

  const handleNextStep = async () => {
    if (currentStep && isPlaying) {
      await executeTutorialStep(currentStep);
    }
    nextStep();
  };

  const handlePreviousStep = () => {
    previousStep();
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleStepAction = async () => {
    if (currentStep) {
      await executeTutorialStep(currentStep);
    }
  };

  if (!currentTutorial) return null;

  return (
    <>
      {/* Tutorial Overlay */}
      <div className="fixed inset-0 z-50 bg-black/50">
        {/* Highlight Overlay */}
        {highlightedElement && (
          <div className="absolute inset-0 pointer-events-none">
            <HighlightOverlay element={highlightedElement} />
          </div>
        )}
      </div>

      {/* Tutorial Panel */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-primary shadow-2xl border-t border-primary">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-primary">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-primary">
                {currentTutorial.title}
              </h2>
              <span className="text-sm text-tertiary">
                Step {currentStepIndex + 1} of {currentTutorial.steps.length}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handlePlayPause}
                className="p-2 rounded-lg hover:bg-secondary transition-colors"
                aria-label={isPlaying ? 'Pause tutorial' : 'Play tutorial'}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5 text-secondary" />
                ) : (
                  <Play className="h-5 w-5 text-secondary" />
                )}
              </button>
              
              <button
                onClick={stopInteractiveTutorial}
                className="p-2 rounded-lg hover:bg-secondary transition-colors"
                aria-label="Close tutorial"
              >
                <X className="h-5 w-5 text-secondary" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-1 bg-secondary">
            <div 
              className="h-full bg-primary-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Step Info */}
              <div className="lg:col-span-2">
                <h3 className="text-xl font-semibold text-primary mb-3">
                  {currentStep?.title}
                </h3>
                
                <div className="text-secondary mb-4 leading-relaxed">
                  {currentStep?.content}
                </div>

                {/* Action Button */}
                {currentStep?.action && (
                  <button
                    onClick={handleStepAction}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Execute Step
                  </button>
                )}

                {/* Media */}
                {currentStep?.imageUrl && (
                  <div className="mt-4">
                    <img 
                      src={currentStep.imageUrl} 
                      alt={currentStep.title}
                      className="rounded-lg border border-secondary max-w-full"
                    />
                  </div>
                )}

                {currentStep?.videoUrl && (
                  <div className="mt-4">
                    <video 
                      src={currentStep.videoUrl}
                      controls
                      className="rounded-lg border border-secondary max-w-full"
                    />
                  </div>
                )}
              </div>

              {/* Step List */}
              <div>
                <h4 className="text-sm font-medium text-secondary mb-3">Tutorial Steps</h4>
                <div className="space-y-2">
                  {currentTutorial.steps.map((step, index) => (
                    <div
                      key={step.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border ${
                        index === currentStepIndex
                          ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                          : index < currentStepIndex
                          ? 'border-green-600 bg-green-50 dark:bg-green-900/20'
                          : 'border-secondary'
                      }`}
                    >
                      <div className="mt-0.5">
                        {index < currentStepIndex ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : index === currentStepIndex ? (
                          <Circle className="h-4 w-4 text-primary-600" />
                        ) : (
                          <Circle className="h-4 w-4 text-tertiary" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h5 className="text-sm font-medium text-primary">
                          {step.title}
                        </h5>
                        {index === currentStepIndex && (
                          <p className="text-xs text-tertiary mt-1">
                            {step.content.substring(0, 100)}...
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between p-4 border-t border-primary">
            <button
              onClick={handlePreviousStep}
              disabled={currentStepIndex === 0}
              className="flex items-center gap-2 px-4 py-2 text-secondary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </button>

            <div className="text-sm text-tertiary">
              {currentTutorial.estimatedTime} min estimated
            </div>

            <button
              onClick={handleNextStep}
              disabled={currentStepIndex === currentTutorial.steps.length - 1}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tutorial Styles */}
      <style jsx>{`
        .tutorial-highlight {
          position: relative;
          z-index: 51;
          box-shadow: 0 0 0 4px rgb(59 130 246), 0 0 0 8px rgb(59 130 246 / 0.2);
          border-radius: 4px;
          animation: pulse-highlight 2s infinite;
        }

        @keyframes pulse-highlight {
          0%, 100% {
            box-shadow: 0 0 0 4px rgb(59 130 246), 0 0 0 8px rgb(59 130 246 / 0.2);
          }
          50% {
            box-shadow: 0 0 0 4px rgb(59 130 246), 0 0 0 12px rgb(59 130 246 / 0.1);
          }
        }
      `}</style>
    </>
  );
}

interface HighlightOverlayProps {
  element: Element;
}

function HighlightOverlay({ element }: HighlightOverlayProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const updateRect = () => {
      setRect(element.getBoundingClientRect());
    };

    updateRect();
    
    const resizeObserver = new ResizeObserver(updateRect);
    resizeObserver.observe(element);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [element]);

  if (!rect) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%' }}
    >
      <defs>
        <mask id="highlight-mask">
          <rect x="0" y="0" width="100%" height="100%" fill="black" />
          <rect
            x={rect.left - 8}
            y={rect.top - 8}
            width={rect.width + 16}
            height={rect.height + 16}
            fill="white"
            rx="8"
          />
        </mask>
      </defs>
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="black"
        fillOpacity="0.5"
        mask="url(#highlight-mask)"
      />
    </svg>
  );
}