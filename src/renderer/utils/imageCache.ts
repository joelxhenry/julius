import { IpcChannel } from '../../shared/types/ipc';

interface CacheEntry {
  data: string;
  timestamp: number;
}

const DEFAULT_MAX_SIZE = 100;
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * LRU Cache for inventory thumbnails
 * Stores base64 image data with automatic eviction of least recently used entries
 */
class ImageCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private ttlMs: number;
  private loadingPromises: Map<string, Promise<string | null>>;

  constructor(maxSize: number = DEFAULT_MAX_SIZE, ttlMs: number = DEFAULT_TTL_MS) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.loadingPromises = new Map();
  }

  /**
   * Generate a cache key for a SKU
   */
  private getKey(sku: string, isVariant: boolean): string {
    return `${isVariant ? 'variant' : 'inventory'}:${sku}`;
  }

  /**
   * Check if an entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > this.ttlMs;
  }

  /**
   * Get a thumbnail from cache
   */
  get(sku: string, isVariant: boolean): string | null {
    const key = this.getKey(sku, isVariant);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used) by re-inserting
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data;
  }

  /**
   * Set a thumbnail in cache
   */
  set(sku: string, isVariant: boolean, data: string): void {
    const key = this.getKey(sku, isVariant);

    // Evict LRU if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Check if a thumbnail is in cache (and not expired)
   */
  has(sku: string, isVariant: boolean): boolean {
    const key = this.getKey(sku, isVariant);
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a thumbnail from cache
   */
  delete(sku: string, isVariant: boolean): void {
    const key = this.getKey(sku, isVariant);
    this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.loadingPromises.clear();
  }

  /**
   * Get the current cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Load a single thumbnail, using cache or fetching from backend
   */
  async loadThumbnail(sku: string, isVariant: boolean): Promise<string | null> {
    // Check cache first
    const cached = this.get(sku, isVariant);
    if (cached) {
      return cached;
    }

    const key = this.getKey(sku, isVariant);

    // Check if already loading
    const existing = this.loadingPromises.get(key);
    if (existing) {
      return existing;
    }

    // Fetch from backend
    const loadPromise = (async () => {
      try {
        const result = await window.electron.invoke(IpcChannel.GET_PRIMARY_THUMBNAIL, {
          sku,
          isVariant,
        });

        if (result.success && result.data) {
          this.set(sku, isVariant, result.data);
          return result.data;
        }
        return null;
      } catch (error) {
        console.error('Failed to load thumbnail:', error);
        return null;
      } finally {
        this.loadingPromises.delete(key);
      }
    })();

    this.loadingPromises.set(key, loadPromise);
    return loadPromise;
  }

  /**
   * Preload thumbnails for multiple SKUs in a batch
   * This is more efficient than loading one by one
   */
  async preloadThumbnails(
    items: Array<{ sku: string; isVariant: boolean }>
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();

    // Filter to only items not in cache
    const toLoad = items.filter(item => !this.has(item.sku, item.isVariant));

    if (toLoad.length === 0) {
      // All in cache, return cached values
      for (const item of items) {
        const cached = this.get(item.sku, item.isVariant);
        if (cached) {
          const key = this.getKey(item.sku, item.isVariant);
          result.set(key, cached);
        }
      }
      return result;
    }

    try {
      // Fetch from backend in batch
      const response = await window.electron.invoke(IpcChannel.GET_PRIMARY_THUMBNAILS_BATCH, {
        items: toLoad,
      });

      if (response.success && response.data) {
        // Store in cache and build result
        for (const [key, data] of Object.entries(response.data)) {
          // Parse key to get sku and isVariant
          const [type, sku] = key.split(':');
          const isVariant = type === 'variant';
          this.set(sku, isVariant, data as string);
          result.set(key, data as string);
        }
      }

      // Add cached items to result
      for (const item of items) {
        const key = this.getKey(item.sku, item.isVariant);
        if (!result.has(key)) {
          const cached = this.get(item.sku, item.isVariant);
          if (cached) {
            result.set(key, cached);
          }
        }
      }
    } catch (error) {
      console.error('Failed to preload thumbnails:', error);
    }

    return result;
  }

  /**
   * Invalidate cache for a specific SKU (call after upload/delete)
   */
  invalidate(sku: string, isVariant: boolean): void {
    this.delete(sku, isVariant);
  }
}

// Export singleton instance
export const imageCache = new ImageCache();

// Export class for testing or custom instances
export { ImageCache };
