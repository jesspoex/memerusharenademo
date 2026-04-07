'use client';
// src/components/TokenCard.tsx
import type { TokenData } from '@/types';
import { formatNumber, formatPrice } from '@/lib/dexscreener';

interface Props {
  token: TokenData;
  side: 'A' | 'B';
  selected?: boolean;
  winner?: boolean;
  loser?: boolean;
  onSelect?: () => void;
}

export default function TokenCard({ token, side, selected, winner, loser, onSelect }: Props) {
  const up = token.priceChange24h >= 0;
  const colorA = '#22d3ee';
  const colorB = '#f472b6';
  const color  = side === 'A' ? colorA : colorB;

  const borderColor = winner
    ? 'rgba(34,197,94,.9)'
    : loser
    ? 'rgba(239,68,68,.4)'
    : selected
    ? `${color}cc`
    : 'rgba(71,85,105,.3)';

  const bg = winner
    ? 'rgba(6,78,59,.25)'
    : loser
    ? 'rgba(127,29,29,.15)'
    : selected
    ? `${color}12`
    : 'rgba(15,15,35,.9)';

  return (
    <button
      onClick={onSelect}
      disabled={!onSelect}
      className="relative w-full rounded-2xl p-5 text-center transition-all active:scale-95 disabled:cursor-default"
      style={{ border: `2px solid ${borderColor}`, background: bg,
        boxShadow: (winner || selected) ? `0 0 24px ${winner ? '#22c55e' : color}30` : 'none' }}
    >
      {/* Badge */}
      {winner && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-500 rounded-full text-xs font-black text-black whitespace-nowrap shadow-lg">
          🏆 WINNER
        </div>
      )}
      {loser && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-red-600 rounded-full text-xs font-black text-white whitespace-nowrap">
          ✗ LOST
        </div>
      )}
      {selected && !winner && !loser && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-xs font-black text-black whitespace-nowrap" style={{ background: color }}>
          ✓ YOUR PICK
        </div>
      )}

      {/* Logo */}
      {token.logoUrl ? (
        <img
          src={token.logoUrl}
          alt={token.symbol}
          className="w-14 h-14 rounded-full mx-auto mb-3 object-cover"
          style={{ outline: `2px solid ${color}44` }}
          onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${token.symbol}&background=7c3aed&color=fff&size=56`; }}
        />
      ) : (
        <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center font-black text-2xl"
          style={{ background: `${color}22`, color }}>
          {token.symbol.slice(0, 2)}
        </div>
      )}

      <p className="font-black text-white text-xl">{token.symbol}</p>
      <p className="text-slate-400 text-xs mb-3 truncate max-w-full px-2">{token.name}</p>

      {/* Price */}
      <p className="text-2xl font-black" style={{ color }}>{formatPrice(token.price)}</p>
      <p className={`text-sm font-bold mt-0.5 ${up ? 'text-emerald-400' : 'text-red-400'}`}>
        {up ? '▲' : '▼'} {Math.abs(token.priceChange24h).toFixed(2)}% (24h)
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
        {[
          { l: 'Volume 24h', v: formatNumber(token.volume24h) },
          { l: 'Liquidity',  v: formatNumber(token.liquidity) },
          { l: 'Market Cap', v: formatNumber(token.marketCap) },
          { l: 'Network',    v: 'Solana' },
        ].map(s => (
          <div key={s.l} className="rounded-lg p-2 border border-white/5" style={{ background: 'rgba(30,41,59,.4)' }}>
            <p className="text-slate-500">{s.l}</p>
            <p className="text-white font-bold mt-0.5">{s.v}</p>
          </div>
        ))}
      </div>

      {/* CTA hint */}
      {onSelect && !selected && !winner && !loser && (
        <p className="text-xs font-bold mt-3" style={{ color }}>
          Tap to pick {token.symbol} →
        </p>
      )}
    </button>
  );
}
