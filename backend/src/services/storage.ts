import fs from 'fs';
import path from 'path';
import { env } from '../config/env';

/**
 * Storage abstraction. Today backed by local disk; swap the implementation
 * for an S3/GCS-backed one later without touching call sites.
 */
export interface StorageDriver {
  save(buffer: Buffer, relativePath: string): Promise<string>;
  urlFor(relativePath: string): string;
  absolutePath(relativePath: string): string;
}

class LocalDiskStorage implements StorageDriver {
  private root = path.resolve(process.cwd(), env.uploadsDir);

  async save(buffer: Buffer, relativePath: string): Promise<string> {
    const fullPath = path.join(this.root, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, buffer);
    return relativePath;
  }

  urlFor(relativePath: string): string {
    return `/uploads/${relativePath.replace(/\\/g, '/')}`;
  }

  absolutePath(relativePath: string): string {
    return path.join(this.root, relativePath);
  }
}

export const storage: StorageDriver = new LocalDiskStorage();
