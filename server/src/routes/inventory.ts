import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';

const router = Router();

const movementSchema = z.object({
  productId: z.string().min(1),
  locationId: z.string().min(1),
  date: z.coerce.date().optional(),
  movementType: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  quantity: z.coerce.number(),
  costPerUnit: z.coerce.number().nonnegative(),
  referenceType: z.enum(['SALES_INVOICE', 'PURCHASE_BILL', 'PAYMENT', 'ADJUSTMENT', 'MANUAL']).default('MANUAL'),
  referenceId: z.string().optional().nullable(),
});

router.use(requireAuth);

router.post('/movements', async (req, res) => {
  const parsed = movementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;
  try {
    const created = await prisma.stockMovement.create({ data });
    res.status(201).json(created);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/valuation', async (_req, res) => {
  const movements = await prisma.stockMovement.findMany();
  const map = new Map<string, { qty: number; value: number }>();
  for (const m of movements) {
    const key = m.productId;
    const sign = m.movementType === 'OUT' ? -1 : 1;
    const qtyDelta = sign * Number(m.quantity);
    const valueDelta = sign * Number(m.quantity) * Number(m.costPerUnit);
    const cur = map.get(key) ?? { qty: 0, value: 0 };
    cur.qty += qtyDelta;
    cur.value += valueDelta;
    map.set(key, cur);
  }
  const products = await prisma.product.findMany();
  const rows = products.map((p: any) => {
    const agg = map.get(p.id) ?? { qty: 0, value: 0 };
    const avgCost = agg.qty !== 0 ? agg.value / agg.qty : Number(p.cost);
    return {
      productId: p.id,
      sku: p.sku,
      name: p.name,
      quantityOnHand: agg.qty,
      avgCost,
      inventoryValue: agg.qty * avgCost,
    };
  });
  res.json({ rows });
});

router.get('/movement-history', async (req, res) => {
  const productId = String(req.query.productId || '');
  const locationId = String(req.query.locationId || '');
  const where: any = {};
  if (productId) where.productId = productId;
  if (locationId) where.locationId = locationId;
  const items = await prisma.stockMovement.findMany({ where, orderBy: { date: 'asc' }, include: { product: true, location: true } });
  res.json({ items });
});

export default router;