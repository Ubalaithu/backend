import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

router.get('/branches', async (_req: Request, res: Response) => {
  const branches = await prisma.branch.findMany({ where: { isActive: true } });
  res.json(branches);
});

router.get('/branches/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] as string ?? '0');
  const branch = await prisma.branch.findUnique({
    where:   { id },
    include: {
      tables:    { where: { isAvailable: true } },
      menuItems: { where: { isAvailable: true } },
    },
  });
  if (!branch) {
    res.status(404).json({ error: 'Branch not found.' });
    return;
  }
  res.json(branch);
});

export default router;
