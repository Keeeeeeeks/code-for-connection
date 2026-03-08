"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.residentsRouter = void 0;
const express_1 = require("express");
const shared_1 = require("@openconnect/shared");
exports.residentsRouter = (0, express_1.Router)();
// GET /api/admin/residents — list residents (with filters)
exports.residentsRouter.get('/', shared_1.requireAuth, (0, shared_1.requireRole)('facility_admin', 'agency_admin'), async (req, res) => {
    try {
        const { status, facilityId, search, page = '1', perPage = '25' } = req.query;
        const where = {};
        // Facility scoping: facility_admin sees only their facility
        if (req.user.role === 'facility_admin') {
            where.facilityId = req.user.facilityId;
        }
        else if (facilityId) {
            where.facilityId = String(facilityId);
        }
        if (status && status !== 'all') {
            where.status = String(status);
        }
        if (search) {
            const searchStr = String(search);
            where.OR = [
                { firstName: { contains: searchStr, mode: 'insensitive' } },
                { lastName: { contains: searchStr, mode: 'insensitive' } },
                { externalId: { contains: searchStr, mode: 'insensitive' } },
            ];
        }
        const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(String(perPage), 10) || 25));
        const skip = (pageNum - 1) * limit;
        const [residents, total] = await Promise.all([
            shared_1.prisma.incarceratedPerson.findMany({
                where,
                include: {
                    facility: { select: { id: true, name: true } },
                    housingUnit: {
                        select: { id: true, name: true, unitType: { select: { name: true, clearanceLevel: true } } },
                    },
                },
                orderBy: { lastName: 'asc' },
                skip,
                take: limit,
            }),
            shared_1.prisma.incarceratedPerson.count({ where }),
        ]);
        // Strip PIN from response
        const safeResidents = residents.map(({ pin, ...rest }) => rest);
        res.json((0, shared_1.createSuccessResponse)({
            residents: safeResidents,
            pagination: { page: pageNum, perPage: limit, total, totalPages: Math.ceil(total / limit) },
        }));
    }
    catch (error) {
        console.error('Error listing residents:', error);
        res.status(500).json((0, shared_1.createErrorResponse)({ code: 'INTERNAL_ERROR', message: 'Failed to list residents' }));
    }
});
// GET /api/admin/residents/:id — get single resident profile
exports.residentsRouter.get('/:id', shared_1.requireAuth, (0, shared_1.requireRole)('facility_admin', 'agency_admin'), async (req, res) => {
    try {
        const resident = await shared_1.prisma.incarceratedPerson.findUnique({
            where: { id: req.params.id },
            include: {
                facility: { select: { id: true, name: true } },
                housingUnit: {
                    select: { id: true, name: true, unitType: { select: { name: true, clearanceLevel: true } } },
                },
                approvedContacts: {
                    include: {
                        familyMember: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
                    },
                },
            },
        });
        if (!resident) {
            res.status(404).json((0, shared_1.createErrorResponse)({ code: 'NOT_FOUND', message: 'Resident not found' }));
            return;
        }
        // Facility scoping
        if (req.user.role === 'facility_admin' && resident.facilityId !== req.user.facilityId) {
            res.status(403).json((0, shared_1.createErrorResponse)({ code: 'FORBIDDEN', message: 'No access to this resident' }));
            return;
        }
        // Strip PIN
        const { pin, ...safeResident } = resident;
        res.json((0, shared_1.createSuccessResponse)(safeResident));
    }
    catch (error) {
        console.error('Error fetching resident:', error);
        res.status(500).json((0, shared_1.createErrorResponse)({ code: 'INTERNAL_ERROR', message: 'Failed to fetch resident' }));
    }
});
// POST /api/admin/residents/:id/deactivate — TICKET-01
exports.residentsRouter.post('/:id/deactivate', shared_1.requireAuth, (0, shared_1.requireRole)('facility_admin', 'agency_admin'), async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason || !String(reason).trim()) {
            res.status(400).json((0, shared_1.createErrorResponse)({ code: 'VALIDATION_ERROR', message: 'Reason is required' }));
            return;
        }
        const resident = await shared_1.prisma.incarceratedPerson.findUnique({ where: { id: req.params.id } });
        if (!resident) {
            res.status(404).json((0, shared_1.createErrorResponse)({ code: 'NOT_FOUND', message: 'Resident not found' }));
            return;
        }
        if (resident.status === 'deactivated') {
            res.status(400).json((0, shared_1.createErrorResponse)({ code: 'ALREADY_DEACTIVATED', message: 'Resident is already deactivated' }));
            return;
        }
        // Facility scoping
        if (req.user.role === 'facility_admin' && resident.facilityId !== req.user.facilityId) {
            res.status(403).json((0, shared_1.createErrorResponse)({ code: 'FORBIDDEN', message: 'No access to this resident' }));
            return;
        }
        const updated = await shared_1.prisma.incarceratedPerson.update({
            where: { id: req.params.id },
            data: { status: 'deactivated' },
        });
        // Audit log: in a production system this would write to an audit table.
        // For now, we log to console with structured data.
        console.log(JSON.stringify({
            event: 'resident_status_changed',
            adminId: req.user.id,
            residentId: resident.id,
            previousStatus: resident.status,
            newStatus: 'deactivated',
            reason: String(reason).trim(),
            timestamp: new Date().toISOString(),
        }));
        const { pin, ...safeUpdated } = updated;
        res.json((0, shared_1.createSuccessResponse)(safeUpdated));
    }
    catch (error) {
        console.error('Error deactivating resident:', error);
        res.status(500).json((0, shared_1.createErrorResponse)({ code: 'INTERNAL_ERROR', message: 'Failed to deactivate resident' }));
    }
});
// POST /api/admin/residents/:id/release — TICKET-02
exports.residentsRouter.post('/:id/release', shared_1.requireAuth, (0, shared_1.requireRole)('facility_admin', 'agency_admin'), async (req, res) => {
    try {
        const { reason, releaseDate } = req.body;
        if (!reason || !String(reason).trim()) {
            res.status(400).json((0, shared_1.createErrorResponse)({ code: 'VALIDATION_ERROR', message: 'Reason is required' }));
            return;
        }
        const resident = await shared_1.prisma.incarceratedPerson.findUnique({ where: { id: req.params.id } });
        if (!resident) {
            res.status(404).json((0, shared_1.createErrorResponse)({ code: 'NOT_FOUND', message: 'Resident not found' }));
            return;
        }
        if (resident.status === 'released') {
            res.status(400).json((0, shared_1.createErrorResponse)({ code: 'ALREADY_RELEASED', message: 'Resident is already released' }));
            return;
        }
        if (req.user.role === 'facility_admin' && resident.facilityId !== req.user.facilityId) {
            res.status(403).json((0, shared_1.createErrorResponse)({ code: 'FORBIDDEN', message: 'No access to this resident' }));
            return;
        }
        const releasedAt = releaseDate ? new Date(String(releaseDate)) : new Date();
        const updated = await shared_1.prisma.incarceratedPerson.update({
            where: { id: req.params.id },
            data: { status: 'released', releasedAt },
        });
        console.log(JSON.stringify({
            event: 'resident_status_changed',
            adminId: req.user.id,
            residentId: resident.id,
            previousStatus: resident.status,
            newStatus: 'released',
            reason: String(reason).trim(),
            releaseDate: releasedAt.toISOString(),
            timestamp: new Date().toISOString(),
        }));
        const { pin, ...safeUpdated } = updated;
        res.json((0, shared_1.createSuccessResponse)(safeUpdated));
    }
    catch (error) {
        console.error('Error releasing resident:', error);
        res.status(500).json((0, shared_1.createErrorResponse)({ code: 'INTERNAL_ERROR', message: 'Failed to release resident' }));
    }
});
// POST /api/admin/residents/:id/reset-pin — TICKET-03
exports.residentsRouter.post('/:id/reset-pin', shared_1.requireAuth, (0, shared_1.requireRole)('facility_admin', 'agency_admin'), async (req, res) => {
    try {
        const resident = await shared_1.prisma.incarceratedPerson.findUnique({ where: { id: req.params.id } });
        if (!resident) {
            res.status(404).json((0, shared_1.createErrorResponse)({ code: 'NOT_FOUND', message: 'Resident not found' }));
            return;
        }
        if (req.user.role === 'facility_admin' && resident.facilityId !== req.user.facilityId) {
            res.status(403).json((0, shared_1.createErrorResponse)({ code: 'FORBIDDEN', message: 'No access to this resident' }));
            return;
        }
        // Generate random 4-digit PIN
        const newPin = String(Math.floor(1000 + Math.random() * 9000));
        // PINs are stored hashed (bcrypt) based on pin-login flow
        const bcrypt = await import('bcryptjs');
        const hashedPin = await bcrypt.hash(newPin, 10);
        await shared_1.prisma.incarceratedPerson.update({
            where: { id: req.params.id },
            data: { pin: hashedPin },
        });
        // Audit log — NEVER log the PIN value
        console.log(JSON.stringify({
            event: 'pin_reset',
            adminId: req.user.id,
            residentId: resident.id,
            timestamp: new Date().toISOString(),
        }));
        // Return plaintext PIN exactly once
        res.json((0, shared_1.createSuccessResponse)({ newPin }));
    }
    catch (error) {
        console.error('Error resetting PIN:', error);
        res.status(500).json((0, shared_1.createErrorResponse)({ code: 'INTERNAL_ERROR', message: 'Failed to reset PIN' }));
    }
});
//# sourceMappingURL=residents.routes.js.map