import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma.js';

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

// New: Permission-aware middleware
// Accountant/Owner-only resources must remain restricted regardless of explicit permissions elsewhere
// If a module is BANKING or REPORTS, only ACCOUNTANT or OWNER are allowed.
export function requirePermission(resource: 'APPOINTMENTS' | 'CLIENTS' | 'INVOICES' | 'PAYMENTS' | 'JOBCARDS' | 'SUPPLIERS' | 'PURCHASES' | 'GOODS_RECEIVED' | 'EXPENSES' | 'PRODUCTS' | 'ADJUSTMENTS' | 'TRANSFERS' | 'BANKING' | 'REPORTS' | 'SETTINGS', action: 'VIEW' | 'CREATE' | 'EDIT' | 'DELETE') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const userRole = String(user.role || '').toUpperCase();

    // Owners have full access
    if (userRole === 'OWNER') return next();

    const accountantOwnerOnly = new Set(['BANKING', 'REPORTS']);
    // Accountant/Owner-only override
    if (accountantOwnerOnly.has(resource) && userRole !== 'ACCOUNTANT') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      const count = await prisma.rolePermission.count({
        where: {
          role: userRole as any,
          resource: resource as any,
          action: action as any,
        },
      });
      if (count === 0) return res.status(403).json({ error: 'Forbidden' });
      return next();
    } catch (e) {
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}