import 'dotenv/config';
import { PrismaClient, AccountCategory, Role, PermissionAction, PermissionResource } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seedRolePermissions() {
  const matrices: Array<{ role: Role; resource: PermissionResource; actions: PermissionAction[] }> = [];

  const all = (acts: PermissionAction[]) => acts;
  const A = PermissionAction;
  const R = PermissionResource;

  // Admin: full access except BANKING/REPORTS which we allow too (but server enforces accountant/owner only if needed)
  const adminResources: PermissionResource[] = [
    R.APPOINTMENTS,
    R.CLIENTS,
    R.INVOICES,
    R.PAYMENTS,
    R.JOBCARDS,
    R.SUPPLIERS,
    R.PURCHASES,
    R.GOODS_RECEIVED,
    R.EXPENSES,
    R.PRODUCTS,
    R.ADJUSTMENTS,
    R.TRANSFERS,
    R.BANKING,
    R.REPORTS,
    R.SETTINGS,
  ];
  for (const res of adminResources) {
    matrices.push({ role: Role.ADMIN, resource: res, actions: all([A.VIEW, A.CREATE, A.EDIT, A.DELETE]) });
  }

  // Accountant: broad access, plus BANKING/REPORTS
  const accountantResources: PermissionResource[] = [
    R.APPOINTMENTS,
    R.CLIENTS,
    R.INVOICES,
    R.PAYMENTS,
    R.JOBCARDS,
    R.SUPPLIERS,
    R.PURCHASES,
    R.GOODS_RECEIVED,
    R.EXPENSES,
    R.PRODUCTS,
    R.ADJUSTMENTS,
    R.TRANSFERS,
    R.BANKING,
    R.REPORTS,
    R.SETTINGS,
  ];
  for (const res of accountantResources) {
    matrices.push({ role: Role.ACCOUNTANT, resource: res, actions: all([A.VIEW, A.CREATE, A.EDIT, A.DELETE]) });
  }

  // Inventory: inventory modules only
  const inventoryResources: PermissionResource[] = [
    R.PRODUCTS,
    R.ADJUSTMENTS,
    R.TRANSFERS,
  ];
  for (const res of inventoryResources) {
    matrices.push({ role: Role.INVENTORY, resource: res, actions: all([A.VIEW, A.CREATE, A.EDIT, A.DELETE]) });
  }

  // Owner: seed full matrix; middleware already grants full access regardless of table entries
  const ownerResources: PermissionResource[] = Object.values(PermissionResource) as PermissionResource[];
  for (const res of ownerResources) {
    matrices.push({ role: Role.OWNER, resource: res, actions: all([A.VIEW, A.CREATE, A.EDIT, A.DELETE]) });
  }

  // Upsert all
  for (const m of matrices) {
    for (const act of m.actions) {
      await prisma.rolePermission.upsert({
        where: { role_resource_action: { role: m.role, resource: m.resource, action: act } as any },
        update: {},
        create: { role: m.role, resource: m.resource, action: act },
      } as any);
    }
  }
}

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

  await seedRolePermissions();

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