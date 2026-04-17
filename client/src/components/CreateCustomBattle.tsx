"use client";

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

interface CustomBattleProps {
  onCreate: (battle: CustomBattleData) => void;
}

interface CustomBattleData {
  name: string;
  tokenA: string;
  tokenB: string;
  duration: number;
  minBet: number;
  maxBet: number;
  entryFee: number;
}

export default function CreateCustomBattle({ onCreate }: CustomBattleProps) {
  const { connected, connect } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    tokenA: 'DOGE',
    tokenB: 'PEPE',
    duration: 600,
    minBet: 0.1,
    maxBet: 5,
    entryFee: 0.01,
  });

  if (!connected) {
    return (
      <div className="text-center py-6 bg-gray-800/50 rounded-xl border border-gray-700 border-dashed">
        <div className="text-4xl mb-3">🔐</div>
        <p className="text-gray-400 mb-4">Connect wallet to create custom battles</p>
        <button
          onClick={connect}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold hover:scale-105 transition-transform"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  const handleCreate = () => {
    if (!formData.name.trim()) {
      alert('Please enter battle name');
      return;
    }

    const newBattle: CustomBattleData = {
      ...formData,
      name: formData.name.trim(),
    };

    onCreate(newBattle);
    setShowModal(false);
    setFormData({
      name: '',
      tokenA: 'DOGE',
      tokenB: 'PEPE',
      duration: 600,
      minBet: 0.1,
      maxBet: 5,
      entryFee: 0.01,
    });
    alert(`Battle "${newBattle.name}" created! Share with your community!`);
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 rounded-xl hover:scale-105 transition-transform"
      >
        ⚔️ Create Custom Battle
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-purple-500/50 rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-black text-white mb-4">Create Custom Battle</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Battle Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., DOGE vs PEPE Championship"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Token A</label>
                  <select
                    value={formData.tokenA}
                    onChange={(e) => setFormData({ ...formData, tokenA: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white"
                  >
                    <option value="DOGE">DOGE</option>
                    <option value="PEPE">PEPE</option>
                    <option value="SHIB">SHIB</option>
                    <option value="BONK">BONK</option>
                    <option value="WIF">WIF</option>
                    <option value="FLOKI">FLOKI</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Token B</label>
                  <select
                    value={formData.tokenB}
                    onChange={(e) => setFormData({ ...formData, tokenB: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white"
                  >
                    <option value="PEPE">PEPE</option>
                    <option value="DOGE">DOGE</option>
                    <option value="SHIB">SHIB</option>
                    <option value="BONK">BONK</option>
                    <option value="WIF">WIF</option>
                    <option value="FLOKI">FLOKI</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Duration (minutes)</label>
                <select
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white"
                >
                  <option value={300}>5 minutes</option>
                  <option value={600}>10 minutes</option>
                  <option value={900}>15 minutes</option>
                  <option value={1800}>30 minutes</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Min Bet (SOL)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.minBet}
                    onChange={(e) => setFormData({ ...formData, minBet: Number(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Max Bet (SOL)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.maxBet}
                    onChange={(e) => setFormData({ ...formData, maxBet: Number(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white"
                  />
                </div>
              </div>

              <div className="bg-purple-900/30 border border-purple-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Creation Fee:</span>
                  <span className="text-lg font-bold text-yellow-400">0.01 SOL</span>
                </div>
                <div className="text-xs text-gray-400">
                  💡 50% goes to platform, 50% to battle prize pool
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-700 rounded-xl font-bold hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold hover:scale-105 transition-transform"
                >
                  Create Battle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
