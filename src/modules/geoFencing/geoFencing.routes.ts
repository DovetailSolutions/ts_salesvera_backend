import { Router } from "express";
import { createTokenCheck } from "../../config/tokenCheck";
import { authorizeRoles } from "../../app/middlewear/rbac";
import * as GeoFencingController from "./geoFencing.controller";

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
const tokenCheck = createTokenCheck(["super_admin", "admin", "manager", "sale_person", "user"]);

const router = Router();

router.get("/geo-fencing/my", tokenCheck, GeoFencingController.getMy);
router.get("/geo-fencing/geocode", tokenCheck, GeoFencingController.geocodeAddress);
router.get("/geo-fencing/reverse-geocode", tokenCheck, GeoFencingController.reverseGeocode);
router.get(
  "/geo-fencing/:userId",
  tokenCheck,
  authorizeRoles("super_admin", "admin"),
  GeoFencingController.getForUser
);
router.put(
  "/geo-fencing/:userId",
  tokenCheck,
  authorizeRoles("super_admin", "admin"),
  GeoFencingController.saveForUser
);

router.patch("/users/:userId/geofence-toggle", tokenCheck, GeoFencingController.toggleRequirementForUser);

export default router;

