import ExcelJS from 'exceljs';

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

/**
 * Generate an Excel report for a valuation.
 */
export async function generateExcelReport(valuation: ValuationData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'OPM Valuation Platform';
  workbook.created = new Date();

  // ── Summary Sheet ──
  const summarySheet = workbook.addWorksheet('Summary');

  // Title
  summarySheet.mergeCells('A1:F1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'OPM Valuation Report';
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center' };

  summarySheet.mergeCells('A2:F2');
  const companyCell = summarySheet.getCell('A2');
  companyCell.value = valuation.companyName;
  companyCell.font = { size: 12 };
  companyCell.alignment = { horizontal: 'center' };

  // Assumptions
  const assumptionStart = 4;
  summarySheet.getCell(`A${assumptionStart}`).value = 'OPM Assumptions';
  summarySheet.getCell(`A${assumptionStart}`).font = { bold: true, size: 12 };

  const assumptions: [string, string | number][] = [
    ['Valuation Date', valuation.valuationDate],
    ['Total Equity Value', valuation.totalEquityValue],
    ['Equity Volatility', valuation.volatility],
    ['Risk-Free Rate', valuation.riskFreeRate],
    ['Expected Term (years)', valuation.term],
    ['Dividend Yield', valuation.dividendYield],
  ];

  if (valuation.createdBy) {
    assumptions.push(['Prepared By', valuation.createdBy.name]);
  }

  assumptions.forEach(([label, value], i) => {
    const row = assumptionStart + 1 + i;
    summarySheet.getCell(`A${row}`).value = label;
    summarySheet.getCell(`A${row}`).font = { bold: true };
    const valueCell = summarySheet.getCell(`B${row}`);
    valueCell.value = value;

    // Format percentages
    if (typeof value === 'number' && (label.includes('Volatility') || label.includes('Rate') || label.includes('Yield'))) {
      valueCell.numFmt = '0.00%';
    } else if (typeof value === 'number' && label.includes('Equity Value')) {
      valueCell.numFmt = '$#,##0.00';
    }
  });

  summarySheet.getColumn('A').width = 25;
  summarySheet.getColumn('B').width = 20;

  // ── Capital Structure Sheet ──
  const capSheet = workbook.addWorksheet('Capital Structure');

  capSheet.columns = [
    { header: 'Class Name', key: 'name', width: 20 },
    { header: 'Type', key: 'type', width: 12 },
    { header: 'Shares Outstanding', key: 'shares', width: 20 },
    { header: 'Issue Price', key: 'issuePrice', width: 15 },
    { header: 'Liq. Preference ($)', key: 'liqPref', width: 18 },
    { header: 'Participating', key: 'participating', width: 14 },
    { header: 'Part. Cap (x)', key: 'partCap', width: 14 },
    { header: 'Conv. Ratio', key: 'convRatio', width: 14 },
    { header: 'Seniority', key: 'seniority', width: 12 },
    { header: 'Strike Price', key: 'strike', width: 14 },
    { header: 'Vesting %', key: 'vesting', width: 12 },
  ];

  // Style header
  capSheet.getRow(1).font = { bold: true };
  capSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  capSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  for (const sc of valuation.shareClasses) {
    capSheet.addRow({
      name: sc.name,
      type: sc.type,
      shares: sc.sharesOutstanding,
      issuePrice: sc.issuePrice,
      liqPref: sc.liquidationPreference,
      participating: sc.isParticipating ? 'Yes' : 'No',
      partCap: sc.participationCap || '-',
      convRatio: sc.conversionRatio,
      seniority: sc.seniorityLevel,
      strike: sc.strikePrice || '-',
      vesting: sc.vestingPercent / 100,
    });
  }

  // Format columns
  capSheet.getColumn('shares').numFmt = '#,##0';
  capSheet.getColumn('issuePrice').numFmt = '$#,##0.00';
  capSheet.getColumn('liqPref').numFmt = '$#,##0.00';
  capSheet.getColumn('strike').numFmt = '$#,##0.00';
  capSheet.getColumn('vesting').numFmt = '0.00%';

  // ── Results Sheet ──
  const resultsSheet = workbook.addWorksheet('Valuation Results');

  resultsSheet.columns = [
    { header: 'Class Name', key: 'name', width: 20 },
    { header: 'Type', key: 'type', width: 12 },
    { header: 'FD Shares', key: 'fdShares', width: 18 },
    { header: 'Option Value ($)', key: 'optionValue', width: 18 },
    { header: 'Per Share Value', key: 'perShare', width: 18 },
    { header: 'Total Value ($)', key: 'totalValue', width: 18 },
    { header: 'Allocation %', key: 'allocation', width: 14 },
  ];

  resultsSheet.getRow(1).font = { bold: true };
  resultsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  resultsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  let totalValue = 0;
  for (const r of valuation.valuationResults) {
    resultsSheet.addRow({
      name: r.shareClass?.name || 'Unknown',
      type: r.shareClass?.type || '-',
      fdShares: r.fullyDilutedShares,
      optionValue: r.optionValue,
      perShare: r.perShareValue,
      totalValue: r.totalValue,
      allocation: r.allocationPercent,
    });
    totalValue += r.totalValue;
  }

  // Total row
  const totalRow = resultsSheet.addRow({
    name: 'TOTAL',
    totalValue: totalValue,
  });
  totalRow.font = { bold: true };

  resultsSheet.getColumn('fdShares').numFmt = '#,##0';
  resultsSheet.getColumn('optionValue').numFmt = '$#,##0.00';
  resultsSheet.getColumn('perShare').numFmt = '$#,##0.0000';
  resultsSheet.getColumn('totalValue').numFmt = '$#,##0.00';
  resultsSheet.getColumn('allocation').numFmt = '0.00%';

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
