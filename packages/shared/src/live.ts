import { config } from './config';
import { parseEvent, type SpotterEvent } from './events';

const AUTH = { host: config.eventsHttpHost, 'x-api-key': config.eventsApiKey };

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** base64url without padding, for the AppSync auth subprotocol. Input is ASCII JSON. */
function base64url(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i += 3) {
    const n = (text.charCodeAt(i) << 16) | ((text.charCodeAt(i + 1) || 0) << 8) | (text.charCodeAt(i + 2) || 0);
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!;
    if (i + 1 < text.length) out += B64[(n >> 6) & 63]!;
    if (i + 2 < text.length) out += B64[n & 63]!;
  }
  return out;
}

/** Publish events to a session channel over HTTPS. */
export async function publish(channel: string, ...events: SpotterEvent[]): Promise<void> {
  const res = await fetch(`https://${config.eventsHttpHost}/event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': config.eventsApiKey },
    body: JSON.stringify({ channel, events: events.map((e) => JSON.stringify(e)) }),
  });
  if (!res.ok) throw new Error(`Publish failed (${res.status})`);
}

export type LiveStatus = 'connecting' | 'live' | 'reconnecting' | 'closed';

export interface ChannelOptions {
  /** Receive events published on the channel (subscribes when given). */
  onEvent?: (event: SpotterEvent) => void;
  onStatus?: (status: LiveStatus) => void;
}

export interface LiveChannel {
  /**
   * Send an event over the open WebSocket. With `fallbackToHttp`, it is posted over HTTPS while
   * the socket is down; otherwise it is dropped (right for high-rate data like poses).
   */
  send(event: SpotterEvent, fallbackToHttp?: boolean): void;
  close(): void;
}

/**
 * One AppSync Events WebSocket for a session channel, used to subscribe, to publish, or both.
 * Reconnects with backoff. Works in browsers and React Native.
 */
export function openChannel(channel: string, { onEvent, onStatus }: ChannelOptions = {}): LiveChannel {
  let socket: WebSocket | null = null;
  let ready = false;
  let closed = false;
  let attempt = 0;
  let nextId = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;

  const connect = () => {
    ready = false;
    onStatus?.(attempt === 0 ? 'connecting' : 'reconnecting');
    const ws = new WebSocket(`wss://${config.eventsRealtimeHost}/event/realtime`, [
      'aws-appsync-event-ws',
      `header-${base64url(JSON.stringify(AUTH))}`,
    ]);
    socket = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'connection_init' }));
    ws.onmessage = (message) => {
      const msg = JSON.parse(String(message.data)) as { type: string; event?: string };
      if (msg.type === 'connection_ack') {
        if (onEvent) {
          ws.send(JSON.stringify({ type: 'subscribe', id: `sub-${nextId++}`, channel, authorization: AUTH }));
        } else {
          ready = true;
          attempt = 0;
          onStatus?.('live');
        }
      } else if (msg.type === 'subscribe_success') {
        ready = true;
        attempt = 0;
        onStatus?.('live');
      } else if (msg.type === 'data' && msg.event && onEvent) {
        const event = parseEvent(msg.event);
        if (event) onEvent(event);
      }
    };
    ws.onclose = () => {
      ready = false;
      if (closed) return;
      attempt += 1;
      retry = setTimeout(connect, Math.min(1000 * 2 ** attempt, 15000));
    };
  };

  connect();
  return {
    send(event, fallbackToHttp = false) {
      if (ready && socket) {
        socket.send(JSON.stringify({ type: 'publish', id: `pub-${nextId++}`, channel, events: [JSON.stringify(event)], authorization: AUTH }));
      } else if (fallbackToHttp) {
        publish(channel, event).catch(() => {});
      }
    },
    close() {
      closed = true;
      clearTimeout(retry);
      socket?.close();
      onStatus?.('closed');
    },
  };
}

/** Subscribe-only convenience wrapper around openChannel. */
export function subscribe(channel: string, onEvent: (event: SpotterEvent) => void, onStatus?: (status: LiveStatus) => void): LiveChannel {
  return openChannel(channel, { onEvent, onStatus });
}
