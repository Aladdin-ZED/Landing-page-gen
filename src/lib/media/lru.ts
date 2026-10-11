/** Byte-bounded LRU (Map keeps insertion order; re-inserting on hit marks an entry as most recent). */
export class ByteLru<V> {
  private map = new Map<string, { value: V; size: number }>();
  private total = 0;

  constructor(
    private readonly maxBytes: number,
    private readonly maxEntrySize: number = Math.floor(maxBytes / 8),
  ) {}

  get(key: string): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key: string, value: V, size: number): void {
    if (size > this.maxEntrySize) return;
    this.delete(key);
    this.map.set(key, { value, size });
    this.total += size;
    while (this.total > this.maxBytes) {
      const oldest = this.map.keys().next();
      if (oldest.done) break;
      this.delete(oldest.value);
    }
  }

  delete(key: string): void {
    const hit = this.map.get(key);
    if (!hit) return;
    this.total -= hit.size;
    this.map.delete(key);
  }

  get bytes(): number {
    return this.total;
  }

  get size(): number {
    return this.map.size;
  }
}
