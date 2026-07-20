import { ServiceError } from "../shared/serviceError";
import * as PreferencesRepo from "./preferences.repository";

// ============================================================
// Preferences service — the Settings module's "My Preferences" tab.
// Self-service only: every role that can reach this (admin/manager/user)
// only ever reads/writes their own row, never another user's.
// ============================================================

const PREFERENCE_KEYS = ["notifyChat", "notifyTask", "notifyMeeting"] as const;
type PreferenceKey = (typeof PREFERENCE_KEYS)[number];

const formatPreferences = (user: any) => ({
  notifyChat: user?.notifyChat !== false,
  notifyTask: user?.notifyTask !== false,
  notifyMeeting: user?.notifyMeeting !== false,
});

export const getMyPreferences = async (userId: number) => {
  const user = await PreferencesRepo.findUserPreferences(userId);
  if (!user) throw new ServiceError("User not found");
  return formatPreferences(user);
};

export const updateMyPreferences = async (userId: number, body: any) => {
  const updates: Partial<Record<PreferenceKey, boolean>> = {};
  for (const key of PREFERENCE_KEYS) {
    if (body?.[key] !== undefined) updates[key] = !!body[key];
  }
  if (Object.keys(updates).length === 0) {
    throw new ServiceError("At least one of notifyChat, notifyTask, notifyMeeting is required");
  }

  const user = await PreferencesRepo.findUserPreferences(userId);
  if (!user) throw new ServiceError("User not found");

  await PreferencesRepo.updateUserPreferences(userId, updates);
  return formatPreferences({ ...user.toJSON(), ...updates });
};
