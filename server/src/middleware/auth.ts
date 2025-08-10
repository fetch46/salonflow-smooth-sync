import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const token = auth.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'devsecret') as any;
    (req as any).user = { id: payload.sub, role: payload.role };
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}