import { Router } from 'express';
import {
  getFleetHealth,
  getFleetActivity,
  parseWindow,
} from '../models/fleet.js';

const router = Router();

/**
 * GET /api/v1/fleet/health
 * Returns fleet health summary with agent list
 * Query: window=1h|6h|24h|7d (default 24h)
 */
router.get('/health', async (req, res) => {
  try {
    const windowParam = req.query.window || '24h';
    const hours = parseWindow(windowParam);

    const health = await getFleetHealth(req.orgId, hours);
    res.json(health);
  } catch (err) {
    console.error('Fleet health error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/fleet/activity
 * Returns last N events across all sessions for this org
 * Query: limit=N (default 100, max 1000)
 */
router.get('/activity', async (req, res) => {
  try {
    let limit = parseInt(req.query.limit, 10) || 100;
    limit = Math.min(limit, 1000); // Cap at 1000

    const events = await getFleetActivity(req.orgId, limit);
    res.json(events);
  } catch (err) {
    console.error('Fleet activity error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
