import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { Prisma } from '@prisma/client';

const router = Router();

const lineSchema = z.object({
	accountId: z.string().min(1),
	description: z.string().optional().nullable(),
	debit: z.coerce.number().nonnegative(),
	credit: z.coerce.number().nonnegative(),
});

const journalSchema = z.object({
	date: z.coerce.date(),
	memo: z.string().optional().nullable(),
	lines: z.array(lineSchema).min(2),
});

router.use(requireAuth);

router.post('/', async (req, res) => {
	const parsed = journalSchema.safeParse(req.body);
	if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
	const data = parsed.data;
	// Enforce per-line accounting constraints (exactly one of debit/credit > 0)
	for (const [idx, l] of data.lines.entries()) {
		const d = Number(l.debit || 0);
		const c = Number(l.credit || 0);
		if ((d > 0 && c > 0) || (d === 0 && c === 0)) {
			return res.status(400).json({ error: `Line ${idx + 1}: enter either a debit or a credit, not both` });
		}
		if (d < 0 || c < 0) {
			return res.status(400).json({ error: `Line ${idx + 1}: amounts cannot be negative` });
		}
	}
	const sumDebit = data.lines.reduce((acc: number, l: any) => acc + l.debit, 0);
	const sumCredit = data.lines.reduce((acc: number, l: any) => acc + l.credit, 0);
	if (Math.round((sumDebit - sumCredit) * 100) !== 0 || sumDebit <= 0) {
		return res.status(400).json({ error: 'Debits and credits must balance and be greater than zero' });
	}
	try {
		const entry = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
			const created = await tx.journalEntry.create({
				data: {
					date: data.date,
					memo: data.memo,
					posted: true,
					createdById: (req as any).user.id,
					referenceType: 'MANUAL',
				},
			});
			for (const l of data.lines) {
				await tx.journalLine.create({
					data: {
						entryId: created.id,
						accountId: l.accountId,
						description: l.description ?? undefined,
						debit: l.debit,
						credit: l.credit,
					},
				});
			}
			return created;
		});
		res.status(201).json(entry);
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
});

router.get('/trial-balance', async (_req, res) => {
	const lines = await prisma.journalLine.groupBy({
		by: ['accountId'],
		_sum: { debit: true, credit: true },
	});
	const accounts = await prisma.account.findMany();
	const map = new Map<string, any>(accounts.map((a: any) => [a.id, a] as const));
	const rows = lines.map((l: any) => {
		const account = map.get(l.accountId)!;
		const debit = Number(l._sum.debit ?? 0);
		const credit = Number(l._sum.credit ?? 0);
		const balance = debit - credit;
		return {
			accountId: account.id,
			code: account.code,
			name: account.name,
			category: account.category,
			debit,
			credit,
			balance,
		};
	}).sort((a: any, b: any) => a.code.localeCompare(b.code));
	const totals = rows.reduce((acc: any, r: any) => ({
		debit: acc.debit + r.debit,
		credit: acc.credit + r.credit,
	}), { debit: 0, credit: 0 });
	res.json({ rows, totals });
});

export default router;