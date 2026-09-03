import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { ServiceError } from "../shared/serviceError";
import * as GeoFencingService from "./geoFencing.service";

const handleServiceError = (res: Response, error: unknown) => {
  if (error instanceof ServiceError) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  const message = error instanceof Error ? error.message : "Something went wrong";
  return res.status(400).json({ success: false, message });
};

export const getMy = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const config = await GeoFencingService.getMyConfig(Number(userData.userId));
    res.status(200).json({ success: true, message: "Geo-fencing config fetched", data: config });
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const getForUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const callerCompanyId = (userData as any)?.companyId ? Number((userData as any).companyId) : null;
    const result = await GeoFencingService.getConfigForUser(
      Number(userData.userId),
      (userData as any).role,
      callerCompanyId,
      Number(req.params.userId)
    );
    res.status(200).json({ success: true, message: "Geo-fencing config fetched", data: result });
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const saveForUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const callerCompanyId = (userData as any)?.companyId ? Number((userData as any).companyId) : null;
    const result = await GeoFencingService.saveConfigForUser(
      Number(userData.userId),
      (userData as any).role,
      callerCompanyId,
      Number(req.params.userId),
      req.body
    );
    res.status(200).json({ success: true, message: "Geo-fencing config saved", data: result });
  } catch (error) {
    handleServiceError(res, error);
  }
};


export const geocodeAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const address = String(req.query.address || req.body?.address || "");
    const result = await GeoFencingService.geocodeAddress(address);
    res.status(200).json({ success: true, message: "Address geocoded successfully", data: result });
  } catch (error) {
    handleServiceError(res, error);
  }
};

export const toggleRequirementForUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = req.userData as JwtPayload;
    const callerCompanyId = (userData as any)?.companyId ? Number((userData as any).companyId) : null;
    const { isGeofenceRequired } = req.body || {};

    const result = await GeoFencingService.saveConfigForUser(
      Number(userData.userId),
      (userData as any).role,
      callerCompanyId,
      Number(req.params.userId),
      { isGeofenceRequired, enabled: isGeofenceRequired }
    );
    res.status(200).json({ success: true, message: `Geofence requirement updated to ${isGeofenceRequired ? "Required" : "Not Required (Exempted)"}`, data: result });
  } catch (error) {
    handleServiceError(res, error);
  }
};
