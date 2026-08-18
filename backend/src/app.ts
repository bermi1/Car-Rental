// Side-effect import: teaches Express to route async rejections to the error
// handler. Must stay above the route imports below — see the module comment.
import './utils/asyncRoutes';

import express from 'express';
import cors from 'cors';
import { env, configError } from './config/env';
import { query } from './config/db';
import { uploadsRoot } from './services/storage';

import authRoutes from './routes/auth.routes';
import vehicleRoutes from './routes/vehicles.routes';
import clientRoutes from './routes/clients.routes';
import bookingRoutes from './routes/bookings.routes';
import documentRoutes from './routes/documents.routes';
import conditionReportRoutes from './routes/conditionReports.routes';
import contractRoutes from './routes/contracts.routes';
import depositRoutes from './routes/deposits.routes';
import staffRoutes from './routes/staff.routes';
import reportRoutes from './routes/reports.routes';
import settingsRoutes from './routes/settings.routes';
import deviceRoutes from './routes/devices.routes';
import overviewRoutes from './routes/overview.routes';
import companyRoutes from './routes/companies.routes';
import damageRoutes from './routes/damages.routes';
import paymentRoutes from './routes/payments.routes';
import trackingRoutes from './routes/tracking.routes';
import aiRoutes from './routes/ai.routes';
import expenseRoutes from './routes/expenses.routes';
import repairRoutes from './routes/repairs.routes';
import catalogueRoutes from './routes/catalogue.routes';

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());
app.use('/uploads', express.static(uploadsRoot));

app.get('/health', (_req, res) => res.json({ ok: true }));

/**
 * The endpoint to open first when a deployment misbehaves. It answers even
 * when the deployment is misconfigured, and says which of the three things is
 * wrong: the variables, the database, or neither.
 */
app.get('/api/health', async (_req, res) => {
  const problem = configError();
  if (problem) {
    return res.status(503).json({ ok: false, configured: false, error: problem });
  }
  try {
    await query('select 1');
    res.json({ ok: true, configured: true, database: 'connected' });
  } catch (err: any) {
    res.status(503).json({ ok: false, configured: true, database: 'unreachable', error: err.message });
  }
});

/**
 * Nothing else is worth attempting without configuration — a query would fail
 * with a connection error that says nothing about the cause. Refuse with the
 * reason instead, so a failed sign-in explains itself.
 */
app.use('/api', (req, res, next) => {
  const problem = configError();
  if (problem && req.path !== '/health') {
    return res.status(503).json({ error: problem });
  }
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/condition-reports', conditionReportRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/deposits', depositRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/overview', overviewRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/damages', damageRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/repairs', repairRoutes);
// Public: no token. See the module comment for what it deliberately omits.
app.use('/api/catalogue', catalogueRoutes);

app.use((req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.path}` }));

/**
 * Turns the errors we can recognise into something the caller can act on.
 * Postgres reports a bad enum or a malformed UUID as a data error, which is
 * the client's mistake, not ours — answering 500 sends people hunting for a
 * server fault that doesn't exist.
 */
const CLIENT_DATA_ERRORS: Record<string, string> = {
  '22P02': 'One of the values sent is not one this field accepts.',
  '23503': 'That references something which does not exist.',
  '23505': 'That already exists.',
  '23514': 'One of the values sent is outside the allowed range.',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const friendly = err?.code && CLIENT_DATA_ERRORS[err.code];
  if (friendly) {
    console.warn(`Rejected request: ${err.code} ${err.message}`);
    return res.status(400).json({ error: friendly });
  }
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

export default app;
