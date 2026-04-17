"use client";

import { useEffect, useState } from 'react';

interface ParticipantsCounterProps {
  count: number;
  label?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function ParticipantsCounter({
  count,
  label = 'wallets joined this battle',
  showIcon = true,
  size = 'md',
}: ParticipantsCounterProps) {
  const [displayCount, setDisplayCount] = useState(count);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Animate number change
    setIsAnimating(true);
    const timer = setTimeout(() => {
      setDisplayCount(count);
      setIsAnimating(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [count]);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Randomly add/remove 1-3 participants
      const change = Math.floor(Math.random() * 3) + 1;
      const shouldAdd = Math.random() > 0.4;
      
      setDisplayCount(prev => {
        const newCount = shouldAdd ? prev + change : Math.max(0, prev - change);
        return newCount;
      });
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-2',
    lg: 'text-base px-4 py-3',
  };

  return (
    <div className={`inline-flex items-center gap-2 bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-500/30 rounded-xl ${sizeClasses[size]} backdrop-blur-sm`}>
      {showIcon && (
        <div className="relative">
          <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-75"></div>
          <div className="relative w-2 h-2 bg-green-400 rounded-full"></div>
        </div>
      )}
      
      <div className="flex items-center gap-2">
        <span className={`font-bold ${
          size === 'sm' ? 'text-lg' : size === 'md' ? 'text-xl' : 'text-2xl'
        } ${isAnimating ? 'text-purple-400' : 'text-green-400'} transition-colors`}>
          {displayCount.toLocaleString()}
        </span>
        <span className="text-gray-400 text-xs sm:text-sm">{label}</span>
      </div>

      {/* Animated Pulse Rings */}
      <div className="absolute inset-0 border border-purple-500/30 rounded-xl animate-ping opacity-20"></div>
    </div>
  );
}
