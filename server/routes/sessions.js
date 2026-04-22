import { Router } from 'express';
import { getSession, listSessions, endSession, terminateSession } from '../models/clawSession.js';
import { getSteps, hasRecording } from '../models/stepPackets.js';
import { emitToOrg } from '../sse-emitter.js';
import { validateUUIDParam } from '../middleware/validate.js';
import aiFixRouter from './ai-fix.js';

const router = Router();

// Mount AI Fix endpoints under /:id/fix
router.use('/:id/fix', aiFixRouter);

router.get('/', async (req, res) => {
  try {
    const { status, claw_name, project, limit, offset } = req.query;
    const sessions = await listSessions(req.orgId, {
      status,
      claw_name,
      project,
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
    });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', validateUUIDParam('id'), async (req, res) => {
  try {
    const session = await getSession(req.params.id, req.orgId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/steps', validateUUIDParam('id'), async (req, res) => {
  try {
    const steps = await getSteps(req.params.id, req.orgId);
    res.json(steps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/has-recording', validateUUIDParam('id'), async (req, res) => {
  try {
    const result = await hasRecording(req.params.id, req.orgId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/terminate', validateUUIDParam('id'), async (req, res) => {
  try {
    const sessionId = req.params.id;
    const orgId = req.orgId;

    // Get current session state
    const session = await getSession(sessionId, orgId);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    // Check if already terminal (idempotent)
    const terminalStatuses = ['completed', 'failed', 'terminated'];
    if (terminalStatuses.includes(session.status)) {
      return res.json({
        ...session,
        _note: `Session already ${session.status}`,
        _idempotent: true
      });
    }

    // Perform termination with atomic guard strike
    const ended = await terminateSession(sessionId, orgId);

    emitToOrg(orgId, 'session_ended', ended);
    res.json(ended);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
