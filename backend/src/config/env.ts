import dotenv from 'dotenv';
dotenv.config();

/**
 * Deployed environments must supply their own DATABASE_URL and JWT_SECRET.
 * The local defaults below are a dev convenience only — silently falling back
 * to them in production produces an API that boots fine and then fails every
 * request, which is far harder to diagnose than refusing to start.
 */
const isServerless = Boolean(process.env.VERCEL);
const isProduction = process.env.NODE_ENV === 'production' || isServerless;

function required(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProduction) {
    throw new Error(
      `${name} is not set. Configure it in the deployment's environment variables.`
    );
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
};
