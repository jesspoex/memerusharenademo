"use client";

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

interface DailyReward {
  day: number;
  reward: number;
  claimed: boolean;
}

export default function DailyRewards() {
  const { connected, connect } = useWallet();
  const [currentDay, setCurrentDay] = useState(1);
  const [rewards, setRewards] = useState<DailyReward[]>([
    { day: 1, reward: 0.01, claimed: false },
    { day: 2, reward: 0.02, claimed: false },
    { day: 3, reward: 0.05, claimed: false },
    { day: 4, reward: 0.1, claimed: false },
    { day: 5, reward: 0.25, claimed: false },
    { day: 6, reward: 0.5, claimed: false },
    { day: 7, reward: 1.0, claimed: false },
  ]);

  if (!connected) {
    return (
      <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border border-yellow-500/30 rounded-2xl p-5">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span>🎁</span> Daily Login Rewards
        </h3>
        <div className="text-center py-6 bg-gray-800/50 rounded-xl border border-gray-700 border-dashed">
          <div className="text-4xl mb-3">🔐</div>
          <p className="text-gray-400 mb-4">Connect wallet to claim daily rewards</p>
          <button
            onClick={connect}
            className="px-6 py-3 bg-gradient-to-r from-yellow-600 to-orange-600 rounded-xl font-bold hover:scale-105 transition-transform"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  const claimReward = (day: number) => {
    if (day !== currentDay) return;
    
    setRewards(prev => prev.map(r => 
      r.day === day ? { ...r, claimed: true } : r
    ));
    
    setCurrentDay(prev => Math.min(prev + 1, 7));
    alert(`Claimed ${rewards.find(r => r.day === day)?.reward} SOL!`);
  };

  return (
    <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border border-yellow-500/30 rounded-2xl p-5">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <span>🎁</span> Daily Login Rewards
      </h3>
      <div className="grid grid-cols-7 gap-2">
        {rewards.map((reward) => (
          <button
            key={reward.day}
            onClick={() => claimReward(reward.day)}
            disabled={reward.claimed || reward.day !== currentDay}
            className={`p-3 rounded-xl text-center transition-all ${
              reward.claimed
                ? 'bg-green-600/30 text-green-400 cursor-not-allowed'
                : reward.day === currentDay
                ? 'bg-yellow-500/50 text-yellow-400 hover:scale-110 animate-pulse'
                : 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
            }`}
          >
            <div className="text-xs font-bold">Day {reward.day}</div>
            <div className="text-sm font-black">{reward.reward} SOL</div>
            {reward.claimed && <div className="text-xs">✓</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
