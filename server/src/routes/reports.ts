import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/trial-balance', async (_req, res) => {
  const lines = await prisma.journalLine.groupBy({ by: ['accountId'], _sum: { debit: true, credit: true } });
  const accounts = await prisma.account.findMany();
  const map = new Map<string, any>(accounts.map((a: any) => [a.id, a] as const));
  const rows = lines.map((l: any) => {
    const a = map.get(l.accountId)!;
    return {
      code: a.code,
      name: a.name,
      category: a.category,
      debit: Number(l._sum.debit ?? 0),
      credit: Number(l._sum.credit ?? 0),
    };
  }).sort((a: any, b: any) => a.code.localeCompare(b.code));
  const totals = rows.reduce((acc: any, r: any) => ({ debit: acc.debit + r.debit, credit: acc.credit + r.credit }), { debit: 0, credit: 0 });
  res.json({ rows, totals });
});

router.get('/profit-and-loss', async (req, res) => {
  const start = req.query.start ? new Date(String(req.query.start)) : new Date('1900-01-01');
  const end = req.query.end ? new Date(String(req.query.end)) : new Date('2900-01-01');
  const lines = await prisma.journalLine.findMany({
    where: { entry: { date: { gte: start, lte: end } }, account: { category: { in: ['INCOME', 'EXPENSE'] as any } } },
    include: { account: true },
  });
  const rows: Record<string, { name: string; category: string; debit: number; credit: number }> = {};
  for (const l of lines) {
    const key = l.accountId;
    if (!rows[key]) rows[key] = { name: l.account.name, category: l.account.category, debit: 0, credit: 0 };
    rows[key].debit += Number(l.debit);
    rows[key].credit += Number(l.credit);
  }
  const arr = Object.entries(rows).map(([accountId, r]) => ({ accountId, ...r }));
  const income = arr.filter((r) => r.category === 'INCOME').reduce((acc, r) => acc + (r.credit - r.debit), 0);
  const expenses = arr.filter((r) => r.category === 'EXPENSE').reduce((acc, r) => acc + (r.debit - r.credit), 0);
  const netIncome = income - expenses;
  res.json({ rows: arr, income, expenses, netIncome });
});

router.get('/balance-sheet', async (req, res) => {
  const end = req.query.asOf ? new Date(String(req.query.asOf)) : new Date('2900-01-01');
  const lines = await prisma.journalLine.findMany({
    where: { entry: { date: { lte: end } }, account: { category: { in: ['ASSET', 'LIABILITY', 'EQUITY'] as any } } },
    include: { account: true },
  });
  const rows: Record<string, { name: string; category: string; balance: number }> = {};
  for (const l of lines) {
    const key = l.accountId;
    if (!rows[key]) rows[key] = { name: l.account.name, category: l.account.category, balance: 0 };
    const debit = Number(l.debit);
    const credit = Number(l.credit);
    let delta = 0;
    if (l.account.category === 'ASSET' || l.account.category === 'EXPENSE') delta = debit - credit; else delta = credit - debit;
    rows[key].balance += delta;
  }
  const arr = Object.entries(rows).map(([accountId, r]) => ({ accountId, ...r }));
  const assets = arr.filter((r) => r.category === 'ASSET').reduce((acc, r) => acc + r.balance, 0);
  const liabilities = arr.filter((r) => r.category === 'LIABILITY').reduce((acc, r) => acc + r.balance, 0);
  const equity = arr.filter((r) => r.category === 'EQUITY').reduce((acc, r) => acc + r.balance, 0);
  res.json({ rows: arr, assets, liabilities, equity, assetsEqualsLiabilitiesPlusEquity: Math.abs(assets - (liabilities + equity)) < 0.01 });
});

export default router;