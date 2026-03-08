import { Router, Request, Response } from 'express';
import { requireAuth, requireRole, createErrorResponse } from '@openconnect/shared';

export const integrationRouter = Router();

integrationRouter.post(
  '/sync-residents',
  requireAuth,
  requireRole('agency_admin'),
  (_req: Request, res: Response) => {
    res.status(501).json(
      createErrorResponse({
        code: 'NOT_IMPLEMENTED',
        message: 'Integration endpoint reserved for case management system',
      })
    );
  }
);

integrationRouter.post(
  '/sync-housing',
  requireAuth,
  requireRole('agency_admin'),
  (_req: Request, res: Response) => {
    res.status(501).json(
      createErrorResponse({
        code: 'NOT_IMPLEMENTED',
        message: 'Integration endpoint reserved for case management system',
      })
    );
  }
);
