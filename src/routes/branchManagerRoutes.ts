import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { verifyToken, requireRole, requireBranch } from '../middleware/auth.js';
import { paginationParams, paginated } from '../lib/paginate.js';

const router = Router();
router.use(verifyToken, requireRole(['BRANCH_MANAGER']), requireBranch);

router.get('/overview', async (req: Request, res: Response) => {
  const branchId = req.user!.branchId!;
  const branch = await prisma.branch.findUnique({
    where:   { id: branchId },
    include: { _count: { select: { orders: true, users: true, tables: true } } },
  });
  res.json(branch);
});

router.get('/orders', async (req: Request, res: Response) => {
  const branchId = req.user!.branchId!;
  const { page, limit, skip } = paginationParams(req.query as Record<string, unknown>);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where:   { branchId },
      include: {
        items:    { include: { menuItem: true } },
        customer: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.order.count({ where: { branchId } }),
  ]);

  res.json(paginated(orders, total, page, limit));
});

router.get('/staff', async (req: Request, res: Response) => {
  const branchId = req.user!.branchId!;
  const staff = await prisma.user.findMany({
    where:  { branchId, role: { in: ['CHEF', 'CASHIER', 'BRANCH_MANAGER'] } },
    select: { id: true, name: true, role: true, salary: true, isActive: true },
  });
  res.json(staff);
});

router.get('/bookings', async (req: Request, res: Response) => {
  const branchId = req.user!.branchId!;
  const { page, limit, skip } = paginationParams(req.query as Record<string, unknown>);

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where:   { table: { branchId } },
      include: {
        customer: { select: { name: true } },
        table:    { select: { tableNumber: true } },
      },
      orderBy: { date: 'asc' },
      skip,
      take: limit,
    }),
    prisma.booking.count({ where: { table: { branchId } } }),
  ]);

  res.json(paginated(bookings, total, page, limit));
});

router.get('/sales', async (req: Request, res: Response) => {
  const branchId = req.user!.branchId!;
  const result = await prisma.order.aggregate({
    where:  { branchId, status: { in: ['DONE', 'DELIVERED'] } },
    _sum:   { total: true },
    _count: { id: true },
  });
  res.json({ totalSales: result._sum.total ?? 0, orderCount: result._count.id });
});

export default router;
