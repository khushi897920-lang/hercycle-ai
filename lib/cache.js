/**
 * Caching Interface (Contract)
 */
export class CacheInterface {
  get(key) {
    throw new Error('Method not implemented');
  }

  set(key, value, options) {
    throw new Error('Method not implemented');
  }

  invalidate(key) {
    throw new Error('Method not implemented');
  }
}

/**
 * In-memory Least Recently Used (LRU) Cache with Time-To-Live (TTL) support.
 */
export class InMemoryLRUCache extends CacheInterface {
  constructor(options = {}) {
    super();
    this.max = options.max || 100;
    this.defaultTtl = options.ttl || 120000; // Default TTL: 120 seconds in milliseconds
    this.cache = new Map();
  }

  /**
   * Retrieves an item from the cache.
   * Updates its recency if found and not expired.
   * Returns undefined if not found or expired.
   */
  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }

    const item = this.cache.get(key);

    // Check if the item has expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    // Refresh position: move to the end of the Map (recently used)
    this.cache.delete(key);
    this.cache.set(key, item);

    return item.value;
  }

  /**
   * Caches an item with a given key and value.
   * Automatically handles LRU eviction if maximum size is reached.
   */
  set(key, value, options = {}) {
    // If key exists, delete it first to renew insertion order
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    const ttl = options.ttl !== undefined ? options.ttl : this.defaultTtl;
    const expiry = Date.now() + ttl;

    this.cache.set(key, { value, expiry });

    // Evict oldest item if capacity exceeded
    if (this.cache.size > this.max) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    return true;
  }

  /**
   * Invalidates (deletes) a cache entry.
   */
  invalidate(key) {
    return this.cache.delete(key);
  }

  /**
   * Clears all cache entries matching a specific prefix pattern.
   */
  invalidatePattern(prefix) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clears all cache entries.
   */
  clear() {
    this.cache.clear();
  }
}

// Export a singleton instance optimized with a 120-second TTL for PCOD risk calculation
export const pcodRiskCache = new InMemoryLRUCache({ max: 100, ttl: 120000 });
