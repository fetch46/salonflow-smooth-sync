import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

function getJwtSecret() {
	const secret = process.env.JWT_SECRET;
	if (!secret) {
		console.warn('JWT_SECRET not set, using default secret. This is insecure for production!');
		return 'your-super-secret-jwt-key-change-this-in-production';
	}
	return secret;
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