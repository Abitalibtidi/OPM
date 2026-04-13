import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, authorize, authorizeValuationAccess } from '../middleware/auth';
import { createAuditLog } from '../middleware/audit';
import { calculateOPM, backsolve, validateBacksolveInputs } from '../engine';
import type { ShareClass } from '../../shared/types';

const router = Router();
const prisma = new PrismaClient();

const createValuationSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  companyName: z.string().min(1),
  valuationDate: z.string(),
  totalEquityValue: z.number().min(0).optional().default(0),
  volatility: z.number().min(0.01).max(3).optional().default(0.6),
  riskFreeRate: z.number().min(0).max(0.5).optional().default(0.04),
  term: z.number().min(0.01).max(30).optional().default(3),
  dividendYield: z.number().min(0).max(1).optional().default(0),
});

const updateValuationSchema = createValuationSchema.partial().extend({
  status: z.enum(['draft', 'in_review', 'approved', 'archived']).optional(),
  backsolveTargetClassId: z.string().optional().nullable(),
  backsolveTargetPPS: z.number().min(0).optional().nullable(),
});

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/valuations
 * List all valuations accessible to the current user.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
    const status = req.query.status as string | undefined;

    const where: any = {};

    // Analysts see only their own; reviewers/admins see all
    if (req.user!.role === 'analyst') {
      where.createdById = req.user!.id;
    }

    if (status) {
      where.status = status;
    }

    const [data, total] = await Promise.all([
      prisma.valuation.findMany({
        where,
        include: {
          createdBy: { select: { id: true, email: true, name: true, role: true } },
          shareClasses: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { valuationResults: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.valuation.count({ where }),
    ]);

    res.json({ data, total, page, pageSize });
  } catch (error) {
    console.error('List valuations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/valuations
 * Create a new valuation.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createValuationSchema.parse(req.body);

    const valuation = await prisma.valuation.create({
      data: {
        ...data,
        createdById: req.user!.id,
      },
      include: {
        createdBy: { select: { id: true, email: true, name: true, role: true } },
        shareClasses: true,
      },
    });

    await createAuditLog({
      userId: req.user!.id,
      valuationId: valuation.id,
      action: 'valuation_created',
      details: `Created valuation: ${valuation.name}`,
      ipAddress: req.ip,
    });

    res.status(201).json(valuation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    console.error('Create valuation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/valuations/:id
 * Get a single valuation with all related data.
 */
router.get('/:id', authorizeValuationAccess, async (req: Request, res: Response) => {
  try {
    const valuation = await prisma.valuation.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { id: true, email: true, name: true, role: true } },
        shareClasses: { orderBy: { sortOrder: 'asc' } },
        valuationResults: {
          include: { shareClass: true },
        },
      },
    });

    if (!valuation) {
      res.status(404).json({ error: 'Valuation not found' });
      return;
    }

    res.json(valuation);
  } catch (error) {
    console.error('Get valuation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/valuations/:id
 * Update a valuation.
 */
router.put('/:id', authorizeValuationAccess, async (req: Request, res: Response) => {
  try {
    const data = updateValuationSchema.parse(req.body);
    const oldValuation = await prisma.valuation.findUnique({ where: { id: req.params.id } });

    if (!oldValuation) {
      res.status(404).json({ error: 'Valuation not found' });
      return;
    }

    // Only drafts can be edited by analysts
    if (req.user!.role === 'analyst' && oldValuation.status !== 'draft') {
      res.status(403).json({ error: 'Only draft valuations can be edited' });
      return;
    }

    const valuation = await prisma.valuation.update({
      where: { id: req.params.id },
      data,
      include: {
        createdBy: { select: { id: true, email: true, name: true, role: true } },
        shareClasses: { orderBy: { sortOrder: 'asc' } },
      },
    });

    const changes: string[] = [];
    if (data.status && data.status !== oldValuation.status) {
      changes.push(`status: ${oldValuation.status} → ${data.status}`);
    }
    if (data.totalEquityValue !== undefined && data.totalEquityValue !== oldValuation.totalEquityValue) {
      changes.push(`equity value: ${oldValuation.totalEquityValue} → ${data.totalEquityValue}`);
    }

    await createAuditLog({
      userId: req.user!.id,
      valuationId: valuation.id,
      action: data.status !== oldValuation.status ? 'valuation_status_changed' : 'valuation_updated',
      details: `Updated valuation: ${valuation.name}. Changes: ${changes.join(', ') || 'inputs modified'}`,
      ipAddress: req.ip,
    });

    res.json(valuation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    console.error('Update valuation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/valuations/:id
 * Delete a valuation (admin only).
 */
router.delete('/:id', authorize('admin'), async (req: Request, res: Response) => {
  try {
    const valuation = await prisma.valuation.findUnique({ where: { id: req.params.id } });
    if (!valuation) {
      res.status(404).json({ error: 'Valuation not found' });
      return;
    }

    await prisma.valuation.delete({ where: { id: req.params.id } });

    await createAuditLog({
      userId: req.user!.id,
      valuationId: req.params.id,
      action: 'valuation_updated',
      details: `Deleted valuation: ${valuation.name}`,
      ipAddress: req.ip,
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete valuation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/valuations/:id/calculate
 * Run the OPM calculation and store results.
 */
router.post('/:id/calculate', authorizeValuationAccess, async (req: Request, res: Response) => {
  try {
    const valuation = await prisma.valuation.findUnique({
      where: { id: req.params.id },
      include: { shareClasses: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!valuation) {
      res.status(404).json({ error: 'Valuation not found' });
      return;
    }

    if (valuation.shareClasses.length === 0) {
      res.status(400).json({ error: 'At least one share class is required' });
      return;
    }

    if (valuation.totalEquityValue <= 0) {
      res.status(400).json({ error: 'Total equity value must be positive' });
      return;
    }

    // Run OPM calculation
    const opmResult = calculateOPM({
      totalEquityValue: valuation.totalEquityValue,
      volatility: valuation.volatility,
      riskFreeRate: valuation.riskFreeRate,
      term: valuation.term,
      dividendYield: valuation.dividendYield,
      shareClasses: valuation.shareClasses as unknown as ShareClass[],
    });

    // Clear previous results and store new ones
    await prisma.valuationResult.deleteMany({ where: { valuationId: valuation.id } });

    for (const result of opmResult.results) {
      await prisma.valuationResult.create({
        data: {
          valuationId: valuation.id,
          shareClassId: result.shareClassId,
          optionValue: result.optionValue,
          perShareValue: result.perShareValue,
          totalValue: result.totalValue,
          allocationPercent: result.allocationPercent,
          fullyDilutedShares: result.fullyDilutedShares,
        },
      });
    }

    await createAuditLog({
      userId: req.user!.id,
      valuationId: valuation.id,
      action: 'valuation_calculated',
      details: `OPM calculation completed. Equity value: $${valuation.totalEquityValue.toLocaleString()}`,
      ipAddress: req.ip,
    });

    res.json(opmResult);
  } catch (error) {
    console.error('Calculate error:', error);
    res.status(500).json({ error: 'Calculation failed', details: String(error) });
  }
});

/**
 * POST /api/valuations/:id/backsolve
 * Run the backsolve to find implied equity value.
 */
router.post('/:id/backsolve', authorizeValuationAccess, async (req: Request, res: Response) => {
  try {
    const bodySchema = z.object({
      targetClassId: z.string(),
      targetPerShareValue: z.number().positive(),
    });

    const body = bodySchema.parse(req.body);

    const valuation = await prisma.valuation.findUnique({
      where: { id: req.params.id },
      include: { shareClasses: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!valuation) {
      res.status(404).json({ error: 'Valuation not found' });
      return;
    }

    if (valuation.shareClasses.length === 0) {
      res.status(400).json({ error: 'At least one share class is required' });
      return;
    }

    const backsolveInputs = {
      targetClassId: body.targetClassId,
      targetPerShareValue: body.targetPerShareValue,
      volatility: valuation.volatility,
      riskFreeRate: valuation.riskFreeRate,
      term: valuation.term,
      dividendYield: valuation.dividendYield,
      shareClasses: valuation.shareClasses as unknown as ShareClass[],
    };

    // Validate inputs
    const validationErrors = validateBacksolveInputs(backsolveInputs);
    if (validationErrors.length > 0) {
      res.status(400).json({ error: 'Invalid inputs', details: validationErrors });
      return;
    }

    // Run backsolve
    const result = backsolve(backsolveInputs);

    if (!result.converged) {
      res.status(422).json({
        error: 'Backsolve did not converge',
        details: `After ${result.iterations} iterations, the solver could not find a solution within tolerance.`,
      });
      return;
    }

    // Update valuation with implied equity value
    await prisma.valuation.update({
      where: { id: valuation.id },
      data: {
        totalEquityValue: result.impliedEquityValue,
        backsolveTargetClassId: body.targetClassId,
        backsolveTargetPPS: body.targetPerShareValue,
      },
    });

    // Store results
    await prisma.valuationResult.deleteMany({ where: { valuationId: valuation.id } });

    for (const r of result.results) {
      await prisma.valuationResult.create({
        data: {
          valuationId: valuation.id,
          shareClassId: r.shareClassId,
          optionValue: r.optionValue,
          perShareValue: r.perShareValue,
          totalValue: r.totalValue,
          allocationPercent: r.allocationPercent,
          fullyDilutedShares: r.fullyDilutedShares,
        },
      });
    }

    await createAuditLog({
      userId: req.user!.id,
      valuationId: valuation.id,
      action: 'valuation_backsolve',
      details: `Backsolve completed. Implied equity value: $${result.impliedEquityValue.toLocaleString()}. Target: ${body.targetPerShareValue}/share for class ${body.targetClassId}`,
      ipAddress: req.ip,
    });

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    console.error('Backsolve error:', error);
    res.status(500).json({ error: 'Backsolve failed', details: String(error) });
  }
});

export default router;
