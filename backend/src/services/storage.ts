import fs from 'fs';
import os from 'os';
import path from 'path';
import { env } from '../config/env';

/**
 * Where uploaded files live.
 *
 * Local disk works on a server you own. It does not work on a serverless host:
 * the bundle is read-only outside the OS temp directory, and that directory is
 * not shared between invocations — a write succeeds and the file is gone by the
 * next request. Every customer's ID photo, every walkaround video, every logo
 * disappeared silently.
 *
 * So the driver is chosen at boot: object storage when the deployment supplies
 * credentials for it, local disk otherwise. Call sites do not know or care
 * which.
 */

export interface StoredFile {
  /** What the browser should be sent to. Absolute for public object storage. */
  url: string;
}

export interface StorageDriver {
  readonly name: string;
  save(buffer: Buffer, relativePath: string, contentType?: string): Promise<string>;
  urlFor(relativePath: string): string;
  /**
   * How `/uploads/<path>` should be answered: a local file to stream, a URL to
   * redirect to, or null when the file cannot be found.
   */
  resolve(relativePath: string): Promise<{ file: string } | { redirect: string } | null>;
}

/**
 * Which files the world may read.
 *
 * A company's logo and its cars are on a public catalogue by design. Nothing
 * else is: a customer's national ID, their driving licence, a signed contract
 * and a damage photograph are all evidence about a named person, and they are
 * kept in a bucket with no public read at all.
 */
const PUBLIC_PREFIXES = ['logos/', 'vehicles/'];

function isPublic(relativePath: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => relativePath.startsWith(prefix));
}

/* ----------------------------- local disk ------------------------------ */

class LocalDiskStorage implements StorageDriver {
  readonly name = 'local disk';
  readonly root = path.resolve(process.env.VERCEL ? os.tmpdir() : process.cwd(), env.uploadsDir);

  async save(buffer: Buffer, relativePath: string): Promise<string> {
    const safe = safeRelativePath(relativePath);
    const fullPath = path.join(this.root, safe);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, buffer);
    return safe;
  }

  urlFor(relativePath: string): string {
    return `/uploads/${safeRelativePath(relativePath)}`;
  }

  async resolve(relativePath: string) {
    const fullPath = path.join(this.root, safeRelativePath(relativePath));
    // Refuse anything that climbed out of the uploads root.
    if (!fullPath.startsWith(this.root)) return null;
    return fs.existsSync(fullPath) ? { file: fullPath } : null;
  }
}

/* --------------------------- Supabase Storage --------------------------- */

class SupabaseStorage implements StorageDriver {
  readonly name = 'Supabase Storage';
  private readonly base: string;
  private readonly key: string;
  private readonly publicBucket: string;
  private readonly privateBucket: string;
  /** Buckets already known to exist, so the check costs one request per boot. */
  private readonly ensured = new Set<string>();

  constructor(url: string, key: string) {
    this.base = url.replace(/\/+$/, '');
    this.key = key;
    this.publicBucket = process.env.SUPABASE_PUBLIC_BUCKET || 'rental-public';
    this.privateBucket = process.env.SUPABASE_PRIVATE_BUCKET || 'rental-private';
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { Authorization: `Bearer ${this.key}`, apikey: this.key, ...extra };
  }

  private bucketFor(relativePath: string): string {
    return isPublic(relativePath) ? this.publicBucket : this.privateBucket;
  }

  /**
   * Creates the bucket if this project has not got one yet.
   *
   * Doing it here rather than asking someone to click through a dashboard means
   * a fresh deployment works on its first upload. A 409 is the expected answer
   * once it exists, and is not an error.
   */
  private async ensureBucket(bucket: string): Promise<void> {
    if (this.ensured.has(bucket)) return;

    const res = await fetch(`${this.base}/storage/v1/bucket`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        id: bucket,
        name: bucket,
        public: bucket === this.publicBucket,
        file_size_limit: 15 * 1024 * 1024,
      }),
    });

    if (res.ok || res.status === 409) {
      this.ensured.add(bucket);
      return;
    }
    // A bucket that already exists can also come back as 400 with a duplicate
    // message, depending on the project's Postgres version.
    const body = await res.text();
    if (/exists|duplicate/i.test(body)) {
      this.ensured.add(bucket);
      return;
    }
    throw new Error(`Could not create storage bucket ${bucket}: ${res.status} ${body}`);
  }

  async save(buffer: Buffer, relativePath: string, contentType?: string): Promise<string> {
    const safe = safeRelativePath(relativePath);
    const bucket = this.bucketFor(safe);
    await this.ensureBucket(bucket);

    const res = await fetch(`${this.base}/storage/v1/object/${bucket}/${encodePath(safe)}`, {
      method: 'POST',
      headers: this.headers({
        'Content-Type': contentType || 'application/octet-stream',
        // Re-uploading the same path replaces it rather than failing, so a
        // retried request cannot leave the caller stuck.
        'x-upsert': 'true',
      }),
      body: new Uint8Array(buffer),
    });

    if (!res.ok) {
      throw new Error(`Upload failed (${res.status}): ${await res.text()}`);
    }
    return safe;
  }

  urlFor(relativePath: string): string {
    // Public files are served straight off the CDN. Private ones keep the
    // /uploads path so nothing that can read the database can read the file.
    const safe = safeRelativePath(relativePath);
    return isPublic(safe)
      ? `${this.base}/storage/v1/object/public/${this.publicBucket}/${encodePath(safe)}`
      : `/uploads/${safe}`;
  }

  /**
   * Private files are handed out as a short-lived signed URL rather than a
   * permanent one, so a link that escapes into a WhatsApp group stops working.
   */
  async resolve(relativePath: string) {
    const safe = safeRelativePath(relativePath);
    if (isPublic(safe)) {
      return { redirect: this.urlFor(safe) };
    }

    const res = await fetch(
      `${this.base}/storage/v1/object/sign/${this.privateBucket}/${encodePath(safe)}`,
      {
        method: 'POST',
        headers: this.headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ expiresIn: 60 * 10 }),
      }
    );
    if (!res.ok) return null;

    const { signedURL } = (await res.json()) as { signedURL: string };
    return { redirect: `${this.base}/storage/v1${signedURL}` };
  }
}

/**
 * Makes a caller-supplied path safe to store under.
 *
 * Several call sites build the path from the uploaded file's own name, which
 * is attacker-controlled: it can carry `../`, a leading slash, or characters
 * that mean something to a URL. Cleaning it here rather than at each call site
 * means a new upload route cannot forget to.
 */
export function safeRelativePath(relativePath: string): string {
  return relativePath
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.replace(/[^A-Za-z0-9._-]/g, '_'))
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .join('/');
}

/** Percent-encodes each segment, leaving the slashes as separators. */
function encodePath(relativePath: string): string {
  return relativePath
    .replace(/\\/g, '/')
    .split('/')
    .map(encodeURIComponent)
    .join('/');
}

/* ------------------------------ selection ------------------------------- */

const SERVICE_KEY_ALIASES = ['SUPABASE_SERVICE_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];

function chooseDriver(): StorageDriver {
  const url = process.env.SUPABASE_URL;
  const key = SERVICE_KEY_ALIASES.map((name) => process.env[name]).find(Boolean);

  if (url && key) return new SupabaseStorage(url, key);

  if (process.env.VERCEL) {
    // Not fatal — the rest of the system works. But files written here are gone
    // by the next request, and that is worth saying once rather than being
    // discovered when a customer's ID photo cannot be found.
    console.warn(
      'No object storage configured (SUPABASE_URL + SUPABASE_SERVICE_KEY). ' +
        'Uploads will be written to a temporary directory and will NOT survive.'
    );
  }
  return new LocalDiskStorage();
}

export const storage: StorageDriver = chooseDriver();

/** Only meaningful for the local driver; kept for the static route's fallback. */
export const uploadsRoot = path.resolve(process.env.VERCEL ? os.tmpdir() : process.cwd(), env.uploadsDir);
