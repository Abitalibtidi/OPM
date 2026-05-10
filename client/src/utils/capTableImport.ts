import * as XLSX from 'xlsx';

// ─── Column definitions ───────────────────────────────────────────────────────

export const TEMPLATE_HEADERS = [
  'Share Class Name',
  'Type',
  'Issue Price ($)',
  'Outstanding Units',
  'Liquidation Preference ($)',
  'Conversion Ratio',
  'Seniority Level',
  'Is Participating (Y/N)',
  'Participation Cap (x)',
  'Strike Price ($)',
  'Vesting %',
] as const;

export type TemplateHeader = (typeof TEMPLATE_HEADERS)[number];

// Required columns — the rest fall back to sensible defaults
const REQUIRED: TemplateHeader[] = ['Share Class Name', 'Type', 'Outstanding Units'];

export const VALID_TYPES = ['common', 'preferred', 'option', 'warrant'] as const;
export type ParsedClassType = (typeof VALID_TYPES)[number];

// ─── Output types ─────────────────────────────────────────────────────────────

export interface ParsedShareClass {
  name: string;
  type: ParsedClassType;
  issuePrice: number;
  sharesOutstanding: number;
  liquidationPreference: number;
  conversionRatio: number;
  seniorityLevel: number;
  isParticipating: boolean;
  participationCap: number;
  strikePrice: number;
  vestingPercent: number;
}

export interface ParsedRow {
  rowNumber: number;   // 1-based spreadsheet row number (for error messages)
  data: ParsedShareClass;
  fdEquivUnits: number;
  errors: string[];
  hasErrors: boolean;
}

export interface ParseResult {
  rows: ParsedRow[];
  globalErrors: string[];
  totalFdUnits: number;
}

// ─── Template download ────────────────────────────────────────────────────────

export function downloadCapTableTemplate(): void {
  const data: (string | number)[][] = [
    [...TEMPLATE_HEADERS],
    // Example rows — one of each type
    ['Series A Preferred', 'preferred', 5.00, 2_000_000, 10_000_000, 1,   1, 'N', 0,    0,    100],
    ['Common Stock',        'common',   0.10, 8_000_000,          0, 1,   2, 'N', 0,    0,    100],
    ['Employee Options',    'option',   0,      500_000,          0, 1,   1, 'N', 0, 1.50,     75],
    ['Investor Warrants',   'warrant',  0,      200_000,          0, 1,   1, 'N', 0, 2.00,    100],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  ws['!cols'] = [
    { wch: 25 }, // Share Class Name
    { wch: 12 }, // Type
    { wch: 16 }, // Issue Price ($)
    { wch: 18 }, // Outstanding Units
    { wch: 26 }, // Liquidation Preference ($)
    { wch: 18 }, // Conversion Ratio
    { wch: 16 }, // Seniority Level
    { wch: 22 }, // Is Participating (Y/N)
    { wch: 22 }, // Participation Cap (x)
    { wch: 16 }, // Strike Price ($)
    { wch: 12 }, // Vesting %
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cap Table');
  XLSX.writeFile(wb, 'cap-table-template.xlsx');
}

// ─── File parser ──────────────────────────────────────────────────────────────

export async function parseCapTableFile(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const ws = workbook.Sheets[workbook.SheetNames[0]];

  if (!ws) {
    return { rows: [], globalErrors: ['The file contains no sheets.'], totalFdUnits: 0 };
  }

  // sheet_to_json with header:1 gives us an array of arrays
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (raw.length === 0) {
    return { rows: [], globalErrors: ['The file is empty.'], totalFdUnits: 0 };
  }

  // ── Map columns by header name (case-insensitive) ──
  const headerRow = (raw[0] as unknown[]).map((h) => String(h ?? '').trim());

  const colIdx: Partial<Record<TemplateHeader, number>> = {};
  for (const col of TEMPLATE_HEADERS) {
    const idx = headerRow.findIndex(
      (h) => h.toLowerCase() === col.toLowerCase()
    );
    colIdx[col] = idx >= 0 ? idx : -1;
  }

  // ── Check required columns ──
  const globalErrors: string[] = [];
  for (const col of REQUIRED) {
    if ((colIdx[col] ?? -1) < 0) {
      globalErrors.push(`Missing required column: "${col}"`);
    }
  }
  if (globalErrors.length > 0) {
    return { rows: [], globalErrors, totalFdUnits: 0 };
  }

  const dataRows = raw.slice(1);
  if (dataRows.length === 0) {
    return {
      rows: [],
      globalErrors: ['The file has column headers but no data rows.'],
      totalFdUnits: 0,
    };
  }

  // ── Helpers ──
  const getCell = (row: unknown[], col: TemplateHeader): unknown => {
    const idx = colIdx[col] ?? -1;
    return idx >= 0 ? row[idx] : undefined;
  };

  const parseNum = (
    raw: unknown,
    label: string,
    errors: string[],
    opts: { default?: number; min?: number; max?: number } = {}
  ): number => {
    const def = opts.default ?? 0;
    if (raw === '' || raw === null || raw === undefined) return def;
    const n = Number(raw);
    if (isNaN(n)) {
      errors.push(`"${label}" must be a number (got: "${raw}")`);
      return def;
    }
    if (opts.min !== undefined && n < opts.min) {
      errors.push(`"${label}" must be ≥ ${opts.min} (got: ${n})`);
      return def;
    }
    if (opts.max !== undefined && n > opts.max) {
      errors.push(`"${label}" must be ≤ ${opts.max} (got: ${n})`);
      return def;
    }
    return n;
  };

  // ── Parse each data row ──
  const seenNames = new Set<string>();
  const rows: ParsedRow[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i] as unknown[];

    // Skip rows that are entirely blank
    if (row.every((c) => c === '' || c === null || c === undefined)) continue;

    const errors: string[] = [];

    // Name
    const name = String(getCell(row, 'Share Class Name') ?? '').trim();
    if (!name) errors.push('Share Class Name is required');

    // Type
    const typeRaw = String(getCell(row, 'Type') ?? '')
      .trim()
      .toLowerCase() as ParsedClassType;
    if (!typeRaw) {
      errors.push('Type is required');
    } else if (!(VALID_TYPES as readonly string[]).includes(typeRaw)) {
      errors.push(`Invalid type "${typeRaw}". Valid values: ${VALID_TYPES.join(', ')}`);
    }

    // Duplicate name check
    if (name) {
      if (seenNames.has(name.toLowerCase())) {
        errors.push(`Duplicate share class name: "${name}"`);
      } else {
        seenNames.add(name.toLowerCase());
      }
    }

    // Numeric fields
    const sharesOutstanding = parseNum(
      getCell(row, 'Outstanding Units'),
      'Outstanding Units',
      errors,
      { min: 0 }
    );
    const issuePrice = parseNum(getCell(row, 'Issue Price ($)'), 'Issue Price ($)', errors, {
      min: 0,
    });
    const liquidationPreference = parseNum(
      getCell(row, 'Liquidation Preference ($)'),
      'Liquidation Preference ($)',
      errors,
      { min: 0 }
    );
    const conversionRatioRaw = parseNum(
      getCell(row, 'Conversion Ratio'),
      'Conversion Ratio',
      errors,
      { min: 0, default: 1 }
    );
    const conversionRatio = conversionRatioRaw > 0 ? conversionRatioRaw : 1;
    const seniorityLevel = Math.max(
      1,
      Math.round(
        parseNum(getCell(row, 'Seniority Level'), 'Seniority Level', errors, {
          min: 1,
          default: 1,
        })
      )
    );
    const participatingRaw = String(getCell(row, 'Is Participating (Y/N)') ?? '')
      .trim()
      .toLowerCase();
    const isParticipating =
      participatingRaw === 'y' ||
      participatingRaw === 'yes' ||
      participatingRaw === 'true';
    const participationCap = parseNum(
      getCell(row, 'Participation Cap (x)'),
      'Participation Cap (x)',
      errors,
      { min: 0 }
    );
    const strikePrice = parseNum(getCell(row, 'Strike Price ($)'), 'Strike Price ($)', errors, {
      min: 0,
    });
    const vestingPercent = parseNum(getCell(row, 'Vesting %'), 'Vesting %', errors, {
      min: 0,
      max: 100,
      default: 100,
    });

    const type: ParsedClassType = (VALID_TYPES as readonly string[]).includes(typeRaw)
      ? typeRaw
      : 'common';

    // Compute fully-diluted equivalent units (preferred converts at conversionRatio)
    const fdEquivUnits =
      type === 'preferred' ? sharesOutstanding * conversionRatio : sharesOutstanding;

    rows.push({
      rowNumber: i + 2, // +2: row 1 = headers
      data: {
        name,
        type,
        issuePrice,
        sharesOutstanding,
        liquidationPreference,
        conversionRatio,
        seniorityLevel,
        isParticipating,
        participationCap,
        strikePrice,
        vestingPercent,
      },
      fdEquivUnits,
      errors,
      hasErrors: errors.length > 0,
    });
  }

  if (rows.length === 0) {
    return {
      rows: [],
      globalErrors: ['No data rows were found after parsing.'],
      totalFdUnits: 0,
    };
  }

  const totalFdUnits = rows
    .filter((r) => !r.hasErrors)
    .reduce((s, r) => s + r.fdEquivUnits, 0);

  return { rows, globalErrors: [], totalFdUnits };
}
