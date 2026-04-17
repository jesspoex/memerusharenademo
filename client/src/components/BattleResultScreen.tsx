"use client";

import { useEffect, useState } from 'react';

interface BattleResultScreenProps {
  winnerToken: string;
  winnerIcon: string;
  prizePool: number;
  winnerPercentage: number;
  loserToken: string;
  loserPercentage: number;
  onClose?: () => void;
}

export default function BattleResultScreen({
  winnerToken,
  winnerIcon,
  prizePool,
  winnerPercentage,
  loserToken,
  loserPercentage,
  onClose,
}: BattleResultScreenProps) {
  const [showAnimation, setShowAnimation] = useState(false);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number }>>([]);

  useEffect(() => {
    setShowAnimation(true);
    
    // Generate confetti particles
    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
    }));
    setParticles(newParticles);

    const timer = setTimeout(() => {
      setShowAnimation(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-4 overflow-hidden">
      {/* Animated Background Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className={`absolute w-2 h-2 rounded-full animate-ping ${
              particle.id % 3 === 0 ? 'bg-yellow-400' :
              particle.id % 3 === 1 ? 'bg-purple-400' : 'bg-pink-400'
            }`}
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: '2s',
            }}
          />
        ))}
      </div>

      {/* Glow Effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-yellow-500/20 rounded-full blur-3xl animate-pulse pointer-events-none"></div>
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-700 pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl animate-pulse delay-1000 pointer-events-none"></div>

      {/* Main Content */}
      <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-yellow-500/50 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl shadow-yellow-500/20">
        {/* Glow Border Animation */}
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 via-purple-500 to-pink-500 rounded-3xl opacity-20 animate-pulse"></div>
        
        <div className="relative">
          {/* Battle Status */}
          <div className="text-center mb-6">
            <div className="inline-block px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-full text-red-400 text-xs font-bold mb-3 animate-pulse">
              ⚔️ BATTLE ENDED
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
              🏆 WINNER
            </h2>
          </div>

          {/* Winner Token */}
          <div className="text-center mb-6">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full blur-xl animate-pulse"></div>
              <div className="relative w-24 h-24 sm:w-32 sm:h-32 mx-auto rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-5xl sm:text-6xl shadow-2xl border-4 border-yellow-400/50">
                {winnerIcon}
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-lg animate-bounce">
                👑
              </div>
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold text-yellow-400 mb-1">
              {winnerToken}
            </h3>
            <div className="text-green-400 font-bold text-lg">
              {winnerPercentage.toFixed(1)}%
            </div>
          </div>

          {/* Prize Pool */}
          <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 border border-purple-500/30 rounded-2xl p-4 mb-6">
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-1">💰 Prize Pool</div>
              <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                {prizePool.toFixed(2)} SOL
              </div>
            </div>
          </div>

          {/* Percentage Bar */}
          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-xs">
              <span className="text-yellow-400 font-bold">{winnerToken} {winnerPercentage.toFixed(1)}%</span>
              <span className="text-gray-400">VS</span>
              <span className="text-purple-400 font-bold">{loserToken} {loserPercentage.toFixed(1)}%</span>
            </div>
            <div className="relative h-6 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
              <div className="absolute inset-0 flex">
                <div 
                  className="bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-1000"
                  style={{ width: `${winnerPercentage}%` }}
                >
                  <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
                </div>
                <div 
                  className="bg-gradient-to-r from-purple-400 to-pink-500 transition-all duration-1000"
                  style={{ width: `${loserPercentage}%` }}
                >
                  <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Rewards Distributed Message */}
          <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border-2 border-green-500/50 rounded-2xl p-4 mb-6">
            <div className="flex items-center justify-center gap-2 text-green-400">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="font-bold text-sm sm:text-base">✅ Rewards Distributed</span>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            </div>
            <div className="text-center text-xs text-gray-400 mt-2">
              Winners have received their share
            </div>
          </div>

          {/* Close Button */}
          {onClose && (
            <button
              onClick={onClose}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-3 rounded-xl transition-all active:scale-95 shadow-lg"
            >
              Continue to Next Battle
            </button>
          )}
        </div>
      </div>
    </div>
  );
              }
