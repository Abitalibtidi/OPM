import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, authorizeValuationAccess } from '../middleware/auth';
import { createAuditLog } from '../middleware/audit';

const router = Router({ mergeParams: true });
const prisma = new PrismaClient();

function formatZodErrors(zodError: z.ZodError): string {
  return zodError.errors
    .map((e) => {
      const field = e.path.join('.');
      return field ? `${field}: ${e.message}` : e.message;
    })
    .join('; ');
}

const shareClassSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['common', 'preferred', 'option']),
  sharesOutstanding: z.number().min(0),
  issuePrice: z.number().min(0).optional().default(0),
  liquidationPreference: z.number().min(0).optional().default(0),
  isParticipating: z.boolean().optional().default(false),
  participationCap: z.number().min(0).optional().default(0),
  conversionRatio: z.number().min(0).optional().default(1),
  seniorityLevel: z.number().int().min(1).optional().default(1),
  liquidationSeniority: z.enum(['senior', 'pari_passu', 'junior']).optional().default('pari_passu'),
  strikePrice: z.number().min(0).optional().default(0),
  vestingPercent: z.number().min(0).max(100).optional().default(100),
  sortOrder: z.number().int().min(0).optional().default(0),
});

// All routes require authentication + valuation access
router.use(authenticate);

/**
 * GET /api/valuations/:valuationId/share-classes
 */
router.get('/', authorizeValuationAccess, async (req: Request, res: Response) => {
  try {
    const shareClasses = await prisma.shareClass.findMany({
      where: { valuationId: req.params.valuationId },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(shareClasses);
  } catch (error) {
    console.error('List share classes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/valuations/:valuationId/share-classes
 */
router.post('/', authorizeValuationAccess, async (req: Request, res: Response) => {
  try {
    const data = shareClassSchema.parse(req.body);

    // Verify valuation exists
    const valuation = await prisma.valuation.findUnique({
      where: { id: req.params.valuationId },
    });
    if (!valuation) {
      res.status(404).json({ error: 'Valuation not found' });
      return;
    }

    const shareClass = await prisma.shareClass.create({
      data: {
        ...data,
        valuationId: req.params.valuationId,
      },
    });

    await createAuditLog({
      userId: req.user!.id,
      valuationId: req.params.valuationId,
      action: 'share_class_added',
      details: `Added share class: ${data.name} (${data.type})`,
      ipAddress: req.ip,
    });

    res.status(201).json(shareClass);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: formatZodErrors(error), details: error.errors });
      return;
    }
    console.error('Create share class error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/valuations/:valuationId/share-classes/:classId
 */
router.put('/:classId', authorizeValuationAccess, async (req: Request, res: Response) => {
  try {
    const data = shareClassSchema.partial().parse(req.body);

    const existing = await prisma.shareClass.findFirst({
      where: { id: req.params.classId, valuationId: req.params.valuationId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Share class not found' });
      return;
    }

    const shareClass = await prisma.shareClass.update({
      where: { id: req.params.classId },
      data,
    });

    await createAuditLog({
      userId: req.user!.id,
      valuationId: req.params.valuationId,
      action: 'share_class_updated',
      details: `Updated share class: ${shareClass.name}`,
      ipAddress: req.ip,
    });

    res.json(shareClass);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: formatZodErrors(error), details: error.errors });
      return;
    }
    console.error('Update share class error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/valuations/:valuationId/share-classes/:classId
 */
router.delete('/:classId', authorizeValuationAccess, async (req: Request, res: Response) => {
  try {
    const existing = await prisma.shareClass.findFirst({
      where: { id: req.params.classId, valuationId: req.params.valuationId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Share class not found' });
      return;
    }

    await prisma.shareClass.delete({ where: { id: req.params.classId } });

    await createAuditLog({
      userId: req.user!.id,
      valuationId: req.params.valuationId,
      action: 'share_class_deleted',
      details: `Deleted share class: ${existing.name}`,
      ipAddress: req.ip,
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete share class error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
