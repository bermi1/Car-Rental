import fs from 'fs';
import os from 'os';
import path from 'path';
import { env } from '../config/env';

/**
 * Storage abstraction. Today backed by local disk; swap the implementation
 * for an S3/GCS-backed one later without touching call sites.
 *
 * On serverless platforms (Vercel) the deployment bundle is read-only outside
 * of the OS temp dir, and that temp dir isn't shared across invocations —
 * writes succeed but don't persist. Falling back to it avoids hard crashes;
 * swapping to real object storage is the fix (see storage-driver roadmap item).
 */
export interface StorageDriver {
  save(buffer: Buffer, relativePath: string): Promise<string>;
  urlFor(relativePath: string): string;
  absolutePath(relativePath: string): string;
}

class LocalDiskStorage implements StorageDriver {
  private root = path.resolve(process.env.VERCEL ? os.tmpdir() : process.cwd(), env.uploadsDir);

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
export const uploadsRoot = path.resolve(process.env.VERCEL ? os.tmpdir() : process.cwd(), env.uploadsDir);
