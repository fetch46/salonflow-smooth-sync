import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

function getJwtSecret() {
	const secret = process.env.JWT_SECRET;
	if (!secret && process.env.NODE_ENV === 'production') {
		throw new Error('JWT_SECRET is required in production');
	}
	return secret || 'devsecret';
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const token = auth.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, getJwtSecret()) as any;
    (req as any).user = { id: payload.sub, role: payload.role };
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}