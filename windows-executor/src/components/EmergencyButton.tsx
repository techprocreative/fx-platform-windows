import React, { useState } from 'react';

interface EmergencyButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function EmergencyButton({ onClick, disabled = false, className = '' }: EmergencyButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const handleMouseDown = () => {
    if (disabled) return;
    
    setIsPressed(true);
    setCountdown(3);
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    const timeout = setTimeout(() => {
      clearInterval(timer);
      setIsPressed(false);
      setCountdown(0);
      onClick();
    }, 3000);
    
    // Cleanup if mouse is released early
    const handleMouseUp = () => {
      clearTimeout(timeout);
      clearInterval(timer);
      setIsPressed(false);
      setCountdown(0);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <button
      onMouseDown={handleMouseDown}
      disabled={disabled}
      className={`relative overflow-hidden transition-all duration-200 ${
        isPressed 
          ? 'bg-danger-700 text-white scale-95' 
          : 'bg-danger-600 text-white hover:bg-danger-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className} px-4 py-2 rounded-md font-medium shadow-sm`}
    >
      {isPressed ? (
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{countdown}</span>
        </div>
      ) : (
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Emergency Stop</span>
        </div>
      )}
      
      {isPressed && (
        <div className="absolute inset-0 bg-danger-600 opacity-50 animate-pulse"></div>
      )}
    </button>
  );
}