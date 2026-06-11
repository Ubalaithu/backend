import bcrypt from 'bcryptjs';
import prisma from './prisma.js';

const BRANCHES = [
  { name: 'Steakz City Centre',  address: '1 Main Street, City Centre' },
  { name: 'Steakz Northside',    address: '45 North Ave, Northside' },
  { name: 'Steakz Southgate',    address: '88 South Road, Southgate' },
  { name: 'Steakz East Quarter', address: '12 East Lane, East Quarter' },
  { name: 'Steakz Westfield',    address: '200 West Mall, Westfield' },
  { name: 'Steakz Marina Bay',   address: '9 Marina Blvd, Marina Bay' },
  { name: 'Steakz Uptown',       address: '77 Uptown Drive, Uptown' },
  { name: 'Steakz Airport',      address: 'Terminal 2, International Airport' },
];

const PREMIUM_MENU = [
  // ──── SPECIALS (Chef's Selection) ────
  {
    category: '✨ SPECIALS',
    items: [
      { name: 'Wagyu A5 Japanese Ribeye', description: 'Perfectly marbled A5 Wagyu with truffle butter and seasonal vegetables. A masterpiece in every bite.', price: 95 },
      { name: 'Dry-Aged Tomahawk (48oz)', description: 'Heritage bone-in steak, aged 45 days for unparalleled depth. Served with roasted bone marrow and fleur de sel.', price: 125 },
      { name: 'Pan-Seared Foie Gras', description: 'Seared Hudson Valley foie gras with cherry gastrique and brioche. The chef\'s pride.', price: 48 },
    ],
  },
  // ──── PRIME CUTS ────
  {
    category: 'PRIME CUTS',
    items: [
      { name: 'Filet Mignon (8oz)', description: 'The most tender cut. Topped with béarnaise and fine herbs. The pinnacle of elegance.', price: 65 },
      { name: 'NY Strip (14oz)', description: 'Bold flavor, perfect marbling. Aged 28 days. A classic with character.', price: 58 },
      { name: 'Porterhouse (20oz)', description: 'Two steaks in one — filet and strip. A showstopper for those with an appetite.', price: 78 },
      { name: 'Ribeye (12oz)', description: 'Luxurious fat marbling creates an unforgettable richness. Aged to perfection.', price: 62 },
      { name: 'Denver Steak (10oz)', description: 'The hidden gem of the cow. Highly marbled with incredible tenderness. A discovery.', price: 56 },
      { name: 'Prime Hanger Steak', description: 'The "butcher\'s cut" — intensely flavorful with exceptional texture. Rare availability.', price: 52 },
    ],
  },
  // ──── APPETIZERS ────
  {
    category: 'APPETIZERS',
    items: [
      { name: 'Beef Carpaccio', description: 'Thinly sliced raw premium beef with capers, shallots, and Dijon mustard. Citrus cured.', price: 22 },
      { name: 'Oysters Rockefeller', description: 'Fresh oysters with spinach, breadcrumbs, and hollandaise. A timeless start.', price: 24 },
      { name: 'Burrata & Heirloom Tomato', description: 'Creamy burrata with summer tomatoes, aged balsamic, and basil oil.', price: 18 },
      { name: 'Pan-Seared Scallops', description: 'Diver scallops with brown butter, lemon, and microgreens.', price: 28 },
    ],
  },
  // ──── SIDES ────
  {
    category: 'SIDES',
    items: [
      { name: 'Truffle Parmesan Fries', description: 'Hand-cut potatoes, crispy exterior, truffle oil, and Parmigiano-Reggiano.', price: 14 },
      { name: 'Creamed Spinach', description: 'Classic preparation with cream, nutmeg, and parmesan. A timeless accompaniment.', price: 12 },
      { name: 'Grilled Asparagus', description: 'Fresh asparagus with roasted garlic, lemon, and aged balsamic.', price: 13 },
      { name: 'Wild Mushroom Medley', description: 'Seasonal wild mushrooms sautéed with garlic, thyme, and butter. Earthy perfection.', price: 15 },
      { name: 'Loaded Baked Potato', description: 'Topped with butter, sour cream, bacon, cheddar, and chives.', price: 11 },
    ],
  },
  // ──── DESSERTS ────
  {
    category: 'DESSERTS',
    items: [
      { name: 'Chocolate Lava Cake', description: 'Warm chocolate center with vanilla ice cream and gold leaf. Decadent indulgence.', price: 16 },
      { name: 'Crème Brûlée', description: 'Classic vanilla bean custard with caramelized sugar. Pure sophistication.', price: 14 },
      { name: 'Grand Marnier Soufflé', description: 'Light, airy, and infused with orange liqueur. A stunning finale.', price: 18 },
      { name: 'Tiramisu', description: 'Layers of mascarpone, espresso, and ladyfingers. Italian elegance.', price: 13 },
    ],
  },
];

export async function seed() {
  const email    = process.env['ADMIN_EMAIL']    ?? 'admin@steakz.com';
  const password = process.env['ADMIN_PASSWORD'] ?? 'admin123';

  const existing = await prisma.user.findUnique({ where: { email } });

  if (!existing) {
    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { name: 'System Admin', email, password: hashed, role: 'ADMIN' },
    });
    console.log(`[Seeder] Admin created: ${email}`);
  } else {
    console.log('[Seeder] Admin already exists — skipping.');
  }

  // Seed a test customer account
  const customerEmail = 'customer@test.com';
  const customerPassword = 'customer123';
  const existingCustomer = await prisma.user.findUnique({ where: { email: customerEmail } });
  if (!existingCustomer) {
    const hashed = await bcrypt.hash(customerPassword, 10);
    await prisma.user.create({
      data: { name: 'Test Customer', email: customerEmail, password: hashed, role: 'CUSTOMER' },
    });
    console.log(`[Seeder] Customer created: ${customerEmail}`);
  }

  for (const b of BRANCHES) {
    const exists = await prisma.branch.findUnique({ where: { name: b.name } });
    if (!exists) {
      await prisma.branch.create({ data: b });
      console.log(`[Seeder] Branch created: ${b.name}`);
    }
  }

  // Seed tables for all branches
  const TABLE_LAYOUTS = [2, 2, 4, 4, 4, 6, 6, 8];
  for (const b of BRANCHES) {
    const branch = await prisma.branch.findUnique({ where: { name: b.name } });
    if (branch) {
      const existingTables = await prisma.table.count({ where: { branchId: branch.id } });
      if (existingTables === 0) {
        for (let i = 0; i < TABLE_LAYOUTS.length; i++) {
          await prisma.table.create({
            data: { tableNumber: i + 1, capacity: TABLE_LAYOUTS[i]!, branchId: branch.id },
          });
        }
        console.log(`[Seeder] Tables created for ${b.name}`);
      }
    }
  }

  // Seed menu items for all branches
  for (const b of BRANCHES) {
    const branch = await prisma.branch.findUnique({ where: { name: b.name } });
    if (branch) {
      for (const menuCategory of PREMIUM_MENU) {
        for (const item of menuCategory.items) {
          const exists = await prisma.menuItem.findFirst({
            where: { name: item.name, branchId: branch.id },
          });
          if (!exists) {
            await prisma.menuItem.create({
              data: {
                name: item.name,
                description: item.description,
                price: item.price,
                category: menuCategory.category,
                branchId: branch.id,
              },
            });
          }
        }
      }
      console.log(`[Seeder] Menu items created for ${b.name}`);
    }
  }
}
