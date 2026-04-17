"use client";

import { useEffect, useState } from 'react';

const loadingMessages = [
  "Initializing battle...",
  "Syncing market data...",
  "Preparing next round...",
  "Connecting to Solana...",
  "Loading token prices...",
];

export default function LoadingState() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [dots, setDots] = useState("");

  useEffect(() => {
    const msgInterval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % loadingMessages.length);
    }, 2000);

    const dotInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? "" : prev + ".");
    }, 500);

    return () => {
      clearInterval(msgInterval);
      clearInterval(dotInterval);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-gray-950/95 backdrop-blur-sm flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <div className="text-cyan-400 font-bold text-lg">
          {loadingMessages[messageIndex]}<span className="animate-pulse">{dots}</span>
        </div>
        <div className="text-gray-400 text-xs mt-2">Please wait...</div>
      </div>
    </div>
  );
}
