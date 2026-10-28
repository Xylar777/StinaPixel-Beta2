import { PixelData } from '../types';

export type RealtimeListener = (event: {
  type: 'canvas:batch_update' | 'canvas:rollback' | 'presence:update' | 'cursor:update' | 'welcome';
  payload: any;
}) => void;

class RealtimeClient {
  private ws: WebSocket | null = null;
  private listeners: Set<RealtimeListener> = new Set();
  private reconnectTimer: any = null;
  private isExplicitClose = false;
  public onlineCount = 1;
  public isConnected = false;
  private currentUserId?: string;
  private currentUsername?: string;

  constructor() {
    this.connect();
  }

  public setUser(userId: string, username: string) {
    this.currentUserId = userId;
    this.currentUsername = username;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'identify',
        userId,
        username
      }));
    }
  }

  public sendCursor(x: number, y: number) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'cursor:move',
        x,
        y
      }));
    }
  }

  public subscribe(listener: RealtimeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(type: any, payload: any) {
    this.listeners.forEach(fn => {
      try {
        fn({ type, payload });
      } catch (err) {
        console.error('[Realtime Listener Error]:', err);
      }
    });
  }

  public connect() {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        if (this.currentUserId) {
          this.setUser(this.currentUserId, this.currentUsername || '');
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'welcome') {
            this.onlineCount = data.onlineCount || 1;
            this.emit('welcome', data);
          } else if (data.type === 'presence:update') {
            this.onlineCount = data.onlineCount || 1;
            this.emit('presence:update', data);
          } else if (data.type === 'canvas:batch_update') {
            this.emit('canvas:batch_update', data);
          } else if (data.type === 'canvas:rollback') {
            this.emit('canvas:rollback', data);
          } else if (data.type === 'cursor:update') {
            this.emit('cursor:update', data);
          }
        } catch (e) {
          // ignore
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        if (!this.isExplicitClose) {
          if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => this.connect(), 3000);
        }
      };

      this.ws.onerror = () => {
        this.isConnected = false;
      };
    } catch (e) {
      this.isConnected = false;
    }
  }

  public disconnect() {
    this.isExplicitClose = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const realtimeClient = new RealtimeClient();
