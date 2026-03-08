import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('@openconnect/shared', async () => {
  const actual = await vi.importActual('@openconnect/shared');
  return {
    ...actual,
    requireAuth: (_req: any, _res: any, next: any) => next(),
    prisma: {
      approvedContact: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
    },
  };
});

import { prisma } from '@openconnect/shared';
import { adminRouter } from '../routes.js';

const mockedPrisma = vi.mocked(prisma);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { id: 'admin-1', role: 'facility_admin', agencyId: 'agency-1', facilityId: 'facility-1' };
    next();
  });
  app.use('/api/admin', adminRouter);
  return app;
}

describe('GET /api/admin/contacts/check route ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes /contacts/check to the check handler, not the :incarceratedPersonId handler', async () => {
    mockedPrisma.approvedContact.findUnique.mockResolvedValue({
      id: 'contact-1',
      incarceratedPersonId: 'person-1',
      familyMemberId: 'family-1',
      status: 'approved',
      isAttorney: false,
    } as any);

    const app = buildApp();
    const res = await request(app)
      .get('/api/admin/contacts/check?incarceratedPersonId=person-1&familyMemberId=family-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // The check endpoint returns { approved, isAttorney }, not an array of contacts
    expect(res.body.data).toHaveProperty('approved');
    expect(res.body.data).toHaveProperty('isAttorney');
    // findUnique should have been called (check handler), not findMany (list handler)
    expect(mockedPrisma.approvedContact.findUnique).toHaveBeenCalled();
    expect(mockedPrisma.approvedContact.findMany).not.toHaveBeenCalled();
  });

  it('returns 400 when required query params are missing', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/admin/contacts/check');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('still routes /contacts/:incarceratedPersonId for non-check paths', async () => {
    mockedPrisma.approvedContact.findMany.mockResolvedValue([]);

    const app = buildApp();
    const res = await request(app).get('/api/admin/contacts/person-123');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(mockedPrisma.approvedContact.findMany).toHaveBeenCalled();
    expect(mockedPrisma.approvedContact.findUnique).not.toHaveBeenCalled();
  });
});
