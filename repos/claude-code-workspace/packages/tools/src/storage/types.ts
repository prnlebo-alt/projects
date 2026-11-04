/**
 * S3-compatible object-storage abstraction (Engineering Defaults). The
 * database stores only the returned `location` string plus metadata —
 * never raw content — per ARCHITECTURE.md §10.
 */
export interface ObjectStorage {
  readonly driverName: string;
  put(key: string, content: string | Buffer): Promise<string>;
  get(location: string): Promise<Buffer>;
}
