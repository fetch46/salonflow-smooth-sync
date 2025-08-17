import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { Prisma } from '@prisma/client';

const router = Router();

const reconcileSchema = z.object({
  bankAccountId: z.string().min(1),
  statementDate: z.coerce.date(),
  endingBalance: z.coerce.number(),
  paymentIds: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

router.use(requireAuth);

router.post('/reconcile', requireRole(['ADMIN', 'ACCOUNTANT']), async (req, res) => {
  const parsed = reconcileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;
  try {
    const recon = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.bankReconciliation.create({
        data: {
          bankAccountId: data.bankAccountId,
          statementDate: data.statementDate,
          endingBalance: data.endingBalance,
          notes: data.notes ?? null,
        },
      });
      for (const pid of data.paymentIds) {
        await tx.reconciliationLine.create({ data: { reconciliationId: created.id, paymentId: pid } });
        await tx.payment.update({ where: { id: pid }, data: { reconciled: true } });
      }
      return created;
    });
    res.status(201).json(recon);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/unreconciled', async (req, res) => {
  const bankAccountId = String(req.query.bankAccountId || '');
  const where: any = { reconciled: false };
  if (bankAccountId) where.bankAccountId = bankAccountId;
  const items = await prisma.payment.findMany({ where, orderBy: { date: 'asc' } });
  res.json({ items });
});

export default router;