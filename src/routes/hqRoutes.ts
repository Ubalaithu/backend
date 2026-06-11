import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { paginationParams, paginated } from '../lib/paginate.js';

const router = Router();
router.use(verifyToken, requireRole(['HQ_MANAGER', 'ADMIN']));

router.get('/overview', async (_req: Request, res: Response) => {
  const branches = await prisma.branch.findMany({
    include: { _count: { select: { orders: true, users: true } } },
  });
  res.json(branches);
});

router.get('/orders', async (req: Request, res: Response) => {
  const { page, limit, skip } = paginationParams(req.query as Record<string, unknown>);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      include: {
        branch:   { select: { name: true } },
        items:    { include: { menuItem: true } },
        customer: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.order.count(),
  ]);

  res.json(paginated(orders, total, page, limit));
});

router.get('/staff', async (_req: Request, res: Response) => {
  const staff = await prisma.user.findMany({
    where: { role: { in: ['BRANCH_MANAGER', 'CHEF', 'CASHIER', 'HQ_MANAGER'] } },
    select: {
      id: true, name: true, role: true, salary: true, isActive: true,
      branch: { select: { name: true } },
    },
  });
  res.json(staff);
});

router.get('/sales', async (_req: Request, res: Response) => {
  const sales = await prisma.order.groupBy({
    by: ['branchId'],
    _sum:   { total: true },
    _count: { id: true },
    where:  { status: { in: ['DONE', 'DELIVERED'] } },
  });
  const branches = await prisma.branch.findMany({ select: { id: true, name: true } });
  const branchMap = Object.fromEntries(branches.map(b => [b.id, b.name]));
  const result = sales.map(s => ({
    branchId:   s.branchId,
    branchName: branchMap[s.branchId] ?? 'Unknown',
    totalSales: s._sum.total ?? 0,
    orderCount: s._count.id,
  }));
  res.json(result);
});

export default router;
