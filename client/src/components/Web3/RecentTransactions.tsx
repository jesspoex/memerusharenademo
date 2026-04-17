"use client";

interface Transaction {
  type: string;
  hash: string;
  amount: number;
  time: string;
  status: 'success' | 'pending' | 'failed';
}

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export default function RecentTransactions({ transactions }: RecentTransactionsProps) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 backdrop-blur-sm">
      <h3 className="text-base font-bold mb-4 flex items-center gap-2">📜 Recent Transactions</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
        {transactions.length === 0 ? (
          <div className="text-center text-gray-400 text-xs py-8">No transactions yet</div>
        ) : (
          transactions.slice(0, 10).map((tx, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl border border-gray-700 hover:border-cyan-500/30 transition-all">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  tx.status === 'success' ? 'bg-green-400' : 
                  tx.status === 'pending' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'
                }`}></div>
                <div>
                  <div className="text-sm font-bold text-white">{tx.type}</div>
                  <div className="text-xs text-gray-400 font-mono">
                    {tx.hash.slice(0, 8)}...{tx.hash.slice(-4)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-bold ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(3)} SOL
                </div>
                <div className="text-xs text-gray-400">{tx.time}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
