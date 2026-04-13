import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Reviewers and admins can view audit logs
router.use(authenticate, authorize('admin', 'reviewer'));

/**
 * GET /api/audit-log
 * List audit log entries with optional filters.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 200);
    const valuationId = req.query.valuationId as string | undefined;
    const userId = req.query.userId as string | undefined;
    const action = req.query.action as string | undefined;

    const where: any = {};
    if (valuationId) where.valuationId = valuationId;
    if (userId) where.userId = userId;
    if (action) where.action = action;

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, name: true } },
          valuation: { select: { id: true, name: true, companyName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ data, total, page, pageSize });
  } catch (error) {
    console.error('Audit log error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
