import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ObjectStorage } from "./types.js";

const LOCATION_PREFIX = "local://";

/**
 * Local-filesystem ObjectStorage. Default Phase 1 driver
 * (STORAGE_DRIVER=local) so tests/dev never require real S3 credentials.
 * Swappable for a real S3-compatible driver behind the same interface.
 */
export class LocalObjectStorage implements ObjectStorage {
  readonly driverName = "local";
  constructor(private readonly root: string) {}

  async put(key: string, content: string | Buffer): Promise<string> {
    const path = join(this.root, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
    return `${LOCATION_PREFIX}${key}`;
  }

  async get(location: string): Promise<Buffer> {
    if (!location.startsWith(LOCATION_PREFIX)) {
      throw new Error(`Unrecognized local storage location: ${location}`);
    }
    const key = location.slice(LOCATION_PREFIX.length);
    return readFile(join(this.root, key));
  }
}
