import { Router, Request, Response } from 'express';
import multer from 'multer';
import {
  requireAuth,
  requireRole,
  createSuccessResponse,
  createErrorResponse,
  prisma,
} from '@openconnect/shared';

export const bulkImportRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are accepted'));
    }
  },
});

type CsvRow = Record<string, string>;

type RowValidation = {
  row: number;
  data: CsvRow;
  status: 'valid' | 'warning' | 'error';
  errors: { field: string; message: string }[];
};

function parseCsv(buffer: Buffer): { headers: string[]; rows: CsvRow[] } {
  const text = buffer.toString('utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n').filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: CsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

const REQUIRED_COLUMNS = ['firstName', 'lastName', 'dateOfBirth', 'inmateId', 'housingUnitName', 'clearanceLevel'];
const VALID_CLEARANCE = ['minimum', 'general', 'restricted', 'segregated'];

// POST /api/admin/residents/bulk-import — validate + preview
bulkImportRouter.post(
  '/preview',
  requireAuth,
  requireRole('agency_admin'),
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json(createErrorResponse({ code: 'NO_FILE', message: 'CSV file is required' }));
        return;
      }

      const { headers, rows } = parseCsv(req.file.buffer);

      // Validate headers
      const missingHeaders = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
      if (missingHeaders.length > 0) {
        res.status(400).json(
          createErrorResponse({
            code: 'MISSING_COLUMNS',
            message: `Missing required columns: ${missingHeaders.join(', ')}`,
          })
        );
        return;
      }

      if (rows.length > 500) {
        res.status(400).json(
          createErrorResponse({ code: 'TOO_MANY_ROWS', message: 'CSV must not exceed 500 rows' })
        );
        return;
      }

      // Fetch housing units for validation
      const housingUnits = await prisma.housingUnit.findMany({
        select: { name: true, facilityId: true },
      });
      const unitNames = new Set(housingUnits.map((u) => u.name.toLowerCase()));

      // Check for existing inmateIds
      const inmateIds = rows.map((r) => r.inmateId).filter(Boolean);
      const existing = await prisma.incarceratedPerson.findMany({
        where: { externalId: { in: inmateIds } },
        select: { externalId: true },
      });
      const existingIds = new Set(existing.map((e) => e.externalId));

      // Validate each row
      const seenIds = new Set<string>();
      const validations: RowValidation[] = rows.map((row, idx) => {
        const errors: { field: string; message: string }[] = [];
        let status: 'valid' | 'warning' | 'error' = 'valid';

        // Required fields
        for (const field of REQUIRED_COLUMNS) {
          if (!row[field] || !row[field].trim()) {
            errors.push({ field, message: `${field} is required` });
            status = 'error';
          }
        }

        // dateOfBirth format
        if (row.dateOfBirth && isNaN(Date.parse(row.dateOfBirth))) {
          errors.push({ field: 'dateOfBirth', message: 'Invalid date format' });
          status = 'error';
        }

        // clearanceLevel
        if (row.clearanceLevel && !VALID_CLEARANCE.includes(row.clearanceLevel.toLowerCase())) {
          errors.push({ field: 'clearanceLevel', message: `Must be one of: ${VALID_CLEARANCE.join(', ')}` });
          status = 'error';
        }

        // housingUnitName
        if (row.housingUnitName && !unitNames.has(row.housingUnitName.toLowerCase())) {
          errors.push({ field: 'housingUnitName', message: 'Housing unit not found' });
          status = 'error';
        }

        // Duplicate inmateId within file
        if (row.inmateId && seenIds.has(row.inmateId)) {
          errors.push({ field: 'inmateId', message: 'Duplicate inmateId within file' });
          if (status !== 'error') status = 'warning';
        }
        if (row.inmateId) seenIds.add(row.inmateId);

        // Existing inmateId in DB
        if (row.inmateId && existingIds.has(row.inmateId)) {
          errors.push({ field: 'inmateId', message: 'inmateId already exists in database' });
          if (status !== 'error') status = 'warning';
        }

        return { row: idx + 2, data: row, status, errors }; // row+2 because CSV is 1-indexed + header row
      });

      const valid = validations.filter((v) => v.status === 'valid').length;
      const warnings = validations.filter((v) => v.status === 'warning').length;
      const errorCount = validations.filter((v) => v.status === 'error').length;

      res.json(
        createSuccessResponse({
          fileName: req.file.originalname,
          fileSize: req.file.size,
          totalRows: rows.length,
          valid,
          warnings,
          errors: errorCount,
          validations,
        })
      );
    } catch (error) {
      console.error('Error previewing bulk import:', error);
      res.status(500).json(createErrorResponse({ code: 'INTERNAL_ERROR', message: 'Failed to preview import' }));
    }
  }
);

// POST /api/admin/residents/bulk-import/confirm — execute import
bulkImportRouter.post(
  '/confirm',
  requireAuth,
  requireRole('agency_admin'),
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json(createErrorResponse({ code: 'NO_FILE', message: 'CSV file is required' }));
        return;
      }

      const { rows } = parseCsv(req.file.buffer);

      if (rows.length === 0) {
        res.status(400).json(createErrorResponse({ code: 'EMPTY_FILE', message: 'CSV file is empty' }));
        return;
      }

      if (rows.length > 500) {
        res.status(400).json(createErrorResponse({ code: 'TOO_MANY_ROWS', message: 'CSV must not exceed 500 rows' }));
        return;
      }

      // Fetch housing units + facility mapping
      const housingUnits = await prisma.housingUnit.findMany({
        include: { unitType: { select: { clearanceLevel: true } } },
      });
      const unitMap = new Map(housingUnits.map((u) => [u.name.toLowerCase(), u]));

      // Get agency from the admin user
      const admin = await prisma.adminUser.findUnique({ where: { id: req.user!.id } });
      if (!admin) {
        res.status(403).json(createErrorResponse({ code: 'FORBIDDEN', message: 'Admin not found' }));
        return;
      }

      const bcrypt = await import('bcryptjs');
      let imported = 0;
      let skipped = 0;
      const errors: { row: number; field: string; message: string }[] = [];

      // Insert valid rows in a transaction
      const createOps: ReturnType<typeof prisma.incarceratedPerson.create>[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const unit = unitMap.get((row.housingUnitName || '').toLowerCase());

        if (!unit || !row.firstName || !row.lastName || !row.inmateId) {
          skipped++;
          errors.push({ row: i + 2, field: 'general', message: 'Missing required data' });
          continue;
        }

        // Generate or use provided PIN
        const rawPin = row.pin && row.pin.trim() ? row.pin.trim() : String(Math.floor(1000 + Math.random() * 9000));
        const hashedPin = await bcrypt.hash(rawPin, 10);

        createOps.push(
          prisma.incarceratedPerson.create({
            data: {
              agencyId: admin.agencyId,
              facilityId: unit.facilityId,
              housingUnitId: unit.id,
              firstName: row.firstName.trim(),
              lastName: row.lastName.trim(),
              pin: hashedPin,
              externalId: row.inmateId.trim(),
              status: 'active',
            },
          })
        );
      }

      if (createOps.length > 0) {
        await prisma.$transaction(createOps);
        imported = createOps.length;
      }

      // Audit log
      console.log(JSON.stringify({
        event: 'bulk_import',
        adminId: req.user!.id,
        fileName: req.file.originalname,
        imported,
        skipped,
        timestamp: new Date().toISOString(),
      }));

      res.json(createSuccessResponse({ imported, skipped, warnings: 0, errors }));
    } catch (error) {
      console.error('Error executing bulk import:', error);
      res.status(500).json(createErrorResponse({ code: 'INTERNAL_ERROR', message: 'Failed to execute import. Transaction rolled back.' }));
    }
  }
);
