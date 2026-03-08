"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitoringRouter = void 0;
const express_1 = require("express");
const shared_1 = require("@openconnect/shared");
exports.monitoringRouter = (0, express_1.Router)();
// GET /api/admin/monitoring/voice/active
exports.monitoringRouter.get('/voice/active', shared_1.requireAuth, (0, shared_1.requireRole)('facility_admin', 'agency_admin'), async (req, res) => {
    try {
        const where = {
            status: { in: ['ringing', 'connected'] },
        };
        if (req.user.role === 'facility_admin') {
            where.facilityId = req.user.facilityId;
        }
        const calls = await shared_1.prisma.voiceCall.findMany({
            where,
            include: {
                incarceratedPerson: { select: { firstName: true, lastName: true } },
                familyMember: { select: { firstName: true, lastName: true } },
                facility: { select: { name: true } },
            },
            orderBy: { startedAt: 'desc' },
        });
        res.json((0, shared_1.createSuccessResponse)({
            calls,
            fetchedAt: new Date().toISOString(),
        }));
    }
    catch (error) {
        console.error('Error fetching active voice calls:', error);
        res.status(500).json((0, shared_1.createErrorResponse)({ code: 'INTERNAL_ERROR', message: 'Failed to fetch active voice calls' }));
    }
});
// GET /api/admin/monitoring/video/active
exports.monitoringRouter.get('/video/active', shared_1.requireAuth, (0, shared_1.requireRole)('facility_admin', 'agency_admin'), async (req, res) => {
    try {
        const where = {
            status: { in: ['in_progress', 'scheduled'] },
        };
        if (req.user.role === 'facility_admin') {
            where.facilityId = req.user.facilityId;
        }
        const calls = await shared_1.prisma.videoCall.findMany({
            where,
            include: {
                incarceratedPerson: { select: { firstName: true, lastName: true } },
                familyMember: { select: { firstName: true, lastName: true } },
                facility: { select: { name: true } },
            },
            orderBy: { scheduledStart: 'desc' },
        });
        res.json((0, shared_1.createSuccessResponse)({
            calls,
            fetchedAt: new Date().toISOString(),
        }));
    }
    catch (error) {
        console.error('Error fetching active video calls:', error);
        res.status(500).json((0, shared_1.createErrorResponse)({ code: 'INTERNAL_ERROR', message: 'Failed to fetch active video calls' }));
    }
});
//# sourceMappingURL=monitoring.routes.js.map