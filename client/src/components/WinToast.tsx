// ========== FILE: components/WinToast.tsx - ENHANCED ==========
"use client";

import React from 'react';

interface WinToastProps {
  message: string;
  amount: number;
  onClose: () => void;
  streak?: number;
}

export default function WinToast({ message, amount, onClose, streak }: WinToastProps) {
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-6 py-4 bg-gradient-to-r from-green-600/90 to-emerald-600/90 border-2 border-green-500/50 rounded-2xl shadow-2xl shadow-green-500/30 animate-slide-up">
      <div className="text-center">
        <div className="text-3xl mb-2">🎉</div>
        <p className="text-lg font-bold text-white">{message}</p>
        <p className="text-2xl font-black text-green-300">+{amount.toFixed(2)} SOL</p>
        {streak && streak > 1 && (
          <div className="mt-2 flex items-center justify-center gap-2 text-orange-400">
            <span>🔥</span>
            <span className="text-sm font-bold">Streak: {streak}</span>
          </div>
        )}
        <button onClick={onClose} className="mt-3 px-4 py-2 bg-green-700/50 rounded-lg text-sm hover:bg-green-700/70 transition-colors">Got it!</button>
      </div>
    </div>
  );
}
