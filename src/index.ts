import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';

import { logger } from './middleware/logger.js';
import { seed } from './lib/seed.js';
import { setIO } from './lib/socket.js';

import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import hqRoutes from './routes/hqRoutes.js';
import branchManagerRoutes from './routes/branchManagerRoutes.js';
import chefRoutes from './routes/chefRoutes.js';
import cashierRoutes from './routes/cashierRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import menuRoutes from './routes/menuRoutes.js';
import publicRoutes from './routes/publicRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Configuration ────────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 3001;
const NODE_ENV = process.env.NODE_ENV ?? 'development';
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

if (NODE_ENV === 'production' && JWT_SECRET === 'dev-secret') {
  console.warn('⚠️  WARNING: Using default JWT_SECRET in production! Set JWT_SECRET environment variable.');
}

// ── Express App ──────────────────────────────────────────────────────────────
const app = express();
const httpServer = createServer(app);

// Trust proxy for production (behind reverse proxy/load balancer)
app.set('trust proxy', 1);

// ── Socket.io ────────────────────────────────────────────────────────────────
const io = new SocketIO(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST'],
  },
});

io.use((socket, next) => {
  const token = socket.handshake.auth['token'] as string | undefined;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: number;
      role: string;
      branchId: number | null;
    };
    socket.data['user'] = decoded;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const user = socket.data['user'] as { id: number; role: string; branchId: number | null };
  if (user.branchId) socket.join(`branch_${user.branchId}`);
  if (['ADMIN', 'HQ_MANAGER'].includes(user.role)) socket.join('hq');
  console.log(`[Socket] ${user.role} #${user.id} connected`);
  socket.on('disconnect', () =>
    console.log(`[Socket] ${user.role} #${user.id} disconnected`)
  );
});

setIO(io);

// ── Express Middleware ───────────────────────────────────────────────────────
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(logger);

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── Health Check Endpoint ────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    version: '1.0.0',
  });
});

app.get('/ready', (_req, res) => {
  res.status(200).json({ status: 'ready' });
});

app.get('/live', (_req, res) => {
  res.status(200).json({ status: 'alive' });
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/hq', hqRoutes);
app.use('/api/branch-manager', branchManagerRoutes);
app.use('/api/chef', chefRoutes);
app.use('/api/cashier', cashierRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/public', publicRoutes);

// ── 404 Handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${_req.method} ${_req.url} not found`,
  });
});

// ── Error Handling Middleware ────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[Error] ${new Date().toISOString()}:`, err);

  const status = res.statusCode !== 200 ? res.statusCode : 500;
  res.status(status).json({
    error: err.name || 'InternalServerError',
    message: NODE_ENV === 'development' ? err.message : 'Internal Server Error',
    ...(NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ── Graceful Shutdown ────────────────────────────────────────────────────────
const gracefulShutdown = async (signal: string) => {
  console.log(`\n[${signal}] Received. Starting graceful shutdown...`);

  httpServer.close(() => {
    console.log('[HTTP] Server closed.');
  });

  io.close(() => {
    console.log('[Socket.IO] Socket server closed.');
  });

  // Give connections time to close
  setTimeout(() => {
    console.log('[Process] Exiting...');
    process.exit(0);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ── Start Server ─────────────────────────────────────────────────────────────
httpServer.listen({ port: PORT, host: '0.0.0.0' }, async () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🥩 Steakz API Server                                    ║
║                                                           ║
║   Environment: ${NODE_ENV.padEnd(45)}║
║   Port: ${String(PORT).padEnd(51)}║
║   Frontend URL: ${FRONTEND_URL.padEnd(43)}║
║                                                           ║
║   Health: http://localhost:${PORT}/health ${String(Math.max(27 - String(PORT).length, 0)).padEnd(0)}║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

  // Run database seed only in development
  if (NODE_ENV === 'development') {
    await seed();
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection] at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]:', err);
  process.exit(1);
});