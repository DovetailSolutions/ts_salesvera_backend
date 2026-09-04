"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tokenCheck_1 = require("../../config/tokenCheck");
const rbac_1 = require("../../app/middlewear/rbac");
const GeoFencingController = __importStar(require("./geoFencing.controller"));
// ============================================================
// Geo-fencing config routes — mounted on /admin in server.ts.
//
// /my is open to every staff role (a sale_person needs to know whether
// geo-fencing applies to THEM before punching in); viewing/editing another
// user's config is restricted to super_admin/admin, with the finer
// "which specific user" hierarchy + tenant-isolation + capability-gate
// checks enforced in geoFencing.service.ts (mirrors allocation.routes.ts's
// split: broad role gate here, precise target-scoping in the service).
// ============================================================
const tokenCheck = (0, tokenCheck_1.createTokenCheck)(["super_admin", "admin", "manager", "sale_person", "user"]);
const router = (0, express_1.Router)();
router.get("/geo-fencing/my", tokenCheck, GeoFencingController.getMy);
router.get("/geo-fencing/geocode", tokenCheck, GeoFencingController.geocodeAddress);
router.get("/geo-fencing/reverse-geocode", tokenCheck, GeoFencingController.reverseGeocode);
router.get("/geo-fencing/:userId", tokenCheck, (0, rbac_1.authorizeRoles)("super_admin", "admin"), GeoFencingController.getForUser);
router.put("/geo-fencing/:userId", tokenCheck, (0, rbac_1.authorizeRoles)("super_admin", "admin"), GeoFencingController.saveForUser);
router.patch("/users/:userId/geofence-toggle", tokenCheck, GeoFencingController.toggleRequirementForUser);
exports.default = router;
