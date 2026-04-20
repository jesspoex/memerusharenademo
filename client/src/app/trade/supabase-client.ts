/**
 * trade/supabase-client.ts
 * Client-side Supabase helpers (anon key, browser only).
 * Separate from lib/supabase.ts which uses SERVICE_ROLE (server only).
 */
import { SB_URL, SB_ANON } from './constants';

function sbH(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SB_ANON}`,
    ...(SB_ANON && !SB_ANON.startsWith('sb_') ? { 'apikey': SB_ANON } : {}),
    ...extra,
  };
}

export async function sbGet<T>(table: string, query = ''): Promise<T[]> {
  if (!SB_URL || !SB_ANON) return [];
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, { headers: sbH(), cache: 'no-store' });
    if (!r.ok) return [];
    return await r.json() as T[];
  } catch { return []; }
}

export async function sbInsert(table: string, body: unknown): Promise<boolean> {
  if (!SB_URL || !SB_ANON) return false;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method: 'POST', headers: sbH({ 'Prefer': 'return=minimal' }), body: JSON.stringify(body),
    });
    return r.ok;
  } catch { return false; }
}

export async function sbUpsert(table: string, body: unknown): Promise<boolean> {
  if (!SB_URL || !SB_ANON) return false;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: sbH({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(body),
    });
    return r.ok;
  } catch { return false; }
}

// ── Realtime WebSocket ────────────────────────────────────────────────────────
export type RealtimePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  old: any;
};
type RealtimeCallback = (payload: RealtimePayload) => void;

export function createRealtimeChannel(
  table: string,
  onMessage: RealtimeCallback,
  onConnect?: () => void,
): () => void {
  if (!SB_URL || !SB_ANON || typeof window === 'undefined') return () => {};

  const wsUrl     = SB_URL.replace('https://', 'wss://').replace('http://', 'ws://');
  const channelId = `realtime:public:${table}:${Date.now()}`;

  let ws:          WebSocket | null = null;
  let heartbeatId: ReturnType<typeof setInterval>  | null = null;
  let reconnectId: ReturnType<typeof setTimeout>   | null = null;
  let destroyed = false;

  function connect() {
    if (destroyed) return;
    try {
      ws = new WebSocket(`${wsUrl}/realtime/v1/websocket?apikey=${SB_ANON}&vsn=1.0.0`);

      ws.onopen = () => {
        if (!ws || destroyed) return;
        ws.send(JSON.stringify({
          topic: `realtime:public:${table}`,
          event: 'phx_join',
          payload: {
            config: {
              broadcast: { self: false },
              presence: { key: '' },
              postgres_changes: [{ event: '*', schema: 'public', table }],
            },
          },
          ref: channelId,
        }));
        heartbeatId = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: null }));
          }
        }, 30_000);
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const msg = JSON.parse(event.data as string) as any;
          if (msg.event === 'postgres_changes' && msg.payload?.data) {
            const { type, record, old_record } = msg.payload.data;
            if (type && record) {
              onMessage({ eventType: type as 'INSERT' | 'UPDATE' | 'DELETE', new: record, old: old_record ?? {} });
            }
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onerror  = () => {};
      ws.onclose  = () => {
        if (heartbeatId) clearInterval(heartbeatId);
        if (!destroyed) reconnectId = setTimeout(connect, 5_000);
      };
    } catch { /* ignore connection errors */ }
  }

  connect();

  return () => {
    destroyed = true;
    if (heartbeatId) clearInterval(heartbeatId);
    if (reconnectId) clearTimeout(reconnectId);
    if (ws) { try { ws.close(); } catch {} }
  };
}
