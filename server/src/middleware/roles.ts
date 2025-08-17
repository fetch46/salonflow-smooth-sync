import { Request, Response, NextFunction } from 'express';

export function requireRole(roles: Array<'ADMIN' | 'ACCOUNTANT' | 'INVENTORY' | 'OWNER'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const userRole = String(user.role || '').toUpperCase();

    // Owners have full access
    if (userRole === 'OWNER') return next();

    if (!(roles as string[]).includes(userRole)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}