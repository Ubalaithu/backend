import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { verifyToken, requireRole, requireBranch } from '../middleware/auth.js';
import { getIO } from '../lib/socket.js';
import { paginationParams, paginated } from '../lib/paginate.js';

const router = Router();
router.use(verifyToken, requireRole(['CASHIER']), requireBranch);

router.post('/orders', async (req: Request, res: Response) => {
  const branchId = req.user!.branchId!;
  const { customerId, bookingId, items } = req.body as {
    customerId?: number;
    bookingId?:  number;
    items: { menuItemId: number; quantity: number }[];
  };

  if (!items || items.length === 0) {
    res.status(400).json({ error: 'At least one item is required.' });
    return;
  }

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: items.map(i => i.menuItemId) }, branchId },
  });

  if (menuItems.length !== items.length) {
    res.status(400).json({ error: 'One or more menu items are invalid for this branch.' });
    return;
  }

  const priceMap = Object.fromEntries(menuItems.map(m => [m.id, m.price]));
  const total    = items.reduce((sum, i) => sum + (priceMap[i.menuItemId] ?? 0) * i.quantity, 0);

  const order = await prisma.order.create({
    data: {
      branchId,
      customerId: customerId ?? null,
      bookingId:  bookingId  ?? null,
      total,
      items: {
        create: items.map(i => ({
          menuItemId: i.menuItemId,
          quantity:   i.quantity,
          unitPrice:  priceMap[i.menuItemId] ?? 0,
        })),
      },
    },
    include: {
      items:  { include: { menuItem: true } },
      branch: { select: { name: true } },
    },
  });

  const io = getIO();
  io.to(`branch_${branchId}`).emit('order:created', order);
  io.to('hq').emit('order:created', order);

  res.status(201).json(order);
});

router.get('/orders', async (req: Request, res: Response) => {
  const branchId = req.user!.branchId!;
  const { page, limit, skip } = paginationParams(req.query as Record<string, unknown>);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where:   { branchId },
      include: { items: { include: { menuItem: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.order.count({ where: { branchId } }),
  ]);

  res.json(paginated(orders, total, page, limit));
});

router.get('/bookings', async (req: Request, res: Response) => {
  const branchId = req.user!.branchId!;
  const { page, limit, skip } = paginationParams(req.query as Record<string, unknown>);

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where: { table: { branchId } },
      include: {
        table: { include: { branch: { select: { name: true } } } },
        customer: { select: { name: true, email: true } },
        orders: { select: { total: true } },
      },
      orderBy: { date: 'desc' },
      skip,
      take: limit,
    }),
    prisma.booking.count({ where: { table: { branchId } } }),
  ]);

  // Calculate total spent from orders for each booking
  const bookingsWithPrices = bookings.map(b => ({
    ...b,
    totalSpent: b.orders.reduce((sum, o) => sum + o.total, 0),
  }));

  res.json(paginated(bookingsWithPrices, total, page, limit));
});

router.patch('/orders/:id/deliver', async (req: Request, res: Response) => {
  const branchId = req.user!.branchId!;
  const id = parseInt(req.params['id'] as string ?? '0');
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.branchId !== branchId) {
    res.status(403).json({ error: 'Order not found in your branch.' });
    return;
  }
  const updated = await prisma.order.update({
    where:   { id },
    data:    { status: 'DELIVERED' },
    include: { items: { include: { menuItem: true } }, branch: { select: { name: true } } },
  });

  const io = getIO();
  io.to(`branch_${branchId}`).emit('order:updated', updated);
  io.to('hq').emit('order:updated', updated);

  res.json(updated);
});

export default router;
