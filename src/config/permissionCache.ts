// ============================================================
// Permission Cache (In-Memory, No Redis)
// Caches a user's permission set as a Set<string> for O(1) lookup.
// Key format: "userId:companyId"
// TTL: 15 minutes (configurable via PERMISSION_CACHE_TTL_MS env)
//
// Call invalidatePermissionCache(userId, companyId) whenever
// permissions are updated so the next request re-fetches from DB.
// ============================================================

interface CacheEntry {
  permissions: Set<string>; // "module:action" strings, e.g. "attendance:view"
  expiresAt: number;        // Unix timestamp in ms
}

const cache = new Map<string, CacheEntry>();

const TTL_MS = Number(process.env.PERMISSION_CACHE_TTL_MS) || 15 * 60 * 1000; // 15 min default

// --- Public helpers ---

/**
 * Returns the set of "module:action" strings for a user.
 * On cache miss, calls the provided loader and caches the result.
 */
export async function getUserPermissionsFromCache(
  userId: number,
  companyId: number,
  loader: () => Promise<string[]>
): Promise<Set<string>> {
  const key = `${userId}:${companyId}`;
  const now = Date.now();

  const entry = cache.get(key);
  if (entry && entry.expiresAt > now) {
    return entry.permissions; // Cache hit ✅
  }

  // Cache miss — load from DB
  const perms = await loader();
  const permSet = new Set(perms);

  cache.set(key, {
    permissions: permSet,
    expiresAt: now + TTL_MS,
  });

  return permSet;
}

/**
 * Invalidates the cache for a specific user+company.
 * Call this after any permission update/delete.
 */
export function invalidatePermissionCache(userId: number, companyId: number): void {
  const key = `${userId}:${companyId}`;
  cache.delete(key);
}

/**
 * Invalidates ALL cached entries for a given company.
 * Use when bulk-updating an entire company's permissions.
 */
export function invalidateCompanyPermissionCache(companyId: number): void {
  for (const key of cache.keys()) {
    if (key.endsWith(`:${companyId}`)) {
      cache.delete(key);
    }
  }
}

/**
 * Clears the entire cache. Useful for testing / admin operations.
 */
export function clearPermissionCache(): void {
  cache.clear();
}

/**
 * Returns cache size — useful for monitoring.
 */
export function getPermissionCacheSize(): number {
  return cache.size;
}
