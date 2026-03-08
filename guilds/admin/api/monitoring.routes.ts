import { Router, Request, Response } from 'express';
import {
  requireAuth,
  requireRole,
  createSuccessResponse,
  createErrorResponse,
  prisma,
} from '@openconnect/shared';

export const monitoringRouter = Router();

// GET /api/admin/monitoring/voice/active
monitoringRouter.get(
  '/voice/active',
  requireAuth,
  requireRole('facility_admin', 'agency_admin'),
  async (req: Request, res: Response) => {
    try {
      const where: Record<string, unknown> = {
        status: { in: ['ringing', 'connected'] },
      };

      if (req.user!.role === 'facility_admin') {
        where.facilityId = req.user!.facilityId;
      }

      const calls = await prisma.voiceCall.findMany({
        where,
        include: {
          incarceratedPerson: { select: { firstName: true, lastName: true } },
          familyMember: { select: { firstName: true, lastName: true } },
          facility: { select: { name: true } },
        },
        orderBy: { startedAt: 'desc' },
      });

      res.json(
        createSuccessResponse({
          calls,
          fetchedAt: new Date().toISOString(),
        })
      );
    } catch (error) {
      console.error('Error fetching active voice calls:', error);
      res.status(500).json(createErrorResponse({ code: 'INTERNAL_ERROR', message: 'Failed to fetch active voice calls' }));
    }
  }
);

// GET /api/admin/monitoring/video/active
monitoringRouter.get(
  '/video/active',
  requireAuth,
  requireRole('facility_admin', 'agency_admin'),
  async (req: Request, res: Response) => {
    try {
      const where: Record<string, unknown> = {
        status: { in: ['in_progress', 'scheduled'] },
      };

      if (req.user!.role === 'facility_admin') {
        where.facilityId = req.user!.facilityId;
      }

      const calls = await prisma.videoCall.findMany({
        where,
        include: {
          incarceratedPerson: { select: { firstName: true, lastName: true } },
          familyMember: { select: { firstName: true, lastName: true } },
          facility: { select: { name: true } },
        },
        orderBy: { scheduledStart: 'desc' },
      });

      res.json(
        createSuccessResponse({
          calls,
          fetchedAt: new Date().toISOString(),
        })
      );
    } catch (error) {
      console.error('Error fetching active video calls:', error);
      res.status(500).json(createErrorResponse({ code: 'INTERNAL_ERROR', message: 'Failed to fetch active video calls' }));
    }
  }
);
