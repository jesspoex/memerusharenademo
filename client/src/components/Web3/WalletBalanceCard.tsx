"use client";

import NetworkStatusBadge from './NetworkStatusBadge';

interface WalletBalanceCardProps {
  balance: number;
  wallet: string | null;
  network?: 'mainnet' | 'devnet'; // ✅ UBAH dari string ke 'mainnet' | 'devnet'
}

export default function WalletBalanceCard({ balance, wallet, network = 'mainnet' }: WalletBalanceCardProps) {
  if (!wallet) return null;
  
  return (
    <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-2xl p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-400">Connected Wallet</div>
        <NetworkStatusBadge network={network} />
      </div>
      <div className="font-mono text-cyan-400 text-sm mb-2 truncate" title={wallet}>
        {wallet}
      </div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400">Balance</div>
        <div className="text-2xl font-bold text-white">
          {balance.toFixed(4)} <span className="text-sm text-purple-400">SOL</span>
        </div>
      </div>
      <div className="text-xs text-gray-400 mt-1">≈ ${(balance * 150).toFixed(2)} USD</div>
    </div>
  );
}
