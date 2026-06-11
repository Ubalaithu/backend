import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';

import { logger } from './middleware/logger.js';
import { seed }   from './lib/seed.js';
import { setIO }  from './lib/socket.js';

import authRoutes          from './routes/authRoutes.js';
import adminRoutes         from './routes/adminRoutes.js';
import hqRoutes            from './routes/hqRoutes.js';
import branchManagerRoutes from './routes/branchManagerRoutes.js';
import chefRoutes          from './routes/chefRoutes.js';
import cashierRoutes       from './routes/cashierRoutes.js';
import customerRoutes      from './routes/customerRoutes.js';
import menuRoutes          from './routes/menuRoutes.js';
import publicRoutes        from './routes/publicRoutes.js';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const PORT       = process.env['PORT']       ?? 3001;
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'dev-secret';
const FRONTEND   = process.env['FRONTEND_URL'] ?? 'http://localhost:5173';

const app        = express();
const httpServer = createServer(app);

// ── Socket.io ──────────────────────────────────────────────────────────────
const io = new SocketIO(httpServer, {
  cors: { origin: FRONTEND, credentials: true },
});

io.use((socket, next) => {
  const token = socket.handshake.auth['token'] as string | undefined;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: number; role: string; branchId: number | null;
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

// ── Express middleware ─────────────────────────────────────────────────────
app.use(cors({
  origin: FRONTEND,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(logger);
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',           authRoutes);
app.use('/api/admin',          adminRoutes);
app.use('/api/hq',             hqRoutes);
app.use('/api/branch-manager', branchManagerRoutes);
app.use('/api/chef',           chefRoutes);
app.use('/api/cashier',        cashierRoutes);
app.use('/api/customer',       customerRoutes);
app.use('/api/menu',           menuRoutes);
app.use('/api/public',         publicRoutes);

// ── Start ───────────────────────────────────────────────────────────────────
httpServer.listen(PORT, async () => {
  await seed();
  console.log(`Steakz API running on http://localhost:${PORT}`);
});
