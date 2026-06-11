import { Router } from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import prisma from '../lib/prisma.js';
import { verifyToken, requireRole, requireBranch } from '../middleware/auth.js';
import { uploadMenuImage } from '../middleware/upload.js';

const router = Router();

// Public — no auth
router.get('/:branchId', async (req: Request, res: Response) => {
  const branchId = parseInt(req.params['branchId'] as string ?? '0');
  const items = await prisma.menuItem.findMany({
    where:   { branchId, isAvailable: true },
    orderBy: { category: 'asc' },
  });
  res.json(items);
});

// Branch manager creates item (with optional image)
router.post(
  '/',
  verifyToken,
  requireRole(['BRANCH_MANAGER', 'ADMIN']),
  requireBranch,
  (req: Request, res: Response, next) => {
    uploadMenuImage(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    const branchId = req.user!.branchId!;
    const { name, description, price, category } = req.body as {
      name: string; description?: string; price: string; category: string;
    };
    if (!name || !price || !category) {
      res.status(400).json({ error: 'name, price and category are required.' });
      return;
    }

    const imageUrl = req.file
      ? `/uploads/menu/${path.basename(req.file.path)}`
      : undefined;

    const item = await prisma.menuItem.create({
      data: {
        name,
        description,
        price:    parseFloat(price),
        category,
        branchId,
        imageUrl,
      },
    });
    res.status(201).json(item);
  }
);

// Branch manager updates item (with optional image replacement)
router.patch(
  '/:id',
  verifyToken,
  requireRole(['BRANCH_MANAGER', 'ADMIN']),
  requireBranch,
  (req: Request, res: Response, next) => {
    uploadMenuImage(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    const branchId = req.user!.branchId!;
    const id = parseInt(req.params['id'] as string ?? '0');
    const item = await prisma.menuItem.findUnique({ where: { id } });
    if (!item || item.branchId !== branchId) {
      res.status(403).json({ error: 'Item not found in your branch.' });
      return;
    }

    const { name, description, price, category, isAvailable } = req.body as {
      name?: string; description?: string; price?: string;
      category?: string; isAvailable?: string;
    };

    const imageUrl = req.file
      ? `/uploads/menu/${path.basename(req.file.path)}`
      : undefined;

    const updated = await prisma.menuItem.update({
      where: { id },
      data: {
        ...(name        !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price       !== undefined && { price: parseFloat(price) }),
        ...(category    !== undefined && { category }),
        ...(isAvailable !== undefined && { isAvailable: isAvailable === 'true' }),
        ...(imageUrl    !== undefined && { imageUrl }),
      },
    });
    res.json(updated);
  }
);

export default router;
