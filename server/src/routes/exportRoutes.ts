import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorizeValuationAccess } from '../middleware/auth';
import { createAuditLog } from '../middleware/audit';
import { generatePDFReport } from '../utils/pdf';
import { generateExcelReport } from '../utils/excel';

const router = Router({ mergeParams: true });
const prisma = new PrismaClient();

router.use(authenticate);

/**
 * GET /api/valuations/:id/export/pdf
 * Export valuation results as PDF.
 */
router.get('/pdf', authorizeValuationAccess, async (req: Request, res: Response) => {
  try {
    const valuation = await prisma.valuation.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { id: true, email: true, name: true, role: true } },
        shareClasses: { orderBy: { sortOrder: 'asc' } },
        valuationResults: { include: { shareClass: true } },
      },
    });

    if (!valuation) {
      res.status(404).json({ error: 'Valuation not found' });
      return;
    }

    if (valuation.valuationResults.length === 0) {
      res.status(400).json({ error: 'No calculation results available. Run the calculation first.' });
      return;
    }

    const pdfBuffer = await generatePDFReport(valuation);

    await createAuditLog({
      userId: req.user!.id,
      valuationId: valuation.id,
      action: 'valuation_exported',
      details: `Exported PDF report for: ${valuation.name}`,
      ipAddress: req.ip,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${valuation.name.replace(/[^a-zA-Z0-9]/g, '_')}_OPM_Report.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

/**
 * GET /api/valuations/:id/export/excel
 * Export valuation results as Excel.
 */
router.get('/excel', authorizeValuationAccess, async (req: Request, res: Response) => {
  try {
    const valuation = await prisma.valuation.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { id: true, email: true, name: true, role: true } },
        shareClasses: { orderBy: { sortOrder: 'asc' } },
        valuationResults: { include: { shareClass: true } },
      },
    });

    if (!valuation) {
      res.status(404).json({ error: 'Valuation not found' });
      return;
    }

    if (valuation.valuationResults.length === 0) {
      res.status(400).json({ error: 'No calculation results available. Run the calculation first.' });
      return;
    }

    const excelBuffer = await generateExcelReport(valuation);

    await createAuditLog({
      userId: req.user!.id,
      valuationId: valuation.id,
      action: 'valuation_exported',
      details: `Exported Excel report for: ${valuation.name}`,
      ipAddress: req.ip,
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${valuation.name.replace(/[^a-zA-Z0-9]/g, '_')}_OPM_Report.xlsx"`);
    res.send(excelBuffer);
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

export default router;
