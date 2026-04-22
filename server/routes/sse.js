import { Router } from 'express';
import { addConnection, removeConnection, getConnectionCount } from '../sse-emitter.js';
import { listSessions } from '../models/clawSession.js';
import { getFleetHealth } from '../models/fleet.js';

const router = Router();

// Max connections per org
const MAX_CONNECTIONS_PER_ORG = 10;

router.get('/', async (req, res) => {
  const orgId = req.orgId;

  // Connection limit check
  const currentConnections = getConnectionCount(orgId);
  if (currentConnections >= MAX_CONNECTIONS_PER_ORG) {
    return res.status(429).json({
      error: 'Too many connections',
      code: 'CONNECTION_LIMIT',
      max: MAX_CONNECTIONS_PER_ORG,
      current: currentConnections,
      retryAfter: 30
    });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Send snapshot on connect
  try {
    const [sessions, fleet] = await Promise.all([
      listSessions(orgId, { limit: 50 }),
      getFleetHealth(orgId, 24).catch(() => null),
    ]);

    const snapshot = {
      sessions: sessions || [],
      fleet: fleet,
      timestamp: new Date().toISOString(),
    };

    res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
  } catch (err) {
    console.error('[SSE] Failed to send snapshot:', err.message);
    // Continue without snapshot - client will use fallback
  }

  addConnection(orgId, res);

  // Heartbeat to keep connection alive and detect dead connections
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      // Connection is dead, will be cleaned up on next heartbeat
      clearInterval(heartbeat);
    }
  }, 15_000);

  // Dead connection detection
  const deadConnectionCheck = setInterval(() => {
    if (res.writableEnded || res.destroyed) {
      clearInterval(heartbeat);
      clearInterval(deadConnectionCheck);
      removeConnection(orgId, res);
    }
  }, 30_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clearInterval(deadConnectionCheck);
    removeConnection(orgId, res);
  });

  // Handle connection errors
  res.on('error', (err) => {
    console.error('[SSE] Connection error:', err.message);
    clearInterval(heartbeat);
    clearInterval(deadConnectionCheck);
    removeConnection(orgId, res);
  });
});

export default router;
