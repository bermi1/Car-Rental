import { Request, Response, NextFunction } from 'express';
import { verifyToken, AuthTokenPayload, AuthRole } from '../utils/jwt';

export interface AuthedRequest extends Request {
  user?: AuthTokenPayload;
  /**
   * The company this request operates on. Set by `resolveCompany`.
   * For admin/staff it is their own company and cannot be overridden.
   * For a super admin it comes from the X-Company-Id header, letting them
   * work inside any tenant without holding a membership in it.
   */
  companyId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: AuthRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };
}

/** Any internal user of a company. A super admin qualifies everywhere. */
export const requireStaffOrAdmin = requireRole('super_admin', 'admin', 'staff');

/** Company-level administration. A super admin qualifies everywhere. */
export const requireCompanyAdmin = requireRole('super_admin', 'admin');

/** Platform-level administration — creating companies, cross-tenant views. */
export const requireSuperAdmin = requireRole('super_admin');

/**
 * Establishes the tenant for the request.
 *
 * This is the single choke point for tenant isolation: route handlers read
 * `req.companyId` and never trust a company id from the request body, so a
 * company's staff cannot reach another company's rows by guessing an id.
 */
export function resolveCompany(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  if (req.user.role === 'super_admin') {
    const header = req.header('X-Company-Id');
    if (header) req.companyId = header;
    // A super admin without a selected company sees across all tenants;
    // handlers treat an undefined companyId as "no tenant filter".
    return next();
  }

  if (!req.user.companyId) {
    return res.status(403).json({ error: 'This account is not linked to a company' });
  }
  req.companyId = req.user.companyId;
  next();
}

/** Like `resolveCompany`, but the request cannot proceed without a tenant. */
export function requireCompany(req: AuthedRequest, res: Response, next: NextFunction) {
  resolveCompany(req, res, () => {
    if (!req.companyId) {
      return res.status(400).json({
        error: 'Select a company first (send an X-Company-Id header)',
      });
    }
    next();
  });
}
