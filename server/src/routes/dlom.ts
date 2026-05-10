import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, authorizeValuationAccess } from '../middleware/auth';
import { calculateDLOM } from '../engine/dlom';

const router = Router({ mergeParams: true });
const prisma = new PrismaClient();

const dlomSchema = z.object({
  volatility: z.number().min(0.01).max(5),
  holdingPeriod: z.number().min(0.1).max(30),
  riskFreeRate: z.number().min(0).max(1),
});

router.use(authenticate);

/**
 * POST /api/valuations/:id/dlom
 *
 * Runs all four DLOM models, persists results, and returns them.
 * Replaces any prior DLOM results for this valuation.
 */
router.post('/', authorizeValuationAccess, async (req: Request, res: Response) => {
  try {
    const inputs = dlomSchema.parse(req.body);
    const valuationId = req.params.id;

    const valuation = await prisma.valuation.findUnique({ where: { id: valuationId } });
    if (!valuation) {
      res.status(404).json({ error: 'Valuation not found' });
      return;
    }

    const modelResults = calculateDLOM({
      volatility: inputs.volatility,
      holdingPeriod: inputs.holdingPeriod,
      riskFreeRate: inputs.riskFreeRate,
    });

    // Replace prior results for this valuation
    await prisma.dLOMResult.deleteMany({ where: { valuationId } });
    await prisma.dLOMResult.createMany({
      data: modelResults.map((r) => ({
        valuationId,
        modelName: r.modelName,
        volatility: inputs.volatility,
        holdingPeriod: inputs.holdingPeriod,
        riskFreeRate: inputs.riskFreeRate,
        dlomPercentage: r.dlomPercentage,
      })),
    });

    res.json({ results: modelResults });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors.map((e) => e.message).join('; ') });
      return;
    }
    console.error('DLOM calculation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/valuations/:id/dlom
 *
 * Returns the most recently saved DLOM results for this valuation.
 */
router.get('/', authorizeValuationAccess, async (req: Request, res: Response) => {
  try {
    const saved = await prisma.dLOMResult.findMany({
      where: { valuationId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(saved);
  } catch (error) {
    console.error('DLOM fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
