import { getFleetHealth } from './models/fleet.js';

const orgConnections = new Map();
const orgTimers = new Map(); // orgId -> interval ID

/**
 * Get connection count for an org
 */
export function getConnectionCount(orgId) {
  const connections = orgConnections.get(orgId);
  return connections?.size || 0;
}

/**
 * Emit event to all connections in an org
 */
export function emitToOrg(orgId, eventName, data) {
  const connections = orgConnections.get(orgId);
  if (!connections?.size) return;
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  connections.forEach(res => {
    try {
      res.write(payload);
    } catch {
      connections.delete(res);
    }
  });
}

/**
 * Emit fleet update for an org (called by interval)
 */
async function emitFleetUpdate(orgId) {
  try {
    const connections = orgConnections.get(orgId);
    if (!connections?.size) return; // No connections, stop timer

    // Get fleet health (use 24h window default)
    const health = await getFleetHealth(orgId, 24);

    // Emit only if there are running sessions (per spec: no spam when idle)
    if (health.running > 0) {
      const payload = {
        event: 'fleet:update',
        data: {
          agents: health.agents,
          health_status: health.status,
          timestamp: new Date().toISOString(),
        },
      };
      connections.forEach(res => {
        try {
          res.write(`event: ${payload.event}\ndata: ${JSON.stringify(payload.data)}\n\n`);
        } catch {
          connections.delete(res);
        }
      });
    }
  } catch (err) {
    console.error('Fleet update error:', err);
  }
}

/**
 * Start fleet update interval for an org (if not already running)
 */
function startFleetUpdates(orgId) {
  if (orgTimers.has(orgId)) return; // Already running
  // Emit immediately then every 2s
  const intervalId = setInterval(() => emitFleetUpdate(orgId), 2000);
  orgTimers.set(orgId, intervalId);
}

/**
 * Stop fleet update interval for an org (when no connections left)
 */
function stopFleetUpdates(orgId) {
  const intervalId = orgTimers.get(orgId);
  if (intervalId) {
    clearInterval(intervalId);
    orgTimers.delete(orgId);
  }
}

export function addConnection(orgId, res) {
  if (!orgConnections.has(orgId)) orgConnections.set(orgId, new Set());
  orgConnections.get(orgId).add(res);
  startFleetUpdates(orgId);
}

export function removeConnection(orgId, res) {
  const connections = orgConnections.get(orgId);
  if (connections) {
    connections.delete(res);
    if (connections.size === 0) {
      orgConnections.delete(orgId);
      stopFleetUpdates(orgId);
    }
  }
}
