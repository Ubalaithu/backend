import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { paginationParams, paginated } from '../lib/paginate.js';

const router = Router();
router.use(verifyToken, requireRole(['ADMIN']));

router.post('/branches', async (req: Request, res: Response) => {
  const { name, address, phone } = req.body as {
    name: string; address: string; phone?: string;
  };
  if (!name || !address) {
    res.status(400).json({ error: 'name and address are required.' });
    return;
  }
  try {
    const branch = await prisma.branch.create({ data: { name, address, phone } });
    res.status(201).json(branch);
  } catch {
    res.status(409).json({ error: 'Branch name already exists.' });
  }
});

router.get('/branches', async (_req: Request, res: Response) => {
  const branches = await prisma.branch.findMany({ orderBy: { id: 'asc' } });
  res.json(branches);
});

router.post('/users', async (req: Request, res: Response) => {
  const { name, email, password, role, branchId, salary } = req.body as {
    name: string; email: string; password: string;
    role: string; branchId?: number; salary?: number;
  };
  if (!name || !email || !password || !role) {
    res.status(400).json({ error: 'name, email, password and role are required.' });
    return;
  }
  const hashed = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({
      data: {
        name, email, password: hashed,
        role: role as any,
        branchId: branchId ?? null,
        salary:   salary   ?? null,
      },
    });
    res.status(201).json({ message: 'User created.', userId: user.id });
  } catch {
    res.status(409).json({ error: 'Email already in use.' });
  }
});

router.get('/users', async (req: Request, res: Response) => {
  const { page, limit, skip } = paginationParams(req.query as Record<string, unknown>);

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true, name: true, email: true,
        role: true, isActive: true, branchId: true, salary: true,
        branch: { select: { name: true } },
      },
      orderBy: { id: 'asc' },
      skip,
      take: limit,
    }),
    prisma.user.count(),
  ]);

  res.json(paginated(users, total, page, limit));
});

const BRANCH_REQUIRED_ROLES = ['BRANCH_MANAGER', 'CHEF', 'CASHIER'];

router.patch('/users/:id/role', async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] as string ?? '0');
  const { role, branchId } = req.body as { role: string; branchId?: number };
  if (BRANCH_REQUIRED_ROLES.includes(role) && !branchId) {
    res.status(400).json({ error: 'A branch is required for this role.' });
    return;
  }
  const user = await prisma.user.update({
    where: { id },
    data:  { role: role as any, branchId: branchId ?? null },
  });
  res.json({ message: 'Role updated.', user });
});

router.patch('/users/:id/disable', async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] as string ?? '0');
  await prisma.user.update({ where: { id }, data: { isActive: false } });
  res.json({ message: 'User disabled.' });
});

router.patch('/users/:id/enable', async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] as string ?? '0');
  await prisma.user.update({ where: { id }, data: { isActive: true } });
  res.json({ message: 'User enabled.' });
});

router.delete('/users/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] as string ?? '0');
  await prisma.user.delete({ where: { id } });
  res.json({ message: 'User deleted.' });
});

export default router;
