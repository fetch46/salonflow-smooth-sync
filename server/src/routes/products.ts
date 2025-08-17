import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/roles.js';

const router = Router();

const productSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  unitOfMeasure: z.string().default('unit'),
  price: z.coerce.number().nonnegative(),
  cost: z.coerce.number().nonnegative(),
  reorderPoint: z.coerce.number().int().nonnegative().default(0),
  inventoryAccountId: z.string().min(1),
  cogsAccountId: z.string().min(1),
  revenueAccountId: z.string().min(1),
  isActive: z.boolean().optional(),
});

router.use(requireAuth);

router.get('/', requirePermission('PRODUCTS','VIEW'), async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Math.min(Number(req.query.pageSize || 20), 100);
  const search = String(req.query.search || '').trim();

  const where = search
    ? { OR: [ { sku: { contains: search } }, { name: { contains: search } } ] }
    : {};

  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, orderBy: { sku: 'asc' }, skip: (page-1)*pageSize, take: pageSize }),
    prisma.product.count({ where }),
  ]);

  res.json({ items, total, page, pageSize });
});

router.post('/', requirePermission('PRODUCTS','CREATE'), async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const product = await prisma.product.create({ data: parsed.data });
    res.status(201).json(product);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/:id', requirePermission('PRODUCTS','VIEW'), async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ error: 'Not found' });
  res.json(product);
});

router.put('/:id', requirePermission('PRODUCTS','EDIT'), async (req, res) => {
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const product = await prisma.product.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(product);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', requirePermission('PRODUCTS','DELETE'), async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;