import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { Prisma } from '@prisma/client';

const router = Router();

const invoiceItemSchema = z.object({
  productId: z.string(),
  locationId: z.string(),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
});

const salesInvoiceSchema = z.object({
  number: z.string().min(1),
  date: z.coerce.date(),
  customerName: z.string().min(1),
  arAccountId: z.string().min(1),
  revenueAccountId: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1),
  post: z.boolean().default(true),
});

const billItemSchema = z.object({
  productId: z.string(),
  locationId: z.string(),
  quantity: z.coerce.number().positive(),
  unitCost: z.coerce.number().nonnegative(),
});

const purchaseBillSchema = z.object({
  number: z.string().min(1),
  date: z.coerce.date(),
  vendorName: z.string().min(1),
  apAccountId: z.string().min(1),
  items: z.array(billItemSchema).min(1),
  post: z.boolean().default(true),
});

const paymentSchema = z.object({
  date: z.coerce.date().optional(),
  amount: z.coerce.number().positive(),
  type: z.enum(['IN', 'OUT']),
  bankAccountId: z.string().min(1),
  arAccountId: z.string().optional(),
  apAccountId: z.string().optional(),
  referenceType: z.enum(['SALES_INVOICE', 'PURCHASE_BILL', 'PAYMENT', 'ADJUSTMENT', 'MANUAL']).default('MANUAL'),
  referenceId: z.string().optional(),
});

router.use(requireAuth);

router.post('/sales-invoices', async (req, res) => {
  const parsed = salesInvoiceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const productIds = data.items.map((i) => i.productId);
      const products = await tx.product.findMany({ where: { id: { in: productIds } } });
      const productMap = new Map<string, any>(products.map((p: any) => [p.id, p] as const));

      const itemsWithTotals = data.items.map((i) => {
        const p = productMap.get(i.productId)!;
        const unitCost = Number(p.cost);
        const lineTotal = i.quantity * i.unitPrice;
        return { ...i, unitCost, lineTotal };
      });

      const total = itemsWithTotals.reduce((acc, i) => acc + i.lineTotal, 0);

      const invoice = await tx.salesInvoice.create({
        data: {
          number: data.number,
          date: data.date,
          customerName: data.customerName,
          arAccountId: data.arAccountId,
          revenueAccountId: data.revenueAccountId ?? null,
          status: data.post ? 'POSTED' : 'DRAFT',
          total,
          items: {
            create: itemsWithTotals.map((i) => ({
              productId: i.productId,
              locationId: i.locationId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              unitCost: i.unitCost,
              lineTotal: i.lineTotal,
            })),
          },
        },
      });

      if (data.post) {
        const createdEntry = await tx.journalEntry.create({
          data: {
            date: data.date,
            memo: `Sales Invoice ${invoice.number}`,
            posted: true,
            createdById: (req as any).user.id,
            referenceType: 'SALES_INVOICE',
            referenceId: invoice.id,
          },
        });

        const arAccountId = data.arAccountId;

        for (const item of itemsWithTotals) {
          const p = productMap.get(item.productId)!;
          const revenueAccountId = data.revenueAccountId ?? p.revenueAccountId;

          await tx.journalLine.create({ data: { entryId: createdEntry.id, accountId: arAccountId, debit: item.lineTotal, credit: 0 } });
          await tx.journalLine.create({ data: { entryId: createdEntry.id, accountId: revenueAccountId, debit: 0, credit: item.lineTotal } });

          await tx.journalLine.create({ data: { entryId: createdEntry.id, accountId: p.cogsAccountId, debit: item.quantity * item.unitCost, credit: 0, productId: p.id, locationId: item.locationId } });
          await tx.journalLine.create({ data: { entryId: createdEntry.id, accountId: p.inventoryAccountId, debit: 0, credit: item.quantity * item.unitCost, productId: p.id, locationId: item.locationId } });

          await tx.stockMovement.create({ data: { productId: p.id, locationId: item.locationId, movementType: 'OUT', quantity: item.quantity, costPerUnit: item.unitCost, referenceType: 'SALES_INVOICE', referenceId: invoice.id, journalEntryId: createdEntry.id, date: data.date } });
        }

        await tx.salesInvoice.update({ where: { id: invoice.id }, data: { postedEntryId: createdEntry.id } });
      }

      return invoice;
    });
    res.status(201).json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/purchase-bills', async (req, res) => {
  const parsed = purchaseBillSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const productIds = data.items.map((i) => i.productId);
      const products = await tx.product.findMany({ where: { id: { in: productIds } } });
      const productMap = new Map<string, any>(products.map((p: any) => [p.id, p] as const));

      const itemsWithTotals = data.items.map((i) => {
        const lineTotal = i.quantity * i.unitCost;
        return { ...i, lineTotal };
      });

      const total = itemsWithTotals.reduce((acc, i) => acc + i.lineTotal, 0);

      const bill = await tx.purchaseBill.create({
        data: {
          number: data.number,
          date: data.date,
          vendorName: data.vendorName,
          apAccountId: data.apAccountId,
          status: data.post ? 'POSTED' : 'DRAFT',
          total,
          items: {
            create: itemsWithTotals.map((i) => ({
              productId: i.productId,
              locationId: i.locationId,
              quantity: i.quantity,
              unitCost: i.unitCost,
              lineTotal: i.lineTotal,
            })),
          },
        },
      });

      if (data.post) {
        const createdEntry = await tx.journalEntry.create({
          data: {
            date: data.date,
            memo: `Purchase Bill ${bill.number}`,
            posted: true,
            createdById: (req as any).user.id,
            referenceType: 'PURCHASE_BILL',
            referenceId: bill.id,
          },
        });

        for (const item of itemsWithTotals) {
          const p = productMap.get(item.productId)!;

          await tx.journalLine.create({ data: { entryId: createdEntry.id, accountId: p.inventoryAccountId, debit: item.lineTotal, credit: 0, productId: p.id, locationId: item.locationId } });
          await tx.journalLine.create({ data: { entryId: createdEntry.id, accountId: data.apAccountId, debit: 0, credit: item.lineTotal } });

          await tx.stockMovement.create({ data: { productId: p.id, locationId: item.locationId, movementType: 'IN', quantity: item.quantity, costPerUnit: item.unitCost, referenceType: 'PURCHASE_BILL', referenceId: bill.id, journalEntryId: createdEntry.id, date: data.date } });
        }

        await tx.purchaseBill.update({ where: { id: bill.id }, data: { postedEntryId: createdEntry.id } });
      }

      return bill;
    });
    res.status(201).json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/payments', async (req, res) => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;
  try {
    const payment = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const createdPayment = await tx.payment.create({ data });
      const entry = await tx.journalEntry.create({
        data: {
          date: data.date ?? new Date(),
          memo: `Payment ${createdPayment.id}`,
          posted: true,
          createdById: (req as any).user.id,
          referenceType: 'PAYMENT',
          referenceId: createdPayment.id,
        },
      });

      if (data.type === 'IN') {
        await tx.journalLine.create({ data: { entryId: entry.id, accountId: data.bankAccountId, debit: data.amount, credit: 0 } });
        await tx.journalLine.create({ data: { entryId: entry.id, accountId: data.arAccountId!, debit: 0, credit: data.amount } });
      } else {
        await tx.journalLine.create({ data: { entryId: entry.id, accountId: data.apAccountId!, debit: data.amount, credit: 0 } });
        await tx.journalLine.create({ data: { entryId: entry.id, accountId: data.bankAccountId, debit: 0, credit: data.amount } });
      }

      await tx.payment.update({ where: { id: createdPayment.id }, data: { journalEntryId: entry.id } });
      return createdPayment;
    });
    res.status(201).json(payment);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;