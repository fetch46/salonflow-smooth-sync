import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { Prisma } from '@prisma/client';

const router = Router();

const COST_METHOD: 'FIFO' | 'LIFO' | 'WAVG' = (process.env.COST_METHOD as any) || 'FIFO';

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

async function buildRemainingLayersFIFO(tx: Prisma.TransactionClient, productId: string, locationId: string, asOfDate: Date) {
  const movements = await tx.stockMovement.findMany({
    where: { productId, locationId, date: { lte: asOfDate } },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
  });
  type Layer = { qty: number; cost: number };
  const layers: Layer[] = [];
  for (const m of movements) {
    const qty = Number(m.quantity);
    const cost = Number(m.costPerUnit);
    if (m.movementType === 'IN') {
      layers.push({ qty, cost });
    } else if (m.movementType === 'OUT' || m.movementType === 'ADJUSTMENT') {
      // For OUT, consume from oldest layers
      let remaining = qty;
      while (remaining > 0 && layers.length > 0) {
        const head = layers[0];
        const take = Math.min(head.qty, remaining);
        head.qty -= take;
        remaining -= take;
        if (head.qty <= 0.0000001) layers.shift();
      }
      // If remaining > 0 here, historical data already went negative; allow to go negative layers (will be caught on new sale check)
    }
  }
  return layers;
}

function consumeFromLayers(layers: Array<{ qty: number; cost: number }>, qtyToIssue: number, mode: 'FIFO' | 'LIFO') {
  let remaining = qtyToIssue;
  let cogs = 0;
  if (mode === 'FIFO') {
    let idx = 0;
    while (remaining > 0 && idx < layers.length) {
      const l = layers[idx];
      const take = Math.min(l.qty, remaining);
      cogs += take * l.cost;
      l.qty -= take;
      remaining -= take;
      if (l.qty <= 0.0000001) {
        layers.splice(idx, 1);
      } else {
        idx++;
      }
    }
  } else {
    let idx = layers.length - 1;
    while (remaining > 0 && idx >= 0) {
      const l = layers[idx];
      const take = Math.min(l.qty, remaining);
      cogs += take * l.cost;
      l.qty -= take;
      remaining -= take;
      if (l.qty <= 0.0000001) {
        layers.splice(idx, 1);
      }
      idx--;
    }
  }
  return { cogs, remaining };
}

async function calculateCostsForItems(
  tx: Prisma.TransactionClient,
  items: Array<{ productId: string; locationId: string; quantity: number; unitPrice: number }>,
  asOfDate: Date
): Promise<Array<{ productId: string; locationId: string; quantity: number; unitPrice: number; unitCost: number; cogsTotal: number; lineTotal: number }>> {
  if (COST_METHOD === 'WAVG') {
    // For weighted average, compute avg per product/location once and apply
    const grouped = new Map<string, any>();
    for (const i of items) {
      const key = `${i.productId}__${i.locationId}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(i);
    }
    const results: Array<any> = [];
    for (const [key, groupItems] of grouped.entries()) {
      const [productId, locationId] = key.split('__');
      const movements = await tx.stockMovement.findMany({ where: { productId, locationId, date: { lte: asOfDate } } });
      let qty = 0;
      let value = 0;
      for (const m of movements) {
        const sign = m.movementType === 'OUT' ? -1 : 1;
        const deltaQty = sign * Number(m.quantity);
        const deltaVal = sign * Number(m.quantity) * Number(m.costPerUnit);
        qty += deltaQty;
        value += deltaVal;
      }
      const totalReq = groupItems.reduce((a: number, gi: any) => a + gi.quantity, 0);
      if (qty + 1e-9 < totalReq) throw new Error('Insufficient stock for product at selected warehouse');
      const avg = qty !== 0 ? value / qty : 0;
      for (const gi of groupItems) {
        const lineTotal = gi.quantity * gi.unitPrice;
        const cogsTotal = avg * gi.quantity;
        results.push({ ...gi, unitCost: avg, cogsTotal, lineTotal });
      }
    }
    return results;
  }

  // FIFO/LIFO: build and consume layers for each product/location across all items
  const groups = new Map<string, { layers: Array<{ qty: number; cost: number }>, entries: Array<any> }>();
  for (const i of items) {
    const key = `${i.productId}__${i.locationId}`;
    if (!groups.has(key)) {
      const layers = await buildRemainingLayersFIFO(tx, i.productId, i.locationId, asOfDate);
      groups.set(key, { layers, entries: [] });
    }
    groups.get(key)!.entries.push(i);
  }
  const results: Array<any> = [];
  for (const { layers, entries } of groups.values()) {
    const totalAvailable = layers.reduce((acc, l) => acc + l.qty, 0);
    const totalReq = entries.reduce((a: number, e: any) => a + e.quantity, 0);
    if (totalAvailable + 1e-9 < totalReq) throw new Error('Insufficient stock for product at selected warehouse');

    for (const e of entries) {
      const { cogs, remaining } = consumeFromLayers(layers, e.quantity, COST_METHOD as 'FIFO' | 'LIFO');
      if (remaining > 1e-9) throw new Error('Insufficient stock for product at selected warehouse');
      const unitCost = e.quantity > 0 ? cogs / e.quantity : 0;
      const lineTotal = e.quantity * e.unitPrice;
      results.push({ ...e, unitCost, cogsTotal: cogs, lineTotal });
    }
  }
  return results;
}

async function calculateIssueCost(
  tx: Prisma.TransactionClient,
  productId: string,
  locationId: string,
  issueQty: number,
  asOfDate: Date
): Promise<{ unitCost: number; cogsTotal: number }>
{
  if (COST_METHOD === 'FIFO' || COST_METHOD === 'LIFO') {
    const layers = await buildRemainingLayersFIFO(tx, productId, locationId, asOfDate);
    const totalAvailable = layers.reduce((acc, l) => acc + l.qty, 0);
    if (totalAvailable + 1e-9 < issueQty) {
      throw new Error('Insufficient stock for product at selected warehouse');
    }
    let remaining = issueQty;
    let cogs = 0;
    if (COST_METHOD === 'FIFO') {
      // consume from start
      let idx = 0;
      while (remaining > 0 && idx < layers.length) {
        const l = layers[idx];
        const take = Math.min(l.qty, remaining);
        cogs += take * l.cost;
        remaining -= take;
        idx++;
      }
    } else {
      // LIFO: consume from end
      let idx = layers.length - 1;
      while (remaining > 0 && idx >= 0) {
        const l = layers[idx];
        const take = Math.min(l.qty, remaining);
        cogs += take * l.cost;
        remaining -= take;
        idx--;
      }
    }
    const unitCost = issueQty > 0 ? cogs / issueQty : 0;
    return { unitCost, cogsTotal: cogs };
  } else {
    // Weighted Average as-of date: compute avg cost from movements
    const movements = await tx.stockMovement.findMany({
      where: { productId, locationId, date: { lte: asOfDate } },
    });
    let qty = 0;
    let value = 0;
    for (const m of movements) {
      const sign = m.movementType === 'OUT' ? -1 : 1;
      const deltaQty = sign * Number(m.quantity);
      const deltaVal = sign * Number(m.quantity) * Number(m.costPerUnit);
      qty += deltaQty;
      value += deltaVal;
    }
    if (qty + 1e-9 < issueQty) {
      throw new Error('Insufficient stock for product at selected warehouse');
    }
    const avg = qty !== 0 ? value / qty : 0;
    return { unitCost: avg, cogsTotal: avg * issueQty };
  }
}

router.post('/sales-invoices', async (req, res) => {
  const parsed = salesInvoiceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const productIds = data.items.map((i) => i.productId);
      const products = await tx.product.findMany({ where: { id: { in: productIds } } });
      const productMap = new Map<string, any>(products.map((p: any) => [p.id, p] as const));

      // Compute COGS unit cost per item using configured method and enforce stock checks per warehouse
      const itemsWithCostsAndTotals = await calculateCostsForItems(
        tx,
        data.items.map((i) => ({ productId: i.productId, locationId: i.locationId, quantity: i.quantity, unitPrice: i.unitPrice })),
        data.date
      );

      const total = itemsWithCostsAndTotals.reduce((acc, i) => acc + i.lineTotal, 0);

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
            create: itemsWithCostsAndTotals.map((i) => ({
              productId: i.productId,
              locationId: i.locationId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              unitCost: i.unitCost, // snapshot computed cost
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

        for (const item of itemsWithCostsAndTotals) {
          const p = productMap.get(item.productId)!;
          const revenueAccountId = data.revenueAccountId ?? p.revenueAccountId;

          await tx.journalLine.create({ data: { entryId: createdEntry.id, accountId: arAccountId, debit: item.lineTotal, credit: 0 } });
          await tx.journalLine.create({ data: { entryId: createdEntry.id, accountId: revenueAccountId, debit: 0, credit: item.lineTotal } });

          await tx.journalLine.create({ data: { entryId: createdEntry.id, accountId: p.cogsAccountId, debit: item.cogsTotal, credit: 0, productId: p.id, locationId: item.locationId } });
          await tx.journalLine.create({ data: { entryId: createdEntry.id, accountId: p.inventoryAccountId, debit: 0, credit: item.cogsTotal, productId: p.id, locationId: item.locationId } });

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

      // If this payment references a sales invoice, recalc invoice status based on total paid
      if (data.referenceType === 'SALES_INVOICE' && data.referenceId && data.type === 'IN') {
        try {
          const invoice = await tx.salesInvoice.findUnique({ where: { id: data.referenceId } });
          if (invoice) {
            const paysAgg = await tx.payment.aggregate({
              _sum: { amount: true },
              where: { referenceType: 'SALES_INVOICE', referenceId: invoice.id, type: 'IN' },
            });
            const paidSum = Number(paysAgg._sum.amount || 0);
            const totalAmount = Number(invoice.total || 0);
            const nextStatus: 'PAID' | 'PARTIALLY_PAID' | 'POSTED' = paidSum + 1e-9 >= totalAmount
              ? 'PAID'
              : paidSum > 0
              ? 'PARTIALLY_PAID'
              : 'POSTED';
            if (invoice.status !== nextStatus) {
              await tx.salesInvoice.update({ where: { id: invoice.id }, data: { status: nextStatus } });
            }
          }
        } catch {}
      }

      return createdPayment;
    });
    res.status(201).json(payment);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;