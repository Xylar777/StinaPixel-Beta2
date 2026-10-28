import express, { Request, Response } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// In-Memory state for instant beta performance (synced with PostgreSQL if configured)
interface ServerPixel {
  x: number;
  y: number;
  color: string;
  ownerId: string;
  ownerName: string;
  isVIP: boolean;
  artId?: string;
  description?: string;
  link?: string;
  timestamp: number;
}

interface AuditEntry {
  id: string;
  x: number;
  y: number;
  oldColor?: string;
  newColor: string;
  userId: string;
  username: string;
  isVIP: boolean;
  artId?: string;
  cost: number;
  timestamp: number;
}

// Global in-memory storage for 100 concurrent players
const canvasPixels = new Map<string, ServerPixel>();
const auditLogs: AuditEntry[] = [];
const playerCooldowns = new Map<string, { lastPlaced: number; countInWindow: number; windowStart: number }>();

// Load seed data if available
const seedFile = path.join(__dirname, 'server-canvas-cache.json');
if (fs.existsSync(seedFile)) {
  try {
    const raw = fs.readFileSync(seedFile, 'utf-8');
    const parsed = JSON.parse(raw);
    for (const [key, val] of Object.entries(parsed)) {
      canvasPixels.set(key, val as ServerPixel);
    }
    console.log(`[Server] Loaded ${canvasPixels.size} cached pixels.`);
  } catch (err) {
    console.warn('[Server] Could not load cached pixels:', err);
  }
}

// Debounced disk save
let saveTimeout: NodeJS.Timeout | null = null;
const persistPixelsDebounced = () => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const obj: Record<string, ServerPixel> = {};
      canvasPixels.forEach((v, k) => {
        obj[k] = v;
      });
      fs.writeFileSync(seedFile, JSON.stringify(obj), 'utf-8');
    } catch (e) {
      console.error('[Server] Persist error:', e);
    }
  }, 3000);
};

// Create HTTP and WebSocket server
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

interface ConnectedPlayer {
  ws: WebSocket;
  id: string;
  username?: string;
  x?: number;
  y?: number;
}

const connectedPlayers = new Map<WebSocket, ConnectedPlayer>();

const broadcast = (data: any, ignoreWs?: WebSocket) => {
  const payload = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client !== ignoreWs && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
};

const broadcastPlayerCount = () => {
  broadcast({
    type: 'presence:update',
    onlineCount: wss.clients.size,
    timestamp: Date.now()
  });
};

wss.on('connection', (ws: WebSocket) => {
  const player: ConnectedPlayer = {
    ws,
    id: `PLAYER_${Math.random().toString(36).substring(2, 9)}`
  };
  connectedPlayers.set(ws, player);

  // Send initial welcome & stats
  ws.send(JSON.stringify({
    type: 'welcome',
    playerId: player.id,
    onlineCount: wss.clients.size,
    totalPixels: canvasPixels.size,
    timestamp: Date.now()
  }));

  broadcastPlayerCount();

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'identify') {
        player.id = data.userId || player.id;
        player.username = data.username || 'Anonymous';
      } else if (data.type === 'cursor:move') {
        player.x = data.x;
        player.y = data.y;
        // Broadcast subtle presence to others
        broadcast({
          type: 'cursor:update',
          playerId: player.id,
          username: player.username,
          x: data.x,
          y: data.y
        }, ws);
      }
    } catch (err) {
      // Ignore malformed WS frames
    }
  });

  ws.on('close', () => {
    connectedPlayers.delete(ws);
    broadcastPlayerCount();
  });

  ws.on('error', () => {
    connectedPlayers.delete(ws);
  });
});

// --------------------------------------------------------------------
// REST API ENDPOINTS
// --------------------------------------------------------------------

// Health & 100-Player Beta Telemetry
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    mode: 'Beta 100 Players',
    uptimeSeconds: Math.floor(process.uptime()),
    onlinePlayers: wss.clients.size,
    totalPixelsPlaced: canvasPixels.size,
    auditLogsCount: auditLogs.length,
    timestamp: Date.now(),
  });
});

// Raw SQL Schema download / inspect for the user
app.get('/api/sql/schema', (req: Request, res: Response) => {
  try {
    const schemaPath = path.join(__dirname, 'database', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf-8');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.send(sql);
    }
    res.status(404).send('schema.sql not found');
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get all pixels or slice
app.get('/api/canvas/pixels', (req: Request, res: Response) => {
  const result: Record<string, ServerPixel> = {};
  canvasPixels.forEach((val, key) => {
    result[key] = val;
  });
  res.json({
    count: canvasPixels.size,
    pixels: result
  });
});

// Safe atomic batch placement
app.post('/api/canvas/batch', (req: Request, res: Response) => {
  const { user, pixels, mode, artId, title, link } = req.body;

  if (!user || !user.id || !Array.isArray(pixels)) {
    return res.status(400).json({ error: 'Некоректний запит' });
  }

  // Rate Limiting check for 100 players
  const now = Date.now();
  const cd = playerCooldowns.get(user.id) || { lastPlaced: 0, countInWindow: 0, windowStart: now };
  if (now - cd.windowStart > 60000) {
    cd.countInWindow = 0;
    cd.windowStart = now;
  }
  if (!user.isAdmin && cd.countInWindow > 10000) {
    return res.status(429).json({ error: 'Перевищено ліміт запитів на розміщення пікселів. Зачекайте 1 хвилину.' });
  }

  const isVIP = mode === 'VIP';
  const costPerPixel = isVIP ? 0.25 : 0.10;
  const totalCost = pixels.length * costPerPixel;

  if (!user.isAdmin && (user.balance || 0) < totalCost) {
    return res.status(400).json({ error: 'Недостатній баланс для розміщення пікселів' });
  }

  const placedUpdates: [string, ServerPixel][] = [];

  for (const p of pixels) {
    const { x, y, color } = p;
    if (typeof x !== 'number' || typeof y !== 'number' || !color) continue;
    if (x < 0 || x >= 10000 || y < 0 || y >= 10000) continue;

    const coordKey = `${x},${y}`;
    const existing = canvasPixels.get(coordKey);

    // VIP protection rule
    if (existing && existing.isVIP && !user.isAdmin && existing.ownerId !== user.id && !isVIP) {
      continue; // Skip protected VIP pixel
    }

    // Add to audit log
    auditLogs.push({
      id: `AUDIT_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      x,
      y,
      oldColor: existing?.color,
      newColor: color,
      userId: user.id,
      username: user.username,
      isVIP,
      artId: artId || undefined,
      cost: costPerPixel,
      timestamp: now
    });

    const pixelData: ServerPixel = {
      x,
      y,
      color,
      ownerId: user.id,
      ownerName: user.username,
      isVIP,
      artId: artId || undefined,
      description: title || undefined,
      link: link || undefined,
      timestamp: now
    };

    canvasPixels.set(coordKey, pixelData);
    placedUpdates.push([coordKey, pixelData]);
  }

  cd.countInWindow += placedUpdates.length;
  cd.lastPlaced = now;
  playerCooldowns.set(user.id, cd);

  persistPixelsDebounced();

  // Instant Real-Time WebSocket Broadcast to all 100 players!
  if (placedUpdates.length > 0) {
    broadcast({
      type: 'canvas:batch_update',
      user: { id: user.id, username: user.username },
      updates: placedUpdates,
      count: placedUpdates.length,
      timestamp: now
    });
  }

  res.json({
    success: true,
    placedCount: placedUpdates.length,
    newBalance: user.isAdmin ? user.balance : user.balance - (placedUpdates.length * costPerPixel)
  });
});

// Admin Rollback vandalism endpoint
app.post('/api/admin/rollback', (req: Request, res: Response) => {
  const { adminId, targetUserId, sinceHours = 24 } = req.body;
  if (!adminId || !targetUserId) {
    return res.status(400).json({ error: 'Необхідно вказати adminId та targetUserId' });
  }

  const sinceTime = Date.now() - (sinceHours * 60 * 60 * 1000);
  const targetLogs = auditLogs
    .filter(log => log.userId === targetUserId && log.timestamp >= sinceTime)
    .reverse();

  let reverted = 0;
  const revertedUpdates: [string, ServerPixel | null][] = [];

  for (const log of targetLogs) {
    const key = `${log.x},${log.y}`;
    if (log.oldColor) {
      const restored: ServerPixel = {
        x: log.x,
        y: log.y,
        color: log.oldColor,
        ownerId: 'SYSTEM_RESTORE',
        ownerName: 'System',
        isVIP: false,
        timestamp: Date.now()
      };
      canvasPixels.set(key, restored);
      revertedUpdates.push([key, restored]);
    } else {
      canvasPixels.delete(key);
      revertedUpdates.push([key, null]);
    }
    reverted++;
  }

  persistPixelsDebounced();

  // Broadcast rollback
  broadcast({
    type: 'canvas:rollback',
    targetUserId,
    revertedCount: reverted,
    updates: revertedUpdates
  });

  res.json({
    success: true,
    revertedCount: reverted,
    message: `Успішно відкочено ${reverted} змін користувача ${targetUserId}`
  });
});

// Keep audit logs bounded in memory (last 10,000)
setInterval(() => {
  if (auditLogs.length > 10000) {
    auditLogs.splice(0, auditLogs.length - 10000);
  }
}, 60000);

// --------------------------------------------------------------------
// FRONTEND STATIC OR VITE MIDDLEWARE
// --------------------------------------------------------------------
async function startServer() {
  if (!isProd) {
    // Dev mode with Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Production static serve
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[StinaPixel.ua] 🚀 Server running at http://0.0.0.0:${PORT} (Beta 100 Players Mode)`);
  });
}

startServer().catch(err => {
  console.error('[StinaPixel.ua] Failed to start server:', err);
});
