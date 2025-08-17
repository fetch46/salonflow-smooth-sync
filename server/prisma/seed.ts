import 'dotenv/config';
import { PrismaClient, AccountCategory, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin',
      role: Role.ADMIN,
      passwordHash,
    },
  });

  // Also create an OWNER user for full admin rights testing
  const ownerPasswordHash = await bcrypt.hash('owner123', 10);
  await prisma.user.upsert({
    where: { email: 'owner@example.com' },
    update: {},
    create: {
      email: 'owner@example.com',
      name: 'Owner User',
      role: Role.OWNER,
      passwordHash: ownerPasswordHash,
    },
  });

  // Core accounts
  const accounts = [
    { code: '1000', name: 'Cash', category: AccountCategory.ASSET },
    { code: '1100', name: 'Bank', category: AccountCategory.ASSET },
    { code: '1200', name: 'Accounts Receivable', category: AccountCategory.ASSET },
    { code: '1300', name: 'Inventory', category: AccountCategory.ASSET },
    { code: '2000', name: 'Accounts Payable', category: AccountCategory.LIABILITY },
    { code: '3000', name: 'Owner Equity', category: AccountCategory.EQUITY },
    { code: '4000', name: 'Sales Revenue', category: AccountCategory.INCOME },
    { code: '5000', name: 'Cost of Goods Sold', category: AccountCategory.EXPENSE },
  ];

  for (const a of accounts) {
    await prisma.account.upsert({
      where: { code: a.code },
      update: {},
      create: a,
    });
  }

  const inventory = await prisma.account.findUniqueOrThrow({ where: { code: '1300' } });
  const cogs = await prisma.account.findUniqueOrThrow({ where: { code: '5000' } });
  const sales = await prisma.account.findUniqueOrThrow({ where: { code: '4000' } });

  await prisma.stockLocation.upsert({
    where: { code: 'MAIN' },
    update: {},
    create: { code: 'MAIN', name: 'Main Warehouse' },
  });

  await prisma.product.upsert({
    where: { sku: 'SKU-001' },
    update: {},
    create: {
      sku: 'SKU-001',
      name: 'Widget',
      unitOfMeasure: 'unit',
      price: 50,
      cost: 30,
      reorderPoint: 10,
      inventoryAccountId: inventory.id,
      cogsAccountId: cogs.id,
      revenueAccountId: sales.id,
    },
  });

  console.log('Seed complete. Admin login: admin@example.com / admin123');
  console.log('Seed complete. Owner login: owner@example.com / owner123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });