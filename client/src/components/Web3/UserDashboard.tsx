"use client";

interface UserStats {
  battles: number;
  profit: number;
  winRate: number;
}

interface UserDashboardProps {
  stats: UserStats;
  wallet: string | null;
}

export default function UserDashboard({ stats, wallet }: UserDashboardProps) {
  if (!wallet) return null;
  
  return (
    <div className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border border-cyan-500/30 rounded-2xl p-5 backdrop-blur-sm">
      <h3 className="text-base font-bold mb-4 text-cyan-400 flex items-center gap-2">📊 Your Dashboard</h3>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center p-3 bg-gray-800/50 rounded-xl hover:bg-gray-800/70 transition-all">
          <div className="text-2xl font-bold text-white">{stats.battles}</div>
          <div className="text-xs text-gray-400 mt-1">Battles</div>
        </div>
        <div className="text-center p-3 bg-gray-800/50 rounded-xl hover:bg-gray-800/70 transition-all">
          <div className={`text-2xl font-bold ${stats.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {stats.profit >= 0 ? '+' : ''}{stats.profit.toFixed(2)}
          </div>
          <div className="text-xs text-gray-400 mt-1">Profit (SOL)</div>
        </div>
        <div className="text-center p-3 bg-gray-800/50 rounded-xl hover:bg-gray-800/70 transition-all">
          <div className="text-2xl font-bold text-purple-400">{stats.winRate}%</div>
          <div className="text-xs text-gray-400 mt-1">Win Rate</div>
        </div>
      </div>
      <div className="text-xs text-gray-400 bg-gray-800/30 rounded-lg p-3 text-center">
        🎯 Keep playing to improve your stats!
      </div>
    </div>
  );
}
