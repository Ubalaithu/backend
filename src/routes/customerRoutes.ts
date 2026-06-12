import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { getIO } from '../lib/socket.js';
import { paginationParams, paginated } from '../lib/paginate.js';

const router = Router();
router.use(verifyToken, requireRole(['CUSTOMER']));

router.get('/bookings', async (req: Request, res: Response) => {
  const customerId = req.user!.id;
  const { page, limit, skip } = paginationParams(req.query as Record<string, unknown>);

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where:   { customerId },
      include: { table: { include: { branch: { select: { name: true } } } } },
      orderBy: { date: 'desc' },
      skip,
      take: limit,
    }),
    prisma.booking.count({ where: { customerId } }),
  ]);

  res.json(paginated(bookings, total, page, limit));
});

router.post('/bookings', async (req: Request, res: Response) => {
  const customerId = req.user!.id;
  const { tableId, guestCount, date } = req.body as {
    tableId: number; guestCount: number; date: string;
  };

  if (!tableId || !guestCount || !date) {
    res.status(400).json({ error: 'tableId, guestCount and date are required.' });
    return;
  }

  const table = await prisma.table.findUnique({ where: { id: tableId } });
  if (!table || !table.isAvailable) {
    res.status(400).json({ error: 'Table is not available.' });
    return;
  }

  const booking = await prisma.booking.create({
    data: { customerId, tableId, guestCount, date: new Date(date) },
    include: { table: { include: { branch: { select: { name: true } } } } },
  });
  res.status(201).json(booking);
});

router.delete('/bookings/:id', async (req: Request, res: Response) => {
  const customerId = req.user!.id;
  const id = parseInt(req.params['id'] as string ?? '0');
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking || booking.customerId !== customerId) {
    res.status(403).json({ error: 'Booking not found.' });
    return;
  }
  await prisma.booking.update({ where: { id }, data: { status: 'CANCELLED' } });
  res.json({ message: 'Booking cancelled.' });
});

router.get('/orders', async (req: Request, res: Response) => {
  const customerId = req.user!.id;
  const { page, limit, skip } = paginationParams(req.query as Record<string, unknown>);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where:   { customerId },
      include: {
        items:  { include: { menuItem: true } },
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.order.count({ where: { customerId } }),
  ]);

  res.json(paginated(orders, total, page, limit));
});

router.post('/orders', async (req: Request, res: Response) => {
  const customerId = req.user!.id;
  const { bookingId, items } = req.body as {
    bookingId: number;
    items: { menuItemId: number; quantity: number }[];
  };

  if (!bookingId || !items || items.length === 0) {
    res.status(400).json({ error: 'bookingId and items are required.' });
    return;
  }

  const booking = await prisma.booking.findUnique({
    where:   { id: bookingId },
    include: { table: true },
  });

  if (!booking || booking.customerId !== customerId) {
    res.status(403).json({ error: 'Booking not found.' });
    return;
  }

  const branchId = booking.table.branchId;
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: items.map(i => i.menuItemId) }, branchId },
  });

  const priceMap = Object.fromEntries(menuItems.map(m => [m.id, m.price]));
  const total    = items.reduce((sum, i) => sum + (priceMap[i.menuItemId] ?? 0) * i.quantity, 0);

  const [order] = await prisma.$transaction([
    prisma.order.create({
      data: {
        customerId, bookingId, branchId, total,
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
    }),
    prisma.booking.update({ where: { id: bookingId }, data: { status: 'CONFIRMED' } }),
  ]);

  const io = getIO();
  io.to(`branch_${branchId}`).emit('order:created', order);
  io.to('hq').emit('order:created', order);

  res.status(201).json(order);
});

export default router;
