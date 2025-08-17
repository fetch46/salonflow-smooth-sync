import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const OPEN_REPORTS = process.env.REPORTS_OPEN_ACCESS === 'true' || process.env.NODE_ENV !== 'production';
if (!OPEN_REPORTS) {
  router.use(requireAuth);
}

router.get('/trial-balance', async (req, res) => {
  try {
    const start = req.query.start ? new Date(String(req.query.start)) : new Date('1900-01-01');
    const end = req.query.end ? new Date(String(req.query.end)) : new Date('2900-01-01');
    const locationId = req.query.locationId ? String(req.query.locationId) : undefined;

    const where: any = {
      entry: { date: { gte: start, lte: end } },
    };
    if (locationId && locationId !== 'all') {
      where.locationId = locationId;
    }

    const lines = await prisma.journalLine.findMany({
      where,
      include: { account: true },
    });

    const rowsMap: Record<string, { accountId: string; code: string; name: string; category: string; debit: number; credit: number; balance: number }> = {};
    for (const l of lines) {
      const key = l.accountId;
      if (!rowsMap[key]) {
        rowsMap[key] = {
          accountId: l.accountId,
          code: l.account.code,
          name: l.account.name,
          category: l.account.category as any,
          debit: 0,
          credit: 0,
          balance: 0,
        };
      }
      rowsMap[key].debit += Number(l.debit || 0);
      rowsMap[key].credit += Number(l.credit || 0);
    }
    const rows = Object.values(rowsMap)
      .map((r) => ({ ...r, balance: r.debit - r.credit }))
      .sort((a, b) => a.code.localeCompare(b.code));

    const totals = rows.reduce((acc, r) => ({ debit: acc.debit + r.debit, credit: acc.credit + r.credit }), { debit: 0, credit: 0 });

    res.json({ rows, totals });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to load trial balance' });
  }
});

router.get('/profit-and-loss', async (req, res) => {
  try {
    const start = req.query.start ? new Date(String(req.query.start)) : new Date('1900-01-01');
    const end = req.query.end ? new Date(String(req.query.end)) : new Date('2900-01-01');
    const locationId = req.query.locationId ? String(req.query.locationId) : undefined;

    const where: any = { entry: { date: { gte: start, lte: end } }, account: { category: { in: ['INCOME', 'EXPENSE'] as any } } };
    if (locationId && locationId !== 'all') {
      where.locationId = locationId;
    }

    const lines = await prisma.journalLine.findMany({
      where,
      include: { account: true },
    });

    const rows: Record<string, { name: string; category: string; debit: number; credit: number }> = {};
    for (const l of lines) {
      const key = l.accountId;
      if (!rows[key]) rows[key] = { name: l.account.name, category: l.account.category as any, debit: 0, credit: 0 } as any;
      rows[key].debit += Number(l.debit || 0);
      rows[key].credit += Number(l.credit || 0);
    }
    const arr = Object.entries(rows).map(([accountId, r]) => ({ accountId, ...r }));
    const income = arr.filter((r) => r.category === 'INCOME').reduce((acc, r) => acc + (r.credit - r.debit), 0);
    const expenses = arr.filter((r) => r.category === 'EXPENSE').reduce((acc, r) => acc + (r.debit - r.credit), 0);
    const netIncome = income - expenses;

    res.json({ rows: arr, income, expenses, netIncome });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to load profit and loss' });
  }
});

router.get('/balance-sheet', async (req, res) => {
  try {
    const end = req.query.asOf ? new Date(String(req.query.asOf)) : new Date();
    const locationId = req.query.locationId ? String(req.query.locationId) : undefined;

    const where: any = { entry: { date: { lte: end } }, account: { category: { in: ['ASSET', 'LIABILITY', 'EQUITY'] as any } } };
    if (locationId && locationId !== 'all') {
      where.locationId = locationId;
    }

    const lines = await prisma.journalLine.findMany({
      where,
      include: { account: true },
    });

    const rows: Record<string, { name: string; category: string; balance: number }> = {};
    for (const l of lines) {
      const key = l.accountId;
      if (!rows[key]) rows[key] = { name: l.account.name, category: l.account.category as any, balance: 0 } as any;
      const debit = Number(l.debit || 0);
      const credit = Number(l.credit || 0);
      let delta = 0;
      if (l.account.category === 'ASSET' || l.account.category === 'EXPENSE') delta = debit - credit; else delta = credit - debit;
      rows[key].balance += delta;
    }
    const arr = Object.entries(rows).map(([accountId, r]) => ({ accountId, ...r }));
    const assets = arr.filter((r) => r.category === 'ASSET').reduce((acc, r) => acc + r.balance, 0);
    const liabilities = arr.filter((r) => r.category === 'LIABILITY').reduce((acc, r) => acc + r.balance, 0);
    const equity = arr.filter((r) => r.category === 'EQUITY').reduce((acc, r) => acc + r.balance, 0);

    res.json({ rows: arr, assets, liabilities, equity, assetsEqualsLiabilitiesPlusEquity: Math.abs(assets - (liabilities + equity)) < 0.01 });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to load balance sheet' });
  }
});

// Revenue by location (based on INCOME accounts within period)
router.get('/revenue-by-location', async (req, res) => {
  try {
    const start = req.query.start ? new Date(String(req.query.start)) : new Date('1900-01-01');
    const end = req.query.end ? new Date(String(req.query.end)) : new Date('2900-01-01');
    const locationId = req.query.locationId ? String(req.query.locationId) : undefined;

    const where: any = {
      entry: { date: { gte: start, lte: end } },
      account: { category: 'INCOME' as any },
    };
    if (locationId && locationId !== 'all') {
      where.locationId = locationId;
    }

    const lines = await prisma.journalLine.findMany({
      where,
      include: { location: true },
    });

    const map = new Map<string, { locationId: string | null; locationName: string; revenue: number }>();
    for (const l of lines) {
      const key = l.locationId || 'unassigned';
      const current = map.get(key) || { locationId: l.locationId || null, locationName: l.location?.name || 'Unassigned', revenue: 0 };
      // For income accounts, revenue increases with credit - debit
      current.revenue += (Number(l.credit || 0) - Number(l.debit || 0));
      map.set(key, current);
    }

    const rows = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    const total = rows.reduce((sum, r) => sum + r.revenue, 0);
    res.json({ rows, total });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to load revenue by location' });
  }
});

export default router;