import React from 'react';

interface NetworkStatusBadgeProps {
  network: 'mainnet' | 'devnet';
}

export default function NetworkStatusBadge({ network }: NetworkStatusBadgeProps) {
  if (network === 'mainnet') {
    return (
      <span className="px-2 py-1 bg-emerald-900/50 border border-emerald-500/50 rounded-full text-xs text-emerald-400 font-semibold">
        🟢 Mainnet
      </span>
    );
  }
  
  return (
    <span className="px-2 py-1 bg-purple-900/50 border border-purple-500/50 rounded-full text-xs text-purple-400 font-semibold">
      Devnet
    </span>
  );
}
