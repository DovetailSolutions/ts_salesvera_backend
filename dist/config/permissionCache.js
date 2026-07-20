"use strict";
// ============================================================
// Permission Cache (In-Memory, No Redis)
// Caches a user's permission set as a Set<string> for O(1) lookup.
// Key format: "userId:companyId"
// TTL: 15 minutes (configurable via PERMISSION_CACHE_TTL_MS env)
//
// Call invalidatePermissionCache(userId, companyId) whenever
// permissions are updated so the next request re-fetches from DB.
// ============================================================
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserPermissionsFromCache = getUserPermissionsFromCache;
exports.invalidatePermissionCache = invalidatePermissionCache;
exports.invalidateCompanyPermissionCache = invalidateCompanyPermissionCache;
exports.clearPermissionCache = clearPermissionCache;
exports.getPermissionCacheSize = getPermissionCacheSize;
const cache = new Map();
const TTL_MS = Number(process.env.PERMISSION_CACHE_TTL_MS) || 15 * 60 * 1000; // 15 min default
// --- Public helpers ---
/**
 * Returns the set of "module:action" strings for a user.
 * On cache miss, calls the provided loader and caches the result.
 */
function getUserPermissionsFromCache(userId, loader) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = `${userId}`;
        const now = Date.now();
        const entry = cache.get(key);
        if (entry && entry.expiresAt > now) {
            return entry.permissions; // Cache hit ✅
        }
        // Cache miss — load from DB
        const perms = yield loader();
        const permSet = new Set(perms);
        cache.set(key, {
            permissions: permSet,
            expiresAt: now + TTL_MS,
        });
        return permSet;
    });
}
/**
 * Invalidates the cache for a specific user+company.
 * Call this after any permission update/delete.
 */
//  companyId: number
// :${companyId}
function invalidatePermissionCache(userId) {
    const key = `${userId}`;
    cache.delete(key);
}
/**
 * Clears all cached permissions for every user in a given tenant.
 * Use when bulk-updating an entire tenant's permissions.
 */
function invalidateCompanyPermissionCache(tenantUserIds) {
    for (const uid of tenantUserIds) {
        cache.delete(`${uid}`);
    }
}
/**
 * Clears the entire cache. Useful for testing / admin operations.
 */
function clearPermissionCache() {
    cache.clear();
}
/**
 * Returns cache size — useful for monitoring.
 */
function getPermissionCacheSize() {
    return cache.size;
}
