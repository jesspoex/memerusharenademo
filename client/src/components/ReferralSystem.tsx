"use client";

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

export default function ReferralSystem() {
  const { connected, connect, publicKey } = useWallet();
  const [referralCode] = useState(publicKey ? publicKey.toString().slice(0, 8).toUpperCase() : 'MRUSH2024');
  const [stats, setStats] = useState({
    totalReferrals: 0,
    totalEarnings: 0,
  });

  if (!connected) {
    return (
      <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-2xl p-5">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span>👥</span> Referral Program
        </h3>
        <div className="text-center py-6 bg-gray-800/50 rounded-xl border border-gray-700 border-dashed">
          <div className="text-4xl mb-3">🔐</div>
          <p className="text-gray-400 mb-4">Connect wallet to get your referral code</p>
          <button
            onClick={connect}
            className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl font-bold hover:scale-105 transition-transform"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  const copyReferralLink = () => {
    const link = `https://memerushsol.vercel.app?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    alert('Referral link copied! Share with friends!');
  };

  return (
    <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-2xl p-5">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <span>👥</span> Referral Program
      </h3>
      
      <div className="mb-4">
        <div className="text-xs text-gray-400 mb-2">Your Referral Code</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-900 rounded-lg px-4 py-3 font-mono font-bold text-green-400 text-center text-sm">
            {referralCode}
          </div>
          <button
            onClick={copyReferralLink}
            className="px-4 py-3 bg-green-600 rounded-lg font-bold hover:bg-green-500 transition-colors"
          >
            📋 Copy
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-800/50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-cyan-400">{stats.totalReferrals}</div>
          <div className="text-xs text-gray-400">Total Referrals</div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-green-400">{stats.totalEarnings.toFixed(2)} SOL</div>
          <div className="text-xs text-gray-400">Total Earnings</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-bold text-gray-400 mb-2">Multi-Level Earnings:</div>
        <div className="flex items-center justify-between p-2 bg-gray-800/30 rounded-lg">
          <span className="text-xs">Level 1 (Direct)</span>
          <span className="text-xs font-bold text-green-400">10% commission</span>
        </div>
        <div className="flex items-center justify-between p-2 bg-gray-800/30 rounded-lg">
          <span className="text-xs">Level 2</span>
          <span className="text-xs font-bold text-blue-400">5% commission</span>
        </div>
        <div className="flex items-center justify-between p-2 bg-gray-800/30 rounded-lg">
          <span className="text-xs">Level 3</span>
          <span className="text-xs font-bold text-purple-400">2.5% commission</span>
        </div>
      </div>

      <div className="mt-4 p-3 bg-green-900/20 border border-green-500/30 rounded-xl">
        <div className="text-xs text-center text-green-400">
          💡 Earn passive income from your referrals' battles!
        </div>
      </div>
    </div>
  );
}
