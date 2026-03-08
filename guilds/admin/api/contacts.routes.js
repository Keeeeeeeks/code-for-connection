"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contactsRouter = void 0;
const express_1 = require("express");
const shared_1 = require("@openconnect/shared");
exports.contactsRouter = (0, express_1.Router)();
// GET /api/admin/contacts — list all contacts (with filters)
exports.contactsRouter.get('/', shared_1.requireAuth, (0, shared_1.requireRole)('facility_admin', 'agency_admin'), async (req, res) => {
    try {
        const { status, search, page = '1', perPage = '25' } = req.query;
        const where = {};
        if (status && status !== 'all') {
            where.status = String(status);
        }
        // Facility scoping via resident
        if (req.user.role === 'facility_admin') {
            where.incarceratedPerson = { facilityId: req.user.facilityId };
        }
        if (search) {
            const searchStr = String(search);
            where.familyMember = {
                OR: [
                    { firstName: { contains: searchStr, mode: 'insensitive' } },
                    { lastName: { contains: searchStr, mode: 'insensitive' } },
                    { email: { contains: searchStr, mode: 'insensitive' } },
                ],
            };
        }
        const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(String(perPage), 10) || 25));
        const skip = (pageNum - 1) * limit;
        const [contacts, total] = await Promise.all([
            shared_1.prisma.approvedContact.findMany({
                where,
                include: {
                    familyMember: {
                        select: { id: true, firstName: true, lastName: true, phone: true, email: true },
                    },
                    incarceratedPerson: {
                        select: { id: true, firstName: true, lastName: true, facility: { select: { name: true } } },
                    },
                },
                orderBy: { requestedAt: 'desc' },
                skip,
                take: limit,
            }),
            shared_1.prisma.approvedContact.count({ where }),
        ]);
        res.json((0, shared_1.createSuccessResponse)({
            contacts,
            pagination: { page: pageNum, perPage: limit, total, totalPages: Math.ceil(total / limit) },
        }));
    }
    catch (error) {
        console.error('Error listing contacts:', error);
        res.status(500).json((0, shared_1.createErrorResponse)({ code: 'INTERNAL_ERROR', message: 'Failed to list contacts' }));
    }
});
// PATCH /api/admin/contacts/:id — edit contact info (TICKET-04)
exports.contactsRouter.patch('/:id', shared_1.requireAuth, (0, shared_1.requireRole)('facility_admin', 'agency_admin'), async (req, res) => {
    try {
        const { phone, email, relationship } = req.body;
        if (!phone && !email && !relationship) {
            res.status(400).json((0, shared_1.createErrorResponse)({ code: 'VALIDATION_ERROR', message: 'At least one field (phone, email, relationship) is required' }));
            return;
        }
        const contact = await shared_1.prisma.approvedContact.findUnique({
            where: { id: req.params.id },
            include: {
                familyMember: true,
                incarceratedPerson: { select: { facilityId: true } },
            },
        });
        if (!contact) {
            res.status(404).json((0, shared_1.createErrorResponse)({ code: 'NOT_FOUND', message: 'Contact not found' }));
            return;
        }
        // Facility scoping
        if (req.user.role === 'facility_admin' && contact.incarceratedPerson.facilityId !== req.user.facilityId) {
            res.status(403).json((0, shared_1.createErrorResponse)({ code: 'FORBIDDEN', message: 'No access to this contact' }));
            return;
        }
        // Build update payloads
        const oldValues = {};
        const newValues = {};
        const familyMemberUpdate = {};
        const contactUpdate = {};
        if (phone && phone !== contact.familyMember.phone) {
            oldValues.phone = contact.familyMember.phone;
            newValues.phone = String(phone);
            familyMemberUpdate.phone = String(phone);
        }
        if (email && email !== contact.familyMember.email) {
            oldValues.email = contact.familyMember.email;
            newValues.email = String(email);
            familyMemberUpdate.email = String(email);
        }
        if (relationship && relationship !== contact.relationship) {
            oldValues.relationship = contact.relationship;
            newValues.relationship = String(relationship);
            contactUpdate.relationship = String(relationship);
        }
        if (Object.keys(oldValues).length === 0) {
            res.status(400).json((0, shared_1.createErrorResponse)({ code: 'NO_CHANGES', message: 'No changes detected' }));
            return;
        }
        // Update in a transaction
        const [updatedContact] = await shared_1.prisma.$transaction([
            shared_1.prisma.approvedContact.update({
                where: { id: req.params.id },
                data: contactUpdate,
                include: {
                    familyMember: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
                },
            }),
            ...(Object.keys(familyMemberUpdate).length > 0
                ? [shared_1.prisma.familyMember.update({ where: { id: contact.familyMemberId }, data: familyMemberUpdate })]
                : []),
        ]);
        // Audit log
        console.log(JSON.stringify({
            event: 'contact_edited',
            adminId: req.user.id,
            contactId: contact.id,
            oldValues,
            newValues,
            timestamp: new Date().toISOString(),
        }));
        res.json((0, shared_1.createSuccessResponse)(updatedContact));
    }
    catch (error) {
        console.error('Error editing contact:', error);
        res.status(500).json((0, shared_1.createErrorResponse)({ code: 'INTERNAL_ERROR', message: 'Failed to edit contact' }));
    }
});
//# sourceMappingURL=contacts.routes.js.map