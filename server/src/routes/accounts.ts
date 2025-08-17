import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/roles.js';

const router = Router();

const accountSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']),
  parentId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

router.use(requireAuth);

router.get('/', requirePermission('SETTINGS','VIEW'), async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Math.min(Number(req.query.pageSize || 20), 100);
  const search = String(req.query.search || '').trim();
  const where: any = {};
  if (search) where.OR = [{ code: { contains: search } }, { name: { contains: search } }];
  const [items, total] = await Promise.all([
    prisma.account.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { code: 'asc' } }),
    prisma.account.count({ where }),
  ]);
  res.json({ items, total, page, pageSize });
});

router.post('/', requirePermission('SETTINGS','EDIT'), async (req, res) => {
  const parsed = accountSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const created = await prisma.account.create({ data: parsed.data });
    res.status(201).json(created);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/:id', requirePermission('SETTINGS','VIEW'), async (req, res) => {
  const account = await prisma.account.findUnique({ where: { id: req.params.id } });
  if (!account) return res.status(404).json({ error: 'Not found' });
  res.json(account);
});

router.put('/:id', requirePermission('SETTINGS','EDIT'), async (req, res) => {
  const parsed = accountSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const updated = await prisma.account.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', requirePermission('SETTINGS','EDIT'), async (req, res) => {
  try {
    await prisma.account.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;