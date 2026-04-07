'use client';
// src/components/TokenSearch.tsx
import { useState } from 'react';
import type { TokenData } from '@/types';
import { PRESET_TOKENS } from '@/lib/mock';

interface Props {
  label: string;
  color: string;
  onToken: (t: TokenData) => void;
  disabled?: boolean;
}

export default function TokenSearch({ label, color, onToken, disabled }: Props) {
  const [ca,       setCa]       = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleFetch(address: string) {
    const addr = address.trim();
    if (!addr) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/token?ca=${encodeURIComponent(addr)}`);
      if (!res.ok) {
        const j = await res.json() as { error?: string };
        setError(j.error ?? 'Token not found');
        return;
      }
      const token = await res.json() as TokenData;
      onToken(token);
      setCa('');
    } catch {
      setError('Network error — try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-bold" style={{ color }}>{label}</p>

      {/* Preset quick-select */}
      <div className="flex flex-wrap gap-2">
        {PRESET_TOKENS.map(p => (
          <button
            key={p.symbol}
            onClick={() => { setCa(p.ca); handleFetch(p.ca); }}
            disabled={disabled || loading}
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all hover:scale-105 disabled:opacity-50"
            style={{ background: `${color}15`, borderColor: `${color}44`, color }}
          >
            {p.symbol}
          </button>
        ))}
      </div>

      {/* Manual CA input */}
      <div className="flex gap-2">
        <input
          value={ca}
          onChange={e => setCa(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleFetch(ca)}
          placeholder="Paste token contract address (CA)…"
          disabled={disabled || loading}
          className="flex-1 rounded-xl px-3 py-2.5 text-white text-xs font-mono border border-white/10 focus:outline-none bg-slate-900/80 disabled:opacity-50"
          style={{ outlineColor: color }}
        />
        <button
          onClick={() => handleFetch(ca)}
          disabled={disabled || loading || !ca.trim()}
          className="px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all"
          style={{ background: loading ? 'rgba(71,85,105,.5)' : color + 'cc' }}
        >
          {loading ? '…' : 'Fetch'}
        </button>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
