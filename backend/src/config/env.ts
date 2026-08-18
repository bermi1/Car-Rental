import dotenv from 'dotenv';
dotenv.config();

/**
 * Deployed environments must supply their own DATABASE_URL and JWT_SECRET.
 * The local defaults below are a dev convenience only — silently falling back
 * to them in production produces an API that boots fine and then fails every
 * request, which is far harder to diagnose than refusing to serve.
 *
 * Missing configuration is recorded rather than thrown. Throwing here kills
 * the module before the Express app is even constructed, which on a serverless
 * host surfaces as an opaque FUNCTION_INVOCATION_FAILED with no clue as to
 * which variable is absent — and takes /api/health down with it, in precisely
 * the situation that endpoint exists to explain. The app boots instead, health
 * names what is missing, and every other route refuses with the same message.
 */
const isServerless = Boolean(process.env.VERCEL);
const isProduction = process.env.NODE_ENV === 'production' || isServerless;

const missing: string[] = [];

function required(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProduction) {
    missing.push(name);
    // Deliberately empty, never the dev fallback: connecting to localhost from
    // a deployed function is the silent failure this guard exists to prevent.
    return '';
  }
  return devFallback;
}

export const env = {
  port: Number(process.env.PORT) || 4000,
  databaseUrl: required('DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/rentaldb'),
  jwtSecret: required('JWT_SECRET', 'dev-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  uploadsDir: process.env.UPLOADS_DIR || 'uploads',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  // Optional. Without it the AI-assist endpoints report themselves unavailable
  // and the console falls back to manual entry — nothing else breaks.
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  /** Names of required variables this deployment did not supply. */
  missing,
};

/** Human-readable reason the API cannot serve, or null when configured. */
export function configError(): string | null {
  if (!missing.length) return null;
  return `Missing environment variable${missing.length > 1 ? 's' : ''}: ${missing.join(
    ', '
  )}. Set ${missing.length > 1 ? 'them' : 'it'} in the deployment's environment variables — on Vercel, tick every environment (Production, Preview and Development), then redeploy.`;
}
