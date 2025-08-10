import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';

const router = Router();

const locationSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  isActive: z.boolean().optional(),
});

router.use(requireAuth);

router.get('/', async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Math.min(Number(req.query.pageSize || 20), 100);
  const search = String(req.query.search || '').trim();

  const where = search
    ? { OR: [ { code: { contains: search } }, { name: { contains: search } } ] }
    : {};

  const [items, total] = await Promise.all([
    prisma.stockLocation.findMany({ where, orderBy: { code: 'asc' }, skip: (page-1)*pageSize, take: pageSize }),
    prisma.stockLocation.count({ where }),
  ]);

  res.json({ items, total, page, pageSize });
});

router.post('/', async (req, res) => {
  const parsed = locationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const location = await prisma.stockLocation.create({ data: parsed.data });
    res.status(201).json(location);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/:id', async (req, res) => {
  const item = await prisma.stockLocation.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.put('/:id', async (req, res) => {
  const parsed = locationSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const item = await prisma.stockLocation.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(item);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.stockLocation.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;