"use client";

import { useState, useEffect } from 'react';

export default function MiniGames() {
  const [prediction, setPrediction] = useState<'up' | 'down' | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [result, setResult] = useState<'win' | 'lose' | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setPrediction(null);
          setResult(null);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handlePredict = (direction: 'up' | 'down') => {
    setPrediction(direction);
    setResult(null);
    
    setTimeout(() => {
      const won = Math.random() > 0.5;
      setResult(won ? 'win' : 'lose');
      if (won) setScore(prev => prev + 10);
      
      setTimeout(() => {
        setPrediction(null);
        setResult(null);
      }, 2000);
    }, 3000);
  };

  return (
    <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <span>🎮</span> Quick Predict
        </h3>
        <div className="text-xs text-gray-400">Score: <span className="text-yellow-400 font-bold">{score}</span></div>
      </div>
      
      <div className="text-center mb-4">
        <div className={`text-3xl font-bold mb-1 ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-cyan-400'}`}>
          {timeLeft}s
        </div>
        <div className="text-xs text-gray-400">Next round in</div>
      </div>

      {!prediction && !result ? (
        <div className="space-y-3">
          <div className="text-center text-sm text-gray-400 mb-2">Predict price direction:</div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handlePredict('up')}
              className="bg-gradient-to-r from-green-600 to-emerald-600 py-3 rounded-xl font-bold hover:scale-105 active:scale-95 transition-transform"
            >
              📈 UP
            </button>
            <button
              onClick={() => handlePredict('down')}
              className="bg-gradient-to-r from-red-600 to-rose-600 py-3 rounded-xl font-bold hover:scale-105 active:scale-95 transition-transform"
            >
              📉 DOWN
            </button>
          </div>
        </div>
      ) : result ? (
        <div className={`text-center py-6 ${result === 'win' ? 'text-green-400' : 'text-red-400'}`}>
          <div className="text-5xl mb-2 animate-bounce">{result === 'win' ? '🎉' : '😢'}</div>
          <div className="text-lg font-bold">{result === 'win' ? 'You Won!' : 'You Lost'}</div>
          {result === 'win' && <div className="text-sm mt-1">+10 points</div>}
        </div>
      ) : (
        <div className="text-center py-6">
          <div className="text-4xl mb-2 animate-pulse">⏳</div>
          <div className="text-sm text-gray-400">Waiting result...</div>
        </div>
      )}

      <div className="mt-4 p-3 bg-gray-800/50 rounded-xl">
        <div className="text-xs text-gray-400 text-center">
          💡 Win predictions to earn bonus rewards!
        </div>
      </div>
    </div>
  );
      }
