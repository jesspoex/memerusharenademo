"use client";

import { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: 'from-green-600 to-emerald-600 border-green-500',
    error: 'from-red-600 to-rose-600 border-red-500',
    info: 'from-blue-600 to-cyan-600 border-blue-500',
    warning: 'from-yellow-600 to-orange-600 border-yellow-500',
  };

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️',
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 bg-gradient-to-r ${colors[type]} border-2 rounded-2xl p-4 shadow-2xl animate-slideUp max-w-sm`}>
      <div className="flex items-start gap-3">
        <div className="text-2xl">{icons[type]}</div>
        <div className="flex-1 text-white font-medium">{message}</div>
        <button onClick={onClose} className="text-white/70 hover:text-white text-xl">×</button>
      </div>
    </div>
  );
}
