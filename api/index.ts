/**
 * Vercel serverless entry point for the whole API.
 *
 * The project deploys as a single Vercel app: this function serves every
 * /api/* and /uploads/* request (see the rewrites in vercel.json), and the
 * built console in web/dist is served as static files from the same domain.
 */
import app from '../backend/src/app';

export default app;
