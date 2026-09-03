import axios from "axios";

export interface DrivingDistanceResult {
  success: boolean;
  distanceMeters?: number;
  distanceKm?: number;
  km?: number;
  duration?: string;
  error?: string;
}

export const isValidCoordinate = (lat: unknown, lng: unknown): boolean => {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  if (Number.isNaN(latNum) || Number.isNaN(lngNum)) return false;
  return latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180;
};

export const calculateDrivingDistance = async (
  originLat: number | string,
  originLng: number | string,
  destLat: number | string,
  destLng: number | string
): Promise<DrivingDistanceResult> => {
  if (!isValidCoordinate(originLat, originLng) || !isValidCoordinate(destLat, destLng)) {
    return { success: false, error: "Invalid coordinates provided" };
  }

  const oLat = Number(originLat);
  const oLng = Number(originLng);
  const dLat = Number(destLat);
  const dLng = Number(destLng);

  const apiKey = process.env.GOOGLE_MAP_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("calculateDrivingDistance: GOOGLE_MAP_API_KEY is not set in environment");
    return { success: false, error: "Google Maps API Key not configured" };
  }

  // 1. Try Google Compute Routes API (v2) with FieldMask Header
  try {
    const response = await axios.post(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        origin: {
          location: {
            latLng: {
              latitude: oLat,
              longitude: oLng,
            },
          },
        },
        destination: {
          location: {
            latLng: {
              latitude: dLat,
              longitude: dLng,
            },
          },
        },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
        },
        timeout: 10000,
      }
    );

    const route = response.data?.routes?.[0];
    if (route && typeof route.distanceMeters === "number") {
      const distanceMeters = route.distanceMeters;
      const distanceKm = Number((distanceMeters / 1000).toFixed(3));
      const duration = route.duration || null;
      return { success: true, distanceMeters, distanceKm, km: distanceKm, duration };
    }
  } catch (err: any) {
    console.warn("Google Compute Routes API error, falling back to Distance Matrix:", err?.response?.data || err?.message);
  }

  // 2. Fallback to Google Distance Matrix API if Compute Routes API fails
  try {
    const matrixRes = await axios.get("https://maps.googleapis.com/maps/api/distancematrix/json", {
      params: {
        origins: `${oLat},${oLng}`,
        destinations: `${dLat},${dLng}`,
        key: apiKey,
      },
      timeout: 10000,
    });

    const element = matrixRes.data?.rows?.[0]?.elements?.[0];
    if (matrixRes.data?.status === "OK" && element?.status === "OK") {
      const distanceMeters = element.distance.value;
      const distanceKm = Number((distanceMeters / 1000).toFixed(3));
      const duration = element.duration?.text || null;
      return { success: true, distanceMeters, distanceKm, duration };
    }
  } catch (err: any) {
    console.error("Google Distance Matrix API fallback failed:", err?.message);
  }

  return { success: false, error: "Failed to calculate driving distance between points" };
};
