import { User, UserGeoFencing } from "../../config/dbConnection";
import { dropFellowAdmins } from "../shared/userHierarchy";
import axios from "axios"
import { ServiceError } from "../shared/serviceError";
import { getCompanyScopedChildUserIdsFast } from "../shared/userHierarchy";
import { haversineMeters } from "../shared/geo";
import { resolveCompanyId } from "../../config/tokenCheck";
import * as GeoFencingRepo from "./geoFencing.repository";

// ============================================================
// Per-user attendance geo-fencing.
//
// IMPORTANT: this module only ever governs attendance punch-in/punch-out
// (see checkUserGeoFencing, called from attendance.service.ts). It must
// never be used to gate login, dashboards, or any other route — that's a
// hard product requirement, not just a convention.
//
// Hierarchy — who may view/configure whose geo-fencing:
//   super_admin -> admin                      (global, no company scoping)
//   admin       -> manager, employee        (same company, and only when
//                                               the admin's OWN config is
//                                               itself enabled — see
//                                               assertCanConfigure below)
// manager and employee cannot configure anyone's geo-fencing (spec: no
// implicit cascade — would need a future, explicit RBAC grant to change).
// ============================================================

const GEO_ASSIGNABLE_TARGET_ROLES: Record<string, string[]> = {
  super_admin: ["admin"],
  admin: ["manager", "employee"],
  manager: ["employee"],
};

const MAX_RADIUS_METERS = 500000; // 500km — generous upper bound, guards against fat-finger entry

const toPublicConfig = (row: any, userId: number) => ({
  userId,
  enabled: row?.enabled ?? false,
  latitude: row?.latitude ?? null,
  longitude: row?.longitude ?? null,
  radius: row?.radius ?? null,
  radiusUnit: row?.radiusUnit ?? "m",
  locationName: row?.locationName ?? null,
  landmark: row?.landmark ?? null,
  address: row?.address ?? null,
  city: row?.city ?? null,
  createdAt: row?.createdAt ?? null,
  updatedAt: row?.updatedAt ?? null,
});

const radiusInMeters = (radius: number, unit: string) => (unit === "km" ? radius * 1000 : radius);

// ── Self-service: view own config (any authenticated role) ─────────────────
export const getMyConfig = async (userId: number) => {
  const row = await GeoFencingRepo.findConfigByUserId(userId);
  return toPublicConfig(row, userId);
};

// ── View a specific user's config (super_admin/admin only) ─────────────────
export const getConfigForUser = async (
  callerId: number,
  callerRole: string | undefined,
  callerCompanyId: number | null,
  targetUserId: number
) => {
  const targetUser = await GeoFencingRepo.findUserById(targetUserId);
  if (!targetUser) throw new ServiceError("User not found", 404);

  await assertCanAct(callerId, callerRole, callerCompanyId, targetUser, { requireOwnCapability: false });

  const row = await GeoFencingRepo.findConfigByUserId(targetUserId);
  return {
    config: toPublicConfig(row, targetUserId),
    targetUser: {
      id: targetUser.id,
      firstName: targetUser.firstName,
      lastName: targetUser.lastName,
      email: targetUser.email,
      role: targetUser.role,
    },
  };
};

// ── Configure a specific user's geo-fencing (super_admin/admin only) ───────
export const saveConfigForUser = async (
  callerId: number,
  callerRole: string | undefined,
  callerCompanyId: number | null,
  targetUserId: number,
  body: any
) => {
  const targetUser = await GeoFencingRepo.findUserById(targetUserId);
  if (!targetUser) throw new ServiceError("User not found", 404);

  await assertCanAct(callerId, callerRole, callerCompanyId, targetUser, { requireOwnCapability: true });
  return applyConfigToUser(targetUser, callerId, callerCompanyId, body);
};

// Validation + save for one user whose access was already checked (used by
// the single save above and the bulk save below — identical rules).
const applyConfigToUser = async (targetUser: any, callerId: number, callerCompanyId: number | null, body: any) => {
  const targetUserId = Number(targetUser.id);
  if (body?.isGeofenceRequired !== undefined) {
    targetUser.isGeofenceRequired = Boolean(body.isGeofenceRequired);
    await targetUser.save();
  }
  const enabled = !!body?.enabled;
  let latitude: number | null = null;
  let longitude: number | null = null;
  let radius: number | null = null;
  let radiusUnit: "m" | "km" = body?.radiusUnit === "km" ? "km" : "m";

  const rawRadius = body?.radius != null ? body.radius : body?.radiusMeters;
  if (body?.radius == null && body?.radiusMeters != null) {
    radiusUnit = "m";
  }

  if (enabled) {
    latitude = Number(body?.latitude);
    longitude = Number(body?.longitude);
    radius = Number(rawRadius);

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new ServiceError("A valid latitude (-90 to 90) is required to enable geo-fencing");
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new ServiceError("A valid longitude (-180 to 180) is required to enable geo-fencing");
    }
    if (!Number.isFinite(radius) || radius <= 0) {
      throw new ServiceError("Radius must be a positive number to enable geo-fencing");
    }
    if (radiusInMeters(radius, radiusUnit) > MAX_RADIUS_METERS) {
      throw new ServiceError(`Radius is too large — must be at most ${MAX_RADIUS_METERS / 1000}km`);
    }
  } else if (body?.latitude != null || body?.longitude != null || body?.radius != null) {
    // Disabled, but caller still supplied coordinates (e.g. editing before
    // re-enabling) — keep them if individually valid, but never let a
    // malformed value silently persist.
    const lat = Number(body.latitude);
    const lng = Number(body.longitude);
    const rad = Number(body.radius);
    latitude = Number.isFinite(lat) && lat >= -90 && lat <= 90 ? lat : null;
    longitude = Number.isFinite(lng) && lng >= -180 && lng <= 180 ? lng : null;
    radius = Number.isFinite(rad) && rad > 0 ? rad : null;
  }

  // Resolve the target's own company for the audit column — admin targets
  // always share the caller's company (enforced in assertCanAct); a
  // super_admin configuring an admin has no single "caller company" to
  // fall back to, so resolve the admin's company directly.
  const resolvedCompanyId =
    callerCompanyId != null ? callerCompanyId : await resolveTargetCompanyId(targetUser);

  const saved = await GeoFencingRepo.upsertConfig(targetUserId, resolvedCompanyId, callerId, {
    enabled,
    latitude,
    longitude,
    radius,
    radiusUnit,
    locationName: body?.locationName !== undefined ? body.locationName : undefined,
    landmark: body?.landmark !== undefined ? body.landmark : undefined,
    address: body?.address !== undefined ? body.address : undefined,
    city: body?.city !== undefined ? body.city : undefined,
  });

  return toPublicConfig(saved, targetUserId);
};

// ── Authorization gate shared by GET/PUT above ──────────────────────────────
// Exported so attendanceSecurity.service.ts can reuse the exact same
// super_admin->admin->manager/employee, same-company hierarchy check for
// its own per-user/bulk settings and device-request review, instead of a
// second copy that could silently drift from this one.
export const assertCanAct = async (
  callerId: number,
  callerRole: string | undefined,
  callerCompanyId: number | null,
  targetUser: any,
  opts: { requireOwnCapability: boolean }
) => {
  const allowedRoles = GEO_ASSIGNABLE_TARGET_ROLES[String(callerRole)] || [];
  if (allowedRoles.length === 0 || !allowedRoles.includes(String(targetUser.role))) {
    throw new ServiceError(
      `As ${callerRole || "your role"} you cannot manage geo-fencing for a ${targetUser.role}`,
      403
    );
  }

  if (callerRole === "admin" || callerRole === "manager") {
    // Tenant isolation — admin/manager may only reach salespersons/managers inside
    // their OWN company-scoped team, never another company's.
    const teamIds = await dropFellowAdmins(callerId, await getCompanyScopedChildUserIdsFast(callerId, callerCompanyId));
    if (!teamIds.includes(Number(targetUser.id))) {
      throw new ServiceError(
        "This user is not on your team, or belongs to another company",
        403
      );
    }
  }
}
  // super_admin: role check above is sufficient — global reach, no company
  // scoping and no capability gate (nothing above super_admin to grant one).


const resolveTargetCompanyId = async (targetUser: any): Promise<number | null> => {
  // Best-effort only — used solely to stamp the audit companyId column on
  // a super_admin-authored row; never used for authorization.
  try {
    return await resolveCompanyId(Number(targetUser.id), String(targetUser.role), null);
  } catch {
    return null;
  }
};

// ============================================================
// checkUserGeoFencing — called from attendance.service.ts on every
// punch-in/punch-out. NEVER call this from anywhere outside the attendance
// punch flow — it must not become a general access gate.
//
// Returns { enforced: false } when the user has no geo-fencing configured
// (or it's turned off) — punch proceeds normally, no location required.
// Throws ServiceError with the exact user-facing copy when enforced and the
// punch should be rejected.
// ============================================================
export const checkUserGeoFencing = async (
  userId: number,
  latitude: number | string | null | undefined,
  longitude: number | string | null | undefined,
  opts: { requiredFlag?: "isGeofenceRequired" | "isPunchOutGeofenceRequired" } = {}
): Promise<{ enforced: boolean; verified?: boolean; distanceMeters?: number; radiusMeters?: number; bypassed?: boolean }> => {
  // requiredFlag lets attendance.service.ts's punch-OUT flow reuse this same
  // distance check against the independent isPunchOutGeofenceRequired
  // column instead of punch-in's isGeofenceRequired — default preserves
  // today's exact punch-in behavior unchanged.
  const requiredFlag = opts.requiredFlag ?? "isGeofenceRequired";
  const user = await (User as any).findByPk(userId, { attributes: ["id", requiredFlag] });
  if (user && (user as any)[requiredFlag] === false) {
    return { enforced: false, bypassed: true };
  }

  const config = (await GeoFencingRepo.findConfigByUserId(userId)) as any;

  if (!config?.enabled) return { enforced: false };

  // Config enabled but incomplete (shouldn't happen — saveConfigForUser
  // requires all three when enabling) — fail open rather than block
  // attendance over a data problem, matching the existing branch-geofence
  // philosophy ("missing config never blocks a punch").
  if (config.latitude == null || config.longitude == null || !config.radius) {
    return { enforced: false };
  }

  if (latitude == null || longitude == null || latitude === "" || longitude === "") {
    throw new ServiceError("Unable to determine your current location. Please try again.");
  }

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new ServiceError("Unable to determine your current location. Please try again.");
  }

  const distanceMeters = haversineMeters(lat, lng, Number(config.latitude), Number(config.longitude));
  const radiusMeters = radiusInMeters(Number(config.radius), config.radiusUnit);

  if (distanceMeters > radiusMeters) {
    throw new ServiceError(
      "You are outside the allowed attendance area. Please move inside the geo-fenced location and try again.",
      400,
      { distanceMeters, radiusMeters }
    );
  }

  return { enforced: true, verified: true, distanceMeters, radiusMeters };
};



export const geocodeAddress = async (address: string) => {
  if (!address || !address.trim()) throw new ServiceError("Address is required");

  const apiKey = process.env.GOOGLE_MAP_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || "";

  if (apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address.trim())}&key=${apiKey}`;
      const response = await axios.get(url);
      if (response.data?.status === "OK" && response.data?.results?.length > 0) {
        const result = response.data.results[0];
        return {
          latitude: Number(result.geometry.location.lat).toFixed(6),
          longitude: Number(result.geometry.location.lng).toFixed(6),
          formattedAddress: result.formatted_address,
          source: "google",
        };
      }
    } catch (err) {
      console.warn("Backend Google geocoding error:", err);
    }
  }

  try {
    const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address.trim())}`;
    const response = await axios.get(osmUrl, {
      headers: { "User-Agent": "SalesVera-Backend/1.0" },
    });
    if (Array.isArray(response.data) && response.data.length > 0) {
      const item = response.data[0];
      return {
        latitude: Number(item.lat).toFixed(6),
        longitude: Number(item.lon).toFixed(6),
        formattedAddress: item.display_name,
        source: "osm",
      };
    }
  } catch (err) {
    console.warn("Backend OSM geocoding error:", err);
  }

  throw new ServiceError("Could not find coordinates for that address. Please try a different location.");
};

export const reverseGeocode = async (lat: number, lng: number) => {
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
    throw new ServiceError("Valid latitude and longitude are required");
  }
  const apiKey = process.env.GOOGLE_MAP_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || "";

  if (apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
      const response = await axios.get(url);
      if (response.data?.status === "OK" && response.data?.results?.length > 0) {
        const result = response.data.results[0];
        let city = "";
        let landmark = "";
        for (const comp of result.address_components || []) {
          if (comp.types.includes("locality") || comp.types.includes("administrative_area_level_2")) {
            city = comp.long_name;
          }
          if (comp.types.includes("point_of_interest") || comp.types.includes("premise") || comp.types.includes("sublocality")) {
            if (!landmark) landmark = comp.long_name;
          }
        }
        return {
          formattedAddress: result.formatted_address,
          locationName: result.address_components?.[0]?.long_name || result.formatted_address.split(",")[0],
          landmark: landmark || null,
          city: city || null,
          source: "google",
        };
      }
    } catch (err) {
      console.warn("Backend Google reverse-geocoding error:", err);
    }
  }

  try {
    const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const response = await axios.get(osmUrl, {
      headers: { "User-Agent": "SalesVera-Backend/1.0" },
    });
    if (response.data && response.data.display_name) {
      const d = response.data;
      const addr = d.address || {};
      const city = addr.city || addr.town || addr.village || addr.county || "";
      const locationName = addr.amenity || addr.building || addr.road || d.display_name.split(",")[0];
      const landmark = addr.suburb || addr.neighbourhood || "";
      return {
        formattedAddress: d.display_name,
        locationName,
        landmark: landmark || null,
        city: city || null,
        source: "osm",
      };
    }
  } catch (err) {
    console.warn("Backend OSM reverse-geocoding error:", err);
  }

  return { formattedAddress: `${lat}, ${lng}`, locationName: `${lat}, ${lng}`, landmark: null, city: null };
};

// ── Live address search (geo-fencing forms) ────────────────────────────────
// Suggestions while typing: Google Places Autocomplete with the backend key
// (the key never reaches the browser), falling back to OpenStreetMap.
// Picking a suggestion → placeDetails() returns its exact coordinates.
export const suggestPlaces = async (query: string) => {
  const q = String(query || "").trim();
  if (q.length < 2) return [];
  const apiKey = process.env.GOOGLE_MAP_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || "";
  if (apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&components=country:in&key=${apiKey}`;
      const response = await axios.get(url, { timeout: 8000 });
      if (response.data?.status === "OK") {
        return (response.data.predictions || []).slice(0, 6).map((p: any) => ({
          placeId: p.place_id,
          description: p.description,
          mainText: p.structured_formatting?.main_text || p.description,
          secondaryText: p.structured_formatting?.secondary_text || "",
          source: "google",
        }));
      }
      if (response.data?.status === "ZERO_RESULTS") return [];
    } catch (err) {
      console.warn("Places autocomplete error:", (err as any)?.message);
    }
  }
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=in&q=${encodeURIComponent(q)}`;
    const response = await axios.get(osmUrl, { headers: { "User-Agent": "SalesVera-Backend/1.0" }, timeout: 8000 });
    return (Array.isArray(response.data) ? response.data : []).map((o: any) => ({
      placeId: null,
      description: o.display_name,
      mainText: String(o.display_name || "").split(",")[0],
      secondaryText: String(o.display_name || "").split(",").slice(1, 4).join(",").trim(),
      latitude: Number(o.lat).toFixed(6),
      longitude: Number(o.lon).toFixed(6),
      source: "osm",
    }));
  } catch (err) {
    console.warn("OSM suggest error:", (err as any)?.message);
    return [];
  }
};

export const placeDetails = async (placeId: string) => {
  const id = String(placeId || "").trim();
  if (!id) throw new ServiceError("placeId is required");
  const apiKey = process.env.GOOGLE_MAP_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || "";
  if (!apiKey) throw new ServiceError("Map service is not configured");
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(id)}&fields=geometry,formatted_address,name&key=${apiKey}`;
  const response = await axios.get(url, { timeout: 8000 });
  const r = response.data?.result;
  if (response.data?.status !== "OK" || !r?.geometry?.location) throw new ServiceError("Could not load this place");
  return {
    latitude: Number(r.geometry.location.lat).toFixed(6),
    longitude: Number(r.geometry.location.lng).toFixed(6),
    formattedAddress: r.formatted_address || r.name || "",
    name: r.name || "",
  };
};

// ── Bulk reads (Field Operations pages) ─────────────────────────────────────
// The Geofencing / Attendance Security pages used to call the per-user GET
// once per staff member (36 users → 36 requests, ~11s on the remote DB).
// filterActableUsers applies assertCanAct's exact rule to a whole list with
// ONE team lookup, so the bulk endpoints return only users the caller could
// have fetched one by one — same rule, no per-user queries.
export const filterActableUsers = async (
  callerId: number,
  callerRole: string | undefined,
  callerCompanyId: number | null,
  users: any[]
): Promise<any[]> => {
  const allowedRoles = GEO_ASSIGNABLE_TARGET_ROLES[String(callerRole)] || [];
  let list = users.filter((u) => allowedRoles.includes(String(u.role)));
  if (callerRole === "admin" || callerRole === "manager") {
    const team = new Set(
      (await dropFellowAdmins(callerId, await getCompanyScopedChildUserIdsFast(callerId, callerCompanyId))).map(Number)
    );
    list = list.filter((u) => team.has(Number(u.id)));
  }
  return list;
};

export const parseUserIds = (raw: unknown): number[] =>
  Array.from(
    new Set(
      String(raw ?? "")
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0)
    )
  ).slice(0, 1000);

/** { [userId]: publicConfig } for every requested user the caller may see. */
export const getConfigsForUsers = async (
  callerId: number,
  callerRole: string | undefined,
  callerCompanyId: number | null,
  userIds: number[]
) => {
  if (!userIds.length) return {};
  const users = await (User as any).findAll({ where: { id: userIds }, attributes: ["id", "role"], raw: true });
  const allowed = await filterActableUsers(callerId, callerRole, callerCompanyId, users);
  const ids = allowed.map((u) => Number(u.id));
  if (!ids.length) return {};
  const rows: any[] = await (UserGeoFencing as any).findAll({ where: { userId: ids } });
  const byUser = new Map(rows.map((r) => [Number(r.userId), r]));
  const out: Record<number, any> = {};
  for (const id of ids) out[id] = toPublicConfig(byUser.get(id) ?? null, id);
  return out;
};

/**
 * Bulk save (Field Operations → Bulk geo-fencing): one permission check for
 * the whole list instead of one per user, then the same validation + save as
 * the single save. Users the caller may not manage are reported, not saved.
 */
export const saveConfigsForUsers = async (
  callerId: number,
  callerRole: string | undefined,
  callerCompanyId: number | null,
  userIds: number[],
  body: any
) => {
  if (!userIds.length) throw new ServiceError("Select at least one user");
  const users = await (User as any).findAll({
    where: { id: userIds },
    attributes: ["id", "firstName", "lastName", "email", "role", "status", "isGeofenceRequired"],
  });
  const allowed = await filterActableUsers(callerId, callerRole, callerCompanyId, users);
  const allowedIds = new Set(allowed.map((u: any) => Number(u.id)));
  const failed: Array<{ userId: number; message: string }> = userIds
    .filter((id) => !allowedIds.has(id))
    .map((id) => ({ userId: id, message: "Not on your team (or not allowed)" }));

  // Validate once up front so a bad payload fails fast with one clear error.
  if (allowed.length) await applyConfigToUser(allowed[0], callerId, callerCompanyId, body);
  const rest = allowed.slice(1);
  const results = await Promise.allSettled(rest.map((u: any) => applyConfigToUser(u, callerId, callerCompanyId, body)));
  results.forEach((r, i) => {
    if (r.status === "rejected") failed.push({ userId: Number(rest[i].id), message: (r.reason as any)?.message || "Failed" });
  });
  return { saved: allowed.length - failed.filter((f) => allowedIds.has(f.userId)).length, failed };
};
