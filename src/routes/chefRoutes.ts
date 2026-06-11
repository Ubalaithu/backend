import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { verifyToken, requireRole, requireBranch } from '../middleware/auth.js';
import { getIO } from '../lib/socket.js';
import { paginationParams, paginated } from '../lib/paginate.js';

const router = Router();
router.use(verifyToken, requireRole(['CHEF']), requireBranch);

router.get('/orders', async (req: Request, res: Response) => {
  const branchId = req.user!.branchId!;
  const { page, limit, skip } = paginationParams(req.query as Record<string, unknown>);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where:   { branchId, status: { in: ['PENDING', 'PREPARING'] } },
      include: { items: { include: { menuItem: { select: { name: true } } } } },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
    }),
    prisma.order.count({ where: { branchId, status: { in: ['PENDING', 'PREPARING'] } } }),
  ]);

  res.json(paginated(orders, total, page, limit));
});

router.patch('/orders/:id/done', async (req: Request, res: Response) => {
  const branchId = req.user!.branchId!;
  const id = parseInt(req.params['id'] as string ?? '0');
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.branchId !== branchId) {
    res.status(403).json({ error: 'Order not found in your branch.' });
    return;
  }
  const updated = await prisma.order.update({
    where:   { id },
    data:    { status: 'DONE' },
    include: { items: { include: { menuItem: true } }, branch: { select: { name: true } } },
  });

  const io = getIO();
  io.to(`branch_${branchId}`).emit('order:updated', updated);
  io.to('hq').emit('order:updated', updated);

  res.json(updated);
});

router.get('/menu', async (req: Request, res: Response) => {
  const branchId = req.user!.branchId!;
  const items = await prisma.menuItem.findMany({ where: { branchId } });
  res.json(items);
});

router.delete('/menu/:id', async (req: Request, res: Response) => {
  const branchId = req.user!.branchId!;
  const id = parseInt(req.params['id'] as string ?? '0');
  const item = await prisma.menuItem.findUnique({ where: { id } });
  if (!item || item.branchId !== branchId) {
    res.status(403).json({ error: 'Menu item not found in your branch.' });
    return;
  }
  await prisma.menuItem.delete({ where: { id } });
  res.json({ message: 'Menu item deleted.' });
});

export default router;
