import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET     = process.env['JWT_SECRET']     ?? 'dev-secret';
const JWT_EXPIRES_IN = process.env['JWT_EXPIRES_IN'] ?? '7d';

router.post('/register', async (req: Request, res: Response) => {
  const { name, email, password } = req.body as {
    name: string; email: string; password: string;
  };

  if (!name || !email || !password) {
    res.status(400).json({ error: 'name, email and password are required.' });
    return;
  }

  const hashed = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: { name, email, password: hashed, role: 'CUSTOMER' },
    });
    res.status(201).json({ message: 'Registration successful.', userId: user.id });
  } catch {
    res.status(409).json({ error: 'Email already in use.' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required.' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.isActive) {
    res.status(401).json({ error: 'Invalid credentials or account is inactive.' });
    return;
  }

  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    res.status(401).json({ error: 'Invalid credentials or account is inactive.' });
    return;
  }

  const token = jwt.sign(
    { id: user.id, role: user.role, branchId: user.branchId },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, role: user.role, branchId: user.branchId },
  });
});

router.get('/me', verifyToken, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where:  { id: req.user!.id },
    select: { id: true, name: true, email: true, role: true, branchId: true, isActive: true },
  });
  res.json(user);
});

export default router;
