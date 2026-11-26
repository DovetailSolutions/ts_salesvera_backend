import { Router, Request, Response } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { createSuccess } from "../../app/middlewear/errorMessage";
import { handleServiceError } from "../shared/handleServiceError";
import * as Location from "./location.service";

// ============================================================
// GET /admin/locations/countries
// GET /admin/locations/states?country=India          (name or ISO-2 code)
// GET /admin/locations/cities?country=India&state=Punjab
// GET /admin/locations/district?state=Punjab&city=Zirakpur (India)
// GET /admin/locations/pincode/140603                (India)
// Reference data for address forms (branch form). Signed-in users only.
// ============================================================

const router = Router();

const handle =
  (fn: (req: Request) => Promise<any>, message: string) =>
  async (req: Request, res: Response): Promise<void> => {
    try {
      createSuccess(res, message, await fn(req));
    } catch (error) {
      handleServiceError(res, error);
    }
  };

router.get("/locations/countries", tokenCheck, handle(() => Location.listCountries(), "Countries fetched"));
router.get("/locations/states", tokenCheck, handle((req) => Location.listStates(String(req.query.country || "")), "States fetched"));
router.get(
  "/locations/cities",
  tokenCheck,
  handle((req) => Location.listCities(String(req.query.country || ""), String(req.query.state || "")), "Cities fetched")
);
router.get(
  "/locations/district",
  tokenCheck,
  handle((req) => Location.lookupCityDistrict(String(req.query.state || ""), String(req.query.city || "")), "District fetched")
);
router.get("/locations/pincode/:pin", tokenCheck, handle((req) => Location.lookupPincode(String(req.params.pin || "")), "PIN code details fetched"));

export default router;
