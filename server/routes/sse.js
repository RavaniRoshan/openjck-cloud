import { Router } from 'express';
import { addConnection, removeConnection } from '../sse-emitter.js';

const router = Router();

router.get('/', (req, res) => {
  const orgId = req.orgId;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  addConnection(orgId, res);

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeConnection(orgId, res);
  });
});

export default router;
