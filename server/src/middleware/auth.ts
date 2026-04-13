import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';

const prisma = new PrismaClient();

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * JWT authentication middleware.
 * Extracts and validates the Bearer token from the Authorization header.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthUser;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Role-based authorization middleware.
 * Must be used after authenticate().
 */
export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

/**
 * Middleware to check that the user can access a specific valuation.
 * Analysts can only access their own valuations. Reviewers and admins can access all.
 */
export async function authorizeValuationAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const valuationId = req.params.id || req.params.valuationId;
  if (!valuationId) {
    next();
    return;
  }

  try {
    const valuation = await prisma.valuation.findUnique({
      where: { id: valuationId },
    });

    if (!valuation) {
      res.status(404).json({ error: 'Valuation not found' });
      return;
    }

    // Admins and reviewers can access all valuations
    if (req.user.role === 'admin' || req.user.role === 'reviewer') {
      next();
      return;
    }

    // Analysts can only access their own valuations
    if (valuation.createdById !== req.user.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
