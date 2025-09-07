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
      // Balance formula by category:
      // Assets/Expenses: balance = debits - credits
      // Liabilities/Equity/Income: balance = credits - debits
      const cat = a.category as string;
      const isDebitNature = cat === 'ASSET' || cat === 'EXPENSE';
      const balance = isDebitNature ? (s.debit - s.credit) : (s.credit - s.debit);
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
      const s = { debit: 0, credit: 0 };
      // Accumulate sums for this account
      for (const l of lines as any[]) {
        if (l.accountId === a.id) {
          s.debit += Number(l.debit || 0);
          s.credit += Number(l.credit || 0);
        }
      }
      const cat = a.category as string;
      const isDebitNature = cat === 'ASSET' || cat === 'EXPENSE';
      const bal = isDebitNature ? (s.debit - s.credit) : (s.credit - s.debit);
      if (a.category === 'ASSET') assets += bal;
      if (a.category === 'LIABILITY') liabilities += bal;
      if (a.category === 'EQUITY' || a.category === 'INCOME') equity += bal; // treat income as increasing equity
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
    // Compute revenue from invoice items grouped by location within period
    const invoices = await prisma.salesInvoice.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { id: true, items: { select: { locationId: true, lineTotal: true } } },
    });
    const byLocation = new Map<string, number>();
    for (const inv of invoices as any[]) {
      for (const it of inv.items as any[]) {
        const locId = it.locationId || 'unassigned';
        byLocation.set(locId, (byLocation.get(locId) || 0) + Number(it.lineTotal || 0));
      }
    }
    const locIds = Array.from(byLocation.keys()).filter((k) => k !== 'unassigned');
    const locations = locIds.length > 0 ? await prisma.stockLocation.findMany({ where: { id: { in: locIds } } }) : [];
    const nameMap = new Map(locations.map((l: any) => [l.id, l.name]));
    const rows = Array.from(byLocation.entries()).map(([id, amt]) => ({
      locationId: id === 'unassigned' ? null : id,
      locationName: id === 'unassigned' ? 'Unassigned' : (nameMap.get(id) || 'Location'),
      amount: amt,
    }));
    res.json({ rows: rows.sort((a, b) => b.amount - a.amount) });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;