import axios from "axios";
import { Branch } from "../../config/dbConnection";
import { haversineMeters } from "../shared/geo";

// ============================================================
// Human-readable location names for the travel timeline (see spec items
// 38/39/57): "Dovetail Solutions Office, Mohali" instead of raw lat/lng.
//
// Priority used by resolveAttendanceLocationName (item 57's list, minus the
// customer/meeting-name step — that one only applies to meeting points,
// handled directly in travelDistance.service.ts from MeetingUser's own
// name/companyName/address, never geocoded):
//   1. A company branch within 300m -> "<branchName>, <branchCity>"
//   2. Google reverse geocoding -> a real street address
//   3. null (caller falls back to "Location unavailable")
// Never throws — a geocoding failure must never break the rest of the
// travel history (spec item 39).
// ============================================================

const BRANCH_MATCH_RADIUS_METERS = 300;

export const resolveBranchLocationName = async (
  lat: number | string,
  lng: number | string,
  companyId: number | null | undefined
): Promise<string | null> => {
  if (!companyId) return null;
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (Number.isNaN(latNum) || Number.isNaN(lngNum)) return null;

  const branches = await Branch.findAll({
    where: { companyId },
    attributes: ["branchName", "branchCity", "latitude", "longitude"],
  });

  for (const branch of branches as any[]) {
    if (branch.latitude == null || branch.longitude == null) continue;
    const distance = haversineMeters(latNum, lngNum, Number(branch.latitude), Number(branch.longitude));
    if (distance <= BRANCH_MATCH_RADIUS_METERS) {
      return branch.branchCity && branch.branchCity !== branch.branchName
        ? `${branch.branchName}, ${branch.branchCity}`
        : branch.branchName;
    }
  }
  return null;
};

export const reverseGeocode = async (
  lat: number | string,
  lng: number | string
): Promise<string | null> => {
  const apiKey = process.env.GOOGLE_MAP_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await axios.get("https://maps.googleapis.com/maps/api/geocode/json", {
      params: { latlng: `${lat},${lng}`, key: apiKey },
      timeout: 8000,
    });

    const data = response.data;
    if (data?.status !== "OK" || !Array.isArray(data.results) || data.results.length === 0) {
      return null;
    }

    // Prefer a locality-level result over the maximally-precise "plus code"/
    // premise result Google often returns first — "Sector 34, Chandigarh"
    // reads better in a timeline than a specific rooftop address.
    const preferred =
      data.results.find((r: any) => r.types?.includes("sublocality") || r.types?.includes("locality")) ||
      data.results[0];

    return preferred.formatted_address || null;
  } catch (error: any) {
    console.error("reverseGeocode: request failed", error?.message);
    return null;
  }
};

export const resolveAttendanceLocationName = async (
  lat: number | string,
  lng: number | string,
  companyId: number | null | undefined
): Promise<string | null> => {
  const branchName = await resolveBranchLocationName(lat, lng, companyId);
  if (branchName) return branchName;
  return reverseGeocode(lat, lng);
};
