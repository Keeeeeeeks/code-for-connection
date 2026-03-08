"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.integrationRouter = void 0;
const express_1 = require("express");
const shared_1 = require("@openconnect/shared");
exports.integrationRouter = (0, express_1.Router)();
exports.integrationRouter.post('/sync-residents', shared_1.requireAuth, (0, shared_1.requireRole)('agency_admin'), (_req, res) => {
    res.status(501).json((0, shared_1.createErrorResponse)({
        code: 'NOT_IMPLEMENTED',
        message: 'Integration endpoint reserved for case management system',
    }));
});
exports.integrationRouter.post('/sync-housing', shared_1.requireAuth, (0, shared_1.requireRole)('agency_admin'), (_req, res) => {
    res.status(501).json((0, shared_1.createErrorResponse)({
        code: 'NOT_IMPLEMENTED',
        message: 'Integration endpoint reserved for case management system',
    }));
});
//# sourceMappingURL=integration.routes.js.map