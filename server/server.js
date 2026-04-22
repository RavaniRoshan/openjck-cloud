import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { apiKeyAuth } from './middleware/api-key-auth.js';
import { jwtAuth } from './middleware/jwt-auth.js';
import { rateLimit } from './middleware/rate-limit.js';
import { errorHandler, notFoundHandler, setupUnhandledRejectionHandler } from './middleware/error-handler.js';
import healthRouter from './routes/health.js';
import eventsRouter from './routes/events.js';
import sseRouter from './routes/sse.js';
import sessionsRouter from './routes/sessions.js';
import orgsRouter from './routes/orgs.js';
import fleetRouter from './routes/fleet.js';
import apiKeysRouter from './routes/api-keys.js';
import alertsRouter from './routes/alerts.js';
import protocolRouter from './routes/protocol.js';
import aiKeysRouter from './routes/aiKeys.js';

const app = express();
const PORT = process.env.PORT || 7070;

// Setup unhandled rejection handler
setupUnhandledRejectionHandler();

// Startup checks
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('WARNING: ANTHROPIC_API_KEY not set. AI Fix feature will be disabled.');
} else {
  console.log('✓ Anthropic API key detected - AI Fix feature enabled');
}

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check (before auth)
app.use(healthRouter);

// API routes
app.use('/api/v1/events', apiKeyAuth, rateLimit, eventsRouter);
app.use('/api/protocol/events', rateLimit, protocolRouter); // Open protocol, no auth, but rate limited
app.use('/api/sse', jwtAuth, sseRouter);
app.use('/api/v1/sessions', jwtAuth, sessionsRouter);
app.use('/api/v1/orgs', jwtAuth, orgsRouter);
app.use('/api/v1/fleet', jwtAuth, fleetRouter);
app.use('/api/v1/api-keys', jwtAuth, apiKeysRouter);
app.use('/api/v1/alerts', jwtAuth, alertsRouter);
app.use('/api/v1/settings/ai-keys', jwtAuth, aiKeysRouter);

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Global error handler - MUST be last
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`OpenJCK API running on port ${PORT}`);
});
