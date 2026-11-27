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

export const reverseGeocode = async (req: Request, res: Response): Promise<void> => {
  try {
    const lat = Number(req.query.lat || req.body?.lat);
    const lng = Number(req.query.lng || req.body?.lng);
    const result = await GeoFencingService.reverseGeocode(lat, lng);
    res.status(200).json({ success: true, message: "Reverse geocoded successfully", data: result });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// GET /admin/geo-fencing/suggest?q=… → live address suggestions
export const suggestPlaces = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await GeoFencingService.suggestPlaces(String(req.query.q || ""));
    res.status(200).json({ success: true, message: "Suggestions", data });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// GET /admin/geo-fencing/place/:placeId → coordinates of a picked suggestion
export const placeDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await GeoFencingService.placeDetails(String(req.params.placeId || ""));
    res.status(200).json({ success: true, message: "Place details", data });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// GET /admin/geo-fencing/bulk?userIds=1,2,3 → { [userId]: config }
export const getForUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const u = req.userData as JwtPayload;
    const data = await GeoFencingService.getConfigsForUsers(
      Number((u as any)?.userId),
      (u as any)?.role,
      (u as any)?.companyId ? Number((u as any).companyId) : null,
      GeoFencingService.parseUserIds(req.query.userIds)
    );
    res.status(200).json({ success: true, message: "Geo-fencing configs fetched", data });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// PUT /admin/geo-fencing/bulk  { userIds: number[], enabled, latitude, longitude, radius, radiusUnit, … }
export const saveForUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const u = req.userData as JwtPayload;
    const ids = Array.isArray(req.body?.userIds)
      ? GeoFencingService.parseUserIds(req.body.userIds.join(","))
      : GeoFencingService.parseUserIds(req.body?.userIds);
    const data = await GeoFencingService.saveConfigsForUsers(
      Number((u as any)?.userId),
      (u as any)?.role,
      (u as any)?.companyId ? Number((u as any).companyId) : null,
      ids,
      req.body || {}
    );
    res.status(200).json({ success: true, message: `Geo-fencing saved for ${data.saved} user(s)`, data });
  } catch (error) {
    handleServiceError(res, error);
  }
};
