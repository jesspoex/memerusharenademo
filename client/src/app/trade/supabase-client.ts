/**
 * trade/supabase-client.ts
 * Client-side Supabase helpers (anon key, browser only).
 * Separate from lib/supabase.ts which uses SERVICE_ROLE (server only).
 *
 * IMPORTANT: SB_ANON must be set via NEXT_PUBLIC_SUPABASE_ANON_KEY env var.
 * No hardcoded fallback — an invalid JWT silently breaks all Supabase requests.
 */

const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  || '';
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function sbH(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SB_ANON}`,
    ...(SB_ANON ? { 'apikey': SB_ANON } : {}),
    ...extra,
  };
}

export async function sbGet<T>(table: string, query = ''): Promise<T[]> {
  if (!SB_URL || !SB_ANON) {
    console.warn('[supabase-client] SB_URL or SB_ANON not set — skipping GET', table);
    return [];
  }
  try {
    const url = `${SB_URL}/rest/v1/${table}${query ? `?${query}` : ''}`;
    const r = await fetch(url, { headers: sbH(), cache: 'no-store' });
    if (!r.ok) {
      console.error(`[supabase-client] GET ${table} failed:`, r.status, await r.text());
      return [];
    }
    return (await r.json()) as T[];
  } catch (e) {
    console.error(`[supabase-client] GET ${table} error:`, e);
    return [];
  }
}

export async function sbInsert(table: string, body: unknown): Promise<boolean> {
  if (!SB_URL || !SB_ANON) return false;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method:  'POST',
      headers: sbH({ 'Prefer': 'return=minimal' }),
      body:    JSON.stringify(body),
    });
    if (!r.ok) {
      console.error(`[supabase-client] INSERT ${table} failed:`, r.status, await r.text());
    }
    return r.ok;
  } catch (e) {
    console.error(`[supabase-client] INSERT ${table} error:`, e);
    return false;
  }
}

export async function sbUpsert(table: string, body: unknown): Promise<boolean> {
  if (!SB_URL || !SB_ANON) return false;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method:  'POST',
      headers: sbH({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
      body:    JSON.stringify(body),
    });
    if (!r.ok) {
      console.error(`[supabase-client] UPSERT ${table} failed:`, r.status, await r.text());
    }
    return r.ok;
  } catch (e) {
    console.error(`[supabase-client] UPSERT ${table} error:`, e);
    return false;
  }
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

  const wsUrl = SB_URL.replace('https://', 'wss://').replace('http://', 'ws://');
  const topic = `realtime:public:${table}`;

  let ws:          WebSocket | null = null;
  let heartbeatId: ReturnType<typeof setInterval> | null = null;
  let reconnectId: ReturnType<typeof setTimeout>  | null = null;
  let destroyed = false;
  let joined    = false;

  function clearTimers() {
    if (heartbeatId) { clearInterval(heartbeatId); heartbeatId = null; }
    if (reconnectId) { clearTimeout(reconnectId);  reconnectId = null; }
  }

  function connect() {
    if (destroyed) return;
    try {
      ws = new WebSocket(`${wsUrl}/realtime/v1/websocket?apikey=${SB_ANON}&vsn=1.0.0`);

      ws.onopen = () => {
        if (!ws || destroyed) return;
        ws.send(JSON.stringify({
          topic,
          event:   'phx_join',
          payload: {
            config: {
              broadcast:       { self: false },
              presence:        { key: '' },
              postgres_changes: [{ event: '*', schema: 'public', table }],
            },
          },
          ref: '1',
        }));
        heartbeatId = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              topic:   'phoenix',
              event:   'heartbeat',
              payload: {},
              ref:     String(Date.now()),
            }));
          }
        }, 30_000);
      };

      ws.onmessage = (event) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const msg = JSON.parse(event.data as string) as any;

          if (msg.event === 'phx_reply' && msg.topic === topic && msg.payload?.status === 'ok') {
            if (!joined) { joined = true; onConnect?.(); }
            return;
          }

          if (msg.event === 'postgres_changes' && msg.payload?.data) {
            const { type, record, old_record } = msg.payload.data;
            onMessage({
              eventType: type as 'INSERT' | 'UPDATE' | 'DELETE',
              new:       record      ?? {},
              old:       old_record  ?? {},
            });
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onerror  = () => {};
      ws.onclose  = () => {
        joined = false;
        clearTimers();
        if (!destroyed) reconnectId = setTimeout(connect, 5_000);
      };
    } catch {
      if (!destroyed) reconnectId = setTimeout(connect, 5_000);
    }
  }

  connect();

  return () => {
    destroyed = true;
    clearTimers();
    if (ws) { try { ws.close(); } catch {} }
  };
}
