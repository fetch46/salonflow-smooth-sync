import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';

const router = Router();

const accountSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']),
  parentId: z.string().optional().nullable(),
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
    prisma.account.findMany({ where, orderBy: { code: 'asc' }, skip: (page-1)*pageSize, take: pageSize }),
    prisma.account.count({ where }),
  ]);

  res.json({ items, total, page, pageSize });
});

router.post('/', async (req, res) => {
  const parsed = accountSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;
  try {
    const account = await prisma.account.create({ data });
    res.status(201).json(account);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/:id', async (req, res) => {
  const account = await prisma.account.findUnique({ where: { id: req.params.id } });
  if (!account) return res.status(404).json({ error: 'Not found' });
  res.json(account);
});

router.put('/:id', async (req, res) => {
  const parsed = accountSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const account = await prisma.account.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(account);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.account.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;