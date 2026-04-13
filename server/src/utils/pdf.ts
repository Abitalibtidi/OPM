import PDFDocument from 'pdfkit';

interface ValuationData {
  name: string;
  companyName: string;
  valuationDate: string;
  totalEquityValue: number;
  volatility: number;
  riskFreeRate: number;
  term: number;
  dividendYield: number;
  backsolveTargetPPS: number | null;
  createdBy: { name: string; email: string } | null;
  shareClasses: any[];
  valuationResults: any[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number): string {
  return (value * 100).toFixed(2) + '%';
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

/**
 * Generate a PDF report for a valuation.
 */
export async function generatePDFReport(valuation: ValuationData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── Header ──
      doc.fontSize(20).font('Helvetica-Bold').text('OPM Valuation Report', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(14).font('Helvetica').text(valuation.companyName, { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#666666').text(`Valuation Date: ${valuation.valuationDate}`, { align: 'center' });
      doc.text(`Report Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
      if (valuation.createdBy) {
        doc.text(`Prepared by: ${valuation.createdBy.name}`, { align: 'center' });
      }
      doc.moveDown(1);

      // ── Horizontal Rule ──
      doc.strokeColor('#cccccc').lineWidth(1)
        .moveTo(50, doc.y).lineTo(562, doc.y).stroke();
      doc.moveDown(1);

      // ── OPM Assumptions ──
      doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold').text('OPM Assumptions');
      doc.moveDown(0.5);

      doc.fontSize(10).font('Helvetica');
      const assumptions = [
        ['Total Equity Value', formatCurrency(valuation.totalEquityValue)],
        ['Equity Volatility', formatPercent(valuation.volatility)],
        ['Risk-Free Rate', formatPercent(valuation.riskFreeRate)],
        ['Expected Term', `${valuation.term.toFixed(1)} years`],
        ['Dividend Yield', formatPercent(valuation.dividendYield)],
      ];

      if (valuation.backsolveTargetPPS) {
        assumptions.push(['Backsolve Target PPS', formatCurrency(valuation.backsolveTargetPPS)]);
      }

      for (const [label, value] of assumptions) {
        doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
        doc.font('Helvetica').text(value);
      }
      doc.moveDown(1);

      // ── Capital Structure ──
      doc.fontSize(14).font('Helvetica-Bold').text('Capital Structure');
      doc.moveDown(0.5);

      // Table header
      const tableLeft = 50;
      const colWidths = [120, 70, 80, 80, 80, 80];
      const headers = ['Class Name', 'Type', 'Shares', 'Issue Price', 'Liq. Pref.', 'Conv. Ratio'];

      doc.fontSize(9).font('Helvetica-Bold');
      let xPos = tableLeft;
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], xPos, doc.y, { width: colWidths[i], align: i === 0 ? 'left' : 'right' });
        xPos += colWidths[i];
      }
      doc.moveDown(0.5);

      // Table rows
      doc.font('Helvetica').fontSize(9);
      for (const sc of valuation.shareClasses) {
        const y = doc.y;
        xPos = tableLeft;
        doc.text(sc.name, xPos, y, { width: colWidths[0] });
        xPos += colWidths[0];
        doc.text(sc.type, xPos, y, { width: colWidths[1], align: 'right' });
        xPos += colWidths[1];
        doc.text(formatNumber(sc.sharesOutstanding), xPos, y, { width: colWidths[2], align: 'right' });
        xPos += colWidths[2];
        doc.text(formatCurrency(sc.issuePrice), xPos, y, { width: colWidths[3], align: 'right' });
        xPos += colWidths[3];
        doc.text(formatCurrency(sc.liquidationPreference), xPos, y, { width: colWidths[4], align: 'right' });
        xPos += colWidths[4];
        doc.text(sc.conversionRatio.toFixed(2), xPos, y, { width: colWidths[5], align: 'right' });
        doc.moveDown(0.3);
      }
      doc.moveDown(1);

      // ── Valuation Results ──
      if (doc.y > 600) doc.addPage();

      doc.fontSize(14).font('Helvetica-Bold').text('Valuation Results');
      doc.moveDown(0.5);

      const resultColWidths = [120, 90, 90, 90, 90];
      const resultHeaders = ['Class Name', 'Total Value', 'Per Share', 'FD Shares', 'Allocation'];

      doc.fontSize(9).font('Helvetica-Bold');
      xPos = tableLeft;
      for (let i = 0; i < resultHeaders.length; i++) {
        doc.text(resultHeaders[i], xPos, doc.y, { width: resultColWidths[i], align: i === 0 ? 'left' : 'right' });
        xPos += resultColWidths[i];
      }
      doc.moveDown(0.5);

      doc.font('Helvetica').fontSize(9);
      let totalAllocated = 0;
      for (const r of valuation.valuationResults) {
        const y = doc.y;
        xPos = tableLeft;
        doc.text(r.shareClass?.name || 'Unknown', xPos, y, { width: resultColWidths[0] });
        xPos += resultColWidths[0];
        doc.text(formatCurrency(r.totalValue), xPos, y, { width: resultColWidths[1], align: 'right' });
        xPos += resultColWidths[1];
        doc.text(formatCurrency(r.perShareValue), xPos, y, { width: resultColWidths[2], align: 'right' });
        xPos += resultColWidths[2];
        doc.text(formatNumber(r.fullyDilutedShares), xPos, y, { width: resultColWidths[3], align: 'right' });
        xPos += resultColWidths[3];
        doc.text(formatPercent(r.allocationPercent), xPos, y, { width: resultColWidths[4], align: 'right' });
        doc.moveDown(0.3);
        totalAllocated += r.totalValue;
      }

      // Total row
      doc.moveDown(0.3);
      doc.strokeColor('#cccccc').lineWidth(0.5)
        .moveTo(tableLeft, doc.y).lineTo(tableLeft + resultColWidths.reduce((a, b) => a + b, 0), doc.y).stroke();
      doc.moveDown(0.3);

      doc.font('Helvetica-Bold');
      xPos = tableLeft;
      doc.text('Total', xPos, doc.y, { width: resultColWidths[0] });
      xPos += resultColWidths[0];
      doc.text(formatCurrency(totalAllocated), xPos, doc.y, { width: resultColWidths[1], align: 'right' });
      doc.moveDown(2);

      // ── Disclaimer ──
      doc.fontSize(8).font('Helvetica').fillColor('#999999');
      doc.text(
        'This report was generated by the OPM Valuation Platform. The valuation methodology is aligned with AICPA and IPEV principles. ' +
        'This report is for internal use only and should be reviewed by a qualified valuation professional before reliance.',
        { align: 'center' }
      );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
