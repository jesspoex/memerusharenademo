/**
 * components/trade/chart/TradeChart.tsx
 * Premium candlestick chart — pure Canvas API, no external lib.
 * Mobile-first, DPR-aware, ResizeObserver for responsive reflow.
 */
'use client';
import React, { useRef, useEffect, useCallback, memo } from 'react';
import type { Candle } from '../../../hooks/useBattleChart';

interface Props {
  candles:  Candle[];
  height?:  number;
  colorUp?: string;
  colorDn?: string;
}

function draw(canvas: HTMLCanvasElement, candles: Candle[], H: number, up: string, dn: string) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !candles.length) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W   = canvas.clientWidth || canvas.offsetWidth || 300;

  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  // Subtle grid
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth   = 0.5;
  for (let i = 1; i <= 3; i++) {
    const y = (H / 4) * i;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Price range with padding
  const highs = candles.map(c => c.high);
  const lows  = candles.map(c => c.low);
  let mn      = Math.min(...lows);
  let mx      = Math.max(...highs);
  const pad   = (mx - mn) * 0.08 || mx * 0.04;
  mn -= pad; mx += pad;
  const rng   = mx - mn || 1;
  const toY   = (p: number) => H - ((p - mn) / rng) * (H - 6) - 3;

  // Candle geometry
  const step  = W / candles.length;
  const body  = Math.max(1.5, step * 0.62);

  candles.forEach((c, i) => {
    const x     = i * step + step / 2;
    const isUp  = c.close >= c.open;
    const col   = isUp ? up : dn;
    const bTop  = toY(Math.max(c.open, c.close));
    const bBot  = toY(Math.min(c.open, c.close));
    const bH    = Math.max(1, bBot - bTop);

    // Wick
    ctx.strokeStyle = col + 'cc';
    ctx.lineWidth   = Math.max(0.5, body * 0.13);
    ctx.beginPath();
    ctx.moveTo(x, toY(c.high));
    ctx.lineTo(x, toY(c.low));
    ctx.stroke();

    // Body
    ctx.fillStyle = col;
    ctx.fillRect(x - body / 2, bTop, body, bH);

    // Last candle glow
    if (i === candles.length - 1) {
      ctx.save();
      ctx.shadowColor = col; ctx.shadowBlur = 10;
      ctx.fillRect(x - body / 2, bTop, body, bH);
      ctx.restore();
    }
  });

  // Dashed price line at last close
  const lastClose = candles[candles.length - 1].close;
  const lineY     = toY(lastClose);
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth   = 0.5;
  ctx.beginPath(); ctx.moveTo(0, lineY); ctx.lineTo(W, lineY); ctx.stroke();
  ctx.setLineDash([]);

  // Price label bubble on right edge
  const isLastUp = lastClose >= candles[candles.length - 1].open;
  const lW = 68, lH = 17, lX = W - lW - 2, lY = lineY - lH / 2;
  ctx.fillStyle = isLastUp ? up : dn;
  ctx.beginPath();
  (ctx as CanvasRenderingContext2D).roundRect
    ? (ctx as CanvasRenderingContext2D).roundRect(lX, lY, lW, lH, 3)
    : ctx.rect(lX, lY, lW, lH);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font      = `bold 9.5px ui-monospace, monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const pStr = lastClose < 0.000001 ? lastClose.toExponential(2)
             : lastClose < 0.001    ? lastClose.toFixed(7)
             : lastClose < 1        ? lastClose.toFixed(5)
             : lastClose < 10000   ? lastClose.toFixed(3)
             : lastClose.toFixed(1);
  ctx.fillText(`$${pStr}`, lX + lW / 2, lineY);
}

export const TradeChart = memo(function TradeChart({
  candles, height = 200, colorUp = '#22c55e', colorDn = '#f97316',
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  const render = useCallback(() => {
    if (ref.current && candles.length) draw(ref.current, candles, height, colorUp, colorDn);
  }, [candles, height, colorUp, colorDn]);

  useEffect(() => {
    render();
    const obs = new ResizeObserver(render);
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [render]);

  return (
    <canvas
      ref={ref}
      style={{ display: 'block', width: '100%', height }}
      className="rounded-xl"
    />
  );
});
