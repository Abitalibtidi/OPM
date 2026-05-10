import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';

import authRoutes from './routes/auth';
import valuationRoutes from './routes/valuations';
import shareClassRoutes from './routes/shareClasses';
import userRoutes from './routes/users';
import auditLogRoutes from './routes/auditLog';
import exportRoutes from './routes/exportRoutes';
import dlomRoutes from './routes/dlom';

const app = express();

// ── Security Middleware ──
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ── Routes ──
app.use('/api/auth', authRoutes);
app.use('/api/valuations', valuationRoutes);
app.use('/api/valuations/:valuationId/share-classes', shareClassRoutes);
app.use('/api/users', userRoutes);
app.use('/api/audit-log', auditLogRoutes);
app.use('/api/valuations/:id/export', exportRoutes);
app.use('/api/valuations/:id/dlom', dlomRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Start Server ──
app.listen(config.port, () => {
  console.log(`OPM Server running on port ${config.port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
