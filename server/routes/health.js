import { Router } from 'express';
import { checkDbHealth } from '../db.js';

const router = Router();

router.get('/health', async (req, res) => {
  // Check database health
  const dbHealth = await checkDbHealth();

  const overallStatus = dbHealth.healthy ? 'ok' : 'degraded';
  const statusCode = dbHealth.healthy ? 200 : 503;

  res.status(statusCode).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || 'dev',
    database: dbHealth,
  });
});

/**
 * Readiness check - for Kubernetes/Container health
 * Returns 200 when ready to serve traffic
 */
router.get('/ready', async (req, res) => {
  const dbHealth = await checkDbHealth();

  if (dbHealth.healthy) {
    res.status(200).json({
      ready: true,
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      ready: false,
      error: 'Database not available',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Liveness check - for Kubernetes/Container health
 * Returns 200 if process is alive
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    alive: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
