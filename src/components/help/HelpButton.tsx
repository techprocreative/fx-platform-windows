'use client';

import { useHelp } from '@/contexts/HelpContext';
import { HelpCircle, X, BookOpen, Video } from 'lucide-react';
import { useState } from 'react';

export function HelpButton() {
  const { openHelp, isHelpOpen, closeHelp } = useHelp();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      <button
        onClick={openHelp}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        aria-label="Get help"
      >
        <HelpCircle className="h-6 w-6" />
        
        {/* Tooltip */}
        {isHovered && (
          <div className="absolute bottom-full mb-2 right-0 bg-gray-900 text-white text-sm px-3 py-2 rounded-lg whitespace-nowrap">
            Need help? Click here!
            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        )}
      </button>

      {/* Quick Help Panel */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={closeHelp}
          />
          
          {/* Help Panel */}
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-primary shadow-xl">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-primary">
                <div className="flex items-center gap-3">
                  <HelpCircle className="h-6 w-6 text-primary-600" />
                  <h2 className="text-xl font-semibold text-primary">Help Center</h2>
                </div>
                <button
                  onClick={closeHelp}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors"
                  aria-label="Close help"
                >
                  <X className="h-5 w-5 text-secondary" />
                </button>
              </div>

              {/* Quick Actions */}
              <div className="p-6 border-b border-primary">
                <h3 className="text-sm font-medium text-secondary mb-3">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-2">
                  <QuickActionCard
                    icon={BookOpen}
                    title="Browse Guides"
                    description="View all help topics"
                    onClick={() => {/* Navigate to help topics */}}
                  />
                  <QuickActionCard
                    icon={Video}
                    title="Video Tutorials"
                    description="Watch step-by-step guides"
                    onClick={() => {/* Navigate to videos */}}
                  />
                </div>
              </div>

              {/* Search */}
              <div className="p-6 border-b border-primary">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search for help..."
                    className="w-full px-4 py-2 pl-10 border border-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <HelpCircle className="absolute left-3 top-2.5 h-5 w-5 text-tertiary" />
                </div>
              </div>

              {/* Popular Topics */}
              <div className="flex-1 overflow-auto p-6">
                <h3 className="text-sm font-medium text-secondary mb-3">Popular Topics</h3>
                <div className="space-y-2">
                  <HelpTopicItem
                    title="Getting Started"
                    category="Beginner"
                    onClick={() => {/* Show getting started topic */}}
                  />
                  <HelpTopicItem
                    title="Creating Strategies"
                    category="Strategies"
                    onClick={() => {/* Show strategies topic */}}
                  />
                  <HelpTopicItem
                    title="Running Backtests"
                    category="Backtesting"
                    onClick={() => {/* Show backtesting topic */}}
                  />
                  <HelpTopicItem
                    title="Risk Management"
                    category="Safety"
                    onClick={() => {/* Show risk management topic */}}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-primary">
                <div className="flex items-center justify-between text-sm text-tertiary">
                  <span>Still need help?</span>
                  <button className="text-primary-600 hover:text-primary-700 font-medium">
                    Contact Support
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface QuickActionCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
}

function QuickActionCard({ icon: Icon, title, description, onClick }: QuickActionCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center p-4 border border-secondary rounded-lg hover:bg-secondary transition-colors text-left"
    >
      <Icon className="h-8 w-8 text-primary-600 mb-2" />
      <h4 className="text-sm font-medium text-primary">{title}</h4>
      <p className="text-xs text-tertiary mt-1">{description}</p>
    </button>
  );
}

interface HelpTopicItemProps {
  title: string;
  category: string;
  onClick: () => void;
}

function HelpTopicItem({ title, category, onClick }: HelpTopicItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-3 text-left border border-secondary rounded-lg hover:bg-secondary transition-colors"
    >
      <div>
        <h4 className="text-sm font-medium text-primary">{title}</h4>
        <p className="text-xs text-tertiary">{category}</p>
      </div>
      <div className="text-primary-600">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}