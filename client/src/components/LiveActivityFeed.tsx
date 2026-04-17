"use client";

import { useEffect, useState } from 'react';

interface Activity {
  id: string;
  text: string;
  type: 'bet' | 'win';
  amount: number;
  token?: string;
}

const mockActivities = [
  { text: "bet on", tokens: ["BONK", "WIF", "PEPE", "DOGE", "SHIB", "FLOKI"] },
  { text: "won", tokens: ["BONK", "WIF", "PEPE", "DOGE", "SHIB", "FLOKI"] },
];

const mockWallets = ["8Px", "7Bs", "3Jf", "9x2", "4kL", "5nR", "2qT", "6rU"];

export default function LiveActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    // Initial activities
    const initial: Activity[] = Array.from({ length: 3 }, (_, i) => ({
      id: `init-${i}`,
      text: `${(Math.random() * 2 + 0.3).toFixed(1)} SOL ${mockActivities[i % 2].text} ${mockActivities[i % 2].tokens[i % 6]}`,
      type: i % 2 === 0 ? 'bet' : 'win',
      amount: parseFloat((Math.random() * 2 + 0.3).toFixed(1)),
      token: mockActivities[i % 2].tokens[i % 6],
    }));
    setActivities(initial);

    // Add new activities every 3-5 seconds
    const interval = setInterval(() => {
      const isWin = Math.random() > 0.6;
      const wallet = mockWallets[Math.floor(Math.random() * mockWallets.length)];
      const activity = mockActivities[isWin ? 1 : 0];
      const token = activity.tokens[Math.floor(Math.random() * activity.tokens.length)];
      const amount = parseFloat((Math.random() * 2 + 0.1).toFixed(1));

      const newActivity: Activity = {
        id: Date.now().toString(),
        text: `${isWin ? `${wallet}... won +` : ""}${amount} SOL ${activity.text} ${token}`,
        type: isWin ? 'win' : 'bet',
        amount,
        token,
      };

      setActivities(prev => [newActivity, ...prev].slice(0, 5));
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-xs font-bold text-gray-300">Live Activity</span>
      </div>
      <div className="space-y-2">
        {activities.map((act) => (
          <div 
            key={act.id} 
            className={`text-xs p-2 rounded-lg bg-gray-800/50 animate-fade-in ${
              act.type === 'win' ? 'border-l-2 border-green-500' : 'border-l-2 border-cyan-500'
            }`}
          >
            <span className={act.type === 'win' ? 'text-green-400' : 'text-cyan-400'}>
              {act.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
