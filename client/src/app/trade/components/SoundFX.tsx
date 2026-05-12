'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Battle } from '../constants';

interface SoundFXProps {
  enabledDefault?: boolean;
  activeBattle: Battle | null;
  battleTimeLeft: number;
  winOpen: boolean;
  liveActivityCount: number;
}

type ToneKind = 'join' | 'tick' | 'win' | 'new';

function playTone(kind: ToneKind) {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const make = (freq: number, start: number, dur: number, gain = 0.035) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = kind === 'win' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + start);
      vol.gain.setValueAtTime(0.0001, now + start);
      vol.gain.exponentialRampToValueAtTime(gain, now + start + 0.015);
      vol.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(vol);
      vol.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);
    };

    if (kind === 'win') {
      make(392.00, 0, 0.16, 0.05);
      make(523.25, 0.10, 0.18, 0.06);
      make(659.25, 0.22, 0.22, 0.065);
      make(783.99, 0.36, 0.26, 0.07);
      make(1046.50, 0.54, 0.34, 0.055);
    } else if (kind === 'tick') {
      make(880, 0, 0.06, 0.025);
    } else if (kind === 'new') {
      make(440, 0, 0.07, 0.025);
      make(660, 0.07, 0.09, 0.03);
    } else {
      make(620, 0, 0.08, 0.025);
    }

    setTimeout(() => ctx.close().catch(() => {}), 900);
  } catch {}
}

export function SoundFX({ enabledDefault = false, activeBattle, battleTimeLeft, winOpen, liveActivityCount }: SoundFXProps) {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === 'undefined') return enabledDefault;
    const saved = localStorage.getItem('mr_sound_enabled');
    return saved ? saved === '1' : enabledDefault;
  });
  const lastSecondRef = useRef<number | null>(null);
  const lastWinRef = useRef(false);
  const lastActivityRef = useRef(liveActivityCount);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    try { localStorage.setItem('mr_sound_enabled', next ? '1' : '0'); } catch {}
    if (next) playTone('join');
  };

  useEffect(() => {
    if (!enabled) return;
    if (winOpen && !lastWinRef.current) playTone('win');
    lastWinRef.current = winOpen;
  }, [enabled, winOpen]);

  useEffect(() => {
    if (!enabled) return;
    if (liveActivityCount > lastActivityRef.current) playTone('new');
    lastActivityRef.current = liveActivityCount;
  }, [enabled, liveActivityCount]);

  useEffect(() => {
    if (!enabled || !activeBattle) return;
    if (battleTimeLeft <= 0 || battleTimeLeft > 10) {
      lastSecondRef.current = battleTimeLeft;
      return;
    }
    if (lastSecondRef.current !== battleTimeLeft) {
      playTone('tick');
      lastSecondRef.current = battleTimeLeft;
    }
  }, [enabled, activeBattle, battleTimeLeft]);

  return (
    <button
      onClick={toggle}
      className="fixed right-3 bottom-[82px] z-[9990] h-12 min-w-[48px] rounded-full px-3 text-sm font-black shadow-2xl active:scale-95 animate-[mrSoundFloat_2.2s_ease-in-out_infinite]"
      style={{
        background: enabled ? 'linear-gradient(135deg,#ea580c,#f97316)' : 'rgba(15,23,42,.88)',
        border: enabled ? '1px solid rgba(251,146,60,.6)' : '1px solid rgba(255,255,255,.08)',
        color: enabled ? '#fff' : '#94a3b8',
      }}
      aria-label="Toggle MemeRush sound effects"
      title="Toggle sound effects"
    >
      <span className="relative z-10 flex items-center gap-1"><span>{enabled ? '🔊' : '🔇'}</span><span className="hidden sm:inline text-[10px] uppercase tracking-widest">{enabled ? 'Sound' : 'Muted'}</span></span>
      <span className="sr-only">Sound {enabled ? 'on' : 'off'}</span>
      <style jsx>{`
        @keyframes mrSoundFloat {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
      `}</style>
    </button>
  );
}
