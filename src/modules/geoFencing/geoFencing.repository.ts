import { User, UserGeoFencing } from "../../config/dbConnection";

export const findConfigByUserId = (userId: number) =>
  (UserGeoFencing as any).findOne({ where: { userId } });

export const findUserById = (userId: number) =>
  (User as any).findByPk(userId, {
    attributes: ["id", "firstName", "lastName", "email", "role", "status"],
  });

export const upsertConfig = async (
  userId: number,
  companyId: number | null,
  actorId: number,
  data: {
    enabled: boolean;
    latitude: number | null;
    longitude: number | null;
    radius: number | null;
    radiusUnit: "m" | "km";
    locationName?: string | null;
    landmark?: string | null;
    address?: string | null;
    city?: string | null;
  }
) => {
  const existing = await findConfigByUserId(userId);
  if (existing) {
    existing.enabled = data.enabled;
    existing.latitude = data.latitude;
    existing.longitude = data.longitude;
    existing.radius = data.radius;
    existing.radiusUnit = data.radiusUnit;
    if (data.locationName !== undefined) existing.locationName = data.locationName;
    if (data.landmark !== undefined) existing.landmark = data.landmark;
    if (data.address !== undefined) existing.address = data.address;
    if (data.city !== undefined) existing.city = data.city;
    existing.updatedBy = actorId;
    if (companyId != null) existing.companyId = companyId;
    await existing.save();
    return existing;
  }

  return (UserGeoFencing as any).create({
    userId,
    companyId,
    enabled: data.enabled,
    latitude: data.latitude,
    longitude: data.longitude,
    radius: data.radius,
    radiusUnit: data.radiusUnit,
    locationName: data.locationName ?? null,
    landmark: data.landmark ?? null,
    address: data.address ?? null,
    city: data.city ?? null,
    createdBy: actorId,
    updatedBy: actorId,
  });
};
