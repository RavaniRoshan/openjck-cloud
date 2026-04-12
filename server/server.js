import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { apiKeyAuth } from './middleware/api-key-auth.js';
import { jwtAuth } from './middleware/jwt-auth.js';
import { rateLimit } from './middleware/rate-limit.js';
import healthRouter from './routes/health.js';
import eventsRouter from './routes/events.js';
import sseRouter from './routes/sse.js';
import sessionsRouter from './routes/sessions.js';
import orgsRouter from './routes/orgs.js';
import fleetRouter from './routes/fleet.js';
import protocolRouter from './routes/protocol.js';

const app = express();
const PORT = process.env.PORT || 7070;

// Startup checks
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('WARNING: ANTHROPIC_API_KEY not set. AI Fix feature will be disabled.');
} else {
  console.log('✓ Anthropic API key detected - AI Fix feature enabled');
}

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use(healthRouter);

app.use('/api/v1/events', apiKeyAuth, rateLimit, eventsRouter);
app.use('/api/protocol/events', rateLimit, protocolRouter); // Open protocol, no auth, but rate limited
app.use('/api/sse', jwtAuth, sseRouter);
app.use('/api/v1/sessions', jwtAuth, sessionsRouter);
app.use('/api/v1/orgs', jwtAuth, orgsRouter);
app.use('/api/v1/fleet', jwtAuth, fleetRouter);

app.listen(PORT, () => {
  console.log(`OpenJCK API running on port ${PORT}`);
});
