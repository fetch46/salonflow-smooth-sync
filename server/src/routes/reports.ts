import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/roles.js';

const router = Router();
const OPEN_REPORTS = process.env.REPORTS_OPEN_ACCESS === 'true' || process.env.NODE_ENV !== 'production';
if (!OPEN_REPORTS) {
  router.use(requireAuth);
}

router.get('/trial-balance', requirePermission('REPORTS','VIEW'), async (req, res) => {
  try {
    const start = req.query.start ? new Date(String(req.query.start)) : new Date('1900-01-01');
    const end = req.query.end ? new Date(String(req.query.end)) : new Date();

    const lines = await prisma.journalLine.findMany({
      where: { entry: { date: { gte: start, lte: end } } },
    });

    const map = new Map<string, { debit: number; credit: number }>();
    for (const l of lines as any[]) {
      const key = l.accountId;
      const cur = map.get(key) || { debit: 0, credit: 0 };
      cur.debit += Number(l.debit || 0);
      cur.credit += Number(l.credit || 0);
      map.set(key, cur);
    }

    const accounts = await prisma.account.findMany({ where: { id: { in: Array.from(map.keys()) } } });

    const rows = accounts.map((a: any) => {
      const s = map.get(a.id) || { debit: 0, credit: 0 };
      const balance = s.debit - s.credit;
      return { accountId: a.id, accountCode: a.code, accountName: a.name, debit: s.debit, credit: s.credit, balance };
    });

    res.json({ rows });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/profit-and-loss', requirePermission('REPORTS','VIEW'), async (req, res) => {
  try {
    const start = req.query.start ? new Date(String(req.query.start)) : new Date('1900-01-01');
    const end = req.query.end ? new Date(String(req.query.end)) : new Date();

    const lines = await prisma.journalLine.findMany({
      where: { entry: { date: { gte: start, lte: end } } },
      include: { account: true },
    });

    let income = 0;
    let cogs = 0;
    let expense = 0;
    for (const l of lines as any[]) {
      const amt = Number(l.credit || 0) - Number(l.debit || 0);
      if (l.account.category === 'INCOME') income += amt;
      if (l.account.category === 'EXPENSE') expense += -amt;
      // If product cogs account category is EXPENSE then COGS is included; otherwise keep simple
    }

    const grossProfit = income - cogs;
    const netProfit = grossProfit - expense;

    res.json({ income, cogs, expense, grossProfit, netProfit });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/balance-sheet', requirePermission('REPORTS','VIEW'), async (req, res) => {
  try {
    const end = req.query.asOf ? new Date(String(req.query.asOf)) : new Date();

    const lines = await prisma.journalLine.findMany({
      where: { entry: { date: { lte: end } } },
      include: { account: true },
    });

    const balances = new Map<string, number>();
    for (const l of lines as any[]) {
      const prev = balances.get(l.accountId) || 0;
      const next = prev + Number(l.debit || 0) - Number(l.credit || 0);
      balances.set(l.accountId, next);
    }

    const accounts = await prisma.account.findMany({});

    let assets = 0;
    let liabilities = 0;
    let equity = 0;

    for (const a of accounts as any[]) {
      const bal = balances.get(a.id) || 0;
      if (a.category === 'ASSET') assets += bal;
      if (a.category === 'LIABILITY') liabilities += -bal;
      if (a.category === 'EQUITY') equity += -bal;
    }

    res.json({ assets, liabilities, equity, balanced: Math.abs(assets - liabilities - equity) < 1e-6 });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Revenue by location (based on INCOME accounts within period)
router.get('/revenue-by-location', requirePermission('REPORTS','VIEW'), async (req, res) => {
  try {
    const start = req.query.start ? new Date(String(req.query.start)) : new Date('1900-01-01');
    const end = req.query.end ? new Date(String(req.query.end)) : new Date();

    const lines = await prisma.journalLine.findMany({
      where: { entry: { date: { gte: start, lte: end } } },
      include: { account: true, product: true },
    });

    const byLocation = new Map<string, number>();
    for (const l of lines as any[]) {
      if (l.account.category === 'INCOME' && l.locationId) {
        const amount = Number(l.credit || 0) - Number(l.debit || 0);
        byLocation.set(l.locationId, (byLocation.get(l.locationId) || 0) + amount);
      }
    }

    const locations = await prisma.stockLocation.findMany({ where: { id: { in: Array.from(byLocation.keys()) } } });

    const rows = locations.map((loc: any) => ({ locationId: loc.id, locationName: loc.name, amount: byLocation.get(loc.id) || 0 }));
    res.json({ rows });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;